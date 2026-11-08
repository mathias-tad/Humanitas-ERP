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

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../auth/entities/tenant.entity';
import { DatabaseService } from '../database/database.service';

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
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private databaseService: DatabaseService,
  ) {}

  /**
   * Evaluates the tenant's AI feature capabilities:
   * - ai.help: Chat assistance, answering questions, navigation guidance.
   * - ai.actions: Autonomous tool execution on behalf of user.
   * - ai.documents: Document and report generation from DB / templates.
   * - ai.full / ai / *: All capabilities enabled.
   */
  async getAiCapabilities(tenantSlug: string): Promise<{
    canHelp: boolean;
    canPerformActions: boolean;
    canGenerateDocs: boolean;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });

    if (tenant?.enabled_features && tenant.enabled_features.length > 0) {
      const feats = tenant.enabled_features.map((f: string) => f.toLowerCase().trim());
      if (feats.includes('*') || feats.includes('ai') || feats.includes('ai.full')) {
        return { canHelp: true, canPerformActions: true, canGenerateDocs: true };
      }
      return {
        canHelp:
          feats.includes('ai.help') ||
          feats.includes('ai.actions') ||
          feats.includes('ai.documents'),
        canPerformActions: feats.includes('ai.actions'),
        canGenerateDocs: feats.includes('ai.documents'),
      };
    }

    if (tenant?.database_name) {
      try {
        const connection = await this.databaseService.getTenantConnection(
          tenant.database_name,
        );
        const rows = await connection.query(
          `SELECT module_key FROM tenant_modules WHERE module_key LIKE 'ai%' AND is_active = true`,
        );
        if (rows && rows.length > 0) {
          const keys = rows.map((r: any) => r.module_key.toLowerCase().trim());
          if (keys.includes('ai') || keys.includes('ai.full')) {
            return { canHelp: true, canPerformActions: true, canGenerateDocs: true };
          }
          return {
            canHelp:
              keys.includes('ai.help') ||
              keys.includes('ai.actions') ||
              keys.includes('ai.documents'),
            canPerformActions: keys.includes('ai.actions'),
            canGenerateDocs: keys.includes('ai.documents'),
          };
        }
      } catch {
        // Fallback default
      }
    }

    return { canHelp: true, canPerformActions: true, canGenerateDocs: true };
  }

  async processRequest(
    tenantId: string,
    tenantSlug: string,
    userId: string,
    userRole: string,
    message: string,
    userName: string,
    conversationId?: string,
    currentRoute?: string,
    currentModule?: string,
    platform?: string,
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

    // 2. Build role context AND fetch permissions array for tool RBAC enforcement
    const roleContext = await this.roleContextBuilder.buildContext(tenantSlug, userId, userRole);
    const userPermissions = await this.roleContextBuilder.getPermissions(tenantSlug, userId, userRole);
    const aiCapabilities = await this.getAiCapabilities(tenantSlug);

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
        userPermissions,
        aiCapabilities,
        currentRoute,
        currentModule,
        platform,
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
    currentRoute?: string,
    currentModule?: string,
    platform?: string,
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

    return this.processRequest(tenantId, tenantSlug, userId, userRole, enrichedMessage, userName, conversationId, currentRoute, currentModule, platform);
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
    userPermissions: string[] = [],
    aiCapabilities: { canHelp: boolean; canPerformActions: boolean; canGenerateDocs: boolean } = { canHelp: true, canPerformActions: true, canGenerateDocs: true },
    currentRoute?: string,
    currentModule?: string,
    platform?: string,
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
    // SECURITY: Pass userPermissions so only RBAC-permitted action tools are returned.
    // GATING: Only equip action tools if tenant package includes 'ai.actions' or 'ai.full'
    const actionTools = aiCapabilities.canPerformActions
      ? this.actionService.getActionTools(tenantSlug, userId, userPermissions)
      : [];

    const tools = [...uiTools, ...dbTools, ...analyticsTools, ...actionTools];

    const agent = createReactAgent({ llm, tools });

    const actionDirectives = aiCapabilities.canPerformActions
      ? `=== DATABASE QUERY & SYSTEM ACTION TOOLS ===
You have full tool calling capabilities to query tenant data and perform permitted actions:
- \`query_tenant_database\`: Execute custom SQL queries on the active tenant's schema for data analytics.
- \`create_user\`, \`update_user\`, \`deactivate_user\`: Manage employee directory records.
- \`submit_leave_request\`, \`approve_leave_request\`, \`reject_leave_request\`: Handle leave workflows.
- \`post_announcement\`: Broadcast company news.
- \`initiate_payroll_run\`, \`add_loan\`: Execute payroll actions.
- \`create_project\`, \`create_task\`, \`update_task_status\`: PMS project and task actions.
- \`analyze_task_distribution\`, \`suggest_task_allocation\`, \`get_all_users_kpi\`: Automated team analytics.
- \`create_sprint\`: Create a sprint inside a project.
- \`add_project_member\`: Add a user to a project.
- \`cancel_leave_request\`: Cancel a leave request.
- \`create_shift\`: Create a new shift definition.
- \`assign_shift\`: Assign an employee to a shift.
- \`mark_day_off\`: Mark a day off for an employee.
- \`log_overtime\`: Log overtime hours.
- \`add_holiday\`: Add a public/company holiday.`
      : `=== AI ACTIONS RESTRICTION: CHAT HELP & GUIDANCE ONLY ===
Action execution capability ("ai.actions") is NOT included in this organization's subscription tier.
You DO NOT have tools to mutate database records, submit leaves, create tasks, or create shifts on behalf of the user.
If the user asks you to perform an action on their behalf (e.g. "create a task", "submit my leave", "approve this request", "add an employee"), DO NOT pretend to execute it.
Politely inform them:
"Your organization's current AI subscription tier is set to Chat Help only, so I cannot perform system modifications on your behalf. However, you can easily perform this yourself by following these steps:"
Then provide clear step-by-step guidance specifying the exact page path and button to use.`;

    const documentDirectives = aiCapabilities.canGenerateDocs
      ? `==== GENERATING DOCUMENTS ===
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
- User says "create a leave report Word doc" → respond with: "Generating your leave report! [DOCUMENT:docx:Generate a leave report showing all leave requests including employee name, leave type, start date, end date, days taken, and approval status.]"`
      : `==== AI DOCUMENT GENERATION RESTRICTION ====
Document generation capability ("ai.documents") is NOT included in this organization's subscription package.
Do NOT output [DOCUMENT:...] tags. If the user asks for a document, report, or export, politely inform them that automated document generation requires the "ai.documents" capability tier in their package subscription.`;

    const systemMessage = new SystemMessage(`You are Humanitas AI — the intelligent co-pilot and enterprise assistant for the Humanitas Enterprise ERP platform.
You are powered by the AI Provider: ${settings.provider.toUpperCase()}, using Model: ${modelName}.

Context about the user making this request:
${roleContext}

=== CURRENT USER SESSION & ACTIVE SCREEN CONTEXT ===
- Platform: ${platform || 'web'}
- Active Business Module: ${currentModule || 'General'}
- Active Route / Screen: ${currentRoute || '/dashboard'}
Context-Awareness Directive: When the user asks context-dependent questions like "how do I add something here?", "what can I do on this page?", or asks for assistance without naming a specific module, tailor your answer directly to their active route (${currentRoute || '/dashboard'}) and module (${currentModule || 'General'}). Always use the \`lookup_system_guide\` tool to retrieve exact button names, locations, and how-to steps for Web and Mobile.

=== HUMANITAS ENTERPRISE UI & DESIGN ARCHITECTURE ===
- **Visual Design System**: "Shiny Gold Luxe" theme with lustrous metallic gold primary accents (#D4AF37), gold glowing highlights, and full dual-mode support (Light mode crisp slate / Dark mode deep onyx).
- **Navigation Model (Dynamics 365 Architecture)**:
  - **9-Dot App Switcher** (Top-Left header button \`Grid\` icon): Opens the modular App Launcher to switch between subscribed business suites.
  - **Contextual Module Dock (Left Sidebar)**: Dynamically renders navigation links and sub-menus for the currently active application suite.
  - **Global Command Palette** (\`Ctrl + K\` or Top Header Search Bar): Allows instantaneous cross-module fuzzy search, page jumps, and command executions.
  - **Global AI Assistant Button** (Top Header Sparkles icon): Opens this interactive assistant panel.
  - **Quick Create Menu** (Top Header "+ Create" button): Instant modals for Add Employee, Submit Leave, New Task, etc.

=== MODULAR ERP APPLICATIONS & ROUTES MAP ===
Humanitas ERP is organized into dedicated subscribable suites. You know every page, purpose, action, and permission:

1. **HUMAN CAPITAL SUITE (HRMS) — Default Route: /dashboard**
   - **Home Dashboard** (\`/dashboard\`): Executive overview KPI tiles (Workforce count, Today's attendance %, Pending leaves, Active PMS tasks, Next payroll date) + Quick Action tiles.
   - **Workforce Directory** (\`/accounts\`): Manage employee profiles, roles, avatars, attachments, and status (Active/Suspended). Top-right button: **"Add Employee"** (gold button). Requires: \`view_users\`, \`create_users\`, \`edit_users\`, \`delete_users\`.
   - **Scheduling & Roster** (\`/scheduling\`): Manage shift patterns, rosters, and employee schedule assignments. Requires: \`view_roster\`, \`manage_roster\`.
   - **Attendance & Biometrics** (\`/attendance/view\`): Real-time clock-in logs, late penalties, overtime tracking, and biometric terminal synchronization. Requires: \`view_attendance\`.
     - *My Attendance* (\`/attendance/my-attendance\`): Personal attendance log.
     - *Overtime Monitor* (\`/attendance/overtime-monitor\`): Live OT calculator.
     - *QR Display* (\`/attendance/qr-display\`): Dynamic QR for mobile clock-in.
   - **Leave Management** (\`/leave/requests\`): Multi-level leave requests approval workflow. Action buttons: **"Approve"**, **"Reject"**, **"Submit Leave"**. Requires: \`view_leave\`, \`approve_leave\`.
     - *My Requests* (\`/leave/my-requests\`): Personal leave status.
     - *Leave Balances* (\`/leave/balances\`): Departmental balance sheets.
     - *Workflow Settings* (\`/leave/workflow\`): Configure multi-tier approval rules.
   - **Automated Payroll Engine** (\`/payroll/dashboard\`): Salary processing, tax deduction breakdown, payslips generation, and banking payment exports. Requires: \`view_payroll\`.
     - *Run Payroll* (\`/payroll/run\`): Execute monthly salary run.
     - *My Payslip* (\`/payroll/my-payslip\`): Personal payslip downloads.
     - *Loan Management* (\`/payroll/loans\`): Employee loans and automatic salary deduction schedules.
   - **Recruitment & ATS** (\`/recruitment\`): AI candidate resume screening, job postings, pipeline stages, and applicant leaderboards. Requires: \`manage_recruitment\`.
   - **Biometric Hardware Terminals** (\`/devices\`): Manage ZKTeco and IP biometric hardware terminals, IP addresses, sync status, and registered user mappings. Top-right button: **"Add Device"**. Requires: \`view_devices\`, \`manage_devices\`.
   - **Company Announcements** (\`/announcements\`): Publish company-wide bulletins, policy updates, and broadcast alerts. Requires: \`view_announcements\`, \`create_announcements\`.

2. **PROJECTS & PERFORMANCE SUITE (PMS) — Default Route: /pms/dashboard**
   - **PMS Dashboard** (\`/pms/dashboard\`): Active sprints, team velocity, task completion rate, and employee KPI rankings. Requires: \`view_pms_dashboard\`.
   - **Task Management** (\`/pms/all-tasks\` & \`/pms/my-tasks\`): Kanban board and grid views with status filters (To Do, In Progress, In Review, Done, Blocked). Action button: **"New Task"**. Requires: \`view_all_tasks\` / \`view_my_tasks\`.
   - **Projects Matrix** (\`/pms/projects\`): Milestone tracking, project budgets, and member assignments. Requires: \`view_projects\`.
   - **Review Queue** (\`/pms/review-queue\`): Managerial approval for completed deliverables. Requires: \`review_tasks\`.
   - **PMS Performance Reports** (\`/pms/reports\`): Employee and team KPI analytics. Requires: \`view_pms_reports\`.

3. **PRODUCTS & CATALOG SUITE — Default Route: /products**
   - Product master catalog, SKU management, multi-variant matrices (color/size), automated QR/barcode generation, dynamic price lists, and label printing.

4. **INVENTORY & WAREHOUSES SUITE — Default Route: /inventory**
   - Multi-location warehouse management, stock movements (Receipts, Transfers, Adjustments), FIFO/AVCO valuation, batch/lot tracking, and automated reorder alerts.

5. **PURCHASING & VENDORS SUITE — Default Route: /purchasing**
   - Vendor directory, RFQs, Purchase Orders (PO), Goods Receipt Notes (GRN), and 3-way matching validation against vendor bills.

6. **SALES, CRM & INVOICING SUITE — Default Route: /sales**
   - CRM lead pipeline, customer quotations, sales orders, automated delivery notes, tax invoicing, and accounts receivable tracking.

7. **POINT OF SALE (POS) SUITE — Default Route: /pos**
   - Rapid touchscreen/barcode checkout interface, cash drawer shift management, offline transaction sync cache, and End-of-Day Z-reports.

8. **FINANCIALS & ACCOUNTING SUITE — Default Route: /accounting**
   - Double-entry General Ledger (GL), Chart of Accounts (COA), automated journal entries from payroll/sales/purchasing, accounts payable/receivable, trial balance, and P&L / Balance Sheet financial statements.

9. **AI INTELLIGENCE SUITE — Default Route: /ai**
   - AI Contextual Assistant, Autonomous Action Executor, and AI Document Generation Engine (PDF/DOCX invoices, slips, contracts).

10. **SYSTEM & SETTINGS — Default Route: /settings**
    - **Access Control** (\`/accesscontrol\`): Granular RBAC roles & permissions matrix editor. Requires: \`view_roles\`, \`edit_roles\`.
    - **System Logs** (\`/system-logs\`): Microservice health diagnostics, failed execution queues, audit trails, and retry monitors. Requires: \`view_logs\`.
    - **General Settings** (\`/settings\`): Company profile, timezone, date formats, currencies, and integrations.
    - **Developer API \u0026 Webhooks** (\`/settings/developer-api\`): Manage API keys and webhook subscriptions for third-party integrations. Tabs: API Keys (generate \`hk_live_...\` tokens, shown once on creation only), Webhooks (subscribe to events: \`employee.created\`, \`leave.approved\`, \`payroll.processed\`, etc.), Delivery Telemetry (retry failed deliveries), Quickstart Guide. Mobile: 2 tabs - API Keys and Webhooks via FAB. Requires: \`view_developer_api\` (view), \`manage_developer_api\` (create/revoke/delete). Signatures: HMAC-SHA256 via \`x-humanitas-signature\` header.

=== SUBSCRIPTION PACKAGE GATING RULES ===
- Tenant access to modules is strictly governed by the tenant's assigned package tier configured in the SaaS Admin Portal.
- If a user asks to access an unsubscribed module, guide them with clarity and inform them that their administrator can upgrade their subscription package in the Admin Portal under **Billing Packages**.

${actionDirectives}

${documentDirectives}

=== HOW TO HELP USERS ===
When a user asks "how do I add users?" → tell them to go to **Accounts** (/accounts) in the sidebar. There they can click the "Add User" or "New User" button. They need the create_users permission.
When a user asks about leave → direct them to the HR section in the sidebar → Leave sub-section.
When a user asks about payslip → direct them to HR → Payroll → My Payslip.
When a user asks about permissions/roles → direct them to Access Control (/accesscontrol).
Always give the exact route path AND sidebar location (e.g. "In the sidebar, go to HR → Attendance → My Attendance, or navigate directly to /attendance/my-attendance").
If the user doesn't have the required permissions, tell them which permission they need and to contact their administrator.


=== COMPANY POLICIES, CONTRACTS & LEGAL PROCLAMATIONS (ZERO-GUESSING RAG) ===
Tenant administrators upload and manage official company handbooks, signed employment agreements, labour proclamations, and operational policies in the Knowledge Vault.
When a user asks about company policies, employment terms, signed contracts, legal rights, probation periods, notice periods, overtime rules, disciplinary procedures, code of conduct, or employee benefits:
1. ALWAYS invoke the \`search_company_knowledge\` tool with the relevant keywords or query.
2. STRICT ZERO GUESSING (Directive 21): You MUST answer EXCLUSIVELY based on the verified excerpts returned by \`search_company_knowledge\`. NEVER fabricate, estimate, or assume any company rule, statutory clause, or contract stipulation.
3. MANDATORY DIRECT CITATION: You MUST provide direct source attribution pointing to the exact document title, section/article, and page number:
   Example citation format:
   > **Reference**: *[Document Title]*, [Section/Article] (Page X)
   > *"[Direct quote or concise summary of the rule]"*
4. STRICT FALLBACK IF NOT FOUND: If the retrieved excerpts do not contain the answer, NEVER invent or guess company rules. State verbatim:
   "This matter is not specified in your organization's uploaded policies and documentation. Please consult your HR Department or Legal Officer for clarification."

CRITICAL RULES — MANDATORY, NON-NEGOTIABLE:
1. STRICT ZERO-GUESSING ON DATA: You MUST NEVER guess, fabricate, estimate, or assume any factual data. If a user asks for employee counts, payroll numbers, leave balances, attendance records, or ANY data from the system — ALWAYS call the \`query_tenant_database\` tool to get real data from the database. If the query fails or returns no results, say exactly: "I could not retrieve this data from the database. Please check directly in the system."
2. ZERO FAKE ACTION CONFIRMATION: You MUST NEVER say "Done", "Completed", "Successfully created", or any success message for a system action UNLESS you have actually called the relevant action tool AND the tool returned a successful result. If you did not call a tool, you did not perform the action.
3. PERMISSION ENFORCEMENT — TWO LAYERS:
   a. LAYER 1 (AI Capability): If the user asks you to perform actions or generate documents and their role does not include the corresponding AI capability permission, respond ONLY with: "You do not have permission to use this AI capability."
   b. LAYER 2 (Business Permission): Even with AI capability, if the user asks for information, actions, or documents that require a business permission they do not have (per their role context above), respond ONLY with: "You do not have permission for this."
   c. DOCUMENT GENERATION: When generating documents with \`[DOCUMENT:...]\` tags, ONLY include data the user has permission to see. If the document would include data outside the user's permission scope, deny the generation with: "You do not have permission to generate a document containing this information."
4. NAVIGATION: Always give precise navigation instructions using page names AND route paths.
5. SIGN OFF: Always finish your response by tagging yourself: "\n\n*(Answered by AI: ${settings.provider.toUpperCase()} - ${modelName})*"
`);

    const result = await agent.invoke({
      messages: [systemMessage, ...pastMessages, new HumanMessage(message)],
    });

    const finalMessage = result.messages[result.messages.length - 1];
    return finalMessage.content as string;
  }

  private async getConnection(tenantSlug: string) {
    const rows = await (this.databaseService as any).masterDataSource.query(
      `SELECT id, database_name FROM tenants WHERE slug = $1`,
      [tenantSlug],
    );
    if (!rows || !rows.length) throw new Error(`Tenant "${tenantSlug}" not found`);
    const ds = await this.databaseService.getTenantConnection(rows[0].database_name);
    return { ds, tenantId: rows[0].id };
  }

  async getKnowledgeEntries(tenantSlug: string, query?: string, moduleKey?: string, platform?: string) {
    const { ds } = await this.getConnection(tenantSlug);
    let sql = `SELECT * FROM ai_knowledge_entries WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;
    if (moduleKey) {
      sql += ` AND module_key = $${idx++}`;
      params.push(moduleKey);
    }
    if (query) {
      sql += ` AND (feature_name ILIKE $${idx} OR page_purpose ILIKE $${idx} OR route_path ILIKE $${idx})`;
      params.push(`%${query}%`);
      idx++;
    }
    if (platform && platform !== 'both') {
      sql += ` AND (platform = 'both' OR platform = $${idx++})`;
      params.push(platform);
    }
    sql += ` ORDER BY feature_name ASC`;
    return ds.query(sql, params).catch(() => []);
  }

  async upsertKnowledgeEntry(tenantSlug: string, entry: any) {
    const { ds } = await this.getConnection(tenantSlug);
    const sql = `
      INSERT INTO ai_knowledge_entries (
        module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path,
        platform, page_purpose, available_actions, button_locations,
        required_permissions, step_by_step_instructions, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      ON CONFLICT (module_key, feature_name) DO UPDATE SET
        route_path = EXCLUDED.route_path,
        mobile_screen_name = EXCLUDED.mobile_screen_name,
        mobile_nav_path = EXCLUDED.mobile_nav_path,
        platform = EXCLUDED.platform,
        page_purpose = EXCLUDED.page_purpose,
        available_actions = EXCLUDED.available_actions,
        button_locations = EXCLUDED.button_locations,
        required_permissions = EXCLUDED.required_permissions,
        step_by_step_instructions = EXCLUDED.step_by_step_instructions,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const rows = await ds.query(sql, [
      entry.module_key,
      entry.feature_name,
      entry.route_path,
      entry.mobile_screen_name || null,
      entry.mobile_nav_path || null,
      entry.platform || 'both',
      entry.page_purpose,
      JSON.stringify(entry.available_actions || []),
      JSON.stringify(entry.button_locations || []),
      JSON.stringify(entry.required_permissions || []),
      JSON.stringify(entry.step_by_step_instructions || {}),
    ]);
    return rows[0];
  }

  async getAuditLogs(tenantSlug: string, limit: number = 50) {
    const { ds } = await this.getConnection(tenantSlug);
    return ds.query(`
      SELECT l.id, l.action_type, l.performed_by, l.executed_by, l.entity_type, l.entity_id, l.details, l.created_at,
             COALESCE(u.full_name, u.email, 'System') as user_name
      FROM system_audit_logs l
      LEFT JOIN users u ON l.performed_by::text = u.id::text
      ORDER BY l.created_at DESC
      LIMIT $1
    `, [limit]).catch(() => []);
  }
}
