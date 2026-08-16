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
        };
        const destLower = destination.toLowerCase();
        
        for (const [key, path] of Object.entries(routes)) {
          if (destLower.includes(key)) {
            return `The exact route to access ${key} is: ${path}`;
          }
        }
        return `I couldn't find a specific route for "${destination}". The available core routes are: ${Object.values(routes).join(', ')}.`;
      },
      {
        name: 'navigate_system',
        description: 'Use this tool to find the specific UI route/URL for a given module (e.g., HR, Payroll, Projects) when the user asks how to get there.',
        schema: z.object({
          destination: z.string().describe('The name of the module or page (e.g. "hr", "payroll", "projects")'),
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
    const tools = [navigateSystemTool, generateDocumentTool, attritionRiskTool, reviewSummaryTool];
    return tools;
  }
}
