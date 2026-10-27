import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';

@Injectable()
export class LeaveService {
  constructor(private readonly databaseService: DatabaseService) { }

  // Helper: Check if user is in probation period
  private async isUserInProbation(
    connection: any,
    userId: string,
    probationDays: number,
  ): Promise<{
    inProbation: boolean;
    hireDate: Date | null;
    daysSinceHire: number;
    noHireDate: boolean;
  }> {
    const userResult = await connection.query(
      `
      SELECT hire_date FROM users WHERE id = $1
    `,
      [userId],
    );

    if (!userResult || userResult.length === 0 || !userResult[0].hire_date) {
      // No hire date set - treat as in probation (block leave)
      return {
        inProbation: true,
        hireDate: null,
        daysSinceHire: 0,
        noHireDate: true,
      };
    }

    const hireDate = new Date(userResult[0].hire_date);
    const today = new Date();
    const daysSinceHire = Math.floor(
      (today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      inProbation: daysSinceHire < probationDays,
      hireDate,
      daysSinceHire,
      noHireDate: false,
    };
  }

  // Helper: Calculate years of service
  private getYearsOfService(hireDate: Date): number {
    const today = new Date();
    let years = today.getFullYear() - hireDate.getFullYear();
    const monthDiff = today.getMonth() - hireDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < hireDate.getDate())
    ) {
      years--;
    }

    return Math.max(0, years);
  }

  // Helper: Get HR settings
  private async getHRSettings(connection: any): Promise<any> {
    try {
      const result = await connection.query(`
        SELECT data FROM settings WHERE category = 'hr'
      `);
      return result?.[0]?.data || {};
    } catch (e) {
      return {};
    }
  }

  // Calculate annual leave for a user based on years of service
  private calculateAnnualLeave(
    baseAnnualLeave: number,
    leaveIncreasePerYear: number,
    yearsOfService: number,
  ): number {
    return baseAnnualLeave + yearsOfService * leaveIncreasePerYear;
  }

  private async ensureSettingsTable(connection: any) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(50) NOT NULL UNIQUE,
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async ensureLeaveTables(connection: any) {
    await this.ensureSettingsTable(connection);

    // Check if leave_requests table has the correct schema
    const tableCheck = await connection.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'leave_requests' AND column_name = 'leave_type_id'
    `);

    // If table exists but doesn't have leave_type_id column, drop and recreate
    if (tableCheck.length === 0) {
      await connection.query(`DROP TABLE IF EXISTS leave_requests CASCADE`);
      await connection.query(`DROP TABLE IF EXISTS leave_balances CASCADE`);
    }

    // Leave requests table (Updated)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        leave_type_id VARCHAR(100) NOT NULL,
        leave_type_name VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        approval_status VARCHAR(20) DEFAULT 'Pending',
        current_step INTEGER DEFAULT 0,
        approved_by UUID,
        approved_at TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure new columns exist for existing tables
    await connection.query(`
        DO $$ 
        BEGIN 
            ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'Pending';
            ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;
            ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        EXCEPTION WHEN others THEN NULL; 
        END $$;
    `);

    // Leave Workflow Tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        step_order INTEGER NOT NULL,
        role_required VARCHAR(50) NOT NULL,
        is_final BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        leave_request_id UUID REFERENCES leave_requests(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        approver_id UUID REFERENCES users(id),
        status VARCHAR(20) NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Leave balances table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS leave_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        leave_type_id VARCHAR(100) NOT NULL,
        leave_type_name VARCHAR(100) NOT NULL,
        total_days DECIMAL(10,2) NOT NULL DEFAULT 0,
        used_days DECIMAL(10,2) NOT NULL DEFAULT 0,
        year INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, leave_type_id, year)
      )
    `);

    // Alter existing columns from INTEGER to DECIMAL if needed
    try {
      await connection.query(`
        ALTER TABLE leave_balances 
        ALTER COLUMN total_days TYPE DECIMAL(10,2),
        ALTER COLUMN used_days TYPE DECIMAL(10,2)
      `);
    } catch (e) {
      // Columns might already be DECIMAL or table is new
    }
  }

  // Get current user's leave requests
  async getMyLeaveRequests(tenantId: string, userId: string) {
    try {
      const connection =
        await this.databaseService.getTenantConnectionById(tenantId);
      await this.ensureLeaveTables(connection);

      const result = await connection.query(
        `
        SELECT lr.*, 
               u.full_name as approver_name
        FROM leave_requests lr
        LEFT JOIN users u ON lr.approved_by = u.id
        WHERE lr.user_id = $1
        ORDER BY lr.created_at DESC
      `,
        [userId],
      );

      return result || [];
    } catch (error) {
      console.error('Error in getMyLeaveRequests:', error);
      throw error;
    }
  }

  // Get current user's leave balances
  async getMyLeaveBalances(tenantId: string, userId: string) {
    try {
      const connection =
        await this.databaseService.getTenantConnectionById(tenantId);
      await this.ensureLeaveTables(connection);

      const currentYear = new Date().getFullYear();

      // First, get leave types from settings
      let settingsResult: any[] = [];
      try {
        settingsResult = await connection.query(`
          SELECT data FROM settings WHERE category = 'hr'
        `);
      } catch {
        settingsResult = [];
      }

      let leaveTypes: any[] = [];
      if (settingsResult && settingsResult.length > 0 && settingsResult[0].data) {
        const hrSettings = settingsResult[0].data;
        leaveTypes = hrSettings.leave_types || [];
      }

      // Get existing balances
      let balances: any[] = [];
      try {
        balances = await connection.query(
          `SELECT * FROM leave_balances WHERE user_id = $1 AND year = $2`,
          [userId, currentYear],
        );
      } catch {
        balances = [];
      }

      // Create/update balances for each leave type
      const result: any[] = [];
      for (const leaveType of leaveTypes) {
        let balance = (balances || []).find(
          (b: any) => b.leave_type_id === leaveType.id,
        );

        if (!balance) {
          try {
            await connection.query(
              `INSERT INTO leave_balances (user_id, leave_type_id, leave_type_name, total_days, used_days, year)
               VALUES ($1, $2, $3, $4, 0, $5)
               ON CONFLICT (user_id, leave_type_id, year) DO NOTHING`,
              [userId, leaveType.id, leaveType.name, leaveType.days_per_year, currentYear],
            );
          } catch { /* ignore insert conflicts */ }

          balance = {
            leave_type_id: leaveType.id,
            leave_type_name: leaveType.name,
            total_days: leaveType.days_per_year || 0,
            used_days: 0,
            year: currentYear,
          };
        }

        result.push({
          ...balance,
          is_paid: leaveType.is_paid,
          available_days: (balance.total_days || 0) - (balance.used_days || 0),
        });
      }

      return result;
    } catch (err) {
      console.error('[LeaveService] getMyLeaveBalances error:', err.message);
      return []; // Return empty array instead of 500
    }
  }

  // Apply for leave
  async applyForLeave(tenantId: string, userId: string, data: ApplyLeaveDto) {
    try {
      console.log('Applying for leave:', { tenantId, userId, data });
      const connection =
        await this.databaseService.getTenantConnectionById(tenantId);
      await this.ensureLeaveTables(connection);

      // Get HR settings
      const hrSettings = await this.getHRSettings(connection);
      const probationDays = hrSettings.probation_period_days ?? 90; // Default 90 days if not set

      console.log('Probation check - HR Settings:', {
        probationDays,
        hrSettings_probation: hrSettings.probation_period_days,
      });

      // Check if user is in probation period
      const { inProbation, daysSinceHire, hireDate, noHireDate } =
        await this.isUserInProbation(connection, userId, probationDays);
      console.log('Probation check - User status:', {
        userId,
        inProbation,
        daysSinceHire,
        hireDate,
        probationDays,
        noHireDate,
      });

      if (noHireDate) {
        throw new ForbiddenException(
          'Your hire date is not set. Please contact HR to update your profile before requesting leave.',
        );
      }

      if (inProbation) {
        const remainingDays = probationDays - daysSinceHire;
        throw new ForbiddenException(
          `You are still in probation period. You cannot request leave until ${remainingDays} more days.`,
        );
      }

      // Check if maternity leave is requested by non-female
      if (data.leave_type_name?.toLowerCase().includes('maternity')) {
        const userGenderResult = await connection.query(
          `
          SELECT gender FROM users WHERE id = $1
        `,
          [userId],
        );
        const userGender = userGenderResult?.[0]?.gender?.toLowerCase();
        if (userGender !== 'female') {
          throw new ForbiddenException(
            'Maternity leave is only available for female employees.',
          );
        }
      }

      // Calculate days between dates
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      const days =
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;

      if (days <= 0) {
        throw new BadRequestException('End date must be after start date');
      }

      // Check leave balance
      const currentYear = new Date().getFullYear();
      const balanceResult = await connection.query(
        `
        SELECT * FROM leave_balances 
        WHERE user_id = $1 AND leave_type_id = $2 AND year = $3
      `,
        [userId, data.leave_type_id, currentYear],
      );

      if (balanceResult && balanceResult.length > 0) {
        const balance = balanceResult[0];
        const available = balance.total_days - balance.used_days;
        if (days > available) {
          throw new BadRequestException(
            `Insufficient leave balance. You have ${available} days available.`,
          );
        }
      } else {
        throw new BadRequestException(
          'No leave balance found. Please contact HR.',
        );
      }

      // Get user's manager/approver (could be from department or default)
      let approverId = null;
      const userResult = await connection.query(
        `
      SELECT department FROM users WHERE id = $1
    `,
        [userId],
      );

      // For now, get any admin/manager as approver
      const approverResult = await connection.query(
        `
      SELECT id FROM users WHERE role IN ('admin', 'owner', 'manager') AND id != $1 LIMIT 1
    `,
        [userId],
      );

      if (approverResult && approverResult.length > 0) {
        approverId = approverResult[0].id;
      }

      const result = await connection.query(
        `
      INSERT INTO leave_requests (user_id, leave_type_id, leave_type_name, start_date, end_date, days, reason, approved_by, current_step)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
      RETURNING *
    `,
        [
          userId,
          data.leave_type_id,
          data.leave_type_name,
          data.start_date,
          data.end_date,
          days,
          data.reason,
          approverId,
        ],
      );

      return result[0];
    } catch (error) {
      console.error('Error in applyForLeave:', error);
      throw error;
    }
  }

  // Cancel leave request (only if pending)
  async cancelLeaveRequest(
    tenantId: string,
    userId: string,
    requestId: string,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Check if request exists and belongs to user
    const requestResult = await connection.query(
      `
      SELECT * FROM leave_requests WHERE id = $1 AND user_id = $2
    `,
      [requestId, userId],
    );

    if (!requestResult || requestResult.length === 0) {
      throw new NotFoundException('Leave request not found');
    }

    const request = requestResult[0];
    if (request.status !== 'Pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    await connection.query(
      `
      DELETE FROM leave_requests WHERE id = $1
    `,
      [requestId],
    );

    return { message: 'Leave request cancelled successfully' };
  }

  // Get leave types from settings
  async getLeaveTypes(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const settingsResult = await connection.query(`
      SELECT data FROM settings WHERE category = 'hr'
    `);

    if (settingsResult && settingsResult.length > 0 && settingsResult[0].data) {
      return settingsResult[0].data.leave_types || [];
    }

    return [];
  }

  // Get a single leave request by ID with user details
  async getLeaveRequestById(tenantId: string, requestId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
      SELECT lr.*, 
             u.full_name as user_name, u.email as user_email, u.department,
             a.full_name as approver_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      LEFT JOIN users a ON lr.approved_by = a.id
      WHERE lr.id = $1
    `,
      [requestId],
    );

    return result[0] || null;
  }

  // ============ ADMIN FUNCTIONS ============

  // Get all leave requests (for managers/admins)
  async getAllLeaveRequests(
    tenantId: string,
    filters?: { status?: string; user_id?: string },
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureLeaveTables(connection);

    let query = `
      SELECT lr.*, 
             u.full_name as user_name, u.email as user_email, u.department,
             a.full_name as approver_name
      FROM leave_requests lr
      JOIN users u ON lr.user_id = u.id
      LEFT JOIN users a ON lr.approved_by = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      query += ` AND lr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.user_id) {
      query += ` AND lr.user_id = $${paramIndex}`;
      params.push(filters.user_id);
      paramIndex++;
    }

    query += ` ORDER BY lr.created_at DESC`;

    const result = await connection.query(query, params);
    return result || [];
  }

  // ============ WORKFLOW MANAGEMENT ============

  async getWorkflow(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureLeaveTables(connection);
    const result = await connection.query(`SELECT * FROM leave_workflows ORDER BY step_order ASC`);
    return result || [];
  }

  async setWorkflowSteps(tenantId: string, steps: any[]) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureLeaveTables(connection);

    // Transaction
    await connection.query('BEGIN');
    try {
      await connection.query('DELETE FROM leave_workflows');

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;
        await connection.query(
          `INSERT INTO leave_workflows (step_order, role_required, is_final) VALUES ($1, $2, $3)`,
          [i + 1, step.role_required, isFinal]
        );
      }
      await connection.query('COMMIT');
      return { message: 'Workflow updated' };
    } catch (e) {
      await connection.query('ROLLBACK');
      throw e;
    }
  }

  async getRoles(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    return connection.query(`SELECT id, name FROM roles WHERE is_active = true`);
  }


  // Approve leave request (Step-based)
  async approveLeaveRequest(
    tenantId: string,
    approverId: string,
    requestId: string,
    comment?: string
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const requestResult = await connection.query(`SELECT * FROM leave_requests WHERE id = $1`, [requestId]);
    if (!requestResult || requestResult.length === 0) throw new NotFoundException('Leave request not found');

    const request = requestResult[0];
    if (request.status !== 'Pending') throw new BadRequestException('Request is not pending');

    // Get current workflow step
    const workflows = await connection.query(`SELECT * FROM leave_workflows ORDER BY step_order ASC`);

    // If no workflow defined, assume 1-step approval (Manager/Admin)
    if (!workflows || workflows.length === 0) {
      // Legacy approval logic
      await connection.query(
        `UPDATE leave_requests SET status = 'Approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [approverId, requestId]
      );
      // Balance deduction
      const currentYear = new Date().getFullYear();
      await connection.query(
        `UPDATE leave_balances SET used_days = used_days + $1, updated_at = NOW() WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [request.days, request.user_id, request.leave_type_id, currentYear]
      );
      return { message: 'Leave approved (Legacy)' };
    }

    const currentStepConfig = workflows.find((w: any) => w.step_order === request.current_step);
    if (!currentStepConfig) throw new BadRequestException('Invalid workflow step');

    // Validate Approver Role
    const approverRoleResult = await connection.query(`SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, [approverId]);
    const approverRole = approverRoleResult?.[0]?.name;

    // Check permissions (Admin can override, or exact role match)
    if (approverRole !== 'Admin' && approverRole !== 'Owner' && approverRole !== currentStepConfig.role_required) {
      throw new ForbiddenException(`Role '${currentStepConfig.role_required}' required for this step.`);
    }

    // Record Approval
    await connection.query(
      `INSERT INTO leave_approvals (leave_request_id, step_number, approver_id, status, comment) VALUES ($1, $2, $3, 'Approved', $4)`,
      [requestId, request.current_step, approverId, comment || 'Approved']
    );

    if (currentStepConfig.is_final) {
      // FINAL APPROVAL
      await connection.query(
        `UPDATE leave_requests SET status = 'Approved', approved_by = $1, approved_at = NOW() WHERE id = $2`,
        [approverId, requestId]
      );
      // Deduct Balance
      const currentYear = new Date().getFullYear();
      await connection.query(
        `UPDATE leave_balances SET used_days = used_days + $1 WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [request.days, request.user_id, request.leave_type_id, currentYear]
      );
    } else {
      // MOVE TO NEXT STEP
      await connection.query(
        `UPDATE leave_requests SET current_step = current_step + 1 WHERE id = $1`,
        [requestId]
      );
    }

    return { message: 'Step approved' };
  }

  // Reject leave request
  async rejectLeaveRequest(
    tenantId: string,
    approverId: string,
    requestId: string,
    reason?: string,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    // Record rejection in approvals
    const request = (await connection.query(`SELECT current_step FROM leave_requests WHERE id = $1`, [requestId]))[0];

    await connection.query(
      `INSERT INTO leave_approvals (leave_request_id, step_number, approver_id, status, comment) VALUES ($1, $2, $3, 'Rejected', $4)`,
      [requestId, request?.current_step || 1, approverId, reason]
    );

    await connection.query(
      `UPDATE leave_requests SET status = 'Rejected', approved_by = $1, rejection_reason = $2, updated_at = NOW() WHERE id = $3`,
      [approverId, reason || '', requestId],
    );

    return { message: 'Leave request rejected' };
  }

  // ============ LEAVE ACCRUAL FUNCTIONS (Calls FastAPI) ============

  private async getCalculationServiceUrl(): Promise<string> {
    return process.env.CALCULATION_SERVICE_URL || 'http://localhost:8000';
  }

  // Get user's leave status including probation info
  async getUserLeaveStatus(tenantId: string, userId: string) {
    try {
      const baseUrl = await this.getCalculationServiceUrl();
      const response = await fetch(`${baseUrl}/api/leave/status/${userId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (!response.ok) throw new Error('Failed to get leave status');
      return response.json();
    } catch (error) {
      console.error('Error calling FastAPI leave status:', error);
      // Fallback to local calculation
      const connection =
        await this.databaseService.getTenantConnectionById(tenantId);
      const hrSettings = await this.getHRSettings(connection);
      const probationDays = hrSettings.probation_period_days || 0;
      const { inProbation, hireDate, daysSinceHire } =
        await this.isUserInProbation(connection, userId, probationDays);
      return {
        in_probation: inProbation,
        hire_date: hireDate,
        days_since_hire: daysSinceHire,
        probation_days: probationDays,
        probation_remaining: inProbation ? probationDays - daysSinceHire : 0,
        years_of_service: hireDate ? this.getYearsOfService(hireDate) : 0,
      };
    }
  }

  // Calculate leave balance for a specific user
  async calculateUserLeaveBalance(tenantId: string, userId: string) {
    try {
      const baseUrl = await this.getCalculationServiceUrl();
      const response = await fetch(`${baseUrl}/api/leave/balance/${userId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (!response.ok) throw new Error('Failed to calculate leave balance');
      return response.json();
    } catch (error) {
      console.error('Error calling FastAPI leave balance:', error);
      throw new BadRequestException(
        'Failed to calculate leave balance. Calculation service unavailable.',
      );
    }
  }

  // Run monthly accrual for all users
  async runMonthlyLeaveAccrual(tenantId: string) {
    try {
      const baseUrl = await this.getCalculationServiceUrl();
      const response = await fetch(`${baseUrl}/api/leave/accrual/run`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (!response.ok) throw new Error('Failed to run leave accrual');
      return response.json();
    } catch (error) {
      console.error('Error calling FastAPI leave accrual:', error);
      throw new BadRequestException(
        'Failed to run leave accrual. Calculation service unavailable.',
      );
    }
  }

  // ============ INITIAL BALANCE REGISTRATION ============

  // Get user balances with calculated annual leave based on years of service
  async getUserBalancesWithCalculation(tenantId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureLeaveTables(connection);

    const hrSettings = await this.getHRSettings(connection);
    const leaveTypes = hrSettings.leave_types || [];
    const leaveIncreasePerYear = hrSettings.leave_increase_per_year || 0;
    const probationDays = hrSettings.probation_period_days || 90;

    // Get user info
    const userResult = await connection.query(
      `
      SELECT id, full_name, hire_date, gender FROM users WHERE id = $1
    `,
      [userId],
    );

    if (!userResult || userResult.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult[0];
    const hireDate = user.hire_date ? new Date(user.hire_date) : null;
    const yearsOfService = hireDate ? this.getYearsOfService(hireDate) : 0;
    const currentYear = new Date().getFullYear();
    const userGender = user.gender?.toLowerCase();

    // Calculate months worked this year (for pro-rata calculation)
    let monthsWorkedThisYear = 12;
    if (hireDate) {
      const hireYear = hireDate.getFullYear();
      if (hireYear === currentYear) {
        monthsWorkedThisYear = 12 - hireDate.getMonth();
      }
    }

    const balances: any[] = [];

    for (const leaveType of leaveTypes) {
      const baseAnnualLeave = leaveType.days_per_year || 0;
      const isAnnualLeave = leaveType.name?.toLowerCase().includes('annual');

      // Only apply yearly increase to Annual Leave
      const currentAnnualLeave = isAnnualLeave
        ? this.calculateAnnualLeave(
          baseAnnualLeave,
          leaveIncreasePerYear,
          yearsOfService,
        )
        : baseAnnualLeave;

      // Pro-rated only for annual leave, fixed for others
      const proRatedAnnualLeave = isAnnualLeave
        ? Math.round((currentAnnualLeave / 12) * monthsWorkedThisYear * 100) /
        100
        : baseAnnualLeave;

      // Get existing balance
      const balanceResult = await connection.query(
        `
        SELECT * FROM leave_balances 
        WHERE user_id = $1 AND leave_type_id = $2 AND year = $3
      `,
        [userId, leaveType.id, currentYear],
      );

      const existingBalance = balanceResult?.[0];

      balances.push({
        leave_type_id: leaveType.id,
        leave_type_name: leaveType.name,
        base_annual_leave: baseAnnualLeave,
        years_of_service: yearsOfService,
        current_annual_leave: currentAnnualLeave,
        pro_rated_annual_leave: proRatedAnnualLeave,
        months_worked_this_year: monthsWorkedThisYear,
        total_days: existingBalance?.total_days || 0,
        used_days: existingBalance?.used_days || 0,
        carried_over: existingBalance?.carried_over || 0,
        available_days:
          (existingBalance?.total_days || 0) -
          (existingBalance?.used_days || 0),
        is_paid: leaveType.is_paid,
        year: currentYear,
      });
    }

    return {
      user: {
        id: user.id,
        full_name: user.full_name,
        hire_date: hireDate,
        years_of_service: yearsOfService,
        months_worked_this_year: monthsWorkedThisYear,
        gender: user.gender,
      },
      settings: {
        leave_increase_per_year: leaveIncreasePerYear,
        probation_period_days: probationDays,
      },
      balances,
    };
  }

  // Register/update initial leave balance for existing employee
  async registerInitialBalance(
    tenantId: string,
    userId: string,
    data: {
      leave_type_id: string;
      carried_over: number;
      used_days: number;
      year?: number;
    },
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureLeaveTables(connection);

    const hrSettings = await this.getHRSettings(connection);
    const leaveTypes = hrSettings.leave_types || [];
    const leaveIncreasePerYear = hrSettings.leave_increase_per_year || 0;

    // Find leave type
    const leaveType = leaveTypes.find(
      (lt: any) => lt.id === data.leave_type_id,
    );
    if (!leaveType) {
      throw new BadRequestException('Invalid leave type');
    }

    // Get user info
    const userResult = await connection.query(
      `
      SELECT hire_date FROM users WHERE id = $1
    `,
      [userId],
    );

    if (!userResult || userResult.length === 0) {
      throw new NotFoundException('User not found');
    }

    const hireDate = userResult[0].hire_date
      ? new Date(userResult[0].hire_date)
      : null;
    const yearsOfService = hireDate ? this.getYearsOfService(hireDate) : 0;
    const currentYear = data.year || new Date().getFullYear();

    // Calculate annual leave based on years of service
    const baseAnnualLeave = leaveType.days_per_year || 0;
    const currentAnnualLeave = this.calculateAnnualLeave(
      baseAnnualLeave,
      leaveIncreasePerYear,
      yearsOfService,
    );

    // Calculate months worked this year
    let monthsWorkedThisYear = 12;
    if (hireDate) {
      const hireYear = hireDate.getFullYear();
      if (hireYear === currentYear) {
        monthsWorkedThisYear = 12 - hireDate.getMonth();
      }
    }

    // Pro-rated annual leave + carried over
    const proRatedAnnualLeave =
      Math.round((currentAnnualLeave / 12) * monthsWorkedThisYear * 100) / 100;
    const totalDays = proRatedAnnualLeave + (data.carried_over || 0);

    // Add carried_over column if not exists
    try {
      await connection.query(`
        ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS carried_over DECIMAL(10,2) DEFAULT 0
      `);
    } catch (e) {
      // Column might already exist
    }

    // Insert or update balance
    await connection.query(
      `
      INSERT INTO leave_balances (user_id, leave_type_id, leave_type_name, total_days, used_days, carried_over, year)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, leave_type_id, year) 
      DO UPDATE SET 
        total_days = $4, 
        used_days = $5, 
        carried_over = $6,
        updated_at = NOW()
    `,
      [
        userId,
        data.leave_type_id,
        leaveType.name,
        totalDays,
        data.used_days || 0,
        data.carried_over || 0,
        currentYear,
      ],
    );

    return {
      message: 'Leave balance registered successfully',
      balance: {
        user_id: userId,
        leave_type_id: data.leave_type_id,
        leave_type_name: leaveType.name,
        years_of_service: yearsOfService,
        base_annual_leave: baseAnnualLeave,
        current_annual_leave: currentAnnualLeave,
        pro_rated_annual_leave: proRatedAnnualLeave,
        carried_over: data.carried_over || 0,
        total_days: totalDays,
        used_days: data.used_days || 0,
        available_days: totalDays - (data.used_days || 0),
        year: currentYear,
      },
    };
  }

  // Auto-calculate and set initial balance based on hire date
  async calculateAndSetInitialBalance(tenantId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureLeaveTables(connection);

    const hrSettings = await this.getHRSettings(connection);
    const leaveTypes = hrSettings.leave_types || [];
    const leaveIncreasePerYear = hrSettings.leave_increase_per_year || 0;

    // Get user info
    const userResult = await connection.query(
      `
      SELECT id, full_name, hire_date FROM users WHERE id = $1
    `,
      [userId],
    );

    if (!userResult || userResult.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = userResult[0];
    if (!user.hire_date) {
      throw new BadRequestException('User hire date is not set');
    }

    const hireDate = new Date(user.hire_date);
    const yearsOfService = this.getYearsOfService(hireDate);
    const currentYear = new Date().getFullYear();

    // Calculate months worked this year
    let monthsWorkedThisYear = 12;
    const hireYear = hireDate.getFullYear();
    if (hireYear === currentYear) {
      monthsWorkedThisYear = 12 - hireDate.getMonth();
    }

    // Add carried_over column if not exists
    try {
      await connection.query(`
        ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS carried_over DECIMAL(10,2) DEFAULT 0
      `);
    } catch (e) {
      // Column might already exist
    }

    const results: any[] = [];

    for (const leaveType of leaveTypes) {
      const baseAnnualLeave = leaveType.days_per_year || 0;
      const isAnnualLeave = leaveType.name?.toLowerCase().includes('annual');

      // Only apply yearly increase to Annual Leave
      const currentAnnualLeave = isAnnualLeave
        ? this.calculateAnnualLeave(
          baseAnnualLeave,
          leaveIncreasePerYear,
          yearsOfService,
        )
        : baseAnnualLeave;

      // Pro-rated only for annual leave, fixed for others
      const proRatedAnnualLeave = isAnnualLeave
        ? Math.round((currentAnnualLeave / 12) * monthsWorkedThisYear * 100) /
        100
        : baseAnnualLeave;

      // Get existing balance to preserve used_days and carried_over
      const existingResult = await connection.query(
        `
        SELECT used_days, carried_over FROM leave_balances 
        WHERE user_id = $1 AND leave_type_id = $2 AND year = $3
      `,
        [userId, leaveType.id, currentYear],
      );

      const existingUsed = existingResult?.[0]?.used_days || 0;
      // Auto-calculate resets carried_over to 0 - user can manually set it later
      const existingCarriedOver = 0;
      const totalDays = proRatedAnnualLeave;

      await connection.query(
        `
        INSERT INTO leave_balances (user_id, leave_type_id, leave_type_name, total_days, used_days, carried_over, year)
        VALUES ($1, $2, $3, $4, $5, 0, $6)
        ON CONFLICT (user_id, leave_type_id, year) 
        DO UPDATE SET 
          total_days = $4,
          carried_over = 0,
          updated_at = NOW()
      `,
        [
          userId,
          leaveType.id,
          leaveType.name,
          totalDays,
          existingUsed,
          currentYear,
        ],
      );

      results.push({
        leave_type_id: leaveType.id,
        leave_type_name: leaveType.name,
        base_annual_leave: baseAnnualLeave,
        current_annual_leave: currentAnnualLeave,
        pro_rated_annual_leave: proRatedAnnualLeave,
        carried_over: existingCarriedOver,
        total_days: totalDays,
        used_days: existingUsed,
        available_days: totalDays - existingUsed,
      });
    }

    return {
      message: 'Leave balances calculated and set successfully',
      user: {
        id: user.id,
        full_name: user.full_name,
        hire_date: hireDate,
        years_of_service: yearsOfService,
        months_worked_this_year: monthsWorkedThisYear,
      },
      balances: results,
    };
  }
}
