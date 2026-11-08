import { Injectable, Logger } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { DatabaseService } from '../../database/database.service';
import { TenantAiKnowledgeService } from './tenant-ai-knowledge.service';

@Injectable()
export class AgentToolRouterService {
  private readonly logger = new Logger(AgentToolRouterService.name);

  constructor(
    private databaseService: DatabaseService,
    private tenantKnowledgeService: TenantAiKnowledgeService,
  ) {}

  private async getConnection(tenantSlug: string) {
    const rows = await (this.databaseService as any).masterDataSource.query(
      `SELECT id, database_name FROM tenants WHERE slug = $1`,
      [tenantSlug],
    );
    if (!rows || !rows.length) throw new Error(`Tenant "${tenantSlug}" not found`);
    const ds = await this.databaseService.getTenantConnection(rows[0].database_name);
    return { ds, tenantId: rows[0].id };
  }

  getTools(tenantSlug: string, userPermissions: string) {
    const getConn = () => this.getConnection(tenantSlug);

    const lookupSystemGuideTool = tool(
      async ({ query, platform, module }) => {
        try {
          const { ds } = await getConn();
          let sql = `
            SELECT module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path,
                   platform, page_purpose, available_actions, button_locations,
                   required_permissions, step_by_step_instructions
            FROM ai_knowledge_entries
            WHERE 1=1
          `;
          const params: any[] = [];
          let idx = 1;

          if (module) {
            sql += ` AND (module_key ILIKE $${idx} OR feature_name ILIKE $${idx})`;
            params.push(`%${module}%`);
            idx++;
          }

          if (query) {
            sql += ` AND (
              module_key ILIKE $${idx} OR
              feature_name ILIKE $${idx} OR
              page_purpose ILIKE $${idx} OR
              route_path ILIKE $${idx} OR
              mobile_screen_name ILIKE $${idx}
            )`;
            params.push(`%${query}%`);
            idx++;
          }

          if (platform && platform !== 'both') {
            sql += ` AND (platform = 'both' OR platform = $${idx})`;
            params.push(platform);
            idx++;
          }

          sql += ` ORDER BY feature_name ASC LIMIT 5`;

          const rows = await ds.query(sql, params).catch(() => []);

          if (!rows || rows.length === 0) {
            return `No exact knowledge entry found for query "${query || module || ''}". Guide the user to the App Launcher (9-dot switcher) or Global Command Palette (Ctrl + K) to search across all modules.`;
          }

          return rows.map((r: any) => {
            const webSteps = r.step_by_step_instructions?.web && Array.isArray(r.step_by_step_instructions.web)
              ? `\n  - **Web Step-by-Step Instructions**:\n    ` + r.step_by_step_instructions.web.join('\n    ')
              : '';
            const mobileSteps = r.step_by_step_instructions?.mobile && Array.isArray(r.step_by_step_instructions.mobile)
              ? `\n  - **Mobile Step-by-Step Instructions**:\n    ` + r.step_by_step_instructions.mobile.join('\n    ')
              : '';
            const buttons = Array.isArray(r.button_locations)
              ? r.button_locations.map((b: any) => `**"${b.label}"** at ${b.location}`).join(', ')
              : 'Standard buttons';
            const perms = Array.isArray(r.required_permissions) ? r.required_permissions.join(', ') : 'None';

            return `### Feature: ${r.feature_name} (Module: ${r.module_key})
- **Purpose**: ${r.page_purpose}
- **Web Route**: [${r.route_path}](${r.route_path})
- **Mobile Screen**: \`${r.mobile_screen_name || 'N/A'}\` (Path: ${r.mobile_nav_path || 'Bottom Navigation'})
- **Button Locations & Labels**: ${buttons}
- **Required Permissions**: \`${perms}\`${webSteps}${mobileSteps}`;
          }).join('\n\n---\n\n');
        } catch (err) {
          return `Knowledge lookup error: ${err.message}`;
        }
      },
      {
        name: 'lookup_system_guide',
        description: 'Lookup the official system guide, step-by-step how-to instructions, button locations, and required permissions for any feature or action on Web and Mobile.',
        schema: z.object({
          query: z.string().describe('Feature, keyword, or action to look up (e.g. "add employee", "request leave", "run payroll", "biometric devices", "reviews")'),
          platform: z.enum(['web', 'mobile', 'both']).optional().describe('Target platform (default: both)'),
          module: z.string().optional().describe('Optional module filter (e.g. "hrms", "payroll", "pms", "attendance")'),
        }),
      }
    );

    const navigateSystemTool = tool(
      async ({ destination }) => {
        // First try dynamic lookup from ai_knowledge_entries
        try {
          const { ds } = await getConn();
          const rows = await ds.query(
            `SELECT feature_name, route_path, mobile_screen_name, mobile_nav_path, page_purpose
             FROM ai_knowledge_entries
             WHERE module_key ILIKE $1 OR feature_name ILIKE $1 OR route_path ILIKE $1
             LIMIT 1`,
            [`%${destination}%`]
          ).catch(() => []);

          if (rows && rows.length > 0) {
            const entry = rows[0];
            return `Navigation details for **${entry.feature_name}**:\n- **Web Route**: ${entry.route_path}\n- **Mobile Screen**: ${entry.mobile_screen_name} (Path: ${entry.mobile_nav_path})\n- **Purpose**: ${entry.page_purpose}`;
          }
        } catch (_) {}

        const routes: Record<string, string> = {
          dashboard: '/app/dashboard',
          hr: '/app/hr',
          projects: '/app/pms/projects',
          tasks: '/app/pms/projects',
          schedules: '/app/scheduling',
          payroll: '/app/payroll',
          chat: '/app/messaging',
          messaging: '/app/messaging',
          settings: '/app/settings',
          profile: '/app/settings/profile',
          attrition: '/app/hr', // Fallback for attrition UI
          employees: '/app/hr',
          reports: '/hrms/reports',
          analytics: '/hrms/reports',
          bank_transfer: '/hrms/reports',
          hrms_reports: '/hrms/reports',
          documents: '/hrms/documents',
          vault: '/hrms/documents',
          document_vault: '/hrms/documents',
          letters: '/hrms/documents',
          letter_templates: '/hrms/documents',
          onboarding: '/hrms/onboarding',
          offboarding: '/hrms/onboarding',
          exit_interview: '/hrms/onboarding',
          probation: '/hrms/onboarding',
          self_service: '/self-service',
          my_hr: '/self-service',
          portal: '/self-service',
          grievances: '/hrms/grievances',
          grievance: '/hrms/grievances',
          whistleblower: '/hrms/grievances',
          complaints: '/hrms/grievances',
          benefits: '/hrms/benefits',
          insurance: '/hrms/benefits',
          benefit_plans: '/hrms/benefits',
          training: '/hrms/training',
          courses: '/hrms/training',
          lms: '/hrms/training',
          skills: '/hrms/training',
          reviews: '/pms/reviews',
          performance_reviews: '/pms/reviews',
          review_cycle: '/pms/reviews',
          pip: '/pms/reviews',
          competencies: '/pms/reviews',
          expenses: '/hrms/expenses',
          expense_claims: '/hrms/expenses',
          reimbursements: '/hrms/expenses',
          expense_reports: '/hrms/expenses',
          assets: '/hrms/assets',
          equipment: '/hrms/assets',
          asset_tracking: '/hrms/assets',
          company_assets: '/hrms/assets',
          asset_maintenance: '/hrms/assets',
          surveys: '/hrms/surveys',
          pulse: '/hrms/surveys',
          pulse_surveys: '/hrms/surveys',
          enps: '/hrms/surveys',
          engagement: '/hrms/surveys',
          import_export: '/settings/import-export',
          bulk_import: '/settings/import-export',
          bulk_export: '/settings/import-export',
          data_import: '/settings/import-export',
          csv_import: '/settings/import-export',
          data_export: '/settings/import-export',
          recruitment: '/hrms/recruitment',
          jobs: '/hrms/recruitment',
          candidates: '/hrms/recruitment',
          ats: '/hrms/recruitment',
          interviews: '/hrms/recruitment',
          offers: '/hrms/recruitment',
          recruitment_reports: '/hrms/recruitment/reports',
          hiring_funnel: '/hrms/recruitment/reports',
          approvals: '/approvals',
          pending_approvals: '/approvals',
          approval_requests: '/approvals',
          approval_rules: '/settings/approvals',
          approval_workflows: '/settings/approvals',
          approval_settings: '/settings/approvals',
        };
        const destLower = destination.toLowerCase();
        
        for (const [key, path] of Object.entries(routes)) {
          if (destLower.includes(key)) {
            if (key.includes('approval')) {
              return `Web route for ${key}: ${path}.\nMobile app: Open the app menu or bottom navigation, select 'Approval Center' to review pending approvals with 1-click Approve or Reject, view request details, or inspect audit history.`;
            }
            return `Web route for ${key}: ${path}.\nMobile app: Open the app menu or bottom navigation, select 'Recruitment & ATS' to access Job Openings, Candidate Pipeline, Scheduled Interviews, and Funnel Analytics.`;
          }
        }
        return `I couldn't find a specific route for "${destination}". The available core routes are: ${Object.values(routes).join(', ')}.`;
      },
      {
        name: 'navigate_system',
        description: 'Use this tool to find the specific UI route/URL for a given module (e.g., HR, Payroll, Projects, Reports, Documents) when the user asks how to get there.',
        schema: z.object({
          destination: z.string().describe('The name of the module or page (e.g. "hr", "payroll", "projects", "reports", "documents")'),
        }),
      }
    );

    const generateDocumentTool = tool(
      async ({ documentType, format }) => {
        return `To generate a ${documentType} in ${format} format, please use the dedicated document generation endpoint: POST /ai/document/generate with body { "prompt": "generate a ${documentType}", "format": "${format}" }. I cannot send binary files directly through this chat interface.`;
      },
      {
        name: 'generate_document',
        description: 'Use this tool when the user asks to generate, create, or download a document (PDF or Excel) like a payslip, contract, or report.',
        schema: z.object({
          documentType: z.string().describe('The type of document the user wants to generate (e.g. contract, payslip)'),
          format: z.enum(['pdf', 'excel']).describe('The format of the document'),
        }),
      }
    );

    const viewHrAnalyticsTool = tool(
      async () => {
        return `The HR Analytics & People Intelligence hub is accessible at /hrms/reports. It provides:
1. Executive Headcount & Demographics: Active workforce, gender diversity ratios, tenure bands, and department distribution.
2. Turnover & Retention Analytics: Monthly new hires vs. exits, 30/60/90-day milestone retention, and department attrition.
3. Attendance & Absenteeism Heatmap: Punctuality rates by day of the week, overtime hour trends, and absence monitoring.
4. Workforce Spend & Payroll Analytics: Department budget burn rates and historical payroll cost breakdown.
5. Direct Bank Transfer File Generator: Generates Standard Commercial Bank CSV, US NACHA ACH, and Australian ABA batch payment files for single-click commercial bank payroll disbursement.`;
      },
      {
        name: 'view_hr_analytics_info',
        description: 'Use this tool when the user asks about HR analytics, people intelligence, headcount trends, turnover metrics, or bank payment file exports.',
        schema: z.object({}),
      }
    );

    const viewDocumentVaultTool = tool(
      async () => {
        return `The Employee Document Vault & Dynamic Letter Generator is accessible at /hrms/documents. It provides:
1. Employee Document Repository: Secure storage for contracts, KYC IDs, tax documents, certifications, and disciplinary notices.
2. Compliance & Expiration Alerts: Real-time tracking of expiring visas, passports, and certifications (30/60/90-day warning alerts).
3. Verification & Audit Trail: Document review workflow with verified/rejected badges, verifier timestamp, and notes.
4. Dynamic Letter Generator: 1-click issuance of official Offer Letters, Employment Contracts, Experience Letters, Salary Certificates, Promotion Letters, and Warning Letters with token interpolation and PDF preview.`;
      },
      {
        name: 'view_document_vault_info',
        description: 'Use this tool when the user asks about the document vault, employee files, letter templates, contracts, or expiring credentials.',
        schema: z.object({}),
      }
    );

    const attritionRiskTool = tool(
      async () => {
        return `To view the attrition/flight-risk report for your organisation, please navigate to /ai/lifecycle/attrition in the API, or use the HR Dashboard → AI Insights → Attrition Risk section in the UI.`;
      },
      {
        name: 'view_attrition_risk',
        description: 'Use this tool when the user asks about employee attrition, flight risk, or who might leave the company.',
        schema: z.object({}),
      }
    );

    const reviewSummaryTool = tool(
      async ({ notes }) => {
        return `To summarize performance review notes, please use POST /ai/lifecycle/review/summarize with { "managerNotes": "${notes.substring(0,100)}..." }. The AI will detect bias and generate a professional summary.`;
      },
      {
        name: 'summarize_performance_review',
        description: 'Use this tool when the user wants to summarize manager notes or check a performance review for bias.',
        schema: z.object({
          notes: z.string().describe('The manager notes or review text to summarize'),
        }),
      }
    );

    const searchCompanyKnowledgeTool = tool(
      async ({ query, category }) => {
        try {
          const results = await this.tenantKnowledgeService.searchKnowledge(
            tenantSlug,
            query,
            category,
            undefined,
            undefined,
            5,
          );

          if (!results || results.length === 0) {
            return `No company policies, agreements, or legal provisions matching "${query}" were found in the uploaded documents. Remind the user that you can only answer from verified company policies and suggest contacting HR.`;
          }

          const formatted = results.map((r, idx) => {
            const sec = r.section_title ? `Section/Article: "${r.section_title}"` : 'General Provision';
            const page = r.page_number ? ` (Page ${r.page_number})` : '';
            return `[VERIFIED COMPANY SOURCE ${idx + 1}]
Document: "${r.document_title}"
Category: ${r.category}
${sec}${page}
Content Excerpt:
"${r.chunk_text}"`;
          }).join('\n\n---\n\n');

          return `Found ${results.length} relevant excerpt(s) from official company documents:\n\n${formatted}\n\nDIRECT CITATION MANDATE: When answering, cite the Document Title and Section/Article explicitly. Do not assume or guess anything not written in these excerpts.`;
        } catch (err: any) {
          return `Error querying company knowledge vault: ${err.message}`;
        }
      },
      {
        name: 'search_company_knowledge',
        description: 'Search official company policy documents, employee handbooks, signed employment agreements, labour proclamations, codes of conduct, and workplace guidelines uploaded by tenant administrators. ALWAYS invoke this tool when answering questions about probation, notice periods, leave rules, working hours, benefits, overtime, termination, code of conduct, or statutory compliance.',
        schema: z.object({
          query: z.string().describe('The policy rule, legal concept, or question to look up (e.g. "probation period notice", "annual leave entitlement", "disciplinary hearing procedure")'),
          category: z.string().optional().describe('Optional category filter: company_policy, legal_proclamation, employment_agreement, code_of_conduct, benefits_guide, etc.'),
        }),
      }
    );

    // Filter tools based on permissions if needed
    const tools = [
      lookupSystemGuideTool,
      searchCompanyKnowledgeTool,
      navigateSystemTool,
      generateDocumentTool,
      viewHrAnalyticsTool,
      viewDocumentVaultTool,
      attritionRiskTool,
      reviewSummaryTool,
    ];
    return tools;
  }
}
