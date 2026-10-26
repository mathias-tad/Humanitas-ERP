import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';

const SYSTEM_DEFAULTS: Record<string, { displayName: string; subject: string; availableVariables: string[] }> = {
  'leave-approved': {
    displayName: 'Leave Approved Notification',
    subject: '✅ Your Leave Request Has Been Approved',
    availableVariables: ['employeeName', 'leaveType', 'startDate', 'endDate', 'approvedBy', 'deepLink'],
  },
  'leave-rejected': {
    displayName: 'Leave Rejected Notification',
    subject: '❌ Your Leave Request Has Been Rejected',
    availableVariables: ['employeeName', 'leaveType', 'startDate', 'endDate', 'reason', 'deepLink'],
  },
  'payroll-ready': {
    displayName: 'Payslip Ready Notification',
    subject: '💰 Your Payslip is Ready',
    availableVariables: ['employeeName', 'payPeriod', 'netPay', 'payDate', 'deepLink'],
  },
  'task-assigned': {
    displayName: 'Task Assigned Notification',
    subject: '📋 New Task Assigned',
    availableVariables: ['employeeName', 'taskTitle', 'projectName', 'dueDate', 'assignedBy', 'deepLink'],
  },
  'document-expiry': {
    displayName: 'Document Expiry Alert',
    subject: '⚠️ Document Expiring Soon',
    availableVariables: ['employeeName', 'documentName', 'expiryDate', 'daysRemaining', 'deepLink'],
  },
};

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);
  private ensuredTenants = new Set<string>();

  constructor(private databaseService: DatabaseService) {}

  private async getConnection(tenantId: string) {
    const conn = await this.databaseService.getTenantConnectionById(tenantId);
    if (!this.ensuredTenants.has(tenantId)) {
      await this.ensureTables(conn);
      this.ensuredTenants.add(tenantId);
    }
    return conn;
  }

  private async ensureTables(conn: any) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_key VARCHAR(100) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        html_body TEXT NOT NULL,
        plain_text_body TEXT,
        available_variables TEXT,
        is_system_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        last_edited_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(template_key, is_system_default)
      )
    `);

    // Seed system defaults
    await this.seedSystemDefaults(conn);
  }

  private getTemplateDir(): string {
    return path.join(__dirname, 'email-templates');
  }

  private readHbsFile(templateKey: string): string {
    try {
      const filePath = path.join(this.getTemplateDir(), `${templateKey}.hbs`);
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return `<p>Template not found: ${templateKey}</p>`;
    }
  }

  private async seedSystemDefaults(conn: any) {
    for (const [key, meta] of Object.entries(SYSTEM_DEFAULTS)) {
      const existing = await conn.query(
        `SELECT id FROM email_templates WHERE template_key = $1 AND is_system_default = TRUE`,
        [key],
      );
      if (existing.length === 0) {
        const htmlBody = this.readHbsFile(key);
        await conn.query(
          `INSERT INTO email_templates
             (template_key, display_name, subject, html_body, available_variables, is_system_default)
           VALUES ($1, $2, $3, $4, $5, TRUE)`,
          [key, meta.displayName, meta.subject, htmlBody, JSON.stringify(meta.availableVariables)],
        ).catch((err: any) => {
          this.logger.warn(`Could not seed template ${key}: ${err.message}`);
        });
      }
    }
  }

  async getTemplate(
    tenantId: string,
    templateKey: string,
  ): Promise<{ subject: string; html_body: string; plain_text_body?: string } | null> {
    try {
      const conn = await this.getConnection(tenantId);

      // Try custom tenant template first
      const custom = await conn.query(
        `SELECT subject, html_body, plain_text_body FROM email_templates
         WHERE template_key = $1 AND is_system_default = FALSE AND is_active = TRUE`,
        [templateKey],
      );
      if (custom.length > 0) return custom[0];

      // Fall back to system default
      const defaults = await conn.query(
        `SELECT subject, html_body, plain_text_body FROM email_templates
         WHERE template_key = $1 AND is_system_default = TRUE`,
        [templateKey],
      );
      if (defaults.length > 0) return defaults[0];
    } catch (err: any) {
      this.logger.warn(`Could not load template ${templateKey}: ${err.message}`);
    }
    return null;
  }

  async getAllTemplates(tenantId: string): Promise<any[]> {
    const conn = await this.getConnection(tenantId);

    const rows = await conn.query(`
      SELECT
        s.template_key,
        s.display_name,
        s.subject             AS default_subject,
        s.available_variables,
        c.subject             AS custom_subject,
        c.html_body           AS custom_html_body,
        c.plain_text_body     AS custom_plain_text_body,
        c.updated_at          AS custom_updated_at,
        (c.id IS NOT NULL)    AS is_customized
      FROM email_templates s
      LEFT JOIN email_templates c
        ON c.template_key = s.template_key AND c.is_system_default = FALSE AND c.is_active = TRUE
      WHERE s.is_system_default = TRUE
      ORDER BY s.template_key
    `);

    return rows;
  }

  async upsertTemplate(
    tenantId: string,
    templateKey: string,
    data: { subject: string; html_body: string; plain_text_body?: string },
    editedBy: string,
  ): Promise<void> {
    const conn = await this.getConnection(tenantId);

    const exists = await conn.query(
      `SELECT id FROM email_templates WHERE template_key = $1 AND is_system_default = FALSE`,
      [templateKey],
    );

    if (exists.length > 0) {
      await conn.query(
        `UPDATE email_templates
         SET subject = $1, html_body = $2, plain_text_body = $3, last_edited_by = $4, updated_at = NOW(), is_active = TRUE
         WHERE template_key = $5 AND is_system_default = FALSE`,
        [data.subject, data.html_body, data.plain_text_body || null, editedBy, templateKey],
      );
    } else {
      const meta = SYSTEM_DEFAULTS[templateKey];
      await conn.query(
        `INSERT INTO email_templates
           (template_key, display_name, subject, html_body, plain_text_body, available_variables, is_system_default, last_edited_by)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)`,
        [
          templateKey,
          meta?.displayName || templateKey,
          data.subject,
          data.html_body,
          data.plain_text_body || null,
          JSON.stringify(meta?.availableVariables || []),
          editedBy,
        ],
      );
    }
  }

  async resetToDefault(tenantId: string, templateKey: string): Promise<void> {
    const conn = await this.getConnection(tenantId);
    await conn.query(
      `UPDATE email_templates SET is_active = FALSE WHERE template_key = $1 AND is_system_default = FALSE`,
      [templateKey],
    );
  }

  async previewTemplate(
    tenantId: string,
    templateKey: string,
    sampleData?: Record<string, string>,
  ): Promise<string> {
    const template = await this.getTemplate(tenantId, templateKey);
    if (!template) return '<p>Template not found.</p>';

    const meta = SYSTEM_DEFAULTS[templateKey];
    const defaultSample: Record<string, any> = {
      employeeName: 'John Smith',
      leaveType: 'Annual Leave',
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      approvedBy: 'Sarah Manager',
      reason: 'Team capacity',
      payPeriod: 'October 2026',
      netPay: '$3,500.00',
      payDate: '2026-10-31',
      taskTitle: 'Prepare Q4 Report',
      projectName: 'Finance Alpha',
      dueDate: '2026-11-15',
      assignedBy: 'PM Admin',
      documentName: 'Employee Contract',
      expiryDate: '2026-12-31',
      daysRemaining: 67,
      deepLink: '#preview',
    };

    const context = { ...defaultSample, ...(sampleData || {}) };

    try {
      const compiled = Handlebars.compile(template.html_body);
      return compiled(context);
    } catch (err: any) {
      return `<p>Preview error: ${err.message}</p>`;
    }
  }
}
