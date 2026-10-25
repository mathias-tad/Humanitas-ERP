import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * SECURITY: Permission-gated AI action tools.
 *
 * Each tool is mapped to one or more required RBAC permissions.
 * Only tools whose required permission exists in the calling user's
 * permission set are returned to the LangChain agent — the agent
 * cannot even see (let alone call) tools the user cannot use.
 */
const TOOL_PERMISSION_MAP: Record<string, string[]> = {
  create_user:           ['manage_employees'],
  update_user:           ['manage_employees'],
  deactivate_user:       ['manage_employees'],
  submit_leave_request:  ['request_leave'],
  approve_leave_request: ['approve_leave'],
  reject_leave_request:  ['approve_leave'],
  cancel_leave_request:  ['request_leave'],
  post_announcement:     ['manage_announcements'],
  add_loan:              ['manage_payroll'],
  initiate_payroll_run:  ['run_payroll'],
  create_project:        ['manage_projects'],
  create_task:           ['create_tasks'],
  update_task_status:    ['update_tasks'],
  create_sprint:         ['manage_projects'],
  add_project_member:    ['manage_projects'],
  create_shift:          ['manage_scheduling'],
  assign_shift:          ['manage_scheduling'],
  mark_day_off:          ['manage_scheduling'],
  log_overtime:          ['manage_overtime'],
  add_holiday:           ['manage_holidays'],
  get_headcount_analytics:   ['view_hrms_reports'],
  export_bank_transfer_file: ['export_bank_transfer_file', 'view_hrms_reports'],
  generate_employee_letter:  ['generate_employee_letters'],
  get_expiring_documents:    ['view_employee_documents'],
  get_onboarding_stats:      ['view_onboarding'],
  start_employee_onboarding: ['manage_onboarding'],
  get_my_self_service_summary: ['view_self_service'],
  get_grievance_stats:       ['view_grievance_reports', 'manage_grievances'],
  file_grievance:            ['file_grievance', 'manage_grievances'],
  get_benefit_plans:         ['view_benefit_plans', 'manage_benefits'],
  get_benefits_summary:      ['view_benefit_reports', 'manage_benefits', 'view_my_benefits'],
  get_training_courses:      ['view_training_courses', 'manage_training'],
  get_training_stats:        ['view_training_reports', 'manage_training'],
  enroll_in_course:          ['enroll_training', 'manage_training'],
  get_review_cycles:         ['view_reviews'],
  get_my_reviews_summary:    ['view_my_reviews', 'view_reviews'],
  get_pms_review_analytics:  ['view_reviews', 'view_pms_reports'],
  get_expense_reports:       ['view_expenses'],
  get_my_expenses_summary:   ['view_my_expenses', 'view_expenses'],
  get_expense_analytics:     ['view_expenses', 'view_expense_reports'],
  get_assets:                ['view_assets'],
  get_my_assigned_assets:    ['view_my_assets', 'view_assets'],
  get_asset_analytics:       ['view_assets', 'view_asset_reports'],
  get_active_surveys:        ['view_surveys'],
  get_survey_analytics:      ['view_survey_results', 'view_surveys'],
  get_import_export_jobs:    ['view_import_export'],
  get_import_export_stats:   ['view_import_export'],
  get_recruitment_funnel:    ['manage_recruitment', 'view_recruitment'],
  get_recruitment_analytics: ['manage_recruitment', 'view_recruitment'],
};

@Injectable()
export class AiActionService {
  private readonly logger = new Logger(AiActionService.name);

  constructor(private databaseService: DatabaseService) {}

  private async getConnection(tenantSlug: string) {
    const rows = await (this.databaseService as any).masterDataSource.query(
      `SELECT id, database_name FROM tenants WHERE slug = $1`,
      [tenantSlug],
    );
    if (!rows || !rows.length) throw new Error(`Tenant "${tenantSlug}" not found`);
    const ds = await this.databaseService.getTenantConnection(rows[0].database_name);
    return { ds, tenantId: rows[0].id };
  }

  /**
   * Returns ONLY the action tools the requesting user has RBAC permission to use.
   * @param tenantSlug - Tenant identifier from JWT
   * @param currentUserId - The human user's UUID (for audit trail)
   * @param userPermissions - Array of permission keys from the user's role
   */
  getActionTools(tenantSlug: string, currentUserId: string, userPermissions: string[] = []) {
    const isOwnerOrAdmin = userPermissions.includes('*');
    const getConn = () => this.getConnection(tenantSlug);

    const hasPermission = (required: string[]): boolean => {
      if (isOwnerOrAdmin) return true;
      return required.some((p) => userPermissions.includes(p));
    };

    // USERS MODULE
    const createUserTool = tool(
      async ({ full_name, email, position, department }) => {
        try {
          const { ds } = await getConn();
          const exists = await ds.query('SELECT id FROM users WHERE email = $1', [email]);
          if (exists.length > 0) return `User with email ${email} already exists.`;
          const id = uuidv4();
          // SECURITY: Generate a cryptographically random temporary password.
          // Never use a hardcoded default password. Never return the password in the response.
          const tempPassword = crypto.randomBytes(16).toString('base64url');
          const passwordHash = await bcrypt.hash(tempPassword, 12);
          await ds.query(`
            INSERT INTO users (id, email, password_hash, full_name, position, department, is_active, must_change_password, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, true, NOW(), NOW())
          `, [id, email, passwordHash, full_name, position || null, department || null]);
          this.logger.log(`[AI-ACTION] User created by ${currentUserId} in tenant ${tenantSlug}: ${email}`);
          // SECURITY: Do NOT return the password in the AI response — instruct the admin to trigger a password reset email.
          return `Successfully created user ${full_name} (${email}). A password reset email must be sent to the user via the Admin > Users panel so they can set their own password.`;
        } catch (err) {
          return `Failed to create user: ${err.message}`;
        }
      },
      {
        name: 'create_user',
        description: 'Create a new employee/user account. Ask for full_name and email if not provided.',
        schema: z.object({
          full_name: z.string().describe('Full name of the employee'),
          email: z.string().email().describe('Email address of the employee'),
          position: z.string().optional().describe('Job title or position'),
          department: z.string().optional().describe('Department name'),
        }),
      }
    );

    const updateUserTool = tool(
      async ({ user_id, position, department, is_active }) => {
        try {
          const { ds } = await getConn();
          const fields: string[] = [];
          const values: any[] = [];
          let idx = 1;
          if (position !== undefined) { fields.push(`position = $${idx++}`); values.push(position); }
          if (department !== undefined) { fields.push(`department = $${idx++}`); values.push(department); }
          if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
          if (fields.length === 0) return 'No fields provided to update.';
          fields.push('updated_at = NOW()');
          values.push(user_id);
          await ds.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values);
          return `Successfully updated user ${user_id}.`;
        } catch (err) {
          return `Failed to update user: ${err.message}`;
        }
      },
      {
        name: 'update_user',
        description: 'Update an existing employee details (position, department, active status).',
        schema: z.object({
          user_id: z.string().describe('UUID of the user to update'),
          position: z.string().optional().describe('New job title/position'),
          department: z.string().optional().describe('New department name'),
          is_active: z.boolean().optional().describe('Whether the user account is active'),
        }),
      }
    );

    const deactivateUserTool = tool(
      async ({ user_id }) => {
        try {
          const { ds } = await getConn();
          await ds.query(`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`, [user_id]);
          return `Successfully deactivated user ${user_id}.`;
        } catch (err) {
          return `Failed to deactivate user: ${err.message}`;
        }
      },
      {
        name: 'deactivate_user',
        description: 'Deactivate (disable) a user account.',
        schema: z.object({
          user_id: z.string().describe('UUID of the user to deactivate'),
        }),
      }
    );

    // LEAVE MODULE
    const submitLeaveRequestTool = tool(
      async ({ user_id, leave_type_name, start_date, end_date, reason }) => {
        try {
          const { ds } = await getConn();
          const targetUserId = user_id || currentUserId;
          const id = uuidv4();
          const start = new Date(start_date);
          const end = new Date(end_date);
          const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          await ds.query(`
            INSERT INTO leave_requests (id, user_id, leave_type_name, start_date, end_date, days, reason, status, approval_status, current_step, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', 'Pending', 0, NOW(), NOW())
          `, [id, targetUserId, leave_type_name, start_date, end_date, days, reason || null]);
          return `Successfully submitted a ${leave_type_name} leave request from ${start_date} to ${end_date} (${days} day(s)).`;
        } catch (err) {
          return `Failed to submit leave request: ${err.message}`;
        }
      },
      {
        name: 'submit_leave_request',
        description: 'Submit a leave request for an employee. If no user_id given, submits for current user. Ask for leave_type_name, start_date, end_date.',
        schema: z.object({
          user_id: z.string().optional().describe('UUID of the employee (defaults to current user)'),
          leave_type_name: z.string().describe('Type of leave e.g. Annual Leave, Sick Leave, Maternity Leave'),
          start_date: z.string().describe('Start date YYYY-MM-DD'),
          end_date: z.string().describe('End date YYYY-MM-DD'),
          reason: z.string().optional().describe('Reason for the leave'),
        }),
      }
    );

    const approveLeaveRequestTool = tool(
      async ({ leave_request_id }) => {
        try {
          const { ds } = await getConn();
          await ds.query(`
            UPDATE leave_requests SET status = 'Approved', approval_status = 'Approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
            WHERE id = $2
          `, [currentUserId, leave_request_id]);
          return `Successfully approved leave request ${leave_request_id}.`;
        } catch (err) {
          return `Failed to approve leave request: ${err.message}`;
        }
      },
      {
        name: 'approve_leave_request',
        description: 'Approve a pending leave request by its ID.',
        schema: z.object({
          leave_request_id: z.string().describe('UUID of the leave request to approve'),
        }),
      }
    );

    const rejectLeaveRequestTool = tool(
      async ({ leave_request_id, rejection_reason }) => {
        try {
          const { ds } = await getConn();
          await ds.query(`
            UPDATE leave_requests SET status = 'Rejected', approval_status = 'Rejected', rejection_reason = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
            WHERE id = $3
          `, [rejection_reason || null, currentUserId, leave_request_id]);
          return `Successfully rejected leave request ${leave_request_id}.`;
        } catch (err) {
          return `Failed to reject leave request: ${err.message}`;
        }
      },
      {
        name: 'reject_leave_request',
        description: 'Reject a pending leave request.',
        schema: z.object({
          leave_request_id: z.string().describe('UUID of the leave request to reject'),
          rejection_reason: z.string().optional().describe('Reason for rejection'),
        }),
      }
    );

    // ANNOUNCEMENTS MODULE
    const postAnnouncementTool = tool(
      async ({ title, content, priority, target_type }) => {
        try {
          const { ds } = await getConn();
          await ds.query(`
            CREATE TABLE IF NOT EXISTS announcements (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              title VARCHAR(255) NOT NULL, content TEXT NOT NULL,
              priority VARCHAR(20) DEFAULT 'normal', target_type VARCHAR(20) NOT NULL,
              target_ids TEXT[], created_by UUID, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
            )
          `);
          const id = uuidv4();
          await ds.query(`
            INSERT INTO announcements (id, title, content, priority, target_type, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          `, [id, title, content, priority || 'normal', target_type || 'all', currentUserId]);
          return `Successfully posted announcement: "${title}".`;
        } catch (err) {
          return `Failed to post announcement: ${err.message}`;
        }
      },
      {
        name: 'post_announcement',
        description: 'Post a system-wide announcement. Ask for title and content if not provided.',
        schema: z.object({
          title: z.string().describe('Title of the announcement'),
          content: z.string().describe('Body content of the announcement'),
          priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe('Priority level'),
          target_type: z.enum(['all', 'department', 'team']).optional().describe('Who this targets (default: all)'),
        }),
      }
    );

    // PAYROLL MODULE
    const addLoanTool = tool(
      async ({ user_id, loan_type, total_amount, monthly_deduction, term_months, description, start_date }) => {
        try {
          const { ds } = await getConn();
          const targetUserId = user_id || currentUserId;
          const id = uuidv4();
          const today = new Date().toISOString().split('T')[0];
          await ds.query(`
            INSERT INTO loans (id, user_id, loan_type, description, total_amount, monthly_deduction, remaining_balance, term_months, start_date, status, approval_status, current_step, requested_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $5, $7, $8, 'active', 'pending', 1, $9, NOW(), NOW())
          `, [id, targetUserId, loan_type || 'personal', description || null, total_amount, monthly_deduction, term_months || 1, start_date || today, currentUserId]);
          return `Successfully created loan of ${total_amount} for user ${targetUserId} with ${monthly_deduction}/month deduction.`;
        } catch (err) {
          return `Failed to create loan: ${err.message}`;
        }
      },
      {
        name: 'add_loan',
        description: 'Register an employee loan. Ask for total_amount and monthly_deduction if not provided.',
        schema: z.object({
          user_id: z.string().optional().describe('UUID of the employee (defaults to current user)'),
          loan_type: z.string().optional().describe('Type of loan e.g. personal, housing, emergency'),
          total_amount: z.number().describe('Total loan amount'),
          monthly_deduction: z.number().describe('Monthly deduction from salary'),
          term_months: z.number().optional().describe('Number of months to repay'),
          description: z.string().optional().describe('Purpose of the loan'),
          start_date: z.string().optional().describe('Date deductions start (YYYY-MM-DD)'),
        }),
      }
    );

    const initiatePayrollRunTool = tool(
      async ({ month, year }) => {
        try {
          const { ds } = await getConn();
          const existing = await ds.query(`SELECT id, status FROM payroll_runs WHERE month = $1 AND year = $2`, [month, year]);
          if (existing.length > 0) return `Payroll run for ${month}/${year} already exists with status: ${existing[0].status}.`;
          const id = uuidv4();
          await ds.query(`
            INSERT INTO payroll_runs (id, month, year, status, run_at, created_by)
            VALUES ($1, $2, $3, 'pending', NOW(), $4)
          `, [id, month, year, currentUserId]);
          return `Successfully initiated payroll run for ${month}/${year}. Status: pending.`;
        } catch (err) {
          return `Failed to initiate payroll run: ${err.message}`;
        }
      },
      {
        name: 'initiate_payroll_run',
        description: 'Initiate a payroll run for a specific month and year. Ask for month and year if not provided.',
        schema: z.object({
          month: z.number().min(1).max(12).describe('Month number 1-12'),
          year: z.number().describe('Year e.g. 2025'),
        }),
      }
    );

    // PMS MODULE
    const createProjectTool = tool(
      async ({ name, description, priority, start_date, target_end_date }) => {
        try {
          const { ds, tenantId } = await getConn();
          const id = uuidv4();
          await ds.query(`
            INSERT INTO pms_projects (id, tenant_id, name, description, status, priority, start_date, target_end_date, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'Planning', $5, $6, $7, $8, NOW(), NOW())
          `, [id, tenantId, name, description || null, priority || 'Medium', start_date || null, target_end_date || null, currentUserId]);
          return `Successfully created project "${name}".`;
        } catch (err) {
          return `Failed to create project: ${err.message}`;
        }
      },
      {
        name: 'create_project',
        description: 'Create a new project. Ask for name if not provided.',
        schema: z.object({
          name: z.string().describe('Name of the project'),
          description: z.string().optional().describe('Brief description'),
          priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional().describe('Priority level'),
          start_date: z.string().optional().describe('Start date YYYY-MM-DD'),
          target_end_date: z.string().optional().describe('Target end date YYYY-MM-DD'),
        }),
      }
    );

    const createTaskTool = tool(
      async ({ title, description, assignee_id, project_id, estimated_hours, priority, due_date }) => {
        try {
          const { ds, tenantId } = await getConn();
          const id = uuidv4();
          await ds.query(`
            INSERT INTO pms_tasks (id, tenant_id, title, description, assignee_id, project_id, estimated_hours, priority, status, due_date, reporter_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'To Do', $9, $10, NOW(), NOW())
          `, [id, tenantId, title, description || null, assignee_id || null, project_id || null, estimated_hours || null, priority || 'Medium', due_date || null, currentUserId]);
          return `Successfully created task "${title}".`;
        } catch (err) {
          return `Failed to create task: ${err.message}`;
        }
      },
      {
        name: 'create_task',
        description: 'Create a new task inside a project. Ask for title and project_id if not provided.',
        schema: z.object({
          title: z.string().describe('Title of the task'),
          description: z.string().optional().describe('Detailed description'),
          assignee_id: z.string().optional().describe('UUID of the user to assign'),
          project_id: z.string().optional().describe('UUID of the project'),
          estimated_hours: z.number().optional().describe('Estimated hours to complete'),
          priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional().describe('Priority level'),
          due_date: z.string().optional().describe('Due date YYYY-MM-DD'),
        }),
      }
    );

    const updateTaskStatusTool = tool(
      async ({ task_id, status, return_comment }) => {
        try {
          const { ds } = await getConn();
          const completedClause = status === 'Done' ? ', completed_at = NOW()' : '';
          await ds.query(`
            UPDATE pms_tasks SET status = $1, status_changed_at = NOW(), status_changed_by = $2, return_comment = $3${completedClause}, updated_at = NOW()
            WHERE id = $4
          `, [status, currentUserId, return_comment || null, task_id]);
          return `Successfully updated task ${task_id} status to "${status}".`;
        } catch (err) {
          return `Failed to update task status: ${err.message}`;
        }
      },
      {
        name: 'update_task_status',
        description: 'Change the status of a task (e.g., To Do, In Progress, Done, Blocked). Ask for task_id and status if not provided.',
        schema: z.object({
          task_id: z.string().describe('UUID of the task'),
          status: z.enum(['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Done']).describe('New status'),
          return_comment: z.string().optional().describe('Comment (required when Blocking or rejecting)'),
        }),
      }
    );

    // SCHEDULING MODULE
    const assignShiftTool = tool(
      async ({ user_id, shift_id, date, note }) => {
        try {
          const { ds } = await getConn();
          const targetUserId = user_id || currentUserId;
          const id = uuidv4();
          await ds.query(`
            INSERT INTO schedules (id, user_id, shift_id, date, is_day_off, is_override, note, created_at, updated_at)
            VALUES ($1, $2, $3, $4, false, true, $5, NOW(), NOW())
            ON CONFLICT (user_id, date) DO UPDATE SET shift_id = EXCLUDED.shift_id, is_override = true, note = EXCLUDED.note, updated_at = NOW()
          `, [id, targetUserId, shift_id, date, note || null]);
          return `Successfully assigned shift to user ${targetUserId} on ${date}.`;
        } catch (err) {
          return `Failed to assign shift: ${err.message}`;
        }
      },
      {
        name: 'assign_shift',
        description: 'Assign an employee to a specific shift on a given date. Ask for user_id, shift_id, date if not provided.',
        schema: z.object({
          user_id: z.string().optional().describe('UUID of the employee (defaults to current user)'),
          shift_id: z.string().describe('UUID of the shift'),
          date: z.string().describe('Date YYYY-MM-DD'),
          note: z.string().optional().describe('Optional note'),
        }),
      }
    );

    const markDayOffTool = tool(
      async ({ user_id, date, note }) => {
        try {
          const { ds } = await getConn();
          const targetUserId = user_id || currentUserId;
          const id = uuidv4();
          await ds.query(`
            INSERT INTO schedules (id, user_id, shift_id, date, is_day_off, is_override, note, created_at, updated_at)
            VALUES ($1, $2, NULL, $3, true, true, $4, NOW(), NOW())
            ON CONFLICT (user_id, date) DO UPDATE SET shift_id = NULL, is_day_off = true, is_override = true, note = EXCLUDED.note, updated_at = NOW()
          `, [id, targetUserId, date, note || null]);
          return `Successfully marked ${date} as a day off for user ${targetUserId}.`;
        } catch (err) {
          return `Failed to mark day off: ${err.message}`;
        }
      },
      {
        name: 'mark_day_off',
        description: 'Mark a specific day as a day off for an employee.',
        schema: z.object({
          user_id: z.string().optional().describe('UUID of employee (defaults to current user)'),
          date: z.string().describe('Date YYYY-MM-DD'),
          note: z.string().optional().describe('Optional note'),
        }),
      }
    );

    // OVERTIME MODULE
    const logOvertimeTool = tool(
      async ({ user_id, date, normal_ot_hours, night_ot_hours, holiday_ot_hours }) => {
        try {
          const { ds } = await getConn();
          const targetUserId = user_id || currentUserId;
          const id = uuidv4();
          await ds.query(`
            INSERT INTO overtime_entries (id, user_id, date, normal_ot_hours, night_ot_hours, holiday_ot_hours, dayoff_ot_hours, total_amount, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 'Pending', NOW(), NOW())
            ON CONFLICT (user_id, date) DO UPDATE SET normal_ot_hours = EXCLUDED.normal_ot_hours, night_ot_hours = EXCLUDED.night_ot_hours, holiday_ot_hours = EXCLUDED.holiday_ot_hours, updated_at = NOW()
          `, [id, targetUserId, date, normal_ot_hours || 0, night_ot_hours || 0, holiday_ot_hours || 0]);
          return `Successfully logged overtime for user ${targetUserId} on ${date}.`;
        } catch (err) {
          return `Failed to log overtime: ${err.message}`;
        }
      },
      {
        name: 'log_overtime',
        description: 'Log overtime hours for an employee on a specific date.',
        schema: z.object({
          user_id: z.string().optional().describe('UUID of employee (defaults to current user)'),
          date: z.string().describe('Date YYYY-MM-DD'),
          normal_ot_hours: z.number().optional().describe('Normal overtime hours (1.25x rate)'),
          night_ot_hours: z.number().optional().describe('Night overtime hours 22:00-06:00 (1.5x rate)'),
          holiday_ot_hours: z.number().optional().describe('Holiday overtime hours (2.5x rate)'),
        }),
      }
    );

    // SCHEDULING MODULE - CREATE SHIFT DEFINITION
    const createShiftTool = tool(
      async ({ name, start_time, end_time, color, is_overnight, description, grace_minutes }) => {
        try {
          const { ds } = await getConn();
          const id = uuidv4();
          await ds.query(`
            INSERT INTO shifts (id, name, start_time, end_time, color, is_overnight, description, grace_minutes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          `, [id, name, start_time, end_time, color || '#3B82F6', is_overnight || false, description || null, grace_minutes || 15]);
          return `Successfully created shift "${name}" (${start_time} - ${end_time}).`;
        } catch (err) {
          return `Failed to create shift: ${err.message}`;
        }
      },
      {
        name: 'create_shift',
        description: 'Create a new shift definition (e.g. Morning Shift, Night Shift). Ask for name, start_time, and end_time if not provided.',
        schema: z.object({
          name: z.string().describe('Name of the shift e.g. "Morning Shift", "Night Shift"'),
          start_time: z.string().describe('Start time in HH:MM format e.g. "08:00"'),
          end_time: z.string().describe('End time in HH:MM format e.g. "17:00"'),
          color: z.string().optional().describe('Hex color code for the shift e.g. #3B82F6'),
          is_overnight: z.boolean().optional().describe('Whether the shift goes past midnight'),
          description: z.string().optional().describe('Optional description'),
          grace_minutes: z.number().optional().describe('Grace period in minutes before marking as late (default 15)'),
        }),
      }
    );

    // PMS MODULE - CREATE SPRINT
    const createSprintTool = tool(
      async ({ project_id, name, goal, start_date, end_date }) => {
        try {
          const { ds, tenantId } = await getConn();
          const id = uuidv4();
          await ds.query(`
            INSERT INTO pms_sprints (id, tenant_id, project_id, name, goal, start_date, end_date, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Planning', NOW(), NOW())
          `, [id, tenantId, project_id, name, goal || null, start_date, end_date]);
          return `Successfully created sprint "${name}" for project ${project_id}.`;
        } catch (err) {
          return `Failed to create sprint: ${err.message}`;
        }
      },
      {
        name: 'create_sprint',
        description: 'Create a new sprint inside a project. Ask for project_id, name, start_date, and end_date if not provided.',
        schema: z.object({
          project_id: z.string().describe('UUID of the project'),
          name: z.string().describe('Name of the sprint e.g. "Sprint 1"'),
          goal: z.string().optional().describe('Sprint goal or objective'),
          start_date: z.string().describe('Start date YYYY-MM-DD'),
          end_date: z.string().describe('End date YYYY-MM-DD'),
        }),
      }
    );

    // PMS MODULE - ADD PROJECT MEMBER
    const addProjectMemberTool = tool(
      async ({ project_id, user_id, role }) => {
        try {
          const { ds } = await getConn();
          await ds.query(`
            INSERT INTO pms_project_members (project_id, user_id, role, can_create_tasks, joined_at)
            VALUES ($1, $2, $3, false, NOW())
            ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
          `, [project_id, user_id, role || 'Member']);
          return `Successfully added user ${user_id} to project ${project_id} as ${role || 'Member'}.`;
        } catch (err) {
          return `Failed to add project member: ${err.message}`;
        }
      },
      {
        name: 'add_project_member',
        description: 'Add a user as a member to a project. Ask for project_id and user_id if not provided.',
        schema: z.object({
          project_id: z.string().describe('UUID of the project'),
          user_id: z.string().describe('UUID of the user to add'),
          role: z.enum(['Manager', 'Lead', 'Member', 'Viewer']).optional().describe('Role in the project (default: Member)'),
        }),
      }
    );

    // LEAVE MODULE - CANCEL LEAVE REQUEST
    const cancelLeaveRequestTool = tool(
      async ({ leave_request_id }) => {
        try {
          const { ds } = await getConn();
          await ds.query(`
            UPDATE leave_requests SET status = 'Cancelled', updated_at = NOW() WHERE id = $1
          `, [leave_request_id]);
          return `Successfully cancelled leave request ${leave_request_id}.`;
        } catch (err) {
          return `Failed to cancel leave request: ${err.message}`;
        }
      },
      {
        name: 'cancel_leave_request',
        description: 'Cancel a leave request. Ask for the leave_request_id if not provided.',
        schema: z.object({
          leave_request_id: z.string().describe('UUID of the leave request to cancel'),
        }),
      }
    );

    // HOLIDAYS MODULE - ADD HOLIDAY
    const addHolidayTool = tool(
      async ({ name, date, description, is_recurring, type }) => {
        try {
          const { ds } = await getConn();
          const id = uuidv4();
          await ds.query(`
            INSERT INTO holidays (id, name, date, description, is_recurring, type, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          `, [id, name, date, description || null, is_recurring !== false, type || 'public']);
          return `Successfully added holiday "${name}" on ${date}.`;
        } catch (err) {
          return `Failed to add holiday: ${err.message}`;
        }
      },
      {
        name: 'add_holiday',
        description: 'Add a new public or company holiday to the calendar. Ask for name and date if not provided.',
        schema: z.object({
          name: z.string().describe('Name of the holiday e.g. "New Year", "Christmas"'),
          date: z.string().describe('Date of the holiday YYYY-MM-DD'),
          description: z.string().optional().describe('Optional description'),
          is_recurring: z.boolean().optional().describe('Whether this holiday repeats every year (default: true)'),
          type: z.enum(['public', 'company', 'religious']).optional().describe('Type of holiday (default: public)'),
        }),
      }
    );

    // HRMS REPORTS TOOLS
    const getHeadcountAnalyticsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const totalRes = await ds.query(`SELECT COUNT(*) as count FROM users WHERE is_active = true`);
          const depts = await ds.query(`SELECT COALESCE(department, 'Unassigned') as name, COUNT(*) as count FROM users WHERE is_active = true GROUP BY department ORDER BY count DESC LIMIT 5`);
          const total = totalRes[0]?.count || 0;
          const deptStr = depts.map((d: any) => `${d.name}: ${d.count}`).join(', ');
          return `Active Headcount: ${total} employees. Top departments: ${deptStr}. For complete interactive reports visit /hrms/reports.`;
        } catch (err) {
          return `Failed to fetch headcount: ${err.message}`;
        }
      },
      {
        name: 'get_headcount_analytics',
        description: 'Get an executive summary of current active employee headcount and department breakdown.',
        schema: z.object({}),
      }
    );

    const exportBankTransferFileTool = tool(
      async ({ month, year, format }) => {
        try {
          const fmt = format || 'csv';
          return `Direct bank transfer file generation for ${month}/${year} (${fmt.toUpperCase()}) is available via the HR Reports page at /hrms/reports or direct download GET /hrms/reports/bank-transfer-file?month=${month}&year=${year}&format=${fmt}.`;
        } catch (err) {
          return `Failed to export bank transfer file: ${err.message}`;
        }
      },
      {
        name: 'export_bank_transfer_file',
        description: 'Export commercial bank direct deposit payment file (CSV, NACHA, or ABA) for monthly payroll disbursement.',
        schema: z.object({
          month: z.number().min(1).max(12).describe('Payroll month (1-12)'),
          year: z.number().min(2000).max(2100).describe('Payroll year (e.g. 2026)'),
          format: z.enum(['csv', 'nacha', 'aba']).optional().describe('Format: csv, nacha, or aba (default: csv)'),
        }),
      }
    );

    // HRMS DOCUMENTS & LETTER TOOLS
    const generateEmployeeLetterTool = tool(
      async ({ templateCode, employeeIdentifier, customMessage }) => {
        try {
          const { ds } = await getConn();
          const userRes = await ds.query(
            `SELECT id, first_name, last_name, email, position, department FROM users WHERE id::text = $1 OR email = $1 LIMIT 1`,
            [employeeIdentifier],
          );
          if (!userRes || userRes.length === 0) {
            return `Employee "${employeeIdentifier}" not found.`;
          }
          const emp = userRes[0];
          const empName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;
          return `To generate the ${templateCode} letter for ${empName} (${emp.position || 'Staff'}, ${emp.department || 'General'}), please confirm. You can also generate and download directly from the Document Vault at /hrms/documents or use POST /hrms/documents/generate-letter with body { "templateIdOrCode": "${templateCode}", "employeeId": "${emp.id}", "saveToVault": true }.`;
        } catch (err) {
          return `Failed to initiate letter generation: ${err.message}`;
        }
      },
      {
        name: 'generate_employee_letter',
        description: 'Prepare or issue an official employee letter (e.g. OFFER_LETTER, EXPERIENCE_LETTER, SALARY_CERTIFICATE, PROMOTION_LETTER, WARNING_LETTER) for an employee.',
        schema: z.object({
          templateCode: z.string().describe('Template code: OFFER_LETTER, EXPERIENCE_LETTER, SALARY_CERTIFICATE, PROMOTION_LETTER, or WARNING_LETTER'),
          employeeIdentifier: z.string().describe('Employee UUID or email address'),
          customMessage: z.string().optional().describe('Optional custom note or special remarks'),
        }),
      }
    );

    const getExpiringDocumentsTool = tool(
      async ({ days }) => {
        try {
          const { ds } = await getConn();
          const windowDays = days || 30;
          const rows = await ds.query(
            `SELECT d.id, d.title, d.category, d.document_type, d.expiry_date, u.first_name, u.last_name, u.department
             FROM employee_documents d
             JOIN users u ON d.user_id = u.id
             WHERE d.expiry_date IS NOT NULL AND d.expiry_date <= (CURRENT_DATE + INTERVAL '${windowDays} days')
             ORDER BY d.expiry_date ASC LIMIT 10`
          );
          if (!rows || rows.length === 0) {
            return `No documents are expiring within the next ${windowDays} days. All credentials in compliance.`;
          }
          const listStr = rows.map((r: any) => `${r.first_name} ${r.last_name}: ${r.title} (${r.document_type}) expires on ${new Date(r.expiry_date).toLocaleDateString()}`).join('\n');
          return `Found ${rows.length} document(s) expiring within ${windowDays} days:\n${listStr}\nFor details visit /hrms/documents.`;
        } catch (err) {
          return `Failed to fetch expiring documents: ${err.message}`;
        }
      },
      {
        name: 'get_expiring_documents',
        description: 'Audit employee documents, visas, passports, or professional certifications expiring within a specified number of days (default: 30).',
        schema: z.object({
          days: z.number().optional().describe('Days threshold e.g. 30, 60, or 90 (default 30)'),
        }),
      }
    );

    // ONBOARDING & OFFBOARDING TOOLS
    const getOnboardingStatsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const rows = await ds.query(
            `SELECT 
               COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
               COUNT(*) FILTER (WHERE status = 'completed') AS completed,
               COUNT(*) FILTER (WHERE status = 'not_started') AS not_started,
               COUNT(*) AS total
             FROM employee_onboarding`
          );
          const r = rows[0] || {};
          return `Onboarding Metrics:\n- Total: ${r.total || 0}\n- In Progress: ${r.in_progress || 0}\n- Completed: ${r.completed || 0}\n- Not Started: ${r.not_started || 0}\nView full tracking dashboard at /hrms/onboarding.`;
        } catch (err) {
          return `Failed to fetch onboarding stats: ${err.message}`;
        }
      },
      {
        name: 'get_onboarding_stats',
        description: 'Get current organizational onboarding and probation metrics, active new hires, and progress overview.',
        schema: z.object({}),
      }
    );

    const startEmployeeOnboardingTool = tool(
      async ({ employeeIdentifier, probationDays }) => {
        try {
          const { ds } = await getConn();
          const userRes = await ds.query(
            `SELECT id, first_name, last_name, email FROM users WHERE id::text = $1 OR email = $1 LIMIT 1`,
            [employeeIdentifier],
          );
          if (!userRes || userRes.length === 0) {
            return `Employee "${employeeIdentifier}" not found.`;
          }
          const emp = userRes[0];
          const days = probationDays || 90;
          return `To initiate onboarding for ${emp.first_name || ''} ${emp.last_name || ''} (${emp.email}) with a ${days}-day probation period, visit /hrms/onboarding and click "Start Onboarding" or invoke POST /hrms/onboarding/start with { "userId": "${emp.id}", "probationDays": ${days} }.`;
        } catch (err) {
          return `Failed to initiate onboarding: ${err.message}`;
        }
      },
      {
        name: 'start_employee_onboarding',
        description: 'Initiate the structured onboarding workflow, checklist, and probation period tracking for a new hire.',
        schema: z.object({
          employeeIdentifier: z.string().describe('Employee UUID or email address'),
          probationDays: z.number().optional().describe('Probation duration in days (default: 90)'),
        }),
      }
    );

    // EMPLOYEE SELF-SERVICE TOOLS
    const getMySelfServiceSummaryTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const balances = await ds.query(
            `SELECT leave_type, remaining_days FROM leave_balances WHERE user_id = $1`,
            [currentUserId],
          );
          const ps = await ds.query(
            `SELECT pi.net_pay, pr.month, pr.year FROM payroll_items pi
             JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
             WHERE pi.user_id = $1 ORDER BY pr.year DESC, pr.month DESC LIMIT 1`,
            [currentUserId],
          );
          const bStr = balances.map((b: any) => `${b.leave_type}: ${b.remaining_days} days left`).join(', ') || 'No records';
          const net = ps[0] ? `$${ps[0].net_pay} (${ps[0].month}/${ps[0].year})` : 'None';
          return `Your Self-Service Summary:\n- Leave Balances: ${bStr}\n- Latest Net Pay: ${net}\n- Punctuality & full details available at /self-service.`;
        } catch (err) {
          return `Failed to fetch self-service summary: ${err.message}`;
        }
      },
      {
        name: 'get_my_self_service_summary',
        description: 'Get personal employee self-service overview: remaining leave balances, latest payslip amount, and attendance metrics.',
        schema: z.object({}),
      }
    );

    const getGrievanceStatsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const rows = await ds.query(`
            SELECT
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status != 'closed') AS open,
              COUNT(*) FILTER (WHERE status != 'closed' AND NOW() > sla_resolution_deadline) AS breached,
              COUNT(*) FILTER (WHERE retaliation_monitoring_flag = TRUE) AS retaliation_watch
            FROM grievances
          `);
          const s = rows[0] || {};
          return `HR Grievance & Whistleblower Summary:\n- Total Cases: ${s.total || 0}\n- Active / Open Cases: ${s.open || 0}\n- SLA Breached Cases: ${s.breached || 0}\n- Retaliation Watchlist: ${s.retaliation_watch || 0}\nManage cases at /hrms/grievances.`;
        } catch (err) {
          return `Failed to fetch grievance stats: ${err.message}`;
        }
      },
      {
        name: 'get_grievance_stats',
        description: 'Get organization grievance metrics including open cases, SLA breaches, and retaliation monitoring status.',
        schema: z.object({}),
      }
    );

    const fileGrievanceTool = tool(
      async ({ category, subject, description, is_anonymous, priority }) => {
        try {
          const { ds } = await getConn();
          const d = new Date();
          const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
          const rand = Math.floor(1000 + Math.random() * 9000);
          const ticketNumber = `GRV-${ym}-${rand}`;

          const res = await ds.query(`
            INSERT INTO grievances (
              ticket_number, user_id, is_anonymous, category, subject, description, priority, status,
              sla_acknowledgment_deadline, sla_resolution_deadline
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, 'filed',
              NOW() + INTERVAL '2 days', NOW() + INTERVAL '14 days'
            ) RETURNING ticket_number
          `, [ticketNumber, currentUserId, is_anonymous || false, category, subject, description, priority || 'medium']);

          return `Grievance successfully filed under ticket ${res[0]?.ticket_number || ticketNumber}. You can track progress under /hrms/grievances.`;
        } catch (err) {
          return `Failed to file grievance: ${err.message}`;
        }
      },
      {
        name: 'file_grievance',
        description: 'Submit an employee grievance or whistleblower complaint confidentially.',
        schema: z.object({
          category: z.enum(['harassment', 'discrimination', 'safety', 'policy_violation', 'workplace_conflict', 'compensation_dispute', 'other']),
          subject: z.string().describe('Brief subject line'),
          description: z.string().describe('Detailed incident narrative'),
          is_anonymous: z.boolean().optional().describe('Whether to mask complainant identity'),
          priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Urgency level'),
        }),
      }
    );

    // BENEFITS MODULE - GET PLANS
    const getBenefitPlansTool = tool(
      async ({ is_active }) => {
        try {
          const { ds } = await getConn();
          let query = 'SELECT id, name, type, provider_name, employer_contribution, employee_contribution, frequency, is_active FROM benefit_plans';
          const params: any[] = [];
          if (is_active !== undefined) {
            query += ' WHERE is_active = $1';
            params.push(is_active);
          }
          query += ' ORDER BY name ASC';
          const plans = await ds.query(query, params);
          return JSON.stringify(plans, null, 2);
        } catch (err) {
          return `Failed to fetch benefit plans: ${err.message}`;
        }
      },
      {
        name: 'get_benefit_plans',
        description: 'Get list of active or all benefit and insurance plans offered by the company.',
        schema: z.object({
          is_active: z.boolean().optional().describe('Filter by active status'),
        }),
      }
    );

    // BENEFITS MODULE - GET SUMMARY STATS
    const getBenefitsSummaryTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const plans = await ds.query('SELECT COUNT(*) as count FROM benefit_plans WHERE is_active = true');
          const enrollments = await ds.query('SELECT COUNT(*) as count FROM benefit_enrollments WHERE status = $1', ['active']);
          const costs = await ds.query('SELECT COALESCE(SUM(employer_cost), 0) as total_employer, COALESCE(SUM(employee_cost), 0) as total_employee FROM benefit_enrollments WHERE status = $1', ['active']);
          return JSON.stringify({
            active_plans: parseInt(plans[0]?.count || '0'),
            active_enrollments: parseInt(enrollments[0]?.count || '0'),
            total_monthly_employer_cost: parseFloat(costs[0]?.total_employer || '0'),
            total_monthly_employee_cost: parseFloat(costs[0]?.total_employee || '0'),
          }, null, 2);
        } catch (err) {
          return `Failed to fetch benefits summary: ${err.message}`;
        }
      },
      {
        name: 'get_benefits_summary',
        description: 'Get high-level organizational analytics and cost breakdown for employee benefits and insurance programs.',
        schema: z.object({}),
      }
    );

    // TRAINING MODULE - GET COURSES
    const getTrainingCoursesTool = tool(
      async ({ category, is_mandatory }) => {
        try {
          const { ds } = await getConn();
          let query = 'SELECT id, title, category, delivery_method, duration_hours, is_mandatory, passing_score, provider_name FROM training_courses WHERE is_active = true';
          const params: any[] = [];
          let idx = 1;
          if (category) {
            query += ` AND category = $${idx++}`;
            params.push(category);
          }
          if (is_mandatory !== undefined) {
            query += ` AND is_mandatory = $${idx++}`;
            params.push(is_mandatory);
          }
          query += ' ORDER BY title ASC';
          const courses = await ds.query(query, params);
          return JSON.stringify(courses, null, 2);
        } catch (err) {
          return `Failed to fetch training courses: ${err.message}`;
        }
      },
      {
        name: 'get_training_courses',
        description: 'Get list of active learning curricula and compliance courses available in the LMS.',
        schema: z.object({
          category: z.string().optional().describe('Filter by category e.g. compliance, technical, leadership, safety'),
          is_mandatory: z.boolean().optional().describe('Filter for mandatory compliance training'),
        }),
      }
    );

    // TRAINING MODULE - GET STATS
    const getTrainingStatsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const courses = await ds.query('SELECT COUNT(*) as count FROM training_courses WHERE is_active = true');
          const enrollments = await ds.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed FROM training_enrollments');
          const skills = await ds.query('SELECT COUNT(*) as count FROM employee_skills WHERE verified = true');
          return JSON.stringify({
            active_courses: parseInt(courses[0]?.count || '0'),
            total_enrollments: parseInt(enrollments[0]?.total || '0'),
            completed_enrollments: parseInt(enrollments[0]?.completed || '0'),
            verified_skills_logged: parseInt(skills[0]?.count || '0'),
          }, null, 2);
        } catch (err) {
          return `Failed to fetch training stats: ${err.message}`;
        }
      },
      {
        name: 'get_training_stats',
        description: 'Get workforce learning KPIs, compliance completion rates, and verified skills count.',
        schema: z.object({}),
      }
    );

    // TRAINING MODULE - ENROLL
    const enrollInCourseTool = tool(
      async ({ course_id, user_id }) => {
        try {
          const { ds } = await getConn();
          const targetUserId = user_id || currentUserId;
          const id = (await import('crypto')).randomUUID();
          await ds.query(
            `INSERT INTO training_enrollments (id, course_id, user_id, enrolled_by, status, completion_percentage, attendance_confirmed, certificate_issued)
             VALUES ($1, $2, $3, $4, 'confirmed', 0, false, false)`,
            [id, course_id, targetUserId, currentUserId],
          );
          return `Successfully enrolled user ${targetUserId} in training course ${course_id}.`;
        } catch (err) {
          return `Failed to enroll in training: ${err.message}`;
        }
      },
      {
        name: 'enroll_in_course',
        description: 'Enroll an employee or yourself in a training course by course_id.',
        schema: z.object({
          course_id: z.string().describe('UUID of the training course'),
          user_id: z.string().optional().describe('UUID of the employee to enroll (defaults to current user)'),
        }),
      }
    );

    // PMS 360 REVIEWS MODULE - GET REVIEW CYCLES
    const getReviewCyclesTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const cycles = await ds.query(`
            SELECT id, title, cycle_type, status, start_date, due_date
            FROM pms_review_cycles
            ORDER BY created_at DESC
            LIMIT 5
          `);
          if (!cycles.length) return 'No review cycles found.';
          return `Active/Recent Review Cycles:\n` +
            cycles.map((c: any) => `- ${c.title} (${c.cycle_type}, Status: ${c.status}, Due: ${c.due_date})`).join('\n');
        } catch (err) {
          return `Failed to fetch review cycles: ${err.message}`;
        }
      },
      {
        name: 'get_review_cycles',
        description: 'Get recent 360 performance review cycles and their current timeline and status.',
        schema: z.object({}),
      }
    );

    // PMS 360 REVIEWS MODULE - GET MY REVIEWS SUMMARY
    const getMyReviewsSummaryTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const pendingFeedbacks = await ds.query(`
            SELECT rf.id, rf.reviewer_type, rc.title as cycle_title, rc.due_date,
                   u.first_name, u.last_name
            FROM pms_review_feedbacks rf
            JOIN pms_review_cycles rc ON rc.id = rf.cycle_id
            JOIN pms_employee_reviews er ON er.id = rf.review_id
            JOIN users u ON u.id = er.employee_id
            WHERE rf.reviewer_id = $1 AND rf.status = 'pending'
          `, [currentUserId]);

          const myReviews = await ds.query(`
            SELECT er.status, er.final_rating, rc.title as cycle_title
            FROM pms_employee_reviews er
            JOIN pms_review_cycles rc ON rc.id = er.cycle_id
            WHERE er.employee_id = $1
            ORDER BY er.created_at DESC
            LIMIT 1
          `, [currentUserId]);

          let summary = `Your 360 Reviews Summary:\n`;
          if (myReviews.length > 0) {
            summary += `Latest Review (${myReviews[0].cycle_title}): Status: ${myReviews[0].status}, Final Rating: ${myReviews[0].final_rating || 'Pending calibration'}\n`;
          }
          summary += `Pending feedback requests waiting for your submission: ${pendingFeedbacks.length}\n`;
          if (pendingFeedbacks.length > 0) {
            summary += pendingFeedbacks.map((f: any) => `- Feedback for ${f.first_name} ${f.last_name} (${f.reviewer_type} review) in ${f.cycle_title}, Due: ${f.due_date}`).join('\n');
          }
          return summary;
        } catch (err) {
          return `Failed to get reviews summary: ${err.message}`;
        }
      },
      {
        name: 'get_my_reviews_summary',
        description: 'Get your personal 360 review status and pending feedback requests waiting for your input.',
        schema: z.object({}),
      }
    );

    // PMS 360 REVIEWS MODULE - GET REVIEW ANALYTICS
    const getPmsReviewAnalyticsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const reviews = await ds.query(`
            SELECT status, final_rating FROM pms_employee_reviews
          `);
          const total = reviews.length;
          const completed = reviews.filter((r: any) => r.status === 'completed').length;
          const pips = await ds.query(`
            SELECT COUNT(*) as count FROM pms_performance_improvement_plans WHERE status = 'active'
          `);
          return `Performance Review Analytics:\n` +
            `- Total Evaluated Employees: ${total}\n` +
            `- Completed Reviews: ${completed} (${total > 0 ? Math.round((completed / total) * 100) : 0}%)\n` +
            `- Active Performance Improvement Plans (PIPs): ${pips[0]?.count || 0}`;
        } catch (err) {
          return `Failed to fetch performance review analytics: ${err.message}`;
        }
      },
      {
        name: 'get_pms_review_analytics',
        description: 'Get overall performance review analytics, completion rates, and active PIP count.',
        schema: z.object({}),
      }
    );

    // HRMS EXPENSES MODULE - GET EXPENSE REPORTS
    const getExpenseReportsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const reports = await ds.query(`
            SELECT report_number, title, status, total_amount, currency, created_at
            FROM expense_reports
            ORDER BY created_at DESC
            LIMIT 5
          `);
          if (!reports.length) return 'No expense reports found.';
          return `Recent Expense Reports:\n` +
            reports.map((r: any) => `- ${r.report_number}: ${r.title} ($${r.total_amount} ${r.currency}, Status: ${r.status})`).join('\n');
        } catch (err) {
          return `Failed to fetch expense reports: ${err.message}`;
        }
      },
      {
        name: 'get_expense_reports',
        description: 'Get recent company expense reports with amounts and approval status.',
        schema: z.object({}),
      }
    );

    // HRMS EXPENSES MODULE - GET MY EXPENSES SUMMARY
    const getMyExpensesSummaryTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const reports = await ds.query(`
            SELECT status, total_amount, approved_amount FROM expense_reports WHERE employee_id = $1
          `, [currentUserId]);
          const pending = reports.filter((r: any) => r.status === 'submitted').length;
          const approved = reports.filter((r: any) => r.status === 'approved').length;
          const reimbursed = reports.filter((r: any) => r.status === 'reimbursed').length;
          const totalClaimed = reports.reduce((acc: number, r: any) => acc + Number(r.total_amount || 0), 0);
          return `Your Expense Claims Summary:\n` +
            `- Total Claims Submitted: ${reports.length} ($${totalClaimed.toFixed(2)})\n` +
            `- Pending Approval: ${pending}\n` +
            `- Approved (Pending Reimbursement): ${approved}\n` +
            `- Paid & Reimbursed: ${reimbursed}`;
        } catch (err) {
          return `Failed to get personal expenses summary: ${err.message}`;
        }
      },
      {
        name: 'get_my_expenses_summary',
        description: 'Get your own expense claims summary, pending approvals, and reimbursement totals.',
        schema: z.object({}),
      }
    );

    // HRMS EXPENSES MODULE - GET EXPENSE ANALYTICS
    const getExpenseAnalyticsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const summary = await ds.query(`
            SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_spend FROM expense_reports
          `);
          const violations = await ds.query(`
            SELECT COUNT(*) as count FROM expense_items WHERE policy_violation = TRUE
          `);
          return `Company Expense Analytics:\n` +
            `- Total Expense Reports: ${summary[0]?.count || 0}\n` +
            `- Total Spend Claimed: $${Number(summary[0]?.total_spend || 0).toFixed(2)}\n` +
            `- Policy Violations Flagged: ${violations[0]?.count || 0}`;
        } catch (err) {
          return `Failed to fetch expense analytics: ${err.message}`;
        }
      },
      {
        name: 'get_expense_analytics',
        description: 'Get company-wide expense analytics, spend totals, and policy violations count.',
        schema: z.object({}),
      }
    );

    // HRMS ASSETS MODULE - GET ASSETS
    const getAssetsTool = tool(
      async ({ status }) => {
        try {
          const { ds } = await getConn();
          let query = 'SELECT name, asset_tag, model, status, current_condition, location FROM company_assets WHERE 1=1';
          const params: any[] = [];
          if (status) {
            query += ' AND status = $1';
            params.push(status);
          }
          query += ' ORDER BY created_at DESC LIMIT 10';
          const assets = await ds.query(query, params);
          if (!assets.length) return 'No assets found.';
          return 'Company Assets:\n' + assets.map((a: any) => `- ${a.name} (Tag: ${a.asset_tag}, Status: ${a.status}, Condition: ${a.current_condition})`).join('\n');
        } catch (err) {
          return `Failed to fetch assets: ${err.message}`;
        }
      },
      {
        name: 'get_assets',
        description: 'Get list of company assets and equipment with tags, status, and condition.',
        schema: z.object({
          status: z.string().optional().describe('Filter by asset status (available, assigned, maintenance, repair)'),
        }),
      }
    );

    // HRMS ASSETS MODULE - GET MY ASSIGNED ASSETS
    const getMyAssignedAssetsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const assets = await ds.query(`
            SELECT a.name, a.asset_tag, a.model, aa.assigned_date, aa.expected_return_date
            FROM company_assets a
            JOIN asset_assignments aa ON a.id = aa.asset_id AND aa.is_active = TRUE AND aa.user_id = $1
          `, [currentUserId]);
          if (!assets.length) return 'You currently have no company assets assigned to you.';
          return 'Your Assigned Assets:\n' + assets.map((a: any) => `- ${a.name} (${a.asset_tag}, Assigned: ${a.assigned_date})`).join('\n');
        } catch (err) {
          return `Failed to get assigned assets: ${err.message}`;
        }
      },
      {
        name: 'get_my_assigned_assets',
        description: 'Get company assets, equipment, or devices currently assigned to you.',
        schema: z.object({}),
      }
    );

    // HRMS ASSETS MODULE - GET ASSET ANALYTICS
    const getAssetAnalyticsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const counts = await ds.query(`
            SELECT 
              COUNT(*) as total_assets,
              SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_count,
              SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned_count,
              SUM(CASE WHEN status = 'maintenance' OR status = 'repair' THEN 1 ELSE 0 END) as maintenance_count,
              COALESCE(SUM(purchase_cost), 0) as total_valuation
            FROM company_assets
          `);
          const row = counts[0] || {};
          return `Asset Tracking Analytics:\n` +
            `- Total Assets: ${row.total_assets || 0}\n` +
            `- Available: ${row.available_count || 0}\n` +
            `- Currently Assigned: ${row.assigned_count || 0}\n` +
            `- In Maintenance/Repair: ${row.maintenance_count || 0}\n` +
            `- Total Inventory Valuation: $${Number(row.total_valuation || 0).toFixed(2)}`;
        } catch (err) {
          return `Failed to fetch asset analytics: ${err.message}`;
        }
      },
      {
        name: 'get_asset_analytics',
        description: 'Get company asset inventory counts, valuation, and maintenance overview.',
        schema: z.object({}),
      }
    );

    // HRMS PULSE SURVEYS - GET ACTIVE SURVEYS
    const getActiveSurveysTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const surveys = await ds.query(`
            SELECT id, title, survey_type, is_anonymous, start_date, end_date
            FROM surveys
            WHERE status = 'active'
            ORDER BY created_at DESC
          `);
          if (!surveys.length) return 'No active pulse surveys currently open.';
          return 'Active Employee Surveys:\n' + surveys.map((s: any) => `- ${s.title} (${s.survey_type.toUpperCase()}, Anonymous: ${s.is_anonymous ? 'Yes' : 'No'}, Ends: ${s.end_date || 'Ongoing'})`).join('\n');
        } catch (err) {
          return `Failed to fetch active surveys: ${err.message}`;
        }
      },
      {
        name: 'get_active_surveys',
        description: 'Get list of active employee pulse and engagement surveys currently open for response.',
        schema: z.object({}),
      }
    );

    // HRMS PULSE SURVEYS - GET SURVEY ANALYTICS
    const getSurveyAnalyticsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const counts = await ds.query('SELECT COUNT(*) as total, SUM(CASE WHEN status = \'active\' THEN 1 ELSE 0 END) as active FROM surveys');
          const resp = await ds.query('SELECT COUNT(*) as total FROM survey_responses');
          const actions = await ds.query('SELECT COUNT(*) as total, SUM(CASE WHEN status = \'completed\' THEN 1 ELSE 0 END) as completed FROM survey_action_items');
          return `Employee Pulse & Engagement Overview:\n` +
            `- Total Surveys Launched: ${counts[0]?.total || 0} (${counts[0]?.active || 0} currently active)\n` +
            `- Total Employee Responses Collected: ${resp[0]?.total || 0}\n` +
            `- Action Items Committed: ${actions[0]?.total || 0} (${actions[0]?.completed || 0} resolved)`;
        } catch (err) {
          return `Failed to fetch survey analytics: ${err.message}`;
        }
      },
      {
        name: 'get_survey_analytics',
        description: 'Get employee engagement survey participation metrics, response volumes, and action plan resolution status.',
        schema: z.object({}),
      }
    );

    // BULK IMPORT / EXPORT MODULE
    const getImportExportJobsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const jobs = await ds.query(`
            SELECT id, job_type, entity_type, format, status, total_rows, processed_rows, created_at
            FROM import_export_jobs
            ORDER BY created_at DESC
            LIMIT 5
          `);
          if (!jobs.length) return 'No recent bulk import/export jobs found.';
          return 'Recent Import/Export Jobs:\n' + jobs.map((j: any) => `- ${j.job_type.toUpperCase()} ${j.entity_type} (${j.status.toUpperCase()}, ${j.processed_rows}/${j.total_rows} rows, Format: ${j.format})`).join('\n');
        } catch (err) {
          return `Failed to fetch import/export jobs: ${err.message}`;
        }
      },
      {
        name: 'get_import_export_jobs',
        description: 'Get the latest data import or export jobs, batch status, row counts, and audit logs.',
        schema: z.object({}),
      }
    );

    const getImportExportStatsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const stats = await ds.query(`
            SELECT 
              COUNT(*) as total_jobs,
              SUM(CASE WHEN job_type = 'import' THEN 1 ELSE 0 END) as total_imports,
              SUM(CASE WHEN job_type = 'export' THEN 1 ELSE 0 END) as total_exports,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
              SUM(processed_rows) as total_rows
            FROM import_export_jobs
          `);
          const row = stats[0] || {};
          return `Data Import & Export Governance Overview:\n` +
            `- Total Imports: ${row.total_imports || 0}\n` +
            `- Total Exports: ${row.total_exports || 0}\n` +
            `- Total Rows Processed: ${row.total_rows || 0}\n` +
            `- Successfully Completed Jobs: ${row.completed_jobs || 0}/${row.total_jobs || 0}`;
        } catch (err) {
          return `Failed to fetch import/export stats: ${err.message}`;
        }
      },
      {
        name: 'get_import_export_stats',
        description: 'Get overall summary metrics of enterprise data imports, exports, and governance volumes.',
        schema: z.object({}),
      }
    );

    const getRecruitmentFunnelTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const interviews = await ds.query(`SELECT COUNT(*) as c FROM recruitment_interviews`);
          const offers = await ds.query(`SELECT COUNT(*) as c, SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as hired FROM recruitment_offers`);
          const intCount = parseInt(interviews[0]?.c || '0', 10);
          const offCount = parseInt(offers[0]?.c || '0', 10);
          const hiredCount = parseInt(offers[0]?.hired || '0', 10);
          return `Recruitment & ATS Pipeline Overview:\n` +
            `- Scheduled Interviews: ${intCount}\n` +
            `- Offers Extended: ${offCount}\n` +
            `- Hired Candidates: ${hiredCount}\n` +
            `- Offer Acceptance Rate: ${offCount > 0 ? Math.round((hiredCount / offCount) * 100) : 0}%`;
        } catch (err) {
          return `Failed to fetch recruitment funnel: ${err.message}`;
        }
      },
      {
        name: 'get_recruitment_funnel',
        description: 'Get hiring funnel metrics, interview counts, extended offers, and conversion statistics.',
        schema: z.object({}),
      }
    );

    const getRecruitmentAnalyticsTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const rows = await ds.query(`
            SELECT 
              department, 
              COUNT(*) as total_offers,
              AVG(offered_salary) as avg_salary
            FROM recruitment_offers
            GROUP BY department
          `);
          return `Recruitment Department Breakdown:\n` +
            (rows.length ? rows.map((r: any) => `- ${r.department || 'General'}: ${r.total_offers} offers (Avg Salary: $${Math.round(Number(r.avg_salary || 0))})`).join('\n') : 'No active department offers recorded yet.');
        } catch (err) {
          return `Failed to fetch recruitment analytics: ${err.message}`;
        }
      },
      {
        name: 'get_recruitment_analytics',
        description: 'Get department-level recruitment salary averages and talent acquisition velocity.',
        schema: z.object({}),
      }
    );

    // Build the full tool registry (name → tool instance)
    const allTools: Record<string, any> = {
      create_user:           createUserTool,
      update_user:           updateUserTool,
      deactivate_user:       deactivateUserTool,
      submit_leave_request:  submitLeaveRequestTool,
      approve_leave_request: approveLeaveRequestTool,
      reject_leave_request:  rejectLeaveRequestTool,
      cancel_leave_request:  cancelLeaveRequestTool,
      post_announcement:     postAnnouncementTool,
      add_loan:              addLoanTool,
      initiate_payroll_run:  initiatePayrollRunTool,
      create_project:        createProjectTool,
      create_task:           createTaskTool,
      update_task_status:    updateTaskStatusTool,
      create_sprint:         createSprintTool,
      add_project_member:    addProjectMemberTool,
      create_shift:          createShiftTool,
      assign_shift:          assignShiftTool,
      mark_day_off:          markDayOffTool,
      log_overtime:          logOvertimeTool,
      add_holiday:           addHolidayTool,
      get_headcount_analytics:   getHeadcountAnalyticsTool,
      export_bank_transfer_file: exportBankTransferFileTool,
      generate_employee_letter:  generateEmployeeLetterTool,
      get_expiring_documents:    getExpiringDocumentsTool,
      get_onboarding_stats:      getOnboardingStatsTool,
      start_employee_onboarding: startEmployeeOnboardingTool,
      get_my_self_service_summary: getMySelfServiceSummaryTool,
      get_grievance_stats:       getGrievanceStatsTool,
      file_grievance:            fileGrievanceTool,
      get_benefit_plans:         getBenefitPlansTool,
      get_benefits_summary:      getBenefitsSummaryTool,
      get_training_courses:      getTrainingCoursesTool,
      get_training_stats:        getTrainingStatsTool,
      enroll_in_course:          enrollInCourseTool,
      get_review_cycles:         getReviewCyclesTool,
      get_my_reviews_summary:    getMyReviewsSummaryTool,
      get_pms_review_analytics:  getPmsReviewAnalyticsTool,
      get_expense_reports:       getExpenseReportsTool,
      get_my_expenses_summary:   getMyExpensesSummaryTool,
      get_expense_analytics:     getExpenseAnalyticsTool,
      get_assets:                getAssetsTool,
      get_my_assigned_assets:    getMyAssignedAssetsTool,
      get_asset_analytics:       getAssetAnalyticsTool,
      get_active_surveys:        getActiveSurveysTool,
      get_survey_analytics:      getSurveyAnalyticsTool,
      get_import_export_jobs:    getImportExportJobsTool,
      get_import_export_stats:   getImportExportStatsTool,
      get_recruitment_funnel:    getRecruitmentFunnelTool,
      get_recruitment_analytics: getRecruitmentAnalyticsTool,
    };

    // SECURITY: Return ONLY the tools the user is permitted to invoke.
    // The AI agent cannot even see — let alone call — tools the user lacks permission for.
    const permittedTools = Object.entries(allTools)
      .filter(([toolName]) => {
        const required = TOOL_PERMISSION_MAP[toolName] ?? [];
        return hasPermission(required);
      })
      .map(([, toolInstance]) => toolInstance);

    this.logger.log(
      `[AI-ACTION] Tenant: ${tenantSlug}, User: ${currentUserId} — ${permittedTools.length}/${Object.keys(allTools).length} action tools permitted`,
    );

    return permittedTools;
  }
}

