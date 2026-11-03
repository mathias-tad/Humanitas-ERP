import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateDelegationDto,
  DelegationsFilterDto,
  LogDelegatedActionDto,
} from './dto/delegation.dto';

@Injectable()
export class DelegationsService {
  private readonly logger = new Logger(DelegationsService.name);
  private readonly ensuredDatabases = new Set<string>();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async getConnection(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureDelegationTables(connection, tenantId);
    return connection;
  }

  async ensureDelegationTables(connection: any, tenantId?: string) {
    if (tenantId && this.ensuredDatabases.has(tenantId)) return;

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS user_delegations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID,
          company_id UUID,
          branch_id UUID,
          delegator_id UUID NOT NULL,
          delegatee_id UUID NOT NULL,
          start_date TIMESTAMPTZ NOT NULL,
          end_date TIMESTAMPTZ NOT NULL,
          scope VARCHAR(50) NOT NULL DEFAULT 'ALL',
          reason TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          created_by UUID,
          is_acting_assignment BOOLEAN DEFAULT FALSE,
          acting_position_title VARCHAR(150),
          acting_allowance_type VARCHAR(30) DEFAULT 'percentage',
          acting_allowance_percentage NUMERIC(5, 2) DEFAULT 0.00,
          acting_allowance_amount NUMERIC(12, 2) DEFAULT 0.00,
          acting_approved_by UUID,
          acting_approved_at TIMESTAMPTZ,
          acting_notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Add acting assignment columns if table was created previously without them
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS is_acting_assignment BOOLEAN DEFAULT FALSE;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_position_title VARCHAR(150);
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_allowance_type VARCHAR(30) DEFAULT 'percentage';
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_allowance_percentage NUMERIC(5, 2) DEFAULT 0.00;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_allowance_amount NUMERIC(12, 2) DEFAULT 0.00;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_approved_by UUID;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_approved_at TIMESTAMPTZ;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_notes TEXT;

        CREATE INDEX IF NOT EXISTS idx_user_delegations_delegator ON user_delegations(delegator_id);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_delegatee ON user_delegations(delegatee_id);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_active ON user_delegations(delegatee_id, status, start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_company ON user_delegations(company_id);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_branch ON user_delegations(branch_id);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_acting ON user_delegations(is_acting_assignment, status);

        CREATE TABLE IF NOT EXISTS delegation_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          delegation_id UUID,
          performed_by UUID NOT NULL,
          on_behalf_of UUID NOT NULL,
          action VARCHAR(100) NOT NULL,
          resource VARCHAR(100),
          details JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_delegation_audit_delegation ON delegation_audit_logs(delegation_id);
        CREATE INDEX IF NOT EXISTS idx_delegation_audit_performed ON delegation_audit_logs(performed_by);
        CREATE INDEX IF NOT EXISTS idx_delegation_audit_on_behalf ON delegation_audit_logs(on_behalf_of);
        CREATE INDEX IF NOT EXISTS idx_delegation_audit_created ON delegation_audit_logs(created_at);
      `);
      if (tenantId) this.ensuredDatabases.add(tenantId);
    } catch (err: any) {
      this.logger.warn(`Failed to ensure delegation tables: ${err.message}`);
    }
  }

  async createDelegation(
    tenantId: string,
    delegatorId: string,
    dto: CreateDelegationDto,
    createdBy?: string,
  ) {
    if (delegatorId === dto.delegatee_id) {
      throw new BadRequestException('Cannot delegate authority to yourself');
    }

    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);
    if (end < start) {
      throw new BadRequestException('End date must be on or after start date');
    }

    const connection = await this.getConnection(tenantId);

    // Verify delegatee user exists
    const delegateeResult = await connection.query(
      `SELECT id, email, first_name, last_name FROM users WHERE id = $1`,
      [dto.delegatee_id],
    );
    if (!delegateeResult || delegateeResult.length === 0) {
      throw new NotFoundException('Delegatee user not found');
    }

    // Lookup delegator info for notification & company/branch context
    const delegatorResult = await connection.query(
      `SELECT id, email, first_name, last_name, company_id, branch_id, position, basic_salary FROM users WHERE id = $1`,
      [delegatorId],
    );
    const delegator = delegatorResult[0] || {};
    const delegatorName = [delegator.first_name, delegator.last_name].filter(Boolean).join(' ') || delegator.email || 'A colleague';

    const companyId = dto.company_id || delegator.company_id || null;
    const branchId = dto.branch_id || delegator.branch_id || null;
    const scope = (dto.scope || 'ALL').toUpperCase();

    // HR Acting Assignment & Allowance metadata
    const isActing = Boolean(dto.is_acting_assignment);
    const actingTitle = dto.acting_position_title || delegator.position || null;
    const allowanceType = dto.acting_allowance_type || 'percentage';
    const allowancePercentage = dto.acting_allowance_percentage !== undefined ? Number(dto.acting_allowance_percentage) : 0;
    const allowanceAmount = dto.acting_allowance_amount !== undefined ? Number(dto.acting_allowance_amount) : 0;
    const actingNotes = dto.acting_notes || null;

    const insertResult = await connection.query(
      `INSERT INTO user_delegations (
        tenant_id, company_id, branch_id, delegator_id, delegatee_id,
        start_date, end_date, scope, reason, status, created_by,
        is_acting_assignment, acting_position_title, acting_allowance_type,
        acting_allowance_percentage, acting_allowance_amount, acting_notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *`,
      [
        tenantId,
        companyId,
        branchId,
        delegatorId,
        dto.delegatee_id,
        start.toISOString(),
        end.toISOString(),
        scope,
        dto.reason || null,
        createdBy || delegatorId,
        isActing,
        actingTitle,
        allowanceType,
        allowancePercentage,
        allowanceAmount,
        actingNotes,
      ],
    );

    const delegation = insertResult[0];

    // Bridge with existing HR acting_assignments table if it exists in the tenant database
    if (isActing) {
      try {
        const tableCheck = await connection.query(`SELECT to_regclass('acting_assignments') as tbl`);
        if (tableCheck[0]?.tbl) {
          const startDateStr = start.toISOString().split('T')[0];
          const endDateStr = end.toISOString().split('T')[0];
          await connection.query(
            `INSERT INTO acting_assignments (actor_user_id, target_user_id, start_date, end_date, is_active)
             VALUES ($1, $2, $3, $4, true)`,
            [dto.delegatee_id, delegatorId, startDateStr, endDateStr],
          );
          this.logger.log(`Synchronized acting assignment delegation to payroll acting_assignments table`);
        }
      } catch (actingSyncErr: any) {
        this.logger.warn(`Could not sync to acting_assignments table: ${actingSyncErr.message}`);
      }
    }

    // Dispatch notification to delegatee (Directive 19 category: delegation_assigned)
    try {
      let notifTitle = 'Authority Delegation Assigned';
      let notifMessage = `${delegatorName} has delegated authority to you (Scope: ${scope}) until ${end.toLocaleDateString()}.`;

      if (isActing) {
        notifTitle = 'Acting Assignment & Delegation Appointed';
        const allowanceDetail = allowanceType === 'fixed_amount'
          ? `${allowanceAmount.toFixed(2)} monthly allowance`
          : `${allowancePercentage}% acting allowance of delegator salary`;
        notifMessage = `${delegatorName} has designated you as Acting ${actingTitle || 'Role'} (${allowanceDetail}) until ${end.toLocaleDateString()}.`;
      }

      await this.notificationsService.createNotification(tenantId, dto.delegatee_id, {
        type: 'delegation_assigned',
        referenceId: delegation.id,
        title: notifTitle,
        message: notifMessage,
        deep_link: '/settings/delegations',
      });
    } catch (notifyErr: any) {
      this.logger.warn(`Failed to dispatch delegation notification: ${notifyErr.message}`);
    }

    return delegation;
  }

  async getMyDelegations(tenantId: string, userId: string) {
    const connection = await this.getConnection(tenantId);

    const rows = await connection.query(
      `SELECT 
        d.*,
        u_from.first_name as delegator_first_name,
        u_from.last_name as delegator_last_name,
        u_from.email as delegator_email,
        u_from.position as delegator_position,
        u_from.basic_salary as delegator_basic_salary,
        r_from.name as delegator_role_name,
        u_to.first_name as delegatee_first_name,
        u_to.last_name as delegatee_last_name,
        u_to.email as delegatee_email,
        u_to.position as delegatee_position,
        r_to.name as delegatee_role_name,
        c.name as company_name,
        b.name as branch_name
      FROM user_delegations d
      JOIN users u_from ON d.delegator_id = u_from.id
      LEFT JOIN roles r_from ON u_from.role_id = r_from.id
      JOIN users u_to ON d.delegatee_id = u_to.id
      LEFT JOIN roles r_to ON u_to.role_id = r_to.id
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN branches b ON d.branch_id = b.id
      WHERE d.delegator_id = $1 OR d.delegatee_id = $1
      ORDER BY d.created_at DESC`,
      [userId],
    );

    return rows;
  }

  async getActiveDelegationsForUser(tenantId: string, userId: string) {
    const connection = await this.getConnection(tenantId);

    const rows = await connection.query(
      `SELECT 
        d.*,
        u_from.first_name as delegator_first_name,
        u_from.last_name as delegator_last_name,
        u_from.email as delegator_email,
        u_from.position as delegator_position,
        r_from.name as delegator_role_name,
        r_from.permissions as delegator_permissions,
        c.name as company_name,
        b.name as branch_name
      FROM user_delegations d
      JOIN users u_from ON d.delegator_id = u_from.id
      LEFT JOIN roles r_from ON u_from.role_id = r_from.id
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN branches b ON d.branch_id = b.id
      WHERE d.delegatee_id = $1 
        AND d.status = 'active'
        AND NOW() >= d.start_date
        AND NOW() <= d.end_date
      ORDER BY d.start_date ASC`,
      [userId],
    );

    return rows;
  }

  async getAllDelegations(tenantId: string, filters: DelegationsFilterDto = {}) {
    const connection = await this.getConnection(tenantId);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (filters.status) {
      conditions.push(`d.status = $${pIdx++}`);
      params.push(filters.status);
    }
    if (filters.scope) {
      conditions.push(`d.scope = $${pIdx++}`);
      params.push(filters.scope);
    }
    if (filters.company_id) {
      conditions.push(`d.company_id = $${pIdx++}`);
      params.push(filters.company_id);
    }
    if (filters.branch_id) {
      conditions.push(`d.branch_id = $${pIdx++}`);
      params.push(filters.branch_id);
    }
    if (filters.delegator_id) {
      conditions.push(`d.delegator_id = $${pIdx++}`);
      params.push(filters.delegator_id);
    }
    if (filters.delegatee_id) {
      conditions.push(`d.delegatee_id = $${pIdx++}`);
      params.push(filters.delegatee_id);
    }
    if (filters.is_acting_assignment !== undefined) {
      conditions.push(`d.is_acting_assignment = $${pIdx++}`);
      params.push(filters.is_acting_assignment);
    }

    const rows = await connection.query(
      `SELECT 
        d.*,
        u_from.first_name as delegator_first_name,
        u_from.last_name as delegator_last_name,
        u_from.email as delegator_email,
        u_from.position as delegator_position,
        u_from.basic_salary as delegator_basic_salary,
        r_from.name as delegator_role_name,
        u_to.first_name as delegatee_first_name,
        u_to.last_name as delegatee_last_name,
        u_to.email as delegatee_email,
        u_to.position as delegatee_position,
        r_to.name as delegatee_role_name,
        c.name as company_name,
        b.name as branch_name
      FROM user_delegations d
      JOIN users u_from ON d.delegator_id = u_from.id
      LEFT JOIN roles r_from ON u_from.role_id = r_from.id
      JOIN users u_to ON d.delegatee_id = u_to.id
      LEFT JOIN roles r_to ON u_to.role_id = r_to.id
      LEFT JOIN companies c ON d.company_id = c.id
      LEFT JOIN branches b ON d.branch_id = b.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.created_at DESC`,
      params,
    );

    return rows;
  }

  async revokeDelegation(tenantId: string, delegationId: string, userId: string, isAdmin = false) {
    const connection = await this.getConnection(tenantId);

    const existing = await connection.query(
      `SELECT * FROM user_delegations WHERE id = $1`,
      [delegationId],
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException('Delegation not found');
    }

    const delegation = existing[0];

    if (!isAdmin && delegation.delegator_id !== userId && delegation.delegatee_id !== userId) {
      throw new ForbiddenException('You can only revoke delegations you are a party to');
    }

    const updated = await connection.query(
      `UPDATE user_delegations
       SET status = 'revoked', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [delegationId],
    );

    // Deactivate corresponding entry in acting_assignments if exists
    if (delegation.is_acting_assignment) {
      try {
        const tableCheck = await connection.query(`SELECT to_regclass('acting_assignments') as tbl`);
        if (tableCheck[0]?.tbl) {
          await connection.query(
            `UPDATE acting_assignments SET is_active = false 
             WHERE actor_user_id = $1 AND target_user_id = $2 AND is_active = true`,
            [delegation.delegatee_id, delegation.delegator_id],
          );
          this.logger.log(`Deactivated corresponding entry in acting_assignments`);
        }
      } catch (deactErr: any) {
        this.logger.warn(`Could not deactivate acting_assignments entry: ${deactErr.message}`);
      }
    }

    return updated[0];
  }

  async calculateActingAllowancePreview(
    tenantId: string,
    delegatorId: string,
    allowancePercentage: number = 0,
    fixedAmount: number = 0,
  ) {
    const connection = await this.getConnection(tenantId);
    const delegatorResult = await connection.query(
      `SELECT id, first_name, last_name, email, position, department, basic_salary FROM users WHERE id = $1`,
      [delegatorId],
    );
    if (!delegatorResult || delegatorResult.length === 0) {
      throw new NotFoundException('Delegator user not found');
    }

    const delegator = delegatorResult[0];
    const basicSalary = parseFloat(delegator.basic_salary) || 0;
    let estimatedMonthlyAllowance = 0;

    if (fixedAmount > 0) {
      estimatedMonthlyAllowance = fixedAmount;
    } else if (allowancePercentage > 0) {
      estimatedMonthlyAllowance = (basicSalary * allowancePercentage) / 100;
    }

    return {
      delegator_id: delegatorId,
      delegator_name: [delegator.first_name, delegator.last_name].filter(Boolean).join(' ') || delegator.email,
      delegator_position: delegator.position || 'Employee',
      delegator_department: delegator.department || 'General',
      delegator_basic_salary: basicSalary,
      allowance_type: fixedAmount > 0 ? 'fixed_amount' : 'percentage',
      allowance_percentage: allowancePercentage,
      fixed_amount: fixedAmount,
      estimated_monthly_allowance: Number(estimatedMonthlyAllowance.toFixed(2)),
    };
  }

  async getActiveActingAssignments(
    tenantId: string,
    userId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const connection = await this.getConnection(tenantId);
    const conditions: string[] = ["d.is_acting_assignment = true", "d.status = 'active'"];
    const params: any[] = [];
    let pIdx = 1;

    if (userId) {
      conditions.push(`d.delegatee_id = $${pIdx++}`);
      params.push(userId);
    }
    if (startDate && endDate) {
      conditions.push(`d.start_date <= $${pIdx++}`);
      params.push(endDate);
      conditions.push(`d.end_date >= $${pIdx++}`);
      params.push(startDate);
    }

    const query = `
      SELECT 
        d.*,
        u_from.first_name as delegator_first_name,
        u_from.last_name as delegator_last_name,
        u_from.email as delegator_email,
        u_from.position as delegator_position,
        u_from.basic_salary as delegator_basic_salary,
        u_to.first_name as delegatee_first_name,
        u_to.last_name as delegatee_last_name,
        u_to.email as delegatee_email,
        u_to.position as delegatee_position,
        u_to.basic_salary as delegatee_basic_salary
      FROM user_delegations d
      JOIN users u_from ON d.delegator_id = u_from.id
      JOIN users u_to ON d.delegatee_id = u_to.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.start_date DESC
    `;

    return await connection.query(query, params);
  }

  async logDelegatedAction(tenantId: string, data: LogDelegatedActionDto) {
    const connection = await this.getConnection(tenantId);

    const result = await connection.query(
      `INSERT INTO delegation_audit_logs (
        delegation_id, performed_by, on_behalf_of, action, resource, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *`,
      [
        data.delegation_id || null,
        data.performed_by,
        data.on_behalf_of,
        data.action,
        data.resource || null,
        data.details ? JSON.stringify(data.details) : null,
      ],
    );

    return result[0];
  }

  async getDelegationAudit(
    tenantId: string,
    delegationId?: string,
    userId?: string,
    canViewAllAudit = false,
  ) {
    const connection = await this.getConnection(tenantId);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (delegationId) {
      conditions.push(`l.delegation_id = $${pIdx++}`);
      params.push(delegationId);
    } else if (!canViewAllAudit && userId) {
      conditions.push(`(l.performed_by = $${pIdx} OR l.on_behalf_of = $${pIdx})`);
      params.push(userId);
      pIdx++;
    }

    const rows = await connection.query(
      `SELECT 
        l.*,
        u_perf.first_name as performed_by_first_name,
        u_perf.last_name as performed_by_last_name,
        u_perf.email as performed_by_email,
        u_obh.first_name as on_behalf_of_first_name,
        u_obh.last_name as on_behalf_of_last_name,
        u_obh.email as on_behalf_of_email,
        d.scope as delegation_scope,
        d.is_acting_assignment,
        d.acting_position_title
      FROM delegation_audit_logs l
      LEFT JOIN user_delegations d ON l.delegation_id = d.id
      JOIN users u_perf ON l.performed_by = u_perf.id
      JOIN users u_obh ON l.on_behalf_of = u_obh.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.created_at DESC
      LIMIT 200`,
      params,
    );

    return rows;
  }
}
