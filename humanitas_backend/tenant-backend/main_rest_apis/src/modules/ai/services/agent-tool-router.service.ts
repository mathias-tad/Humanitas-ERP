import { Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AgentToolRouterService {
  constructor(private databaseService: DatabaseService) {}

  getTools(tenantSlug: string, userPermissions: string) {
    const navigateSystemTool = tool(
      async ({ destination }) => {
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
        };
        const destLower = destination.toLowerCase();
        
        for (const [key, path] of Object.entries(routes)) {
          if (destLower.includes(key)) {
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

    // Filter tools based on permissions if needed
    const tools = [navigateSystemTool, generateDocumentTool, viewHrAnalyticsTool, viewDocumentVaultTool, attritionRiskTool, reviewSummaryTool];
    return tools;
  }
}
