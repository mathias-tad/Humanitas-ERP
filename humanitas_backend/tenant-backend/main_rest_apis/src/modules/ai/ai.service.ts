import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleContextBuilderService } from './services/role-context-builder.service';
import { AgentToolRouterService } from './services/agent-tool-router.service';
import { AiDbQueryService } from './services/ai-db-query.service';
import { AiConversationService } from './services/ai-conversation.service';
import { AiUsageService } from './services/ai-usage.service';
import { AiSettingsFetchService, ResolvedAiSettings } from './services/ai-settings-fetch.service';
import { AiAnalyticsService } from './services/ai-analytics.service';
import { AiActionService } from './services/ai-action.service';
import { AiFileParserService } from './services/ai-file-parser.service';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

@Injectable()
export class AiService {
  constructor(
    private roleContextBuilder: RoleContextBuilderService,
    private toolRouter: AgentToolRouterService,
    private dbQueryService: AiDbQueryService,
    private conversationService: AiConversationService,
    private usageService: AiUsageService,
    private aiSettingsFetch: AiSettingsFetchService,
    private analyticsService: AiAnalyticsService,
    private actionService: AiActionService,
    private fileParserService: AiFileParserService,
  ) {}

  async processRequest(
    tenantId: string,
    tenantSlug: string,
    userId: string,
    userRole: string,
    message: string,
    userName: string,
    conversationId?: string,
  ): Promise<{ response: string; conversationId: string }> {
    // 0. Check Budget
    const budget = await this.usageService.checkTokenBudget(tenantId);
    if (!budget.allowed) {
      throw new ForbiddenException('Your AI token budget for this billing period has been exhausted.');
    }

    const startTime = Date.now();

    // 1. Fetch AI settings (tenant-specific or global fallback)
    const aiSettings = await this.aiSettingsFetch.getSettings(tenantSlug);

    if (!aiSettings.is_enabled || (!aiSettings.api_key && aiSettings.provider !== 'ollama')) {
      return {
        response: 'AI assistant is not configured yet. Please contact your administrator to set up an AI provider in the Admin Dashboard.',
        conversationId: conversationId || 'no-config',
      };
    }

    // 2. Build role context
    const roleContext = await this.roleContextBuilder.buildContext(tenantSlug, userId, userRole);

    // 3. Setup Conversation History
    let convoId = conversationId;
    let pastMessages: (HumanMessage | AIMessage)[] = [];
    if (!convoId) {
      const convo = await this.conversationService.createConversation(tenantSlug, userId, message.substring(0, 50));
      convoId = convo.id;
    } else {
      const convo = await this.conversationService.getConversation(tenantSlug, userId, convoId);
      if (convo && convo.messages) {
        pastMessages = convo.messages.map(m =>
          m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
        );
      }
    }

    // Save user message to history
    await this.conversationService.saveMessage(tenantSlug, convoId, 'user', message);

    const modelName = aiSettings.model || 'gemini-1.5-pro-latest';
    const temperature = aiSettings.temperature ?? 0.7;

    try {
      // All providers go through LangChain agent so they have tool access
      const content = await this.callViaLangchain(
        aiSettings,
        tenantSlug,
        roleContext,
        pastMessages,
        message,
        modelName,
        temperature,
        userId,
      );

      // Save AI response
      await this.conversationService.saveMessage(tenantSlug, convoId, 'ai', content);

      // Log Usage
      const promptChars = message.length + roleContext.length;
      const responseChars = content.length;

      await this.usageService.logUsage({
        tenant_id: tenantId,
        user_id: userId,
        user_name: userName,
        user_role: userRole,
        provider: aiSettings.provider,
        model: modelName,
        feature: 'chat',
        prompt_tokens: Math.ceil(promptChars / 4),
        completion_tokens: Math.ceil(responseChars / 4),
        total_tokens: Math.ceil((promptChars + responseChars) / 4),
        cost_usd: 0.002 * (Math.ceil((promptChars + responseChars) / 4) / 1000),
        duration_ms: Date.now() - startTime,
        status: 'success',
      });

      return { response: content, conversationId: convoId };
    } catch (error) {
      console.error('AI Error:', error);

      await this.usageService.logUsage({
        tenant_id: tenantId,
        user_id: userId,
        user_name: userName,
        user_role: userRole,
        provider: aiSettings.provider,
        model: modelName,
        feature: 'chat',
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        duration_ms: Date.now() - startTime,
        status: 'error',
        error_message: error.message,
      });

      throw new BadRequestException(`Failed to process AI request: ${error.message}`);
    }
  }

  /**
   * Process a request that includes an uploaded file (PDF, DOCX, or image).
   */
  async processRequestWithFile(
    tenantId: string,
    tenantSlug: string,
    userId: string,
    userRole: string,
    message: string,
    userName: string,
    fileBuffer: Buffer,
    fileMimetype: string,
    fileOriginalname: string,
    conversationId?: string,
  ): Promise<{ response: string; conversationId: string }> {
    const parsed = await this.fileParserService.extractText(fileBuffer, fileMimetype, fileOriginalname);

    let enrichedMessage: string;
    if (parsed.isImage) {
      // For images, prepend a note and attach base64 in message for vision models
      enrichedMessage = `[The user has attached an image for analysis.]

User message: ${message || 'Please analyse this image and describe what you see.'}

[IMAGE_BASE64:${parsed.base64}]`;
    } else {
      const truncated = parsed.text.length > 12000 ? parsed.text.substring(0, 12000) + '\n...[content truncated]' : parsed.text;
      enrichedMessage = `[The user has uploaded a document (${fileOriginalname}). Its extracted text content is below:]

---
${truncated}
---

User message: ${message || 'Please analyse this document and provide a summary.'}`;
    }

    return this.processRequest(tenantId, tenantSlug, userId, userRole, enrichedMessage, userName, conversationId);
  }

  /**
   * LangChain agent for Gemini, Vertex, OpenAI, Anthropic, and Ollama providers.
   */
  private async callViaLangchain(
    settings: ResolvedAiSettings,
    tenantSlug: string,
    roleContext: string,
    pastMessages: (HumanMessage | AIMessage)[],
    message: string,
    modelName: string,
    temperature: number,
    userId: string,
  ): Promise<string> {
    let llm: any;

    if (settings.provider === 'ollama') {
      llm = new ChatOllama({
        model: modelName || 'llama3',
        temperature,
        baseUrl: settings.endpoint_url || 'http://localhost:11434',
      });
    } else if (settings.provider === 'vertex') {
      // For Vertex AI configured with an API Key (via Admin Dashboard),
      // we route through ChatGoogleGenerativeAI instead of ChatVertexAI to prevent 
      // the @langchain/google-webauth ADC missing credentials crash (ERR_INVALID_URL).
      // We manually overwrite the internal client to point to the Vertex AI endpoint so 
      // it correctly bills to the Google Cloud project (e.g. $300 free credits) instead of AI Studio.
      llm = new ChatGoogleGenerativeAI({
        model: modelName || 'gemini-1.5-pro-001',
        temperature,
        apiKey: settings.api_key,
      });

      if (settings.gcp_project_id && settings.api_key) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const gcpLocation = settings.gcp_location || 'us-central1';
        
        // Exact Vertex AI Endpoint Format: https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google
        const baseUrl = `https://${gcpLocation}-aiplatform.googleapis.com`;
        const apiVersion = `v1/projects/${settings.gcp_project_id}/locations/${gcpLocation}/publishers/google`;

        (llm as any).client = new GoogleGenerativeAI(settings.api_key).getGenerativeModel(
          { model: modelName || 'gemini-1.5-pro-001' },
          { baseUrl, apiVersion }
        );
      }
    } else if (settings.provider === 'openai') {
      llm = new ChatOpenAI({
        model: modelName,
        temperature,
        apiKey: settings.api_key,
        configuration: settings.endpoint_url ? { baseURL: settings.endpoint_url } : undefined,
      });
    } else if (settings.provider === 'anthropic') {
      llm = new ChatAnthropic({
        model: modelName,
        temperature,
        apiKey: settings.api_key,
      });
    } else {
      // Default: Gemini (google-genai)
      llm = new ChatGoogleGenerativeAI({
        model: modelName,
        temperature,
        apiKey: settings.api_key,
      });
    }

    const uiTools = this.toolRouter.getTools(tenantSlug, roleContext);
    const dbTools = [this.dbQueryService.getDbTool(tenantSlug, roleContext)];
    const analyticsTools = this.analyticsService.getAnalyticsTools(tenantSlug);
    const actionTools = this.actionService.getActionTools(tenantSlug, userId);

    const tools = [...uiTools, ...dbTools, ...analyticsTools, ...actionTools];

    const agent = createReactAgent({ llm, tools });

    const systemMessage = new SystemMessage(`You are a helpful AI assistant for the Humanitas ERP system.
You are powered by the AI Provider: ${settings.provider.toUpperCase()}, using Model: ${modelName}.

Context about the user making this request:
${roleContext}

=== HUMANITAS NAVIGATION MAP ===
You have full knowledge of every page and sidebar section available in the system. Use this to guide users precisely.

**SIDEBAR - APPLICATION**
- Dashboard → /dashboard — Home overview with quick stats (attendance, leave, tasks, scheduling)
- Accounts → /accounts — View, create, edit, delete users/employees. THIS IS WHERE YOU ADD/MANAGE USERS. Requires: view_users / create_users / edit_users / delete_users
- Calendar → /calendar — Company-wide calendar. Open to all.
- Scheduling → /scheduling — Manage work rosters and shift scheduling. Requires: manage_roster / view_roster
- Announcements → /announcements — View and post company announcements. Requires: view_announcements
- Events → /events — Company events management. Requires: view_events
- Devices → /devices — Biometric/attendance device management. Requires: view_devices / manage_devices

**SIDEBAR - HR (Expandable section)**
  Attendance sub-section:
  - Attendance → /attendance/view — View all employee attendance records. Requires: view_attendance
  - My Attendance → /attendance/my-attendance — View your own attendance. Requires: view_my_attendance
  - Real-Time OT Monitor → /attendance/overtime-monitor — Live overtime tracker. Requires: view_overtime_workers
  - QR Display → /attendance/qr-display — QR code for clock-in. Requires: view_qr_display
  - Clock In → /attendance/clock-in — Manual clock in/out page. Requires: clock_in_out

  Leave sub-section:
  - Leave Requests → /leave/requests — Review and approve leave requests. Requires: view_leave / approve_leave
  - My Requests → /leave/my-requests — Submit and view your own leave requests. Requires: view_my_leave / request_leave
  - Leave Balances → /leave/balances — View all employee leave balances. Requires: manage_leave / view_leave
  - Workflow Settings → /leave/workflow — Configure leave approval workflow. Requires: manage_leave / approve_leave

  Payroll sub-section:
  - Payroll Dashboard → /payroll/dashboard — Payroll overview and reports. Requires: view_payroll / view_payroll_dashboard
  - Run Payroll → /payroll/run — Execute payroll processing cycle. Requires: run_payroll
  - My Payslip → /payroll/my-payslip — View your own payslips. Requires: view_my_payslip
  - My Loans → /my-loans — View your loan repayments. Open to all.
  - Per Diem Claims → /per-diem-claims — Submit expense/per diem claims. Requires: view_my_payslip
  - Review Claims → /admin/per-diem-claims — Approve/reject per diem claims. Requires: manage_payroll
  - Loan Management → /payroll/loans — Manage employee loans. Requires: manage_loans
  - Loan Workflow → /payroll/loan-workflow — Configure loan approval workflow. Requires: manage_loan_workflows

  Recruitment sub-section:
  - AI Screening → /recruitment — AI-powered candidate screening and job postings. Requires: manage_recruitment
    - Job Leaderboard → /recruitment/jobs/:id/leaderboard — Candidate ranking
    - Form Builder → /recruitment/jobs/:id/form-builder — Custom application form

**SIDEBAR - PMS (Performance Management, expandable)**
- PMS Dashboard → /pms/dashboard — Team performance overview. Requires: view_pms_dashboard
- My Tasks → /pms/my-tasks — View your own assigned tasks. Requires: view_my_tasks
- All Tasks → /pms/all-tasks — View all tasks across the company. Requires: view_all_tasks
- Review Queue → /pms/review-queue — Review and approve submitted tasks. Requires: review_tasks
- Reports → /pms/reports — Performance analytics and reports. Requires: view_pms_reports
- Projects → /pms/projects — Project management view. Requires: view_projects
- My Team → /pms/team — View your own team members. Requires: view_pms_team
- Teams → /pms/teams — Manage all teams. Requires: view_teams
- PMS Settings → /pms/settings — Configure PMS rules and metrics. Requires: manage_pms_settings

**SIDEBAR - SYSTEM**
- Access Control → /accesscontrol — Manage roles and permissions. Requires: view_roles / edit_roles / create_roles / delete_roles
- Settings → /settings — General system settings. Requires: view_general_settings / edit_general_settings
- System Logs → /system-logs — View audit and system logs. Requires: view_logs

=== DATABASE KNOWLEDGE & ACTIONS ===
You have direct access to the database via query tools. The schema includes:
- **Users**: users, departments, employee_categories
- **PMS (Tasks/Projects)**: pms_projects, pms_tasks, pms_teams, pms_sprints, pms_project_members
- **Leave**: leave_requests
- **Attendance**: attendance_records, schedules, shift_patterns, shifts
- **Payroll**: payroll_runs, payroll_items, loans, user_incomes, per_diem_claims

You have powerful tools available:
- \`query_tenant_database\`: Execute custom SQL queries. Use this for ANY data question.
- \`analyze_task_distribution\`: Analyzes workload across all users (active vs overdue tasks).
- \`analyze_user_experience\`: Evaluates a user's experience based on past completed tasks and on-time rate.
- \`suggest_task_allocation\`: Recommends who should take a task based on current workload and past performance.
- \`get_all_users_kpi\`: Gets performance stats for all users.
- \`analyze_projects\`: Analyzes project progress.

=== ACTION TOOLS (YOU CAN DO THESE FOR THE USER) ===
**Users Module:**
- \`create_user\`: Create a new employee. Ask for full_name and email first.
- \`update_user\`: Update employee details (position, department, active status). Ask for user_id.
- \`deactivate_user\`: Disable a user account. Ask for user_id.

**Leave Module:**
- \`submit_leave_request\`: Submit a leave request. Ask for leave_type_name, start_date, end_date. Defaults to current user if no user_id given.
- \`approve_leave_request\`: Approve a pending leave request. Ask for leave_request_id.
- \`reject_leave_request\`: Reject a leave request. Ask for leave_request_id and optionally a reason.

**Announcements Module:**
- \`post_announcement\`: Post a system-wide announcement. Ask for title and content.

**Payroll Module:**
- \`add_loan\`: Register an employee loan. Ask for total_amount and monthly_deduction.
- \`initiate_payroll_run\`: Start a payroll run. Ask for month and year.

**PMS (Project Management) Module:**
- \`create_project\`: Create a new project. Ask for name.
- \`create_task\`: Create a new task. Ask for title and project_id.
- \`update_task_status\`: Change a task's status (To Do, In Progress, Done, Blocked, etc.). Ask for task_id and status.
- \`create_sprint\`: Create a sprint inside a project. Ask for project_id, name, start_date, end_date.
- \`add_project_member\`: Add a user to a project. Ask for project_id and user_id.

**Leave Module (additional):**
- \`cancel_leave_request\`: Cancel a leave request. Ask for leave_request_id.

**Scheduling Module:**
- \`create_shift\`: Create a new shift definition (name, start/end time). Ask for name, start_time, end_time.
- \`assign_shift\`: Assign an employee to a shift on a given date. Ask for user_id, shift_id, date.
- \`mark_day_off\`: Mark a day off for an employee. Ask for user_id and date.

**Overtime Module:**
- \`log_overtime\`: Log overtime hours for an employee. Ask for date and hours breakdown.

**Holidays Module:**
- \`add_holiday\`: Add a public/company holiday to the calendar. Ask for name and date.

==== GENERATING DOCUMENTS ===
CRITICAL: When a user asks you to create, generate, produce, prepare, or export ANY document, report, file, PDF, Word document, or Excel spreadsheet — you MUST ALWAYS output the special document tag below. NEVER tell the user to call an API or use a different endpoint. NEVER say "I cannot send binary files". NEVER say "use the dedicated endpoint". Just output the tag and a short friendly message.

The tag format is:
[DOCUMENT:format:detailed_prompt]

Rules:
- 'format' must be exactly one of: pdf, docx, excel
- 'detailed_prompt' must be a detailed description of the document to generate (include what data to fetch, how to structure it, what columns/sections to include)
- Always pick the format the user asked for. If they say "Word" use docx. If they say "spreadsheet" or "Excel" use excel. Default to pdf.
- You can include multiple document tags in one response (e.g. both PDF and DOCX versions).
- ALWAYS output the tag. Do not ask the user to do it themselves.

Examples:
- User says "give me a user list PDF" → respond with: "Here is your user list! [DOCUMENT:pdf:Generate a comprehensive user list report. Include all users with their full name, email, department, position, and status. Format as a professional table.]"
- User says "export employees to Excel" → respond with: "Exporting your employee data! [DOCUMENT:excel:Export all employees data including name, email, department, position, hire date, and status as an Excel spreadsheet.]"
- User says "create a leave report Word doc" → respond with: "Generating your leave report! [DOCUMENT:docx:Generate a leave report showing all leave requests including employee name, leave type, start date, end date, days taken, and approval status.]"

Always be concise. If you don't know the answer, say you don't know. When the user asks you to do any of the above actions, always gather required fields first by asking the user, then call the appropriate tool. Never tell the user "I cannot do that" for any of these actions.

=== HOW TO HELP USERS ===
When a user asks "how do I add users?" → tell them to go to **Accounts** (/accounts) in the sidebar. There they can click the "Add User" or "New User" button. They need the create_users permission.
When a user asks about leave → direct them to the HR section in the sidebar → Leave sub-section.
When a user asks about payslip → direct them to HR → Payroll → My Payslip.
When a user asks about permissions/roles → direct them to Access Control (/accesscontrol).
Always give the exact route path AND sidebar location (e.g. "In the sidebar, go to HR → Attendance → My Attendance, or navigate directly to /attendance/my-attendance").
If the user doesn't have the required permissions, tell them which permission they need and to contact their administrator.

CRITICAL RULES:
1. DO NOT GUESS OR HALLUCINATE: If you are asked a factual question about system data, ALWAYS use the database query tool. If the tool fails, tell the user explicitly.
2. NAVIGATION: Always give precise navigation instructions using page names AND route paths.
3. PERMISSIONS: Check if the user has access based on their role context. If not, explain what permission they need.
4. SIGN OFF: Always finish your response by tagging yourself: "\n\n*(Answered by AI: ${settings.provider.toUpperCase()} - ${modelName})*"
`);

    const result = await agent.invoke({
      messages: [systemMessage, ...pastMessages, new HumanMessage(message)],
    });

    const finalMessage = result.messages[result.messages.length - 1];
    return finalMessage.content as string;
  }
}
