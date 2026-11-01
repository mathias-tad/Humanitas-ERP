import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  UpdateProfileSelfDto,
  RequestSensitiveChangeDto,
  ReviewSensitiveChangeDto,
} from './dto/self-service.dto';

@Injectable()
export class SelfServiceService {
  private readonly logger = new Logger(SelfServiceService.name);
  private ensuredTenants = new Set<string>();

  constructor(private readonly databaseService: DatabaseService) {}

  private async getConnection(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    if (!this.ensuredTenants.has(tenantId)) {
      await this.ensureTables(connection);
      this.ensuredTenants.add(tenantId);
    }
    return connection;
  }

  async ensureTables(connection: any) {
    try {
      // Ensure extra user columns if not exist
      await connection.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
      `);

      // Profile sensitive change request table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS profile_change_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          field_name VARCHAR(100) NOT NULL,
          current_value TEXT,
          proposed_value TEXT NOT NULL,
          reason TEXT,
          supporting_doc_url TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          reviewed_by UUID,
          reviewed_at TIMESTAMP,
          reviewer_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e) {
      this.logger.error('Failed to ensure self-service tables', e);
    }
  }

  async getDashboard(tenantId: string, userId: string) {
    const connection = await this.getConnection(tenantId);

    // 1. User basic info
    const users = await connection.query(
      `SELECT id, COALESCE(full_name, '') as full_name, COALESCE(full_name, '') as first_name, '' as last_name, email, position, department, hire_date
       FROM users WHERE id::text = $1::text LIMIT 1`,
      [userId],
    );
    if (!users || users.length === 0) {
      throw new NotFoundException('Employee not found');
    }
    const user = users[0];

    // 2. Leave balances
    let leaveBalances = [];
    try {
      leaveBalances = await connection.query(
        `SELECT leave_type, allocated_days, used_days, remaining_days
         FROM leave_balances WHERE user_id::text = $1::text`,
        [userId],
      );
    } catch (e) {
      leaveBalances = [];
    }

    // 3. Pending requests counts
    let pendingLeaveCount = 0;
    try {
      const lr = await connection.query(
        `SELECT COUNT(*) AS count FROM leave_requests WHERE user_id::text = $1::text AND status = 'pending'`,
        [userId],
      );
      pendingLeaveCount = parseInt(lr[0]?.count || '0', 10);
    } catch (e) {
      pendingLeaveCount = 0;
    }

    let pendingChangesCount = 0;
    try {
      const pc = await connection.query(
        `SELECT COUNT(*) AS count FROM profile_change_requests WHERE user_id::text = $1::text AND status = 'pending'`,
        [userId],
      );
      pendingChangesCount = parseInt(pc[0]?.count || '0', 10);
    } catch (e) {
      pendingChangesCount = 0;
    }

    // 4. Current month attendance summary
    let attendanceStats = {
      present: 0,
      late: 0,
      absent: 0,
      streak: 0,
    };
    try {
      const att = await connection.query(
        `SELECT status, COUNT(*) AS count
         FROM attendance_records
         WHERE user_id::text = $1::text 
           AND date >= date_trunc('month', CURRENT_DATE)
         GROUP BY status`,
        [userId],
      );
      for (const row of att) {
        if (row.status === 'present') attendanceStats.present = parseInt(row.count, 10);
        else if (row.status === 'late') attendanceStats.late = parseInt(row.count, 10);
        else if (row.status === 'absent') attendanceStats.absent = parseInt(row.count, 10);
      }

      // Calculate recent streak
      const recent = await connection.query(
        `SELECT status FROM attendance_records
         WHERE user_id::text = $1::text AND date <= CURRENT_DATE
         ORDER BY date DESC LIMIT 14`,
        [userId],
      );
      let streak = 0;
      for (const r of recent) {
        if (r.status === 'present' || r.status === 'late') streak++;
        else break;
      }
      attendanceStats.streak = streak;
    } catch (e) {
      // defaults
    }

    // 5. Latest payslip preview
    let latestPayslip = null;
    try {
      const ps = await connection.query(
        `SELECT pi.net_pay, pi.gross_pay, pi.total_deductions, pr.month, pr.year, pr.status
         FROM payroll_items pi
         JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
         WHERE pi.user_id::text = $1::text
         ORDER BY pr.year DESC, pr.month DESC LIMIT 1`,
        [userId],
      );
      if (ps && ps.length > 0) {
        latestPayslip = ps[0];
      }
    } catch (e) {
      latestPayslip = null;
    }

    return {
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        position: user.position,
        department: user.department,
        hire_date: user.hire_date,
      },
      leave_balances: leaveBalances,
      pending_requests: {
        leave: pendingLeaveCount,
        profile_changes: pendingChangesCount,
      },
      attendance_summary: attendanceStats,
      latest_payslip: latestPayslip,
    };
  }

  async getAttendanceHeatmap(tenantId: string, userId: string, daysBack = 90) {
    const connection = await this.getConnection(tenantId);
    try {
      const records = await connection.query(
        `SELECT date, status, actual_in, actual_out
         FROM attendance_records
         WHERE user_id::text = $1::text 
           AND date >= (CURRENT_DATE - INTERVAL '${daysBack} days')
         ORDER BY date ASC`,
        [userId],
      );
      return records;
    } catch (e) {
      return [];
    }
  }

  async getPayslips(tenantId: string, userId: string) {
    const connection = await this.getConnection(tenantId);
    try {
      const items = await connection.query(
        `SELECT pi.id, pi.net_pay, pi.gross_pay, pi.total_deductions, 
                pr.month, pr.year, pr.status
         FROM payroll_items pi
         JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
         WHERE pi.user_id::text = $1::text
         ORDER BY pr.year DESC, pr.month DESC`,
        [userId],
      );

      // Calculate YTD totals for current year
      const currentYear = new Date().getFullYear();
      let ytdGross = 0;
      let ytdNet = 0;
      let ytdDeductions = 0;

      for (const item of items) {
        if (item.year === currentYear) {
          ytdGross += parseFloat(item.gross_pay || '0');
          ytdNet += parseFloat(item.net_pay || '0');
          ytdDeductions += parseFloat(item.total_deductions || '0');
        }
      }

      return {
        payslips: items,
        ytd_summary: {
          year: currentYear,
          ytd_gross: ytdGross,
          ytd_net: ytdNet,
          ytd_deductions: ytdDeductions,
        },
      };
    } catch (e) {
      return {
        payslips: [],
        ytd_summary: {
          year: new Date().getFullYear(),
          ytd_gross: 0,
          ytd_net: 0,
          ytd_deductions: 0,
        },
      };
    }
  }

  async getProfile(tenantId: string, userId: string) {
    const connection = await this.getConnection(tenantId);
    const users = await connection.query(
      `SELECT id, COALESCE(full_name, '') as full_name, COALESCE(full_name, '') as first_name, '' as last_name, email, phone, address, city, state, country, 
              postal_code, gender, marital_status, nationality, national_id,
              emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
              hire_date, position, department, tin, account_number, bank_name
       FROM users WHERE id::text = $1::text LIMIT 1`,
      [userId],
    );
    if (!users || users.length === 0) {
      throw new NotFoundException('Employee not found');
    }

    const pendingRequests = await connection.query(
      `SELECT id, field_name, current_value, proposed_value, reason, status, created_at
       FROM profile_change_requests
       WHERE user_id::text = $1::text AND status = 'pending'
       ORDER BY created_at DESC`,
      [userId],
    );

    return {
      profile: users[0],
      pending_change_requests: pendingRequests,
    };
  }

  async updateProfile(tenantId: string, userId: string, dto: UpdateProfileSelfDto) {
    const connection = await this.getConnection(tenantId);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowed = [
      'phone',
      'address',
      'city',
      'state',
      'country',
      'postal_code',
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relationship',
    ];

    for (const key of allowed) {
      if ((dto as any)[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push((dto as any)[key]);
        idx++;
      }
    }

    if (fields.length === 0) {
      throw new BadRequestException('No fields provided to update');
    }

    values.push(userId);
    await connection.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
      values,
    );

    return { message: 'Profile updated successfully' };
  }

  async requestSensitiveChange(
    tenantId: string,
    userId: string,
    dto: RequestSensitiveChangeDto,
  ) {
    const connection = await this.getConnection(tenantId);

    // Get current value from users
    const users = await connection.query(
      `SELECT ${dto.field_name} AS val FROM users WHERE id::text = $1::text LIMIT 1`,
      [userId],
    );
    const currentVal = users?.[0]?.val || null;

    const result = await connection.query(
      `INSERT INTO profile_change_requests 
       (user_id, field_name, current_value, proposed_value, reason, supporting_doc_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        userId,
        dto.field_name,
        currentVal,
        dto.proposed_value,
        dto.reason || null,
        dto.supporting_doc_url || null,
      ],
    );

    return result[0];
  }

  async getChangeRequests(
    tenantId: string,
    userId: string,
    isAdmin: boolean,
    status = 'pending',
  ) {
    const connection = await this.getConnection(tenantId);

    if (isAdmin) {
      return await connection.query(
        `SELECT pcr.*, COALESCE(u.full_name, '') as employee_name, COALESCE(u.full_name, '') as first_name, '' as last_name, u.email, u.department, u.position
         FROM profile_change_requests pcr
         JOIN users u ON pcr.user_id::text = u.id::text
         WHERE pcr.status = $1
         ORDER BY pcr.created_at ASC`,
        [status],
      );
    } else {
      return await connection.query(
        `SELECT * FROM profile_change_requests
         WHERE user_id::text = $1::text
         ORDER BY created_at DESC`,
        [userId],
      );
    }
  }

  async reviewChangeRequest(
    tenantId: string,
    requestId: string,
    reviewerId: string,
    dto: ReviewSensitiveChangeDto,
  ) {
    const connection = await this.getConnection(tenantId);

    const reqs = await connection.query(
      `SELECT * FROM profile_change_requests WHERE id = $1 LIMIT 1`,
      [requestId],
    );
    if (!reqs || reqs.length === 0) {
      throw new NotFoundException('Change request not found');
    }
    const changeReq = reqs[0];

    if (changeReq.status !== 'pending') {
      throw new BadRequestException('This request has already been reviewed');
    }

    // Update the request record
    await connection.query(
      `UPDATE profile_change_requests
       SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, reviewer_notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [dto.status, reviewerId, dto.reviewer_notes || null, requestId],
    );

    // If approved, apply the proposed change directly to the users table
    if (dto.status === 'approved') {
      const allowedCols = ['account_number', 'bank_name', 'tin', 'national_id'];
      if (allowedCols.includes(changeReq.field_name)) {
        await connection.query(
          `UPDATE users SET ${changeReq.field_name} = $1 WHERE id = $2`,
          [changeReq.proposed_value, changeReq.user_id],
        );
      }
    }

    return {
      message: `Change request has been ${dto.status}`,
      status: dto.status,
    };
  }

  async getAnalytics(tenantId: string, userId: string) {
    const connection = await this.getConnection(tenantId);

    // 1. Punctuality rate
    let punctuality = 100;
    try {
      const totalScheduled = await connection.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'present') AS on_time,
                COUNT(*) FILTER (WHERE status = 'late') AS late
         FROM attendance_records
         WHERE user_id::text = $1::text AND date >= (CURRENT_DATE - INTERVAL '180 days')`,
        [userId],
      );
      const total = parseInt(totalScheduled[0]?.total || '0', 10);
      const onTime = parseInt(totalScheduled[0]?.on_time || '0', 10);
      if (total > 0) {
        punctuality = Math.round((onTime / total) * 100);
      }
    } catch (e) {}

    // 2. Net pay trend over past 6 months
    let payTrend: any[] = [];
    try {
      payTrend = await connection.query(
        `SELECT pr.month, pr.year, pi.net_pay, pi.gross_pay
         FROM payroll_items pi
         JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
         WHERE pi.user_id::text = $1::text
         ORDER BY pr.year DESC, pr.month DESC LIMIT 6`,
        [userId],
      );
      payTrend = payTrend.reverse();
    } catch (e) {}

    return {
      punctuality_score: punctuality,
      pay_trend: payTrend,
    };
  }
}
