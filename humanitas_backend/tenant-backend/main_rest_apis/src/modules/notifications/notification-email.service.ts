import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { EmailTemplatesService } from './email-templates.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../auth/entities/tenant.entity';

export interface EmailContext {
  [key: string]: any;
}

export interface SendEmailOptions {
  tenantSlug: string;
  tenantId?: string;
  to: string | string[];
  subject: string;
  templateName: string;
  context: EmailContext;
  deepLink?: string;
}

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);
  private fsTemplateCache = new Map<string, HandlebarsTemplateDelegate>();
  private baseTemplate: HandlebarsTemplateDelegate | null = null;

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private databaseService: DatabaseService,
    private emailTemplatesService: EmailTemplatesService,
  ) {}

  private getTemplateDir(): string {
    return path.join(__dirname, 'email-templates');
  }

  private compileFsTemplate(templateName: string): HandlebarsTemplateDelegate {
    if (this.fsTemplateCache.has(templateName)) {
      return this.fsTemplateCache.get(templateName)!;
    }
    const templatePath = path.join(this.getTemplateDir(), `${templateName}.hbs`);
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const compiled = Handlebars.compile(templateSource);
    this.fsTemplateCache.set(templateName, compiled);
    return compiled;
  }

  private getBaseTemplate(): HandlebarsTemplateDelegate {
    if (!this.baseTemplate) {
      const basePath = path.join(this.getTemplateDir(), 'base.hbs');
      const baseSource = fs.readFileSync(basePath, 'utf8');
      this.baseTemplate = Handlebars.compile(baseSource);
    }
    return this.baseTemplate;
  }

  private async getTenantEmailSettings(tenantSlug: string): Promise<{
    host: string; port: number; user: string; pass: string;
    fromName: string; fromEmail: string;
    logoUrl?: string; companyName: string;
    appUrl: string;
  }> {
    try {
      const tenant = await this.tenantRepository.findOne({ where: { slug: tenantSlug } });
      if (tenant?.database_name) {
        const conn = await this.databaseService.getTenantConnection(tenant.database_name);
        const rows = await conn.query(
          `SELECT key, value FROM system_settings WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from_name','smtp_from_email','company_logo_url','company_name','app_url') LIMIT 20`
        ).catch(() => []);
        const settingsMap: Record<string, string> = {};
        for (const row of rows) {
          if (row.key && row.value) settingsMap[row.key] = row.value;
        }
        if (settingsMap['smtp_host']) {
          return {
            host: settingsMap['smtp_host'],
            port: parseInt(settingsMap['smtp_port'] || '587'),
            user: settingsMap['smtp_user'] || '',
            pass: settingsMap['smtp_pass'] || '',
            fromName: settingsMap['smtp_from_name'] || settingsMap['company_name'] || 'Humanitas',
            fromEmail: settingsMap['smtp_from_email'] || 'noreply@humanitas.app',
            logoUrl: settingsMap['company_logo_url'],
            companyName: settingsMap['company_name'] || 'Humanitas',
            appUrl: settingsMap['app_url'] || process.env.APP_URL || 'https://app.humanitas.io',
          };
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not load tenant email settings for ${tenantSlug}: ${err.message}`);
    }

    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromName: process.env.SMTP_FROM_NAME || 'Humanitas',
      fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@humanitas.app',
      logoUrl: process.env.COMPANY_LOGO_URL,
      companyName: process.env.COMPANY_NAME || 'Humanitas',
      appUrl: process.env.APP_URL || 'https://app.humanitas.io',
    };
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const settings = await this.getTenantEmailSettings(options.tenantSlug);

    if (!settings.user && !settings.host) {
      this.logger.warn(`Email not configured for tenant ${options.tenantSlug} — skipping email send`);
      return;
    }

    try {
      const baseTemplate = this.getBaseTemplate();
      const context = { ...options.context, deepLink: options.deepLink || settings.appUrl };
      let html: string;
      let subject = options.subject;

      // Try DB template first (tenant custom or system default)
      const tenantId = options.tenantId;
      const dbTemplate = tenantId
        ? await this.emailTemplatesService.getTemplate(tenantId, options.templateName).catch(() => null)
        : null;

      if (dbTemplate) {
        // Use DB template — subject comes from DB
        subject = dbTemplate.subject;
        const compiled = Handlebars.compile(dbTemplate.html_body);
        const content = compiled(context);
        html = baseTemplate({
          content,
          companyName: settings.companyName,
          logoUrl: settings.logoUrl,
          unsubscribeUrl: `${settings.appUrl}/settings/notifications`,
        });
      } else {
        // Fallback to filesystem .hbs template
        const contentTemplate = this.compileFsTemplate(options.templateName);
        const content = contentTemplate(context);
        html = baseTemplate({
          content,
          companyName: settings.companyName,
          logoUrl: settings.logoUrl,
          unsubscribeUrl: `${settings.appUrl}/settings/notifications`,
        });
      }

      // Plain text fallback
      const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.port === 465,
        auth: settings.user ? { user: settings.user, pass: settings.pass } : undefined,
      });

      await transporter.sendMail({
        from: `"${settings.fromName}" <${settings.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject,
        html,
        text,
      });

      this.logger.log(`Email sent to ${options.to} (template: ${options.templateName})`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${options.to}: ${err.message}`);
      // Don't throw — email failure should never break main flow
    }
  }

  // Convenience methods for each notification type
  async sendLeaveApproved(
    tenantSlug: string,
    to: string,
    ctx: { employeeName: string; leaveType: string; startDate: string; endDate: string; approvedBy: string },
    appUrl: string,
    tenantId?: string,
  ): Promise<void> {
    await this.sendEmail({
      tenantSlug, tenantId, to,
      subject: '✅ Your Leave Request Has Been Approved',
      templateName: 'leave-approved',
      context: ctx,
      deepLink: `${appUrl}/leave/my-requests`,
    });
  }

  async sendLeaveRejected(
    tenantSlug: string,
    to: string,
    ctx: { employeeName: string; leaveType: string; startDate: string; endDate: string; reason?: string },
    appUrl: string,
    tenantId?: string,
  ): Promise<void> {
    await this.sendEmail({
      tenantSlug, tenantId, to,
      subject: '❌ Your Leave Request Has Been Rejected',
      templateName: 'leave-rejected',
      context: ctx,
      deepLink: `${appUrl}/leave/my-requests`,
    });
  }

  async sendPayrollReady(
    tenantSlug: string,
    to: string,
    ctx: { employeeName: string; payPeriod: string; netPay: string; payDate: string },
    appUrl: string,
    tenantId?: string,
  ): Promise<void> {
    await this.sendEmail({
      tenantSlug, tenantId, to,
      subject: '💰 Your Payslip is Ready',
      templateName: 'payroll-ready',
      context: ctx,
      deepLink: `${appUrl}/payroll/my-payslip`,
    });
  }

  async sendTaskAssigned(
    tenantSlug: string,
    to: string,
    ctx: { employeeName: string; taskTitle: string; projectName: string; dueDate: string; assignedBy: string },
    taskId: string,
    appUrl: string,
    tenantId?: string,
  ): Promise<void> {
    await this.sendEmail({
      tenantSlug, tenantId, to,
      subject: `📋 New Task Assigned: ${ctx.taskTitle}`,
      templateName: 'task-assigned',
      context: ctx,
      deepLink: `${appUrl}/pms/all-tasks?task=${taskId}`,
    });
  }

  async sendDocumentExpiry(
    tenantSlug: string,
    to: string,
    ctx: { employeeName: string; documentName: string; expiryDate: string; daysRemaining: number },
    appUrl: string,
    tenantId?: string,
  ): Promise<void> {
    await this.sendEmail({
      tenantSlug, tenantId, to,
      subject: `⚠️ Document Expiring: ${ctx.documentName}`,
      templateName: 'document-expiry',
      context: ctx,
      deepLink: `${appUrl}/hrms/documents`,
    });
  }
}
