import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateBenefitPlanDto,
  UpdateBenefitPlanDto,
  EnrollEmployeeDto,
  AddDependentDto,
  CreateOpenEnrollmentDto,
} from './dto/hrms-benefits.dto';

@Injectable()
export class HrmsBenefitsService {
  private readonly logger = new Logger(HrmsBenefitsService.name);
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
        -- Master Benefit Plans Table
        CREATE TABLE IF NOT EXISTS benefit_plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50) UNIQUE NOT NULL,
          plan_type VARCHAR(64) NOT NULL,
          tier VARCHAR(32) DEFAULT 'standard',
          provider_name VARCHAR(255),
          policy_number VARCHAR(100),
          description TEXT,
          total_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          employer_contribution DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          employee_contribution DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          employer_percentage DECIMAL(5,2) DEFAULT 0.00,
          employee_percentage DECIMAL(5,2) DEFAULT 0.00,
          contribution_frequency VARCHAR(32) DEFAULT 'monthly',
          is_family_covered BOOLEAN DEFAULT FALSE,
          max_dependents INT DEFAULT 0,
          min_tenure_months INT DEFAULT 0,
          eligible_employment_types JSONB DEFAULT '["full_time"]',
          eligible_departments JSONB DEFAULT '[]',
          is_active BOOLEAN DEFAULT TRUE,
          company_id UUID,
          branch_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Employee Benefit Enrollments Table
        CREATE TABLE IF NOT EXISTS benefit_enrollments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          plan_id UUID NOT NULL REFERENCES benefit_plans(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          coverage_tier VARCHAR(32) DEFAULT 'individual',
          status VARCHAR(32) DEFAULT 'enrolled',
          enrollment_type VARCHAR(32) DEFAULT 'open_enrollment',
          qualifying_life_event VARCHAR(64),
          life_event_date DATE,
          effective_start_date DATE NOT NULL,
          effective_end_date DATE,
          employee_deduction_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          employer_cost_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          notes TEXT,
          company_id UUID,
          branch_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Covered Dependents Table
        CREATE TABLE IF NOT EXISTS benefit_dependents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          enrollment_id UUID NOT NULL REFERENCES benefit_enrollments(id) ON DELETE CASCADE,
          full_name VARCHAR(255) NOT NULL,
          relationship VARCHAR(32) NOT NULL,
          date_of_birth DATE,
          national_id VARCHAR(50),
          gender VARCHAR(20),
          is_covered BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Open Enrollment Periods
        CREATE TABLE IF NOT EXISTS open_enrollment_periods (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          plan_year INT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status VARCHAR(32) DEFAULT 'upcoming',
          company_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_benefit_plans_type ON benefit_plans(plan_type);
        CREATE INDEX IF NOT EXISTS idx_benefit_enrollments_user ON benefit_enrollments(user_id);
        CREATE INDEX IF NOT EXISTS idx_benefit_enrollments_status ON benefit_enrollments(status);
        CREATE INDEX IF NOT EXISTS idx_benefit_dependents_enrollment ON benefit_dependents(enrollment_id);
      `);

      // Seed default benefit plans if empty
      const existingPlans = await connection.query('SELECT COUNT(*) as count FROM benefit_plans');
      if (parseInt(existingPlans[0]?.count || '0', 10) === 0) {
        await connection.query(`
          INSERT INTO benefit_plans (name, code, plan_type, tier, provider_name, description, total_cost, employer_contribution, employee_contribution, is_family_covered, max_dependents)
          VALUES 
          ('Comprehensive Health Plan (Standard)', 'HLT-STD-01', 'medical', 'standard', 'National Health Insurance Corp', 'Complete in-patient and out-patient medical coverage', 250.00, 200.00, 50.00, true, 4),
          ('Premium Health & Dental Plan', 'HLT-PRM-01', 'medical', 'premium', 'National Health Insurance Corp', 'Premium health coverage including dental and optical care', 400.00, 300.00, 100.00, true, 5),
          ('Group Term Life Insurance', 'LIF-GRP-01', 'life_insurance', 'standard', 'Global Life Assurance', 'Coverage of 3x annual base salary in case of death or disability', 80.00, 80.00, 0.00, false, 0),
          ('Retirement Pension Co-Contribution', 'PEN-7PCT-01', 'pension', 'standard', 'National Pension Authority', 'Statutory 7% employer match retirement fund contribution', 150.00, 100.00, 50.00, false, 0),
          ('Monthly Commuter / Transport Subsidy', 'TRN-SUB-01', 'transport_allowance', 'basic', 'Internal Corporate Benefit', 'Monthly transport allowance support for on-site staff', 60.00, 60.00, 0.00, false, 0)
        `);
      }

      this.logger.log('Benefit tables and seeds verified successfully');
    } catch (error) {
      this.logger.error('Failed to create benefit tables', error);
      throw error;
    }
  }

  async getPlans(tenantId: string, planType?: string, companyId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT bp.*,
        (SELECT COUNT(DISTINCT be.user_id) FROM benefit_enrollments be WHERE be.plan_id = bp.id AND be.status = 'enrolled') AS active_enrollments_count
      FROM benefit_plans bp
      WHERE bp.is_active = TRUE
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (planType && planType !== 'all') {
      query += ` AND bp.plan_type = $${pIdx++}`;
      params.push(planType);
    }
    if (companyId) {
      query += ` AND (bp.company_id = $${pIdx++} OR bp.company_id IS NULL)`;
      params.push(companyId);
    }

    query += ` ORDER BY bp.name ASC`;
    return connection.query(query, params);
  }

  async getPlanById(tenantId: string, id: string) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(
      `SELECT bp.*,
        (SELECT COUNT(DISTINCT be.user_id) FROM benefit_enrollments be WHERE be.plan_id = bp.id AND be.status = 'enrolled') AS active_enrollments_count
       FROM benefit_plans bp
       WHERE bp.id = $1`,
      [id],
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException('Benefit plan not found');
    }
    return rows[0];
  }

  async createPlan(tenantId: string, dto: CreateBenefitPlanDto, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(
      `INSERT INTO benefit_plans (
        name, code, plan_type, tier, provider_name, policy_number, description,
        total_cost, employer_contribution, employee_contribution, employer_percentage,
        employee_percentage, contribution_frequency, is_family_covered, max_dependents,
        min_tenure_months, eligible_employment_types, eligible_departments, company_id, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        dto.name,
        dto.code,
        dto.plan_type,
        dto.tier || 'standard',
        dto.provider_name || null,
        dto.policy_number || null,
        dto.description || null,
        dto.total_cost,
        dto.employer_contribution,
        dto.employee_contribution,
        dto.employer_percentage || 0,
        dto.employee_percentage || 0,
        dto.contribution_frequency || 'monthly',
        dto.is_family_covered || false,
        dto.max_dependents || 0,
        dto.min_tenure_months || 0,
        JSON.stringify(dto.eligible_employment_types || ['full_time']),
        JSON.stringify(dto.eligible_departments || []),
        companyId || null,
        branchId || null,
      ],
    );
    return rows[0];
  }

  async updatePlan(tenantId: string, id: string, dto: UpdateBenefitPlanDto) {
    const connection = await this.getConnection(tenantId);
    const existing = await connection.query('SELECT * FROM benefit_plans WHERE id = $1', [id]);
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Benefit plan not found');
    }

    const updates: string[] = [];
    const params: any[] = [id];
    let pIdx = 2;

    if (dto.name !== undefined) {
      updates.push(`name = $${pIdx++}`);
      params.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${pIdx++}`);
      params.push(dto.description);
    }
    if (dto.total_cost !== undefined) {
      updates.push(`total_cost = $${pIdx++}`);
      params.push(dto.total_cost);
    }
    if (dto.employer_contribution !== undefined) {
      updates.push(`employer_contribution = $${pIdx++}`);
      params.push(dto.employer_contribution);
    }
    if (dto.employee_contribution !== undefined) {
      updates.push(`employee_contribution = $${pIdx++}`);
      params.push(dto.employee_contribution);
    }
    if (dto.is_active !== undefined) {
      updates.push(`is_active = $${pIdx++}`);
      params.push(dto.is_active);
    }

    if (updates.length === 0) return existing[0];

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    const query = `UPDATE benefit_plans SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await connection.query(query, params);
    return result[0];
  }

  async enrollEmployee(
    tenantId: string,
    dto: EnrollEmployeeDto,
    companyId?: string,
    branchId?: string,
  ) {
    const connection = await this.getConnection(tenantId);
    const plan = await this.getPlanById(tenantId, dto.plan_id);

    const employeeDeduction =
      dto.custom_employee_deduction !== undefined
        ? dto.custom_employee_deduction
        : plan.employee_contribution;

    const employerCost =
      dto.custom_employer_cost !== undefined
        ? dto.custom_employer_cost
        : plan.employer_contribution;

    const rows = await connection.query(
      `INSERT INTO benefit_enrollments (
        plan_id, user_id, coverage_tier, status, enrollment_type,
        qualifying_life_event, life_event_date, effective_start_date, effective_end_date,
        employee_deduction_amount, employer_cost_amount, notes, company_id, branch_id
      ) VALUES ($1, $2, $3, 'enrolled', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        dto.plan_id,
        dto.user_id,
        dto.coverage_tier || 'individual',
        dto.enrollment_type || 'open_enrollment',
        dto.qualifying_life_event || null,
        dto.life_event_date || null,
        dto.effective_start_date,
        dto.effective_end_date || null,
        employeeDeduction,
        employerCost,
        dto.notes || null,
        companyId || null,
        branchId || null,
      ],
    );

    return rows[0];
  }

  async getEnrollments(
    tenantId: string,
    currentUserId: string,
    hasManagePerm: boolean,
    filters?: { user_id?: string; plan_id?: string; status?: string; company_id?: string },
  ) {
    try {
      const connection = await this.getConnection(tenantId);
      let query = `
        SELECT 
          be.*,
          bp.name AS plan_name,
          bp.code AS plan_code,
          bp.plan_type,
          bp.tier AS plan_tier,
          bp.provider_name,
          COALESCE(u.full_name, '') AS employee_name,
          u.email AS employee_email,
          u.department AS employee_department,
          (SELECT COUNT(*) FROM benefit_dependents bd WHERE bd.enrollment_id = be.id AND bd.is_covered = TRUE) AS covered_dependents_count
        FROM benefit_enrollments be
        JOIN benefit_plans bp ON be.plan_id = bp.id
        JOIN users u ON be.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let pIdx = 1;

      if (!hasManagePerm) {
        query += ` AND be.user_id = $${pIdx++}`;
        params.push(currentUserId);
      } else if (filters?.user_id) {
        query += ` AND be.user_id = $${pIdx++}`;
        params.push(filters.user_id);
      }

      if (filters?.plan_id) {
        query += ` AND be.plan_id = $${pIdx++}`;
        params.push(filters.plan_id);
      }
      if (filters?.status) {
        query += ` AND be.status = $${pIdx++}`;
        params.push(filters.status);
      }
      if (filters?.company_id) {
        query += ` AND be.company_id = $${pIdx++}`;
        params.push(filters.company_id);
      }

      query += ` ORDER BY be.created_at DESC`;
      return await connection.query(query, params);
    } catch (err) {
      console.error('[HrmsBenefitsService] getEnrollments error:', err.message);
      return [];
    }
  }

  async getEnrollmentById(
    tenantId: string,
    id: string,
    currentUserId: string,
    hasManagePerm: boolean,
  ) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(
      `SELECT 
        be.*,
        bp.name AS plan_name,
        bp.code AS plan_code,
        bp.plan_type,
        bp.tier AS plan_tier,
        bp.provider_name,
        bp.is_family_covered,
        bp.max_dependents,
        COALESCE(u.full_name, '') AS employee_name,
        u.email AS employee_email,
        u.department AS employee_department
       FROM benefit_enrollments be
       JOIN benefit_plans bp ON be.plan_id = bp.id
       JOIN users u ON be.user_id = u.id
       WHERE be.id = $1`,
      [id],
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException('Benefit enrollment not found');
    }

    const enrollment = rows[0];
    if (!hasManagePerm && enrollment.user_id !== currentUserId) {
      throw new ForbiddenException('Access denied to this benefit enrollment');
    }

    const dependents = await connection.query(
      `SELECT * FROM benefit_dependents WHERE enrollment_id = $1 ORDER BY created_at ASC`,
      [id],
    );

    return {
      ...enrollment,
      dependents,
    };
  }

  async addDependent(
    tenantId: string,
    enrollmentId: string,
    currentUserId: string,
    hasManagePerm: boolean,
    dto: AddDependentDto,
  ) {
    const connection = await this.getConnection(tenantId);
    const enrollment = await connection.query(
      'SELECT * FROM benefit_enrollments WHERE id = $1',
      [enrollmentId],
    );
    if (!enrollment || enrollment.length === 0) {
      throw new NotFoundException('Enrollment not found');
    }

    if (!hasManagePerm && enrollment[0].user_id !== currentUserId) {
      throw new ForbiddenException('Access denied to modify this enrollment');
    }

    const rows = await connection.query(
      `INSERT INTO benefit_dependents (
        enrollment_id, full_name, relationship, date_of_birth, national_id, gender, is_covered
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING *`,
      [
        enrollmentId,
        dto.full_name,
        dto.relationship,
        dto.date_of_birth || null,
        dto.national_id || null,
        dto.gender || null,
      ],
    );

    return rows[0];
  }

  async removeDependent(
    tenantId: string,
    dependentId: string,
    currentUserId: string,
    hasManagePerm: boolean,
  ) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(
      `SELECT bd.*, be.user_id FROM benefit_dependents bd
       JOIN benefit_enrollments be ON bd.enrollment_id = be.id
       WHERE bd.id = $1`,
      [dependentId],
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException('Dependent not found');
    }

    if (!hasManagePerm && rows[0].user_id !== currentUserId) {
      throw new ForbiddenException('Access denied to delete this dependent');
    }

    await connection.query('DELETE FROM benefit_dependents WHERE id = $1', [dependentId]);
    return { success: true, message: 'Dependent removed' };
  }

  async getOpenEnrollmentPeriods(tenantId: string, companyId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = 'SELECT * FROM open_enrollment_periods WHERE 1=1';
    const params: any[] = [];
    if (companyId) {
      query += ' AND (company_id = $1 OR company_id IS NULL)';
      params.push(companyId);
    }
    query += ' ORDER BY plan_year DESC, start_date DESC';
    return connection.query(query, params);
  }

  async createOpenEnrollmentPeriod(
    tenantId: string,
    dto: CreateOpenEnrollmentDto,
    companyId?: string,
  ) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(
      `INSERT INTO open_enrollment_periods (title, plan_year, start_date, end_date, status, company_id)
       VALUES ($1, $2, $3, $4, 'upcoming', $5)
       RETURNING *`,
      [dto.title, dto.plan_year, dto.start_date, dto.end_date, companyId || null],
    );
    return rows[0];
  }

  async getPayrollDeductions(tenantId: string, companyId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT 
        be.id AS enrollment_id,
        be.user_id,
        COALESCE(u.full_name, '') AS employee_name,
        u.email,
        u.department,
        bp.name AS benefit_name,
        bp.code AS benefit_code,
        bp.plan_type,
        be.employee_deduction_amount,
        be.employer_cost_amount,
        be.effective_start_date,
        be.effective_end_date
      FROM benefit_enrollments be
      JOIN benefit_plans bp ON be.plan_id = bp.id
      JOIN users u ON be.user_id = u.id
      WHERE be.status = 'enrolled'
    `;
    const params: any[] = [];
    if (companyId) {
      query += ` AND be.company_id = $1`;
      params.push(companyId);
    }
    query += ` ORDER BY u.department ASC, employee_name ASC`;
    return connection.query(query, params);
  }

  async getStats(tenantId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    let whereClause = "WHERE be.status = 'enrolled'";
    const params: any[] = [];
    let pIdx = 1;

    if (companyId) {
      whereClause += ` AND be.company_id = $${pIdx++}`;
      params.push(companyId);
    }
    if (branchId) {
      whereClause += ` AND be.branch_id = $${pIdx++}`;
      params.push(branchId);
    }

    const enrolledSummary = await connection.query(
      `SELECT 
        COUNT(DISTINCT be.user_id) AS enrolled_employees,
        COALESCE(SUM(be.employer_cost_amount), 0) AS total_monthly_employer_cost,
        COALESCE(SUM(be.employee_deduction_amount), 0) AS total_monthly_employee_deductions
       FROM benefit_enrollments be
       ${whereClause}`,
      params,
    );

    const plansCount = await connection.query('SELECT COUNT(*) as active_plans FROM benefit_plans WHERE is_active = TRUE');
    const dependentsCount = await connection.query('SELECT COUNT(*) as covered_dependents FROM benefit_dependents WHERE is_covered = TRUE');
    const totalUsers = await connection.query('SELECT COUNT(*) as total_users FROM users WHERE is_active = TRUE');

    const byPlanType = await connection.query(`
      SELECT bp.plan_type, COUNT(be.id) as enrollment_count, SUM(be.employer_cost_amount) as total_employer_cost
      FROM benefit_enrollments be
      JOIN benefit_plans bp ON be.plan_id = bp.id
      ${whereClause}
      GROUP BY bp.plan_type
    `, params);

    const enrolled = parseInt(enrolledSummary[0]?.enrolled_employees || '0', 10);
    const usersTotal = parseInt(totalUsers[0]?.total_users || '1', 10);
    const enrollmentRate = usersTotal > 0 ? Math.round((enrolled / usersTotal) * 100) : 0;

    return {
      total_enrolled_employees: enrolled,
      total_active_plans: parseInt(plansCount[0]?.active_plans || '0', 10),
      total_monthly_employer_cost: parseFloat(enrolledSummary[0]?.total_monthly_employer_cost || '0'),
      total_monthly_employee_deductions: parseFloat(enrolledSummary[0]?.total_monthly_employee_deductions || '0'),
      total_covered_dependents: parseInt(dependentsCount[0]?.covered_dependents || '0', 10),
      enrollment_rate: enrollmentRate,
      by_plan_type: byPlanType,
    };
  }
}
