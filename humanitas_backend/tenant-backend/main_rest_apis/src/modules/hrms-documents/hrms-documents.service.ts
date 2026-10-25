import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateDocumentDto,
  VerifyDocumentDto,
  DocumentsFilterDto,
  CreateLetterTemplateDto,
  UpdateLetterTemplateDto,
  GenerateLetterDto,
  VerificationStatus,
  DocumentCategory,
} from './dto/hrms-documents.dto';

@Injectable()
export class HrmsDocumentsService {
  private readonly logger = new Logger(HrmsDocumentsService.name);
  private ensuredTenants = new Set<string>();

  constructor(private readonly databaseService: DatabaseService) {}

  private async getConnection(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    if (!this.ensuredTenants.has(tenantId)) {
      await this.ensureTables(connection);
      this.ensuredTenants.add(tenantId);
    }
    return connection;
  }

  async ensureTables(connection: any) {
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS letter_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID,
          branch_id UUID,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50) NOT NULL UNIQUE,
          category VARCHAR(50) NOT NULL DEFAULT 'employment',
          description TEXT,
          subject VARCHAR(255) NOT NULL,
          body_template TEXT NOT NULL,
          is_system BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS employee_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID,
          branch_id UUID,
          user_id UUID NOT NULL,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL,
          document_type VARCHAR(50) NOT NULL,
          file_url TEXT NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_size INTEGER NOT NULL DEFAULT 0,
          mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
          issue_date DATE,
          expiry_date DATE,
          verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
          verified_by UUID,
          verified_at TIMESTAMP WITH TIME ZONE,
          signature_status VARCHAR(30) NOT NULL DEFAULT 'not_required',
          signed_at TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          is_confidential BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_emp_docs_user ON employee_documents(user_id);
        CREATE INDEX IF NOT EXISTS idx_emp_docs_expiry ON employee_documents(expiry_date);
        CREATE INDEX IF NOT EXISTS idx_emp_docs_company ON employee_documents(company_id);
        CREATE INDEX IF NOT EXISTS idx_emp_docs_branch ON employee_documents(branch_id);
      `);

      await this.seedDefaultTemplates(connection);
    } catch (err) {
      this.logger.error(`Error ensuring document tables: ${err.message}`);
    }
  }

  private async seedDefaultTemplates(connection: any) {
    const defaultTemplates = [
      {
        code: 'OFFER_LETTER',
        name: 'Employment Offer Letter',
        category: 'recruitment',
        description: 'Standard conditional employment offer detailing salary, position, and start date.',
        subject: 'Offer of Employment — {{company_name}}',
        body_template: `Dear {{employee_name}},

On behalf of {{company_name}}, we are delighted to offer you the position of {{job_title}} in our {{department}} department.

Key Terms of Offer:
- Position: {{job_title}}
- Department: {{department}}
- Base Monthly Salary: {{salary}}
- Anticipated Start Date: {{hire_date}}
- Office Location: {{company_address}}

Please confirm your acceptance of this offer by signing and returning this letter by {{effective_date}}.

Sincerely,
{{signee_name}}
{{signee_title}}
{{company_name}}`,
        is_system: true,
      },
      {
        code: 'EMPLOYMENT_CONTRACT',
        name: 'Full-Time Employment Agreement',
        category: 'employment',
        description: 'Comprehensive employment contract establishing duties, compensation, confidentiality, and notice periods.',
        subject: 'Employment Agreement — {{employee_name}}',
        body_template: `EMPLOYMENT AGREEMENT

This Agreement is entered into on {{effective_date}} between {{company_name}} ("Employer") and {{employee_name}} ("Employee").

1. APPOINTMENT & DUTIES:
The Employer engages the Employee as {{job_title}} in the {{department}} team.

2. COMPENSATION:
The Employee shall receive a gross monthly salary of {{salary}}, payable in accordance with the standard monthly payroll cycle.

3. COMMENCEMENT:
Employment commences on {{hire_date}}.

4. CONFIDENTIALITY & GOVERNING LAW:
The Employee agrees to maintain strict confidentiality regarding all proprietary information.

EMPLOYER: ____________________          EMPLOYEE: ____________________
{{signee_name}}, {{company_name}}         {{employee_name}}`,
        is_system: true,
      },
      {
        code: 'EXPERIENCE_LETTER',
        name: 'Certificate of Service & Experience',
        category: 'verification',
        description: 'Formal statement verifying an employee tenure, job title, and good standing.',
        subject: 'Experience & Service Certificate — {{employee_name}}',
        body_template: `TO WHOM IT MAY CONCERN

This is to certify that {{employee_name}} (Employee ID: {{employee_id}}) was employed with {{company_name}} as {{job_title}} in the {{department}} department from {{hire_date}} to {{effective_date}}.

During their tenure, {{employee_name}} discharged their professional duties diligently and exhibited exemplary teamwork, professional competence, and integrity.

We wish {{employee_name}} continued success in all future professional endeavors.

Issued on: {{effective_date}}

{{signee_name}}
{{signee_title}}
{{company_name}}`,
        is_system: true,
      },
      {
        code: 'SALARY_CERTIFICATE',
        name: 'Salary & Proof of Employment Certificate',
        category: 'verification',
        description: 'Official proof of employment and monthly compensation for banking, loans, or visa embassies.',
        subject: 'Salary Certificate — {{employee_name}}',
        body_template: `TO WHOM IT MAY CONCERN

This is to certify that {{employee_name}} is currently employed with {{company_name}} on a permanent full-time basis as {{job_title}} within the {{department}} department, having commenced employment on {{hire_date}}.

Current Monthly Remuneration:
- Gross Monthly Compensation: {{salary}}
- Employment Status: Active / Full-Time
- Official Work Location: {{company_address}}

This certificate is issued upon the employee's request for official banking/legal purposes without any liability on the part of the issuing company.

Issued by:
{{signee_name}}
{{signee_title}}
{{company_name}}`,
        is_system: true,
      },
      {
        code: 'PROMOTION_LETTER',
        name: 'Promotion & Compensation Revision Notice',
        category: 'compensation',
        description: 'Notification of career advancement, title elevation, and revised compensation package.',
        subject: 'Notice of Promotion — {{employee_name}}',
        body_template: `Dear {{employee_name}},

In recognition of your exceptional performance, dedication, and leadership within the {{department}} department, {{company_name}} is pleased to inform you of your promotion to {{job_title}}, effective {{effective_date}}.

In conjunction with this promotion, your revised gross monthly compensation is {{salary}}.

We thank you for your commitment to excellence and look forward to your continued contributions to the growth of {{company_name}}.

Warm congratulations,

{{signee_name}}
{{signee_title}}
{{company_name}}`,
        is_system: true,
      },
      {
        code: 'WARNING_LETTER',
        name: 'Formal Disciplinary Notice',
        category: 'disciplinary',
        description: 'Official record of workplace non-compliance or performance deficiency.',
        subject: 'Formal Written Notice — {{employee_name}}',
        body_template: `CONFIDENTIAL - FORMAL DISCIPLINARY NOTICE

Date: {{effective_date}}
To: {{employee_name}}
Department: {{department}}
Position: {{job_title}}

Dear {{employee_name}},

This letter serves as a formal written notice regarding performance or conduct standards at {{company_name}}.

Expected Standards & Immediate Corrective Actions:
You are required to adhere strictly to company operational policies and fulfill your core responsibilities as {{job_title}}. Continued failure to meet required standards may result in further disciplinary action in accordance with company labor regulations.

Please acknowledge receipt of this letter below.

Issued by:
{{signee_name}}
{{signee_title}}

Employee Acknowledgment: ____________________ Date: ____________`,
        is_system: true,
      },
    ];

    for (const t of defaultTemplates) {
      await connection.query(
        `INSERT INTO letter_templates (code, name, category, description, subject, body_template, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (code) DO NOTHING`,
        [t.code, t.name, t.category, t.description, t.subject, t.body_template, t.is_system],
      );
    }
  }

  async getDocuments(tenantId: string, filters: DocumentsFilterDto) {
    const connection = await this.getConnection(tenantId);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (filters.userId) {
      conditions.push(`d.user_id = $${idx++}`);
      params.push(filters.userId);
    }

    if (filters.category) {
      conditions.push(`d.category = $${idx++}`);
      params.push(filters.category);
    }

    if (filters.verificationStatus) {
      conditions.push(`d.verification_status = $${idx++}`);
      params.push(filters.verificationStatus);
    }

    if (filters.company_id) {
      conditions.push(`d.company_id = $${idx++}`);
      params.push(filters.company_id);
    }

    if (filters.branch_id) {
      conditions.push(`d.branch_id = $${idx++}`);
      params.push(filters.branch_id);
    }

    if (filters.expiringWithinDays) {
      if (filters.expiringWithinDays === 'expired') {
        conditions.push(`d.expiry_date IS NOT NULL AND d.expiry_date < CURRENT_DATE`);
      } else {
        const days = parseInt(filters.expiringWithinDays, 10);
        if (!isNaN(days)) {
          conditions.push(`d.expiry_date IS NOT NULL AND d.expiry_date >= CURRENT_DATE AND d.expiry_date <= (CURRENT_DATE + INTERVAL '${days} days')`);
        }
      }
    }

    if (filters.search) {
      conditions.push(`(
        d.title ILIKE $${idx} OR
        d.document_type ILIKE $${idx} OR
        u.first_name ILIKE $${idx} OR
        u.last_name ILIKE $${idx} OR
        u.email ILIKE $${idx}
      )`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const query = `
      SELECT 
        d.*,
        u.first_name,
        u.last_name,
        u.email,
        u.department,
        u.position,
        v.first_name as verified_by_first_name,
        v.last_name as verified_by_last_name,
        CASE
          WHEN d.expiry_date IS NULL THEN 'no_expiry'
          WHEN d.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN d.expiry_date <= (CURRENT_DATE + INTERVAL '30 days') THEN 'expiring_soon'
          ELSE 'valid'
        END as expiry_status,
        CASE
          WHEN d.expiry_date IS NOT NULL THEN (d.expiry_date - CURRENT_DATE)
          ELSE NULL
        END as days_until_expiry
      FROM employee_documents d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN users v ON d.verified_by = v.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.created_at DESC
    `;

    return connection.query(query, params);
  }

  async getDocumentById(tenantId: string, id: string) {
    const connection = await this.getConnection(tenantId);
    const docs = await connection.query(
      `SELECT d.*, u.first_name, u.last_name, u.email, u.department, u.position
       FROM employee_documents d
       JOIN users u ON d.user_id = u.id
       WHERE d.id = $1`,
      [id],
    );
    if (!docs || docs.length === 0) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }
    return docs[0];
  }

  async createDocument(tenantId: string, dto: CreateDocumentDto, creatorUserId?: string) {
    const connection = await this.getConnection(tenantId);

    // Verify employee exists
    const users = await connection.query(`SELECT id, company_id, branch_id FROM users WHERE id = $1`, [dto.userId]);
    if (!users || users.length === 0) {
      throw new NotFoundException(`Employee with ID "${dto.userId}" not found`);
    }

    const companyId = dto.company_id || users[0].company_id;
    const branchId = dto.branch_id || users[0].branch_id;

    const result = await connection.query(
      `INSERT INTO employee_documents (
        user_id, company_id, branch_id, title, category, document_type,
        file_url, file_name, file_size, mime_type, issue_date, expiry_date,
        notes, is_confidential, signature_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        dto.userId,
        companyId,
        branchId,
        dto.title,
        dto.category,
        dto.documentType,
        dto.fileUrl,
        dto.fileName,
        dto.fileSize || 0,
        dto.mimeType || 'application/pdf',
        dto.issueDate ? new Date(dto.issueDate) : null,
        dto.expiryDate ? new Date(dto.expiryDate) : null,
        dto.notes || null,
        dto.isConfidential ?? false,
        dto.signatureStatus || 'not_required',
      ],
    );

    return result[0];
  }

  async verifyDocument(tenantId: string, id: string, dto: VerifyDocumentDto, verifierUserId: string) {
    const connection = await this.getConnection(tenantId);
    const existing = await this.getDocumentById(tenantId, id);

    const result = await connection.query(
      `UPDATE employee_documents 
       SET verification_status = $1, verified_by = $2, verified_at = NOW(), notes = COALESCE($3, notes), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [dto.status, verifierUserId, dto.notes || null, id],
    );

    return result[0];
  }

  async deleteDocument(tenantId: string, id: string) {
    const connection = await this.getConnection(tenantId);
    await this.getDocumentById(tenantId, id);
    await connection.query(`DELETE FROM employee_documents WHERE id = $1`, [id]);
    return { success: true, message: 'Document deleted successfully' };
  }

  async getExpiringDocumentsSummary(tenantId: string, scope?: { company_id?: string; branch_id?: string }) {
    const connection = await this.getConnection(tenantId);

    const conditions: string[] = ['d.expiry_date IS NOT NULL'];
    const params: any[] = [];
    let idx = 1;

    if (scope?.company_id) {
      conditions.push(`d.company_id = $${idx++}`);
      params.push(scope.company_id);
    }
    if (scope?.branch_id) {
      conditions.push(`d.branch_id = $${idx++}`);
      params.push(scope.branch_id);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await connection.query(
      `SELECT
        COUNT(CASE WHEN d.expiry_date < CURRENT_DATE THEN 1 END) as expired_count,
        COUNT(CASE WHEN d.expiry_date >= CURRENT_DATE AND d.expiry_date <= (CURRENT_DATE + INTERVAL '30 days') THEN 1 END) as expiring_30_days,
        COUNT(CASE WHEN d.expiry_date > (CURRENT_DATE + INTERVAL '30 days') AND d.expiry_date <= (CURRENT_DATE + INTERVAL '60 days') THEN 1 END) as expiring_60_days,
        COUNT(CASE WHEN d.expiry_date > (CURRENT_DATE + INTERVAL '60 days') AND d.expiry_date <= (CURRENT_DATE + INTERVAL '90 days') THEN 1 END) as expiring_90_days,
        COUNT(CASE WHEN d.expiry_date >= CURRENT_DATE THEN 1 END) as total_active_tracked
       FROM employee_documents d
       WHERE ${whereClause}`,
      params,
    );

    const upcomingDocs = await connection.query(
      `SELECT 
        d.id, d.title, d.category, d.document_type, d.expiry_date,
        u.id as user_id, u.first_name, u.last_name, u.department,
        (d.expiry_date - CURRENT_DATE) as days_remaining
       FROM employee_documents d
       JOIN users u ON d.user_id = u.id
       WHERE ${whereClause} AND d.expiry_date <= (CURRENT_DATE + INTERVAL '90 days')
       ORDER BY d.expiry_date ASC
       LIMIT 10`,
      params,
    );

    const counts = countRes[0] || {};
    return {
      expiredCount: parseInt(counts.expired_count || '0', 10),
      expiring30Days: parseInt(counts.expiring_30_days || '0', 10),
      expiring60Days: parseInt(counts.expiring_60_days || '0', 10),
      expiring90Days: parseInt(counts.expiring_90_days || '0', 10),
      totalActiveTracked: parseInt(counts.total_active_tracked || '0', 10),
      upcomingExpiringDocuments: upcomingDocs,
    };
  }

  async getLetterTemplates(tenantId: string, scope?: { company_id?: string; branch_id?: string }) {
    const connection = await this.getConnection(tenantId);
    let query = `SELECT * FROM letter_templates WHERE is_system = true`;
    const params: any[] = [];

    if (scope?.company_id) {
      query += ` OR company_id = $1`;
      params.push(scope.company_id);
    } else {
      query += ` OR company_id IS NULL`;
    }

    query += ` ORDER BY is_system DESC, name ASC`;
    return connection.query(query, params);
  }

  async getLetterTemplateById(tenantId: string, idOrCode: string) {
    const connection = await this.getConnection(tenantId);
    const res = await connection.query(
      `SELECT * FROM letter_templates WHERE id::text = $1 OR code = $1 LIMIT 1`,
      [idOrCode],
    );
    if (!res || res.length === 0) {
      throw new NotFoundException(`Letter template "${idOrCode}" not found`);
    }
    return res[0];
  }

  async createLetterTemplate(tenantId: string, dto: CreateLetterTemplateDto) {
    const connection = await this.getConnection(tenantId);

    const existing = await connection.query(`SELECT id FROM letter_templates WHERE code = $1`, [dto.code]);
    if (existing && existing.length > 0) {
      throw new BadRequestException(`Template with code "${dto.code}" already exists`);
    }

    const res = await connection.query(
      `INSERT INTO letter_templates (name, code, category, description, subject, body_template, company_id, branch_id, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
       RETURNING *`,
      [dto.name, dto.code, dto.category || 'employment', dto.description || null, dto.subject, dto.bodyTemplate, dto.company_id || null, dto.branch_id || null],
    );
    return res[0];
  }

  async updateLetterTemplate(tenantId: string, id: string, dto: UpdateLetterTemplateDto) {
    const connection = await this.getConnection(tenantId);
    const template = await this.getLetterTemplateById(tenantId, id);

    const res = await connection.query(
      `UPDATE letter_templates
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           subject = COALESCE($3, subject),
           body_template = COALESCE($4, body_template),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [dto.name || null, dto.description || null, dto.subject || null, dto.bodyTemplate || null, template.id],
    );
    return res[0];
  }

  async generateLetter(tenantId: string, dto: GenerateLetterDto, issuerUserId?: string) {
    const connection = await this.getConnection(tenantId);

    const template = await this.getLetterTemplateById(tenantId, dto.templateIdOrCode);

    // Fetch employee data
    const users = await connection.query(
      `SELECT u.*, c.name as company_name, c.address as company_address, c.email as company_email
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [dto.employeeId],
    );
    if (!users || users.length === 0) {
      throw new NotFoundException(`Employee with ID "${dto.employeeId}" not found`);
    }
    const emp = users[0];

    // Fetch issuer / signee data
    let signeeName = 'Human Resources Department';
    let signeeTitle = 'HR Director';
    if (issuerUserId) {
      const issuers = await connection.query(`SELECT first_name, last_name, position FROM users WHERE id = $1`, [issuerUserId]);
      if (issuers && issuers.length > 0) {
        signeeName = `${issuers[0].first_name || ''} ${issuers[0].last_name || ''}`.trim() || signeeName;
        signeeTitle = issuers[0].position || signeeTitle;
      }
    }

    const employeeFullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;
    const salaryFormatted = emp.base_salary ? `ETB ${parseFloat(emp.base_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'ETB Confidential';
    const hireDateFormatted = emp.created_at ? new Date(emp.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
    const effectiveDateFormatted = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const tokens: Record<string, string> = {
      '{{employee_name}}': employeeFullName,
      '{{employee_id}}': emp.id.substring(0, 8).toUpperCase(),
      '{{job_title}}': emp.position || 'Staff Member',
      '{{department}}': emp.department || 'General',
      '{{salary}}': salaryFormatted,
      '{{hire_date}}': hireDateFormatted,
      '{{company_name}}': emp.company_name || 'Humanitas Enterprise',
      '{{company_address}}': emp.company_address || 'Addis Ababa, Ethiopia',
      '{{effective_date}}': effectiveDateFormatted,
      '{{signee_name}}': signeeName,
      '{{signee_title}}': signeeTitle,
      ...(dto.customTokens || {}),
    };

    let renderedSubject = template.subject;
    let renderedBody = template.body_template;

    for (const [key, val] of Object.entries(tokens)) {
      renderedSubject = renderedSubject.split(key).join(val);
      renderedBody = renderedBody.split(key).join(val);
    }

    const renderedHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; line-height: 1.6;">
        <div style="border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: bold;">${emp.company_name || 'Humanitas Enterprise'}</h1>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">${emp.company_address || 'Corporate Headquarters'}</p>
        </div>
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0 0 10px; color: #0284c7; font-size: 18px; font-weight: 600;">${renderedSubject}</h2>
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">Date: ${effectiveDateFormatted}</p>
        </div>
        <div style="white-space: pre-wrap; font-size: 14px; margin-bottom: 40px; color: #334155;">
${renderedBody}
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #94a3b8; text-align: center;">
          This document is generated by Humanitas People Intelligence & Document Management System. Document verification ID: ${emp.id.substring(0, 8)}-${Date.now().toString(36)}.
        </div>
      </div>
    `;

    let vaultDocumentId: string | null = null;
    if (dto.saveToVault) {
      const docRes = await connection.query(
        `INSERT INTO employee_documents (
          user_id, company_id, branch_id, title, category, document_type,
          file_url, file_name, file_size, mime_type, issue_date,
          verification_status, verified_by, verified_at, signature_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_DATE, 'verified', $11, NOW(), 'signed')
        RETURNING id`,
        [
          dto.employeeId,
          emp.company_id,
          emp.branch_id,
          `${template.name} — ${employeeFullName}`,
          DocumentCategory.LETTER,
          template.code.toLowerCase(),
          `data:text/html;charset=utf-8,${encodeURIComponent(renderedHtml)}`,
          `${template.code}_${employeeFullName.replace(/\s+/g, '_')}.html`,
          Buffer.byteLength(renderedHtml, 'utf8'),
          'text/html',
          issuerUserId || null,
        ],
      );
      vaultDocumentId = docRes[0]?.id || null;
    }

    return {
      templateCode: template.code,
      templateName: template.name,
      employeeId: dto.employeeId,
      employeeName: employeeFullName,
      subject: renderedSubject,
      renderedText: renderedBody,
      renderedHtml,
      savedToVault: !!dto.saveToVault,
      vaultDocumentId,
    };
  }
}
