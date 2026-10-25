import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'crypto';
import {
  CreateExpenseCategoryDto,
  CreateExpenseReportDto,
  UpdateExpenseReportDto,
  CreateExpenseItemDto,
  ApproveExpenseReportDto,
  ExpenseReportStatus,
  ExpenseItemStatus,
} from './dto/hrms-expenses.dto';

@Injectable()
export class HrmsExpensesService {
  private readonly logger = new Logger(HrmsExpensesService.name);
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

  private async ensureTables(connection: any) {
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS expense_categories (
          id VARCHAR(36) PRIMARY KEY,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          name VARCHAR(100) NOT NULL,
          code VARCHAR(50) NOT NULL,
          description TEXT,
          spending_limit DECIMAL(12,2),
          daily_per_diem_cap DECIMAL(12,2),
          requires_receipt BOOLEAN DEFAULT TRUE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expense_reports (
          id VARCHAR(36) PRIMARY KEY,
          report_number VARCHAR(50) NOT NULL,
          employee_id VARCHAR(36) NOT NULL,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          title VARCHAR(255) NOT NULL,
          purpose TEXT,
          status VARCHAR(50) DEFAULT 'draft',
          total_amount DECIMAL(12,2) DEFAULT 0,
          approved_amount DECIMAL(12,2) DEFAULT 0,
          currency VARCHAR(10) DEFAULT 'USD',
          submitted_at TIMESTAMP,
          approved_by VARCHAR(36),
          approved_at TIMESTAMP,
          rejection_reason TEXT,
          reimbursed_at TIMESTAMP,
          include_in_payroll BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expense_items (
          id VARCHAR(36) PRIMARY KEY,
          report_id VARCHAR(36) NOT NULL,
          category_id VARCHAR(36) NOT NULL,
          expense_date DATE NOT NULL,
          merchant_name VARCHAR(255),
          description TEXT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          receipt_url TEXT,
          ocr_scanned BOOLEAN DEFAULT FALSE,
          policy_violation BOOLEAN DEFAULT FALSE,
          violation_note TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed default categories if none exist
      const existing = await connection.query(`SELECT COUNT(*) as count FROM expense_categories`);
      if (Number(existing[0]?.count || 0) === 0) {
        await connection.query(`
          INSERT INTO expense_categories (id, name, code, description, spending_limit, daily_per_diem_cap, requires_receipt) VALUES
          ('${randomUUID()}', 'Travel & Transportation', 'TRAVEL', 'Flights, trains, taxis, mileage, and transit', 1000.00, 150.00, TRUE),
          ('${randomUUID()}', 'Meals & Entertainment', 'MEALS', 'Client dining and employee meal stipends during business trips', 150.00, 75.00, TRUE),
          ('${randomUUID()}', 'Lodging & Accommodation', 'LODGING', 'Hotel and temporary corporate lodging', 350.00, 250.00, TRUE),
          ('${randomUUID()}', 'Office & Remote Supplies', 'OFFICE', 'Hardware accessories, stationery, and home office ergonomics', 250.00, NULL, TRUE),
          ('${randomUUID()}', 'Training & Subscriptions', 'TRAINING', 'Conference registrations, professional courses, and software books', 1500.00, NULL, TRUE),
          ('${randomUUID()}', 'Miscellaneous & Incidentals', 'MISC', 'Other reimbursable operational business expenses', 100.00, 30.00, FALSE);
        `);
      }
    } catch (err) {
      this.logger.error(`Error ensuring expense tables: ${err.message}`, err.stack);
    }
  }

  // ==================== CATEGORIES ====================

  async getCategories(tenantId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `SELECT * FROM expense_categories WHERE is_active = TRUE`;
    const params: any[] = [];
    if (companyId) {
      params.push(companyId);
      query += ` AND (company_id = $${params.length} OR company_id IS NULL)`;
    }
    query += ` ORDER BY name ASC`;
    return connection.query(query, params);
  }

  async createCategory(tenantId: string, dto: CreateExpenseCategoryDto, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    const id = randomUUID();
    await connection.query(
      `INSERT INTO expense_categories (
        id, company_id, branch_id, name, code, description,
        spending_limit, daily_per_diem_cap, requires_receipt, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)`,
      [
        id,
        companyId || null,
        branchId || null,
        dto.name,
        dto.code.toUpperCase(),
        dto.description || null,
        dto.spending_limit || null,
        dto.daily_per_diem_cap || null,
        dto.requires_receipt ?? true,
      ]
    );
    const res = await connection.query(`SELECT * FROM expense_categories WHERE id = $1`, [id]);
    return res[0];
  }

  // ==================== EXPENSE REPORTS ====================

  async getReports(tenantId: string, employeeId?: string, status?: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT er.*,
        u.first_name, u.last_name, u.email, u.department,
        appr.first_name as approver_first_name, appr.last_name as approver_last_name,
        (SELECT COUNT(*) FROM expense_items ei WHERE ei.report_id = er.id) as item_count,
        (SELECT COUNT(*) FROM expense_items ei WHERE ei.report_id = er.id AND ei.policy_violation = TRUE) as violation_count
      FROM expense_reports er
      JOIN users u ON u.id = er.employee_id
      LEFT JOIN users appr ON appr.id = er.approved_by
      WHERE 1=1
    `;
    const params: any[] = [];
    if (employeeId) {
      params.push(employeeId);
      query += ` AND er.employee_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND er.status = $${params.length}`;
    }
    if (companyId) {
      params.push(companyId);
      query += ` AND (er.company_id = $${params.length} OR er.company_id IS NULL)`;
    }
    if (branchId) {
      params.push(branchId);
      query += ` AND (er.branch_id = $${params.length} OR er.branch_id IS NULL)`;
    }
    query += ` ORDER BY er.created_at DESC`;
    return connection.query(query, params);
  }

  async getMyReports(tenantId: string, userId: string) {
    return this.getReports(tenantId, userId);
  }

  async getReportById(tenantId: string, reportId: string) {
    const connection = await this.getConnection(tenantId);
    const reportRes = await connection.query(`
      SELECT er.*,
        u.first_name, u.last_name, u.email, u.department,
        appr.first_name as approver_first_name, appr.last_name as approver_last_name
      FROM expense_reports er
      JOIN users u ON u.id = er.employee_id
      LEFT JOIN users appr ON appr.id = er.approved_by
      WHERE er.id = $1
    `, [reportId]);

    if (!reportRes || reportRes.length === 0) {
      throw new NotFoundException(`Expense report ${reportId} not found`);
    }

    const items = await connection.query(`
      SELECT ei.*, ec.name as category_name, ec.code as category_code
      FROM expense_items ei
      JOIN expense_categories ec ON ec.id = ei.category_id
      WHERE ei.report_id = $1
      ORDER BY ei.expense_date DESC
    `, [reportId]);

    return {
      ...reportRes[0],
      items,
    };
  }

  async createReport(tenantId: string, dto: CreateExpenseReportDto, userId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    const reportId = randomUUID();

    // Generate readable report number EXP-YYYYMM-XXXX
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const reportNumber = `EXP-${ym}-${randSuffix}`;

    await connection.query(
      `INSERT INTO expense_reports (
        id, report_number, employee_id, company_id, branch_id,
        title, purpose, status, total_amount, currency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        reportId,
        reportNumber,
        userId,
        companyId || null,
        branchId || null,
        dto.title,
        dto.purpose || null,
        ExpenseReportStatus.DRAFT,
        0,
        dto.currency || 'USD',
      ]
    );

    // Insert items if provided
    if (dto.items && dto.items.length > 0) {
      for (const item of dto.items) {
        await this.addExpenseItem(tenantId, reportId, item);
      }
    }

    return this.getReportById(tenantId, reportId);
  }

  async updateReport(tenantId: string, reportId: string, dto: UpdateExpenseReportDto, userId: string) {
    const connection = await this.getConnection(tenantId);
    const existing = await this.getReportById(tenantId, reportId);

    if (existing.status !== ExpenseReportStatus.DRAFT) {
      throw new BadRequestException(`Only draft expense reports can be edited`);
    }

    const fields: string[] = [];
    const params: any[] = [reportId];

    if (dto.title) {
      params.push(dto.title);
      fields.push(`title = $${params.length}`);
    }
    if (dto.purpose !== undefined) {
      params.push(dto.purpose);
      fields.push(`purpose = $${params.length}`);
    }

    if (fields.length > 0) {
      await connection.query(
        `UPDATE expense_reports SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        params
      );
    }

    return this.getReportById(tenantId, reportId);
  }

  async addExpenseItem(tenantId: string, reportId: string, dto: CreateExpenseItemDto) {
    const connection = await this.getConnection(tenantId);
    const itemId = randomUUID();

    // Check category policy limit
    const catRes = await connection.query(
      `SELECT spending_limit, name FROM expense_categories WHERE id = $1`,
      [dto.category_id]
    );

    let policyViolation = false;
    let violationNote: string | null = null;

    if (catRes.length > 0 && catRes[0].spending_limit) {
      const limit = Number(catRes[0].spending_limit);
      if (dto.amount > limit) {
        policyViolation = true;
        violationNote = `Amount ($${dto.amount}) exceeds policy spending limit ($${limit}) for ${catRes[0].name}`;
      }
    }

    await connection.query(
      `INSERT INTO expense_items (
        id, report_id, category_id, expense_date, merchant_name,
        description, amount, currency, receipt_url, policy_violation, violation_note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        itemId,
        reportId,
        dto.category_id,
        dto.expense_date,
        dto.merchant_name || null,
        dto.description,
        dto.amount,
        dto.currency || 'USD',
        dto.receipt_url || null,
        policyViolation,
        violationNote,
      ]
    );

    // Recalculate report total
    await this.recalculateReportTotal(connection, reportId);

    const res = await connection.query(`SELECT * FROM expense_items WHERE id = $1`, [itemId]);
    return res[0];
  }

  async deleteExpenseItem(tenantId: string, reportId: string, itemId: string) {
    const connection = await this.getConnection(tenantId);
    await connection.query(
      `DELETE FROM expense_items WHERE id = $1 AND report_id = $2`,
      [itemId, reportId]
    );
    await this.recalculateReportTotal(connection, reportId);
    return { success: true };
  }

  private async recalculateReportTotal(connection: any, reportId: string) {
    const sumRes = await connection.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expense_items WHERE report_id = $1`,
      [reportId]
    );
    const total = Number(sumRes[0]?.total || 0);
    await connection.query(
      `UPDATE expense_reports SET total_amount = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [total, reportId]
    );
  }

  async submitReport(tenantId: string, reportId: string, userId: string) {
    const connection = await this.getConnection(tenantId);
    const report = await this.getReportById(tenantId, reportId);

    if (report.items.length === 0) {
      throw new BadRequestException('Cannot submit an expense report with 0 line items');
    }

    await connection.query(
      `UPDATE expense_reports SET status = $1, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [ExpenseReportStatus.SUBMITTED, reportId]
    );

    return this.getReportById(tenantId, reportId);
  }

  async approveReport(tenantId: string, reportId: string, dto: ApproveExpenseReportDto, approverId: string) {
    const connection = await this.getConnection(tenantId);
    const report = await this.getReportById(tenantId, reportId);

    // Process line-item decisions if supplied
    if (dto.line_item_decisions && dto.line_item_decisions.length > 0) {
      for (const dec of dto.line_item_decisions) {
        await connection.query(
          `UPDATE expense_items SET status = $1 WHERE id = $2 AND report_id = $3`,
          [dec.status, dec.item_id, reportId]
        );
      }
    } else {
      // Auto approve all items
      await connection.query(
        `UPDATE expense_items SET status = 'approved' WHERE report_id = $1`,
        [reportId]
      );
    }

    const approvedAmount = dto.approved_amount !== undefined
      ? dto.approved_amount
      : report.total_amount;

    await connection.query(
      `UPDATE expense_reports SET
        status = $1,
        approved_amount = $2,
        approved_by = $3,
        approved_at = CURRENT_TIMESTAMP,
        include_in_payroll = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5`,
      [
        ExpenseReportStatus.APPROVED,
        approvedAmount,
        approverId,
        dto.include_in_payroll ?? true,
        reportId,
      ]
    );

    return this.getReportById(tenantId, reportId);
  }

  async rejectReport(tenantId: string, reportId: string, reason: string, reviewerId: string) {
    const connection = await this.getConnection(tenantId);
    await connection.query(
      `UPDATE expense_reports SET
        status = $1,
        rejection_reason = $2,
        approved_by = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4`,
      [ExpenseReportStatus.REJECTED, reason, reviewerId, reportId]
    );
    return this.getReportById(tenantId, reportId);
  }

  async markReimbursed(tenantId: string, reportId: string) {
    const connection = await this.getConnection(tenantId);
    await connection.query(
      `UPDATE expense_reports SET
        status = $1,
        reimbursed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2`,
      [ExpenseReportStatus.REIMBURSED, reportId]
    );
    return this.getReportById(tenantId, reportId);
  }

  // ==================== ANALYTICS ====================

  async getExpenseAnalytics(tenantId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);

    let whereCompany = '';
    const params: any[] = [];
    if (companyId) {
      params.push(companyId);
      whereCompany += ` AND (er.company_id = $${params.length} OR er.company_id IS NULL)`;
    }

    const summaryRes = await connection.query(`
      SELECT
        COUNT(*) as total_reports,
        COUNT(CASE WHEN er.status = 'approved' THEN 1 END) as approved_reports,
        COUNT(CASE WHEN er.status = 'submitted' THEN 1 END) as pending_reports,
        COUNT(CASE WHEN er.status = 'reimbursed' THEN 1 END) as reimbursed_reports,
        COALESCE(SUM(er.total_amount), 0) as total_claimed,
        COALESCE(SUM(er.approved_amount), 0) as total_approved
      FROM expense_reports er
      WHERE 1=1 ${whereCompany}
    `, params);

    const violationsRes = await connection.query(`
      SELECT COUNT(*) as count
      FROM expense_items ei
      JOIN expense_reports er ON er.id = ei.report_id
      WHERE ei.policy_violation = TRUE ${whereCompany}
    `, params);

    const categorySpendRes = await connection.query(`
      SELECT ec.name, COALESCE(SUM(ei.amount), 0) as spend
      FROM expense_items ei
      JOIN expense_categories ec ON ec.id = ei.category_id
      JOIN expense_reports er ON er.id = ei.report_id
      WHERE 1=1 ${whereCompany}
      GROUP BY ec.name
      ORDER BY spend DESC
    `, params);

    const deptSpendRes = await connection.query(`
      SELECT u.department, COALESCE(SUM(er.total_amount), 0) as spend, COUNT(er.id) as report_count
      FROM expense_reports er
      JOIN users u ON u.id = er.employee_id
      WHERE 1=1 ${whereCompany}
      GROUP BY u.department
      ORDER BY spend DESC
    `, params);

    const summary = summaryRes[0] || {};

    return {
      total_reports: Number(summary.total_reports || 0),
      approved_reports: Number(summary.approved_reports || 0),
      pending_reports: Number(summary.pending_reports || 0),
      reimbursed_reports: Number(summary.reimbursed_reports || 0),
      total_claimed: Number(summary.total_claimed || 0),
      total_approved: Number(summary.total_approved || 0),
      policy_violations: Number(violationsRes[0]?.count || 0),
      category_spend: categorySpendRes.map((c: any) => ({
        name: c.name,
        spend: Number(c.spend || 0),
      })),
      department_spend: deptSpendRes.map((d: any) => ({
        department: d.department || 'General',
        spend: Number(d.spend || 0),
        count: Number(d.report_count || 0),
      })),
    };
  }
}
