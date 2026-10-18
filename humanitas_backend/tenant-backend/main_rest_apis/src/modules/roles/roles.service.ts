import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseService } from '../database/database.service';
import { Tenant } from '../auth/entities/tenant.entity';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { HolidaysService } from '../holidays/holidays.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly databaseService: DatabaseService,
    private readonly holidaysService: HolidaysService,
  ) { }

  private async getTenantDatabaseName(tenantSlug: string): Promise<string> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantSlug}`);
    }
    return tenant.database_name;
  }

  private async ensureRolesTable(connection: any): Promise<void> {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions JSONB NOT NULL DEFAULT '[]',
        is_system BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default roles if they don't exist
    const existingRoles = await connection.query(
      `SELECT COUNT(*) as count FROM roles`,
    );
    if (parseInt(existingRoles[0].count) === 0) {
      await this.seedDefaultRoles(connection);
    } else {
      // Migrate: Add new permissions to existing roles
      await this.migrateNewPermissions(connection);
    }
  }

  public async migrateNewPermissions(connection: any): Promise<void> {
    // Create migration tracking table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS _permission_migrations (
        permission VARCHAR(100) PRIMARY KEY,
        migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const newPermissions = [
      'correct_attendance', 'view_holidays', 'manage_holidays',
      'view_announcements', 'create_announcements', 'edit_announcements', 'delete_announcements',
      'view_events', 'create_events', 'edit_events', 'delete_events',
      'view_overtime_workers', 'force_clockout',
      'view_shifts', 'manage_shifts',
      'view_roster', 'manage_roster',
      'view_attendance', 'edit_attendance', 'correct_attendance',
      'manage_shift_assignments',
      'logs_view', 'logs_manage',
      'overtime_view', 'overtime_management',
      // PMS New Permissions
      'view_pms_dashboard', 'view_my_tasks',
      'view_sprints', 'manage_sprints',
      'assign_tasks', 'approve_tasks',
      'log_time', 'view_time_logs',
      'view_team_kpis', 'view_own_kpis',
      'manage_pms_settings', 'export_pms_data',
      'edit_own_tasks',
      // Workflow Permissions
      'review_tasks',
      'block_tasks',
      'reassign_tasks',
      // PMS Team Permissions
      'view_teams', 'create_teams', 'edit_teams', 'delete_teams',
      'manage_team_members', 'view_team_dashboard',

      // [NEW] Messaging Permissions
      'use_messaging',
      'create_groups',
      'manage_own_groups',
      'create_channels',
      'manage_channels',
      'manage_any_group',
      'broadcast_messages',
      'view_chat_settings',
      'manage_chat_settings',
      'delete_any_message',      // Admin only
      'bypass_privacy_mode',     // Admin only
      'export_chat_history',     // Admin only

      // Recruitment Permissions
      'manage_recruitment',

      // Biometric & Hardware Permissions
      'authorize_devices',
      'sync_devices',
      'view_device_logs',
    ];

    // Permissions restricted to Administrator only (exclude from Manager)
    const adminOnlyPermissions = [
      'delete_any_message', 'bypass_privacy_mode', 'export_chat_history',
      'manage_channels', 'manage_any_group', 'broadcast_messages', 'manage_chat_settings',
      'authorize_devices',
    ];

    // Permissions allowed for Employee role
    const employeeSafePermissions = [
      'view_my_tasks', 'view_pms_dashboard', 'log_time', 'view_own_kpis',
      'view_my_attendance', 'view_my_leave', 'view_my_payslip', 'edit_own_tasks',
      'use_messaging', 'create_groups', 'manage_own_groups', 'view_chat_settings',
    ];

    for (const permission of newPermissions) {
      // Check if this permission has already been migrated
      const alreadyMigrated = await connection.query(
        `SELECT 1 FROM _permission_migrations WHERE permission = $1`,
        [permission]
      );
      if (alreadyMigrated.length > 0) {
        continue;
      }

      // 1. Add to Administrator (ALL permissions)
      await connection.query(`
        UPDATE roles 
        SET permissions = permissions || $1::jsonb
        WHERE name = 'Administrator' 
          AND NOT (permissions @> $1::jsonb)
      `, [JSON.stringify([permission])]);

      // 2. Add to Manager (Exclude Admin-only)
      if (!adminOnlyPermissions.includes(permission)) {
        await connection.query(`
          UPDATE roles 
          SET permissions = permissions || $1::jsonb
          WHERE name = 'Manager' 
            AND NOT (permissions @> $1::jsonb)
        `, [JSON.stringify([permission])]);
      }

      // 3. Add to Employee (Only safe list)
      if (employeeSafePermissions.includes(permission)) {
        await connection.query(`
          UPDATE roles 
          SET permissions = permissions || $1::jsonb
          WHERE name = 'Employee' 
            AND NOT (permissions @> $1::jsonb)
        `, [JSON.stringify([permission])]);
      }

      // Mark as migrated
      await connection.query(
        `INSERT INTO _permission_migrations (permission) VALUES ($1) ON CONFLICT DO NOTHING`,
        [permission]
      );
    }

    // Seed default holidays for existing tenants
    await this.holidaysService.seedDefaultHolidays(connection);
  }

  private async seedDefaultRoles(connection: any): Promise<void> {
    const allPermissions = [
      // Dashboard
      'view_dashboard',

      // User Management
      'view_users',
      'edit_users',
      'create_users',
      'delete_users',
      'view_user_attachments',
      'manage_user_attachments',

      // Roles & Access Control
      'view_roles',
      'edit_roles',
      'create_roles',
      'delete_roles',

      // Devices
      'view_devices',
      'manage_devices',
      'authorize_devices',
      'sync_devices',
      'view_device_logs',

      // Attendance
      'view_attendance',
      'edit_attendance',
      'correct_attendance',
      'view_my_attendance',

      // Leave
      'view_leave',
      'request_leave',
      'approve_leave',
      'view_my_leave',

      // Payroll
      'view_payroll',
      'view_payroll_dashboard',
      'run_payroll',
      'view_my_payslip',
      'view_payroll_history',
      'view_tax_reports',

      // PMS - Project Management
      'view_pms',
      'view_pms_dashboard',
      'view_my_tasks',
      'view_all_tasks',
      'create_tasks',
      'edit_tasks',
      'delete_tasks',
      'edit_own_tasks', // Added missing
      'view_projects',
      'create_projects',
      'edit_projects',
      'delete_projects',
      'view_pms_team',
      'view_pms_reports',
      'view_sprints',
      'manage_sprints',
      'assign_tasks',
      'approve_tasks',
      'log_time',
      'view_time_logs',
      'view_team_kpis',
      'view_own_kpis',
      'manage_pms_settings',
      'export_pms_data',
      // Workflow Permissions
      'review_tasks',
      'block_tasks',
      'reassign_tasks',
      // PMS Team Permissions
      'view_teams',
      'create_teams',
      'edit_teams',
      'delete_teams',
      'manage_team_members',
      'view_team_dashboard',

      // KPI & Performance
      'view_kpi',
      'create_kpi',
      'edit_kpi',
      'delete_kpi',
      'view_performance_reviews',
      'create_performance_reviews',
      'approve_performance_reviews',

      // Settings
      'view_general_settings',
      'edit_general_settings',
      'view_company_settings',
      'edit_company_settings',
      'view_payroll_settings',
      'edit_payroll_settings',
      'view_accounts_privacy_settings',
      'edit_accounts_privacy_settings',
      'view_hrm_settings',
      'edit_hrm_settings',
      'view_tasks_settings',
      'edit_tasks_settings',
      'view_kpi_settings',
      'edit_kpi_settings',
      'view_notifications_settings',
      'edit_notifications_settings',
      'view_email_settings',
      'edit_email_settings',

      // Holidays
      'view_holidays',
      'manage_holidays',

      // Announcements & Events
      'view_announcements',
      'create_announcements',
      'edit_announcements',
      'delete_announcements',
      'view_events',
      'create_events',
      'edit_events',
      'delete_events',

      // OT Monitor
      'view_overtime_workers',
      'force_clockout',

      // Overtime Management
      'overtime_view',
      'overtime_management',

      // Roster
      'view_roster',
      'manage_roster',
      'view_shifts',
      'manage_shifts',
      'manage_shift_assignments',

      // System Logs
      'view_logs',
      'manage_logs',

      // Recruitment
      'manage_recruitment',

      // Messaging (full)
      'use_messaging',
      'create_groups',
      'manage_own_groups',
      'create_channels',
      'manage_channels',
      'manage_any_group',
      'broadcast_messages',
      'view_chat_settings',
      'manage_chat_settings',
      'delete_any_message',
      'bypass_privacy_mode',
      'export_chat_history',
    ];

    const managerPermissions = [
      'view_dashboard',
      'view_users',
      'edit_users',
      'view_user_attachments',
      'view_attendance',
      'edit_attendance',
      'correct_attendance',
      'view_my_attendance',
      'view_leave',
      'approve_leave',
      'view_my_leave',
      'view_payroll',
      'view_payroll_dashboard',
      'run_payroll',
      'view_my_payslip',
      'view_payroll_history',
      'view_tax_reports',
      'view_pms',
      'view_pms_dashboard',
      'view_my_tasks',
      'view_all_tasks',
      'create_tasks',
      'edit_tasks',
      'view_projects',
      'view_pms_team',
      'view_pms_reports',
      'view_sprints',
      'manage_sprints',
      'assign_tasks',
      'approve_tasks',
      'view_time_logs',
      'view_team_kpis',
      'export_pms_data',
      'view_holidays',
      'manage_holidays',
      'view_overtime_workers',
      'force_clockout',
      'view_roster',
      'manage_roster',
      'view_shifts',
      'manage_shifts',
      'manage_shift_assignments',
      'manage_recruitment',
      'use_messaging',
      'create_groups',
      'manage_own_groups',
      'create_channels',
      'view_chat_settings',
    ];

    const employeePermissions = [
      'view_dashboard',
      'view_my_attendance',
      'view_my_leave',
      'request_leave',
      'view_my_payslip',
      'log_time',
      'view_own_kpis',
      'view_pms_dashboard',
      'view_my_tasks',
      'use_messaging',
      'create_groups',
      'manage_own_groups',
      'view_chat_settings',
    ];

    const defaultRoles = [
      {
        name: 'Administrator',
        description: 'Full access to all system features and settings.',
        permissions: allPermissions,
        is_system: true,
      },
      {
        name: 'Manager',
        description: 'Manage team, approve requests, and view reports.',
        permissions: managerPermissions,
        is_system: true,
      },
      {
        name: 'Employee',
        description: 'View personal information, attendance, and tasks.',
        permissions: employeePermissions,
        is_system: true,
      },
    ];

    for (const role of defaultRoles) {
      await connection.query(
        `INSERT INTO roles (name, description, permissions, is_system) VALUES ($1, $2, $3, $4)`,
        [
          role.name,
          role.description,
          JSON.stringify(role.permissions),
          role.is_system,
        ],
      );
    }

    // Seed default holidays for new tenants
    await this.holidaysService.seedDefaultHolidays(connection);
  }

  async findAll(tenantSlug: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureRolesTable(connection);

    const roles = await connection.query(
      `SELECT * FROM roles WHERE is_active = true ORDER BY is_system DESC, name ASC`,
    );
    return roles;
  }

  async findOne(tenantSlug: string, id: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureRolesTable(connection);

    const result = await connection.query(
      `SELECT * FROM roles WHERE id = $1 AND is_active = true`,
      [id],
    );
    if (!result[0]) {
      throw new NotFoundException(`Role not found: ${id}`);
    }
    return result[0];
  }

  async create(tenantSlug: string, dto: CreateRoleDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureRolesTable(connection);

    const result = await connection.query(
      `INSERT INTO roles (name, description, permissions) VALUES ($1, $2, $3) RETURNING *`,
      [dto.name, dto.description || '', JSON.stringify(dto.permissions || [])],
    );
    return result[0];
  }

  async update(tenantSlug: string, id: string, dto: UpdateRoleDto) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureRolesTable(connection);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(dto.description);
    }
    if (dto.permissions !== undefined) {
      updates.push(`permissions = $${paramIndex++}`);
      values.push(JSON.stringify(dto.permissions));
    }

    if (updates.length === 0) {
      return this.findOne(tenantSlug, id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await connection.query(
      `UPDATE roles SET ${updates.join(', ')} WHERE id = $${paramIndex} AND is_active = true RETURNING *`,
      values,
    );

    if (!result[0]) {
      throw new NotFoundException(`Role not found: ${id}`);
    }
    return result[0];
  }

  async remove(tenantSlug: string, id: string) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureRolesTable(connection);

    // Check if it's a system role
    const role = await this.findOne(tenantSlug, id);
    if (role.is_system) {
      throw new Error('Cannot delete system roles');
    }

    await connection.query(
      `UPDATE roles SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return { message: 'Role deleted successfully' };
  }

  async updatePermissions(
    tenantSlug: string,
    id: string,
    permissions: string[],
  ) {
    const databaseName = await this.getTenantDatabaseName(tenantSlug);
    const connection =
      await this.databaseService.getTenantConnection(databaseName);
    await this.ensureRolesTable(connection);

    console.log(`[RolesService] Updating permissions for Role ${id}. Perms count: ${permissions.length}`);
    try {
      const result = await connection.query(
        `UPDATE roles SET permissions = $1, updated_at = NOW() WHERE id = $2 AND is_active = true RETURNING *`,
        [JSON.stringify(permissions), id],
      );

      console.log(`[RolesService] Update result:`, result[0] ? 'Success' : 'No row returned');

      if (!result[0]) {
        throw new NotFoundException(`Role not found: ${id}`);
      }
      return result[0];
    } catch (error) {
      if (error.message?.includes('Connection terminated') || error.message?.includes('Client has already been connected')) {
        console.warn(`⚠️ Connection error in updatePermissions, retrying...`);
        await this.databaseService.resetConnection(databaseName);
        // Retry with new connection
        const newConnection = await this.databaseService.getTenantConnection(databaseName);
        const retryResult = await newConnection.query(
          `UPDATE roles SET permissions = $1, updated_at = NOW() WHERE id = $2 AND is_active = true RETURNING *`,
          [JSON.stringify(permissions), id],
        );
        if (!retryResult[0]) {
          throw new NotFoundException(`Role not found: ${id}`);
        }
        return retryResult[0];
      }
      throw error;
    }
  }

  async hasPermission(tenantSlug: string, roleId: string, permission: string): Promise<boolean> {
    const role = await this.findOne(tenantSlug, roleId);
    if (!role || !role.permissions) return false;

    // Check if permissions include the specific permission
    // Handling JSONB array from DB which might be string or object array depending on driver
    const perms = Array.isArray(role.permissions) ? role.permissions : role.permissions;
    return perms.includes(permission);
  }
}
