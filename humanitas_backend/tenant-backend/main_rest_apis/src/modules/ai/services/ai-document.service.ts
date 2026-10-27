import { Injectable, BadRequestException } from '@nestjs/common';
const PDFDocument = require('pdfkit');
import * as ExcelJS from 'exceljs';
import { DatabaseService } from '../../database/database.service';
import { AiSettingsFetchService } from './ai-settings-fetch.service';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage } from '@langchain/core/messages';

export interface AiDocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'HRMS' | 'Payroll' | 'PMS' | 'Attendance' | 'Finance' | 'Operations' | 'General';
  supportedFormats: ('pdf' | 'docx' | 'excel')[];
  defaultPrompt: string;
  parameters: {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    required: boolean;
    description?: string;
  }[];
}

@Injectable()
export class AiDocumentService {
  private readonly BUILTIN_TEMPLATES: AiDocumentTemplate[] = [
    {
      id: 'employment_verification',
      name: 'Employment Verification Letter',
      description: 'Formal verification letter confirming employee designation, department, hire date, and employment status.',
      category: 'HRMS',
      supportedFormats: ['pdf', 'docx'],
      defaultPrompt: 'Generate a formal Employment Verification Letter for the employee. Include official company header, date, employee full name, job title, department, date of hire, employment status (active/full-time), and official verification signature block.',
      parameters: [
        { key: 'employee_identifier', label: 'Employee Name or Email', type: 'string', required: true, description: 'Target employee to verify' },
        { key: 'recipient_organization', label: 'Addressed To (e.g., Embassy, Bank)', type: 'string', required: false, description: 'Organization requesting verification' },
      ],
    },
    {
      id: 'salary_certificate',
      name: 'Salary & Compensation Certificate',
      description: 'Certified breakdown of employee basic salary, allowances, statutory deductions, net monthly salary, and bank details.',
      category: 'Payroll',
      supportedFormats: ['pdf', 'docx'],
      defaultPrompt: 'Generate an official Salary and Compensation Certificate. Detail basic salary, fixed allowances, statutory deductions, monthly net pay, and bank account details for the employee.',
      parameters: [
        { key: 'employee_identifier', label: 'Employee Name or Email', type: 'string', required: true, description: 'Target employee' },
        { key: 'purpose', label: 'Purpose (e.g., Bank Loan, Visa Application)', type: 'string', required: false, description: 'Certificate purpose' },
      ],
    },
    {
      id: 'performance_evaluation',
      name: 'PMS Performance Evaluation Summary',
      description: 'Executive performance appraisal report compiling employee KPI scores, sprint completion velocity, completed deliverables, and manager ratings.',
      category: 'PMS',
      supportedFormats: ['pdf', 'docx'],
      defaultPrompt: 'Generate a comprehensive Performance Evaluation Summary report. Include employee name, department, role, overall KPI score, completed tasks vs assigned, sprint velocity, and manager recommendations.',
      parameters: [
        { key: 'employee_identifier', label: 'Employee Name or Email', type: 'string', required: false, description: 'Optional specific employee' },
        { key: 'review_period', label: 'Review Period (e.g., Q3 2026)', type: 'string', required: false, description: 'Performance period' },
      ],
    },
    {
      id: 'attendance_monthly_report',
      name: 'Monthly Attendance & Timesheet Summary',
      description: 'Detailed workforce attendance summary aggregating clock-in/out records, total working hours, overtime, late arrival counts, and leaves taken.',
      category: 'Attendance',
      supportedFormats: ['pdf', 'excel'],
      defaultPrompt: 'Generate a Monthly Attendance and Timesheet Summary report. Include total scheduled shifts, days present, days absent, late clock-ins, approved leaves, and overtime hours worked.',
      parameters: [
        { key: 'month', label: 'Month (1-12)', type: 'number', required: false, description: 'Target month' },
        { key: 'year', label: 'Year (e.g., 2026)', type: 'number', required: false, description: 'Target year' },
        { key: 'department', label: 'Department Name', type: 'string', required: false, description: 'Filter by department' },
      ],
    },
    {
      id: 'project_status_report',
      name: 'Project Executive Status Brief',
      description: 'High-level project status briefing detailing active milestones, task burn-down, velocity, team members, and open blockers.',
      category: 'PMS',
      supportedFormats: ['pdf', 'docx'],
      defaultPrompt: 'Generate a Project Executive Status Brief. Include project title, description, status, start/end dates, active milestone progress, sprint deliverables, task counts by status (To Do, In Progress, Done, Blocked), and project team members.',
      parameters: [
        { key: 'project_name', label: 'Project Name', type: 'string', required: false, description: 'Target project name' },
      ],
    },
    {
      id: 'hr_analytics_executive_brief',
      name: 'HR Analytics & People Intelligence Executive Brief',
      description: 'Comprehensive workforce intelligence brief compiling headcount demographics, turnover rates, absenteeism heatmaps, and total cost of workforce.',
      category: 'HRMS',
      supportedFormats: ['pdf', 'excel'],
      defaultPrompt: 'Generate an HR Analytics & People Intelligence Executive Brief. Include total active headcount, departmental distribution, gender diversity ratio, monthly attrition/turnover rate, 30/60/90-day new hire retention, absenteeism percentage, and total monthly workforce payroll cost.',
      parameters: [
        { key: 'month', label: 'Month (1-12)', type: 'number', required: false, description: 'Target month' },
        { key: 'year', label: 'Year (e.g. 2026)', type: 'number', required: false, description: 'Target year' },
        { key: 'department', label: 'Department Name', type: 'string', required: false, description: 'Filter by department' },
      ],
    },
    {
      id: 'individual_payslip',
      name: 'Individual Employee Payslip',
      description: 'Official monthly payslip detailing earnings, allowances, tax/pension statutory deductions, and net compensation for an individual employee.',
      category: 'Payroll',
      supportedFormats: ['pdf', 'docx', 'excel'],
      defaultPrompt: 'Generate a comprehensive individual employee payslip. Include employer details, pay period, payment date, employee ID, full name, department, designation, bank account details, basic salary, itemized earnings/allowances (transport, housing, bonus), statutory and custom deductions (income tax, pension, loan deductions), and final net pay with currency.',
      parameters: [
        { key: 'employee_identifier', label: 'Employee Name or Email', type: 'string', required: true, description: 'Target employee' },
        { key: 'pay_period', label: 'Pay Period (e.g., October 2026)', type: 'string', required: true, description: 'Target payroll cycle' },
        { key: 'include_ytd', label: 'Include Year-to-Date Totals', type: 'boolean', required: false, description: 'Show YTD earnings' },
      ],
    },
    {
      id: 'payroll_summary_report',
      name: 'Payroll Summary & Cost Allocation Report',
      description: 'Enterprise payroll summary report compiling total payroll spend, statutory employer liabilities, departmental allocations, and net pay distributions.',
      category: 'Payroll',
      supportedFormats: ['pdf', 'excel'],
      defaultPrompt: 'Generate an executive Payroll Summary Report. Include total gross payroll, statutory employee & employer contributions, total net disbursements, department-by-department payroll cost breakdown, headcount paid, and payment method summaries.',
      parameters: [
        { key: 'month', label: 'Month (1-12)', type: 'number', required: false, description: 'Target month' },
        { key: 'year', label: 'Year (e.g., 2026)', type: 'number', required: false, description: 'Target year' },
        { key: 'department', label: 'Department Name', type: 'string', required: false, description: 'Filter by department' },
      ],
    },
    {
      id: 'sales_invoice_quotation',
      name: 'Sales Invoice & Quotation',
      description: 'Professional commercial sales invoice or formal price quotation with line items, tax/VAT calculations, discounts, and payment terms.',
      category: 'Finance',
      supportedFormats: ['pdf', 'docx'],
      defaultPrompt: 'Generate a professional Sales Invoice or Quotation. Include invoice/quotation number, issue date, due date, customer billing and shipping address, itemized line items with description, quantity, unit price, discounts, tax/VAT breakdown, subtotal, and total amount due with payment terms.',
      parameters: [
        { key: 'document_type', label: 'Document Type (Invoice or Quotation)', type: 'string', required: true, description: 'Invoice or Quotation' },
        { key: 'customer_name', label: 'Customer Name', type: 'string', required: true, description: 'Target customer or account' },
        { key: 'order_number', label: 'Order / Ref Number', type: 'string', required: false, description: 'Reference order number' },
      ],
    },
    {
      id: 'purchase_order_delivery',
      name: 'Purchase Order & Goods Delivery Note',
      description: 'Official procurement purchase order or delivery receipt note for vendor shipments with receiving acceptance criteria.',
      category: 'Operations',
      supportedFormats: ['pdf', 'docx'],
      defaultPrompt: 'Generate an enterprise Purchase Order and Goods Delivery Note. Include PO number, requisition date, vendor details, shipping destination warehouse/branch, expected delivery date, line items with SKU, item description, quantity ordered, agreed unit cost, tax, payment terms, and receiving signature blocks.',
      parameters: [
        { key: 'document_type', label: 'Document Type (PO or Delivery Note)', type: 'string', required: true, description: 'PO or Delivery Note' },
        { key: 'vendor_name', label: 'Vendor Name', type: 'string', required: true, description: 'Target supplier' },
        { key: 'po_number', label: 'PO / Reference Number', type: 'string', required: false, description: 'Purchase order reference' },
      ],
    },
    {
      id: 'inventory_stock_valuation',
      name: 'Inventory Stock Valuation Summary',
      description: 'Comprehensive inventory valuation report detailing stock on hand, warehouse locations, valuation costing (FIFO/AVCO), and reorder alerts.',
      category: 'Operations',
      supportedFormats: ['pdf', 'excel'],
      defaultPrompt: 'Generate an Inventory Stock Report and Valuation Summary. Include warehouse location, product categories, SKU codes, item descriptions, available on-hand stock quantities, unit cost valuation (FIFO/AVCO), total inventory valuation, reorder levels, and slow-moving or low-stock alerts.',
      parameters: [
        { key: 'warehouse_name', label: 'Warehouse Name', type: 'string', required: false, description: 'Target warehouse' },
        { key: 'category', label: 'Product Category', type: 'string', required: false, description: 'Filter by product category' },
      ],
    },
    {
      id: 'financial_statements',
      name: 'Financial Statements (P&L, Balance Sheet, Trial Balance)',
      description: 'Official enterprise financial statements including Profit & Loss Statement, Balance Sheet, and Trial Balance ledger reconciliation.',
      category: 'Finance',
      supportedFormats: ['pdf', 'excel'],
      defaultPrompt: 'Generate official Enterprise Financial Statements. For Profit & Loss: revenue breakdown, cost of goods sold (COGS), gross margin, operating expenses, and net operating income. For Balance Sheet: current and non-current assets, liabilities, and owner equity. For Trial Balance: list of ledger accounts with debit and credit balances verifying debit-credit equality.',
      parameters: [
        { key: 'statement_type', label: 'Statement Type (P&L, Balance Sheet, Trial Balance)', type: 'string', required: true, description: 'Type of financial statement' },
        { key: 'fiscal_year', label: 'Fiscal Year (e.g., 2026)', type: 'number', required: false, description: 'Fiscal reporting year' },
        { key: 'period', label: 'Period (e.g., Q3, Annual)', type: 'string', required: false, description: 'Reporting period' },
      ],
    },
    {
      id: 'employee_contract_offer',
      name: 'Employee Contract & Offer Letter',
      description: 'Formal employment offer letter and contract agreement outlining job designation, compensation package, reporting line, and terms of service.',
      category: 'HRMS',
      supportedFormats: ['pdf', 'docx'],
      defaultPrompt: 'Generate an official Employment Contract and Job Offer Letter. Include company letterhead, formal greeting, job title, reporting manager, department, commencement date, compensation package breakdown (base salary, benefits, allowances), probationary period, confidentiality and IP terms, and candidate acceptance signature section.',
      parameters: [
        { key: 'candidate_name', label: 'Candidate Full Name', type: 'string', required: true, description: 'Prospective employee' },
        { key: 'job_title', label: 'Job Title / Designation', type: 'string', required: true, description: 'Offered position' },
        { key: 'department', label: 'Department', type: 'string', required: false, description: 'Department assignment' },
        { key: 'offered_salary', label: 'Offered Gross Salary', type: 'number', required: false, description: 'Compensation figure' },
      ],
    },
    {
      id: 'leave_attendance_report',
      name: 'Attendance & Leave Summary Report',
      description: 'Comprehensive workforce attendance analysis detailing scheduled vs worked hours, leave utilization by type, remaining balances, and absenteeism rates.',
      category: 'Attendance',
      supportedFormats: ['pdf', 'excel'],
      defaultPrompt: 'Generate a Workforce Attendance and Leave Summary Report. Detail scheduled vs worked hours per employee, leave requests by category (annual, sick, casual, maternity, unpaid), approval statuses, total days taken, remaining balances, and punctuality/absenteeism rate analysis.',
      parameters: [
        { key: 'start_date', label: 'Start Date (YYYY-MM-DD)', type: 'string', required: false, description: 'Start of period' },
        { key: 'end_date', label: 'End Date (YYYY-MM-DD)', type: 'string', required: false, description: 'End of period' },
        { key: 'department', label: 'Department Name', type: 'string', required: false, description: 'Filter by department' },
      ],
    },
  ];

  constructor(
    private databaseService: DatabaseService,
    private aiSettingsFetch: AiSettingsFetchService,
  ) {}

  getBuiltinTemplates(): AiDocumentTemplate[] {
    return this.BUILTIN_TEMPLATES;
  }

  async generateFromTemplate(
    tenantSlug: string,
    userRoleContext: string,
    templateId: string,
    format: 'pdf' | 'docx' | 'excel',
    parameters?: Record<string, any>,
    customNotes?: string,
    userId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const template = this.BUILTIN_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new BadRequestException(`Unknown template ID: ${templateId}`);
    }

    if (!template.supportedFormats.includes(format)) {
      throw new BadRequestException(
        `Format "${format}" is not supported for template "${template.name}". Supported formats: ${template.supportedFormats.join(', ')}`,
      );
    }

    let paramDetails = '';
    if (parameters && Object.keys(parameters).length > 0) {
      paramDetails = Object.entries(parameters)
        .filter(([_, val]) => val !== undefined && val !== null && val !== '')
        .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`)
        .join('\n');
    }

    let combinedPrompt = `${template.defaultPrompt}\n\nTEMPLATE PARAMETERS:\n${paramDetails || 'None specified'}`;
    if (customNotes) {
      combinedPrompt += `\n\nADDITIONAL USER INSTRUCTIONS:\n${customNotes}`;
    }

    let result: { buffer: Buffer; filename: string };
    if (format === 'pdf') {
      result = await this.generatePdf(tenantSlug, userRoleContext, combinedPrompt, undefined, userId);
    } else if (format === 'docx') {
      result = await this.generateDocx(tenantSlug, userRoleContext, combinedPrompt, undefined, userId);
    } else {
      result = await this.generateExcel(tenantSlug, userRoleContext, combinedPrompt, userId);
    }

    await this.logDocumentGeneration(tenantSlug, userId, templateId, format, result.filename, parameters);
    return result;
  }

  /**
   * Log document generation audit trail with executed_by: 'ai_on_behalf'.
   */
  async logDocumentGeneration(
    tenantSlug: string,
    userId: string | undefined,
    templateId: string,
    format: string,
    filename: string,
    parameters?: Record<string, any>,
  ): Promise<void> {
    try {
      const rows = await (this.databaseService as any).masterDataSource.query(
        `SELECT database_name FROM tenants WHERE slug = $1`,
        [tenantSlug],
      );
      if (!rows || !rows.length) return;
      const dataSource = await this.databaseService.getTenantConnection(rows[0].database_name);
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS ai_document_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR(100),
          user_id VARCHAR(100),
          template_id VARCHAR(100),
          format VARCHAR(20),
          filename VARCHAR(255),
          parameters JSONB,
          executed_by VARCHAR(50) DEFAULT 'ai_on_behalf',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await dataSource.query(
        `INSERT INTO ai_document_audit_logs (tenant_id, user_id, template_id, format, filename, parameters, executed_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'ai_on_behalf')`,
        [tenantSlug, userId || null, templateId, format, filename, JSON.stringify(parameters || {})]
      );
    } catch (err) {
      console.warn('Could not log AI document generation audit trail:', err.message);
    }
  }

  /**
   * Fetch real data from the tenant database based on the user prompt.
   * Provides the FULL schema (tables + columns) to the AI before it writes SQL.
   */
  private async fetchDatabaseData(tenantSlug: string, prompt: string): Promise<string> {
    try {
      const rows = await (this.databaseService as any).masterDataSource.query(
        `SELECT database_name FROM tenants WHERE slug = $1`,
        [tenantSlug],
      );
      if (!rows || !rows.length) return 'No tenant database found.';

      const dataSource = await this.databaseService.getTenantConnection(rows[0].database_name);

      // Fetch full schema: all tables with their columns
      const schemaRows = await dataSource.query(`
        SELECT c.table_name, c.column_name, c.data_type
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND t.table_schema = 'public'
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position
      `);

      // Build a human-readable schema string: "users(id, first_name, last_name, email, ...)"
      const schemaMap: Record<string, string[]> = {};
      for (const row of schemaRows) {
        if (!schemaMap[row.table_name]) schemaMap[row.table_name] = [];
        schemaMap[row.table_name].push(`${row.column_name}(${row.data_type})`);
      }
      const schemaStr = Object.entries(schemaMap)
        .map(([table, cols]) => `${table}(${cols.join(', ')})`)
        .join('\n');

      // Use AI to write correct SQL using the real schema
      const settings = await this.aiSettingsFetch.getSettings(tenantSlug);
      const modelName = settings.model || (settings.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-pro-001');
      let llm: any;

      if (settings.provider === 'vertex') {
        llm = new ChatGoogleGenerativeAI({ model: modelName, temperature: 0, apiKey: settings.api_key });
        if (settings.gcp_project_id && settings.api_key) {
          const { GoogleGenerativeAI } = require('@google/generative-ai');
          const gcpLocation = settings.gcp_location || 'us-central1';
          (llm as any).client = new GoogleGenerativeAI(settings.api_key).getGenerativeModel(
            { model: modelName },
            { baseUrl: `https://${gcpLocation}-aiplatform.googleapis.com`, apiVersion: `v1/projects/${settings.gcp_project_id}/locations/${gcpLocation}/publishers/google` }
          );
        }
      } else if (settings.provider === 'openai') {
        llm = new ChatOpenAI({ model: modelName, temperature: 0, apiKey: settings.api_key, configuration: settings.endpoint_url ? { baseURL: settings.endpoint_url } : undefined });
      } else if (settings.provider === 'anthropic') {
        llm = new ChatAnthropic({ model: modelName, temperature: 0, apiKey: settings.api_key });
      } else {
        llm = new ChatGoogleGenerativeAI({ model: modelName, temperature: 0, apiKey: settings.api_key });
      }

      const queryPlanResult = await llm.invoke([
        new HumanMessage({
          content: `You are a PostgreSQL expert. The user wants a document about: "${prompt}"

Here is the EXACT database schema with real column names — use ONLY these column names, never guess:
${schemaStr}

Write 1-3 SQL SELECT queries (only SELECT) to fetch the relevant data needed for this document.
CRITICAL: Only use column names that exist in the schema above. Do NOT add any column that is not listed.
Return ONLY the SQL queries separated by "---QUERY---", nothing else. No explanations, no markdown.
Example output:
SELECT id, first_name, last_name, email FROM users
---QUERY---
SELECT id, name FROM departments`
        }),
      ]);

      const queryPlan = typeof queryPlanResult.content === 'string' ? queryPlanResult.content : '';
      // Strip markdown code blocks if AI wraps them
      const cleanPlan = queryPlan.replace(/```sql\n?/gi, '').replace(/```\n?/gi, '').trim();
      const queries = cleanPlan.split('---QUERY---').map(q => q.trim()).filter(q => q.toUpperCase().startsWith('SELECT'));

      const results: string[] = [];
      for (const query of queries.slice(0, 3)) {
        try {
          const data = await dataSource.query(query);
          const jsonStr = JSON.stringify(data);
          results.push(`Query: ${query}\nResults: ${jsonStr.length > 8000 ? jsonStr.substring(0, 8000) + '...(truncated)' : jsonStr}`);
        } catch (e) {
          // On failure, try a simplified fallback using just the main table
          console.warn(`AI-doc query failed: ${query}`, e.message);
          results.push(`Query failed (bad column name or table): ${query}\nError: ${e.message}`);
        }
      }

      return results.join('\n\n---\n\n') || 'No data found.';
    } catch (error) {
      console.error('Error fetching database data for document:', error);
      return `Could not fetch database data: ${error.message}`;
    }
  }


  /**
   * Generate a meaningful filename from the user prompt.
   */
  private generateFilename(prompt: string): string {
    // Extract key words, remove special chars, limit length
    const cleaned = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('_');
    return cleaned || 'document';
  }

  private async generateContent(tenantSlug: string, roleContext: string, prompt: string, referenceText?: string): Promise<string> {
    // Step 1: Fetch REAL data from the database
    const realData = await this.fetchDatabaseData(tenantSlug, prompt);

    const settings = await this.aiSettingsFetch.getSettings(tenantSlug);
    let llm: any;
    const modelName = settings.model || (settings.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-pro-001');
    const temperature = 0.3;

    if (settings.provider === 'ollama') {
      const { ChatOllama } = await import('@langchain/ollama');
      llm = new ChatOllama({ model: modelName || 'llama3', temperature, baseUrl: settings.endpoint_url || 'http://localhost:11434' });
    } else if (settings.provider === 'vertex') {
      llm = new ChatGoogleGenerativeAI({ model: modelName, temperature, apiKey: settings.api_key });
      if (settings.gcp_project_id && settings.api_key) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const gcpLocation = settings.gcp_location || 'us-central1';
        (llm as any).client = new GoogleGenerativeAI(settings.api_key).getGenerativeModel(
          { model: modelName },
          { baseUrl: `https://${gcpLocation}-aiplatform.googleapis.com`, apiVersion: `v1/projects/${settings.gcp_project_id}/locations/${gcpLocation}/publishers/google` }
        );
      }
    } else if (settings.provider === 'openai') {
      llm = new ChatOpenAI({ model: modelName, temperature, apiKey: settings.api_key, configuration: settings.endpoint_url ? { baseURL: settings.endpoint_url } : undefined });
    } else if (settings.provider === 'anthropic') {
      llm = new ChatAnthropic({ model: modelName, temperature, apiKey: settings.api_key });
    } else {
      llm = new ChatGoogleGenerativeAI({ model: modelName, temperature, apiKey: settings.api_key });
    }

    const refSection = referenceText
      ? `\n\n=== USER-PROVIDED REFERENCE TEMPLATE STRUCTURE ===
The user has provided a custom reference template below. You MUST strictly mirror its structure, sections, table layouts, tone, and formatting style.
Replace any placeholder tokens (such as {{name}}, [Employee Name], {{salary}}, [Date], etc.) or example rows with the real database records provided above.
--- TEMPLATE CONTENT ---
${referenceText.substring(0, 6000)}
--- END TEMPLATE CONTENT ---\n`
      : '';

    const systemPrompt = `You are a professional business document writer for the Humanitas ERP platform.
User context: ${roleContext}
${refSection}

CRITICAL RULES:
1. You MUST use ONLY the data provided below from the database. Do NOT invent, guess, or add any data that is not in the database results.
2. If the data is empty or insufficient, state clearly that no data was found.
3. Format the document professionally in clean Markdown with title, sections, and tables.
4. Include a generation timestamp at the top.
5. Do NOT add any preamble — output the document directly.

=== ACTUAL DATABASE DATA ===
${realData}
=== END OF DATABASE DATA ===

Generate the document based strictly on the above data.`;

    const result = await llm.invoke([
      new HumanMessage({ content: systemPrompt + '\n\nDocument request: ' + prompt }),
    ]);
    return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
  }


  async generatePdf(tenantSlug: string, userRoleContext: string, prompt: string, referenceText?: string, userId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const markdownContent = await this.generateContent(tenantSlug, userRoleContext, prompt, referenceText);
    const filename = this.generateFilename(prompt);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new (PDFDocument as any)({ margin: 60, size: 'A4', bufferPages: true });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers) as any));
        doc.on('error', reject);

        // Parse and render markdown as styled PDF
        const lines = markdownContent.split('\n');
        let inTable = false;
        let tableRows: string[][] = [];

        const flushTable = () => {
          if (tableRows.length > 0) {
            const colCount = tableRows[0].length;
            const colWidth = (doc.page.width - 120) / colCount;
            tableRows.forEach((row, ri) => {
              if (ri === 1 && row.every(c => /^[-:]+$/.test(c.trim()))) return; // separator
              const y = doc.y;
              row.forEach((cell, ci) => {
                const isHeader = ri === 0;
                doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
                   .fontSize(9)
                   .text(cell.trim(), 60 + ci * colWidth, y, { width: colWidth - 4, continued: false });
              });
              doc.moveDown(0.3);
              if (ri === 0) {
                doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).stroke();
                doc.moveDown(0.2);
              }
            });
            tableRows = [];
            inTable = false;
            doc.moveDown(0.5);
          }
        };

        lines.forEach(line => {
          // Table row detection
          if (line.trim().startsWith('|')) {
            inTable = true;
            tableRows.push(line.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim()));
            return;
          }
          if (inTable) flushTable();

          if (line.startsWith('# ')) {
            doc.font('Helvetica-Bold').fontSize(22).fillColor('#1a1a2e').text(line.slice(2), { align: 'center' });
            doc.moveDown(0.4);
            doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).strokeColor('#3B82F6').lineWidth(2).stroke();
            doc.lineWidth(1).strokeColor('black');
            doc.moveDown(0.8);
          } else if (line.startsWith('## ')) {
            doc.moveDown(0.5);
            doc.font('Helvetica-Bold').fontSize(15).fillColor('#1e3a5f').text(line.slice(3));
            doc.moveDown(0.3);
          } else if (line.startsWith('### ')) {
            doc.moveDown(0.3);
            doc.font('Helvetica-Bold').fontSize(12).fillColor('#2c5282').text(line.slice(4));
            doc.moveDown(0.2);
          } else if (/^\d+\.\s/.test(line)) {
            doc.font('Helvetica').fontSize(10).fillColor('#222').text(line, { indent: 20 });
            doc.moveDown(0.2);
          } else if (line.startsWith('- ') || line.startsWith('* ')) {
            doc.font('Helvetica').fontSize(10).fillColor('#222').text('• ' + line.slice(2), { indent: 20 });
            doc.moveDown(0.2);
          } else if (line.startsWith('**') && line.endsWith('**')) {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#222').text(line.replace(/\*\*/g, ''));
            doc.moveDown(0.2);
          } else if (line.trim() === '' || line.trim() === '---') {
            doc.moveDown(0.4);
          } else {
            // Strip inline markdown bold/italic
            const clean = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1');
            doc.font('Helvetica').fontSize(10).fillColor('#333').text(clean);
            doc.moveDown(0.2);
          }
        });
        if (inTable) flushTable();

        // Footer
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          doc.font('Helvetica').fontSize(8).fillColor('#999')
             .text(`Generated by Humanitas AI  |  Page ${i + 1} of ${pageCount}`, 60, doc.page.height - 40, { align: 'center', width: doc.page.width - 120 });
        }

        doc.end();
      } catch (error) {
        reject(new BadRequestException('Failed to generate PDF document: ' + error.message));
      }
    });

    await this.logDocumentGeneration(tenantSlug, userId, 'custom_freeform', 'pdf', filename, { prompt });
    return { buffer, filename };
  }

  async generateDocx(tenantSlug: string, userRoleContext: string, prompt: string, referenceText?: string, userId?: string): Promise<{ buffer: Buffer; filename: string }> {
    const markdownContent = await this.generateContent(tenantSlug, userRoleContext, prompt, referenceText);
    const filename = this.generateFilename(prompt);

    const docx = await import('docx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } = docx;

    const children: any[] = [];
    const lines = markdownContent.split('\n');
    let tableRows: string[][] = [];
    let inTable = false;

    const flushDocxTable = () => {
      if (tableRows.length < 2) { tableRows = []; inTable = false; return; }
      const rows = tableRows
        .filter((_, i) => !(i === 1 && tableRows[i].every(c => /^[-:]+$/.test(c.trim()))))
        .map((row, ri) =>
          new TableRow({
            children: row.map(cell =>
              new TableCell({
                children: [new Paragraph({
                  children: [new TextRun({ text: cell.trim(), bold: ri === 0, size: 20 })],
                })],
                width: { size: Math.floor(9000 / row.length), type: WidthType.DXA },
              })
            ),
          })
        );
      children.push(new Table({ rows, width: { size: 9000, type: WidthType.DXA } }));
      children.push(new Paragraph(''));
      tableRows = []; inTable = false;
    };

    lines.forEach(line => {
      if (line.trim().startsWith('|')) {
        inTable = true;
        tableRows.push(line.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim()));
        return;
      }
      if (inTable) flushDocxTable();

      if (line.startsWith('# ')) {
        children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
      } else if (line.startsWith('## ')) {
        children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
      } else if (line.startsWith('### ')) {
        children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
      } else if (/^\d+\.\s/.test(line)) {
        children.push(new Paragraph({ text: line, numbering: undefined, indent: { left: 360 } }));
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(new Paragraph({ text: '• ' + line.slice(2), indent: { left: 360 } }));
      } else if (line.trim() === '' || line.trim() === '---') {
        children.push(new Paragraph(''));
      } else {
        // Handle bold inline
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const runs = parts.map(p => p.startsWith('**') ? new TextRun({ text: p.replace(/\*\*/g, ''), bold: true }) : new TextRun(p.replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1')));
        children.push(new Paragraph({ children: runs }));
      }
    });
    if (inTable) flushDocxTable();

    const doc = new Document({
      sections: [{
        properties: {},
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    await this.logDocumentGeneration(tenantSlug, userId, 'custom_freeform', 'docx', filename, { prompt });
    return { buffer, filename };
  }

  async generateExcel(tenantSlug: string, userRoleContext: string, prompt: string, userId?: string): Promise<{ buffer: Buffer; filename: string }> {
    try {
      const filename = this.generateFilename(prompt);
      // Fetch real data
      const realData = await this.fetchDatabaseData(tenantSlug, prompt);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Humanitas AI';
      workbook.created = new Date();

      // Parse the data into rows per query result
      const sections = realData.split('\n\n---\n\n');
      for (const section of sections) {
        const resultsMatch = section.match(/Results: (\[.*)/s);
        if (!resultsMatch) continue;
        try {
          const rows: any[] = JSON.parse(resultsMatch[1].replace('...(truncated)', ''));
          if (!rows.length) continue;
          const sheetName = filename.split('_').slice(0, 2).join(' ').substring(0, 30) || 'Data';
          const worksheet = workbook.addWorksheet(sheetName);
          // Set columns from first row keys
          const keys = Object.keys(rows[0]);
          worksheet.columns = keys.map(k => ({ header: k.replace(/_/g, ' ').toUpperCase(), key: k, width: 22 }));
          // Style header row
          worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
          worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
          // Add data rows
          rows.forEach(row => worksheet.addRow(row));
          break; // One sheet per generate call is enough
        } catch { continue; }
      }

      if (workbook.worksheets.length === 0) {
        const ws = workbook.addWorksheet('Result');
        ws.addRow(['No structured data found for this query.']);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      await this.logDocumentGeneration(tenantSlug, userId, 'custom_freeform', 'excel', filename, { prompt });
      return { buffer: buffer as any as Buffer, filename };
    } catch (error) {
      throw new BadRequestException('Failed to generate Excel document: ' + error.message);
    }
  }
}
