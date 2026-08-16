import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AiActionService {
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

  getActionTools(tenantSlug: string, currentUserId: string) {
    const getConn = () => this.getConnection(tenantSlug);

    // USERS MODULE
    const createUserTool = tool(
      async ({ full_name, email, position, department }) => {
        try {
          const { ds } = await getConn();
          const exists = await ds.query('SELECT id FROM users WHERE email = $1', [email]);
          if (exists.length > 0) return `User with email ${email} already exists.`;
          const id = uuidv4();
          const defaultPassword = await bcrypt.hash('Password123!', 10);
          await ds.query(`
            INSERT INTO users (id, email, password_hash, full_name, position, department, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
          `, [id, email, defaultPassword, full_name, position || null, department || null]);
          return `Successfully created user ${full_name} (${email}). Default password is 'Password123!'.`;
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

    return [
      createUserTool, updateUserTool, deactivateUserTool,
      submitLeaveRequestTool, approveLeaveRequestTool, rejectLeaveRequestTool, cancelLeaveRequestTool,
      postAnnouncementTool,
      addLoanTool, initiatePayrollRunTool,
      createProjectTool, createTaskTool, updateTaskStatusTool, createSprintTool, addProjectMemberTool,
      createShiftTool, assignShiftTool, markDayOffTool,
      logOvertimeTool,
      addHolidayTool,
    ];
  }
}
