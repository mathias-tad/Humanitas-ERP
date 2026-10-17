import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AttendanceGateway } from './attendance.gateway';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SettingsService } from '../settings/settings.service';
import { HolidaysService } from '../holidays/holidays.service';
import { AbsencePenaltyService } from '../payroll/absence-penalty.service';
import { LateMinuteService } from '../payroll/late-minute.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => AttendanceGateway))
    private readonly attendanceGateway: AttendanceGateway,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
    private readonly settingsService: SettingsService,
    private readonly holidaysService: HolidaysService,
    private readonly absencePenaltyService: AbsencePenaltyService,
    private readonly lateMinuteService: LateMinuteService,
  ) { }

  // Get company timezone from general settings
  private async getCompanyTimezone(connection: any): Promise<string> {
    try {
      const result = await connection.query(
        `SELECT data FROM settings WHERE category = 'general'`,
      );
      if (result && result.length > 0 && result[0].data) {
        const settings =
          typeof result[0].data === 'string'
            ? JSON.parse(result[0].data)
            : result[0].data;
        return settings.timezone || 'UTC';
      }
    } catch (e) {
      console.log(
        '[Attendance] Could not get timezone from settings, using UTC',
      );
    }
    return 'UTC';
  }

  // Get HR settings
  private async getHRSettings(connection: any): Promise<any> {
    try {
      const result = await connection.query(
        `SELECT data FROM settings WHERE category = 'hr'`,
      );
      if (result && result.length > 0 && result[0].data) {
        return typeof result[0].data === 'string'
          ? JSON.parse(result[0].data)
          : result[0].data;
      }
    } catch (e) {
      console.log('[Attendance] Could not get HR settings');
    }
    return {};
  }

  // Get current date/time in company timezone
  private getCurrentTimeInTimezone(timezone: string): {
    now: Date;
    today: string;
    currentMinutes: number;
  } {
    const now = new Date();

    // Get time components in the specified timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(now);

    const dateParts: Record<string, string> = {};
    for (const part of parts) {
      dateParts[part.type] = part.value;
    }

    const year = dateParts.year;
    const month = dateParts.month;
    const day = dateParts.day;
    const hour = parseInt(dateParts.hour, 10);
    const minute = parseInt(dateParts.minute, 10);

    const today = `${year}-${month}-${day}`;
    const currentMinutes = hour * 60 + minute;

    // Create a date object representing the local time in the timezone
    const localNow = new Date(
      `${today}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`,
    );

    return { now: localNow, today, currentMinutes };
  }

  // Get day of week in company timezone
  private getDayOfWeekInTimezone(timezone: string): {
    dayIndex: number;
    dayAbbrev: string;
  } {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      weekday: 'short',
    };
    const dayAbbrev = new Intl.DateTimeFormat('en-US', options).format(now);

    const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayIndex = dayAbbreviations.indexOf(dayAbbrev);

    return { dayIndex, dayAbbrev };
  }

  private async ensureAttendanceTables(connection: any) {
    // Shifts table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        grace_minutes INTEGER DEFAULT 15,
        wait_for_absent_minutes INTEGER DEFAULT NULL,
        color VARCHAR(50) DEFAULT 'bg-blue-500',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Schedule patterns table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schedule_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        rotation_type VARCHAR(20) DEFAULT 'fixed',
        auto_rotate BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Rotation weeks table (links patterns to shifts)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rotation_weeks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pattern_id UUID REFERENCES schedule_patterns(id) ON DELETE CASCADE,
        week_number INTEGER NOT NULL,
        shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
        days_off TEXT[] DEFAULT ARRAY['Sat', 'Sun'],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User shift assignments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS shift_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        pattern_id UUID REFERENCES schedule_patterns(id) ON DELETE CASCADE,
        current_week_in_rotation INTEGER DEFAULT 1,
        effective_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);

    // Attendance records table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        date DATE NOT NULL,
        shift_id UUID REFERENCES shifts(id),
        scheduled_in TIME,
        scheduled_out TIME,
        actual_in TIMESTAMP,
        actual_out TIMESTAMP,
        status VARCHAR(20) DEFAULT 'Pending',
        work_hours INTERVAL,
        remarks TEXT,
        is_corrected BOOLEAN DEFAULT false,
        corrected_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Schema Patch: Add is_corrected and corrected_by if missing
    await connection.query(`
      ALTER TABLE attendance_records 
      ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS ot_duration_normal INTERVAL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS ot_duration_night INTERVAL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS ot_duration_holiday INTERVAL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS ot_duration_dayoff INTERVAL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS forced_clock_out_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS forced_at TIMESTAMP;
    `);

    // Overtime Entires for Approval
    await connection.query(`
      CREATE TABLE IF NOT EXISTS overtime_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        date DATE NOT NULL,
        attendance_id UUID REFERENCES attendance_records(id),
        normal_ot_hours NUMERIC(5,2) DEFAULT 0,
        night_ot_hours NUMERIC(5,2) DEFAULT 0,
        holiday_ot_hours NUMERIC(5,2) DEFAULT 0,
        dayoff_ot_hours NUMERIC(5,2) DEFAULT 0,
        total_amount NUMERIC(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Pending', -- Pending, Approved, Rejected
        is_manual BOOLEAN DEFAULT false,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);

    // Schedules table (Manual Overrides / Daily Assignments) - Moved/Shared from SchedulingService
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        shift_id UUID REFERENCES shifts(id),
        date DATE NOT NULL,
        is_day_off BOOLEAN DEFAULT false,
        is_override BOOLEAN DEFAULT false,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id),
        UNIQUE(user_id, date)
      )
    `);

    // Schema Patch: Add updated_by if missing (for existing tables)
    await connection.query(`
      ALTER TABLE schedules 
      ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
    `);

    // User device binding table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        device_name VARCHAR(255),
        device_type VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        approved_by UUID,
        approved_at TIMESTAMP,
        UNIQUE(user_id, device_id)
      )
    `);

    // QR codes table for rotating codes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS attendance_qr_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(100) NOT NULL UNIQUE,
        type VARCHAR(20) DEFAULT 'clock_in',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Allowed networks table for attendance
    await connection.query(`
      CREATE TABLE IF NOT EXISTS allowed_networks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        ip_address INET,
        subnet_mask VARCHAR(15),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure Lateness Summary Table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS late_minutes_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        week_start_date DATE NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL,
        
        late_minutes INTEGER DEFAULT 0,
        late_penalty_amount DECIMAL(10,2) DEFAULT 0,
        
        weekly_late_minutes INTEGER DEFAULT 0,
        weekly_late_penalty DECIMAL(10,2) DEFAULT 0,
        
        monthly_late_minutes INTEGER DEFAULT 0,
        monthly_late_penalty DECIMAL(10,2) DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id, date)
      )
    `);


    // Add wait_for_absent_minutes column if it doesn't exist (Migration)
    try {
      await connection.query(`
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS wait_for_absent_minutes INTEGER DEFAULT NULL;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS grace_minutes INTEGER DEFAULT 15;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
    } catch (e) {
      console.log('Columns might already exist or error adding them');
    }
  }

  // ============ SHIFTS ============
  async getShifts(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(`
    SELECT * FROM shifts WHERE is_active = true ORDER BY name
      `);
    return result || [];
  }

  async createShift(tenantId: string, data: any, userId?: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(
      `
      INSERT INTO shifts(name, start_time, end_time, grace_minutes, color, wait_for_absent_minutes)
    VALUES($1, $2, $3, $4, $5, $6)
    RETURNING *
      `,
      [
        data.name,
        data.start_time,
        data.end_time,
        data.grace_minutes || 15,
        data.color || 'bg-blue-500',
        data.wait_for_absent_minutes || null,
      ],
    );

    const shift = result[0];
    if (userId) {
      await this.logToTenantAudit(tenantId, userId, 'CREATE_SHIFT', shift.id, data);
    }

    return shift;
  }

  async updateShift(tenantId: string, shiftId: string, data: any, userId?: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
      UPDATE shifts SET
    name = COALESCE($1, name),
      start_time = COALESCE($2, start_time),
      end_time = COALESCE($3, end_time),
      grace_minutes = COALESCE($4, grace_minutes),
      color = COALESCE($5, color),
      wait_for_absent_minutes = $6,
      updated_at = NOW()
      WHERE id = $7
    RETURNING *
      `,
      [
        data.name,
        data.start_time,
        data.end_time,
        data.grace_minutes,
        data.color,
        data.wait_for_absent_minutes,
        shiftId,
      ],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Shift not found');
    }

    if (userId) {
      await this.logToTenantAudit(tenantId, userId, 'UPDATE_SHIFT', shiftId, data);
    }
    return result[0];
  }

  async deleteShift(tenantId: string, shiftId: string, userId?: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(
      `UPDATE shifts SET is_active = false WHERE id = $1`,
      [shiftId],
    );

    if (userId) {
      await this.logToTenantAudit(tenantId, userId, 'DELETE_SHIFT', shiftId, { deleted_at: new Date() });
    }

    return { message: 'Shift deleted successfully' };
  }

  // ============ SCHEDULE PATTERNS ============
  async getSchedulePatterns(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const patterns =
      (await connection.query(`
    SELECT * FROM schedule_patterns WHERE is_active = true ORDER BY name
      `)) || [];

    // Get rotation weeks for each pattern
    for (const pattern of patterns) {
      const weeks = await connection.query(
        `
        SELECT rw.*, s.name as shift_name, s.start_time, s.end_time, s.color
        FROM rotation_weeks rw
        LEFT JOIN shifts s ON rw.shift_id = s.id
        WHERE rw.pattern_id = $1
        ORDER BY rw.week_number
      `,
        [pattern.id],
      );
      pattern.rotation_weeks = weeks || [];
    }

    return patterns;
  }

  async createSchedulePattern(tenantId: string, data: any, userId?: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Create pattern
    const patternResult = await connection.query(
      `
      INSERT INTO schedule_patterns(name, rotation_type, auto_rotate)
    VALUES($1, $2, $3)
    RETURNING *
      `,
      [data.name, data.rotation_type || 'fixed', data.auto_rotate || false],
    );

    const pattern = patternResult[0];

    // Create rotation weeks
    if (data.rotation_weeks && data.rotation_weeks.length > 0) {
      for (const week of data.rotation_weeks) {
        await connection.query(
          `
          INSERT INTO rotation_weeks(pattern_id, week_number, shift_id, days_off)
    VALUES($1, $2, $3, $4)
      `,
          [
            pattern.id,
            week.week_number,
            week.shift_id,
            week.days_off || ['Sat', 'Sun'],
          ],
        );
      }
    }

    if (userId) {
      await this.logToTenantAudit(tenantId, userId, 'CREATE_PATTERN', pattern.id, data);
    }

    return this.getSchedulePatternById(tenantId, pattern.id);
  }

  async getSchedulePatternById(tenantId: string, patternId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const patternResult = await connection.query(
      `
    SELECT * FROM schedule_patterns WHERE id = $1
      `,
      [patternId],
    );

    if (!patternResult || patternResult.length === 0) {
      throw new NotFoundException('Schedule pattern not found');
    }

    const pattern = patternResult[0];
    const weeks = await connection.query(
      `
      SELECT rw.*, s.name as shift_name, s.start_time, s.end_time, s.color
      FROM rotation_weeks rw
      LEFT JOIN shifts s ON rw.shift_id = s.id
      WHERE rw.pattern_id = $1
      ORDER BY rw.week_number
      `,
      [patternId],
    );

    pattern.rotation_weeks = weeks || [];
    return pattern;
  }

  async updateSchedulePattern(tenantId: string, patternId: string, data: any, userId?: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(
      `
      UPDATE schedule_patterns SET
    name = COALESCE($1, name),
      rotation_type = COALESCE($2, rotation_type),
      auto_rotate = COALESCE($3, auto_rotate),
      updated_at = NOW()
      WHERE id = $4
      `,
      [data.name, data.rotation_type, data.auto_rotate, patternId],
    );

    // Update rotation weeks if provided
    if (data.rotation_weeks) {
      await connection.query(
        `DELETE FROM rotation_weeks WHERE pattern_id = $1`,
        [patternId],
      );
      for (const week of data.rotation_weeks) {
        await connection.query(
          `
          INSERT INTO rotation_weeks(pattern_id, week_number, shift_id, days_off)
    VALUES($1, $2, $3, $4)
        `,
          [
            patternId,
            week.week_number,
            week.shift_id,
            week.days_off || ['Sat', 'Sun'],
          ],
        );
      }
    }

    if (userId) {
      await this.logToTenantAudit(tenantId, userId, 'UPDATE_PATTERN', patternId, data);
    }
    return this.getSchedulePatternById(tenantId, patternId);
  }

  async deleteSchedulePattern(tenantId: string, patternId: string, userId?: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(
      `UPDATE schedule_patterns SET is_active = false WHERE id = $1`,
      [patternId],
    );

    if (userId) {
      await this.logToTenantAudit(tenantId, userId, 'DELETE_PATTERN', patternId, { deleted_at: new Date() });
    }

    return { message: 'Schedule pattern deleted successfully' };
  }


  // ============ SHIFT ASSIGNMENTS ============
  async getShiftAssignments(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(`
      SELECT sa.*,
      u.full_name, u.email, u.department, u.position, u.avatar_url,
      sp.name as pattern_name, sp.rotation_type, sp.auto_rotate
      FROM shift_assignments sa
      JOIN users u ON sa.user_id = u.id
      LEFT JOIN schedule_patterns sp ON sa.pattern_id = sp.id
      WHERE u.is_active = true
      ORDER BY u.full_name
      `);

    return result || [];
  }

  async assignShift(tenantId: string, data: any, userId?: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(
      `
      INSERT INTO shift_assignments(user_id, pattern_id, current_week_in_rotation, effective_date)
    VALUES($1, $2, $3, $4)
      ON CONFLICT(user_id) DO UPDATE SET
    pattern_id = $2,
      current_week_in_rotation = $3,
      effective_date = $4,
      updated_at = NOW()
    RETURNING *
      `,
      [
        data.user_id,
        data.pattern_id,
        data.current_week_in_rotation || 1,
        data.effective_date || new Date(),
      ],
    );

    const assignment = result[0];
    if (userId) {
      await this.logToTenantAudit(
        tenantId,
        userId,
        'ASSIGN_PATTERN',
        assignment.id,
        { ...data, target_user: data.user_id }
      );

      // Get pattern name and admin name for notification
      try {
        const patternResult = await connection.query(
          `SELECT name FROM schedule_patterns WHERE id = $1`,
          [data.pattern_id]
        );
        const adminResult = await connection.query(
          `SELECT full_name FROM users WHERE id = $1`,
          [userId]
        );

        const patternName = patternResult[0]?.name || 'a new shift pattern';
        const adminName = adminResult[0]?.full_name || 'An administrator';

        // Create notification for the assigned user
        const notification = await this.notificationsService.createNotification(
          tenantId,
          data.user_id,
          {
            type: 'shift_assignment',
            referenceId: assignment.id,
            title: 'Shift Pattern Assigned',
            message: `${adminName} has assigned you to "${patternName}" shift pattern.`
          }
        );

        // Push real-time notification
        this.notificationsGateway.pushToUser(tenantId, data.user_id, notification);
      } catch (notifError) {
        console.error('[AttendanceService] Failed to send shift assignment notification:', notifError);
      }
    }

    return assignment;
  }

  async removeAssignment(tenantId: string, targetUserId: string, userId?: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(`DELETE FROM shift_assignments WHERE user_id = $1`, [
      targetUserId,
    ]);

    if (userId) {
      await this.logToTenantAudit(tenantId, userId, 'REMOVE_ASSIGNMENT', targetUserId, { target_user: targetUserId });
    }

    return { message: 'Assignment removed successfully' };
  }

  // ============ ROSTER / SCHEDULE MANAGEMENT (Moved/Shared from SchedulingService due to 404s) ============

  // Assign/Override specific day
  async assignSchedule(tenantId: string, data: any, userId?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Fetch previous state for Audit & Target User Name
    // IMPORTANT: Use date range to handle timezone offset (DB stores dates at 21:00 UTC for UTC+3 midnight)
    const existingResult = await connection.query(
      `
      SELECT s.*, sh.name as shift_name, u.full_name as target_user_name
      FROM schedules s 
      LEFT JOIN shifts sh ON s.shift_id = sh.id 
      RIGHT JOIN users u ON u.id = $1
    WHERE(s.user_id = $1 AND s.date >= ($2:: date - interval '1 day') AND s.date < ($2:: date + interval '1 day'))
    OR(s.user_id IS NULL AND u.id = $1)
      LIMIT 1
      `,
      [data.user_id, data.date],
    );
    // Note: RIGHT JOIN users ensures we get user name even if no schedule exists
    const previous = existingResult.find((r: any) => r.id); // Find actual schedule row if exists
    const targetUserName = existingResult[0]?.target_user_name || 'Unknown User';

    // DEBUG: Log previous state
    console.log('[assignSchedule] Previous state:', previous ? { id: previous.id, shift_id: previous.shift_id, shift_name: previous.shift_name, is_day_off: previous.is_day_off } : 'No previous');

    // Determine change description with actual shift names
    const oldShiftName = previous?.shift_name || null;
    const formatShiftDesc = (shiftName: string | null, isOff: boolean) => {
      if (isOff) return 'Day Off';
      if (shiftName) return shiftName;
      return 'Default Pattern';
    };
    const oldVal = previous ? formatShiftDesc(oldShiftName, previous.is_day_off) : 'Default Pattern';

    // We need to get the new shift name - fetch it if shift_id is provided
    let newShiftName = 'Unknown';
    if (data.shift_id) {
      const shiftResult = await connection.query(`SELECT name FROM shifts WHERE id = $1`, [data.shift_id]);
      if (shiftResult[0]) newShiftName = shiftResult[0].name;
    }
    const newVal = data.is_day_off ? 'Day Off' : (data.shift_id ? newShiftName : 'None');
    const changeDesc = `Changed from ${oldVal} to ${newVal} `;

    // Perform Upsert with updated_by
    const result = await connection.query(
      `
      INSERT INTO schedules(user_id, shift_id, date, is_day_off, is_override, note, updated_by)
    VALUES($1, $2, $3, $4, true, $5, $6)
      ON CONFLICT(user_id, date) DO UPDATE SET
    shift_id = $2,
      is_day_off = $4,
      is_override = true,
      note = $5,
      updated_by = $6,
      updated_at = NOW()
    RETURNING *
      `,
      [
        data.user_id,
        data.shift_id || null, // Ensure explicit null for DB
        data.date,
        data.is_day_off,
        data.note || '',
        userId || null
      ],
    );

    // Audit Log (Detailed)
    if (userId) {
      await this.logToTenantAudit(
        tenantId,
        userId,
        'ASSIGN_SCHEDULE',
        result[0].id,
        {
          ...data,
          target_user: data.user_id,
          target_user_name: targetUserName,
          previous_state: previous,
          change_description: changeDesc
        }
      );

      // Create notification for schedule update (only if there's an actual change)
      if (oldVal !== newVal) {
        try {
          const adminResult = await connection.query(
            `SELECT full_name FROM users WHERE id = $1`,
            [userId]
          );
          const adminName = adminResult[0]?.full_name || 'An administrator';

          const notification = await this.notificationsService.createNotification(
            tenantId,
            data.user_id,
            {
              type: 'schedule_update',
              referenceId: result[0].id,
              title: 'Schedule Updated',
              message: `${adminName} updated your schedule for ${data.date}.${changeDesc}.`
            }
          );

          this.notificationsGateway.pushToUser(tenantId, data.user_id, notification);
        } catch (notifError) {
          console.error('[AttendanceService] Failed to send schedule update notification:', notifError);
        }
      }
    }

    return result[0];
  }

  // Calculate User Schedule (Pattern + Overrides) for Roster View
  async getUserSchedule(
    tenantId: string,
    userId: string,
    startDate: string,
    endDate: string,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Normalize inputs to UTC Midnight
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T00:00:00.000Z');

    // 1. Get Manual Overrides (Schedules)
    const schedules = await connection.query(
      `
      SELECT s.*, sh.name as shift_name, sh.start_time, sh.end_time, sh.color,
      u.full_name as updated_by_name
      FROM schedules s
      LEFT JOIN shifts sh ON s.shift_id = sh.id
      LEFT JOIN users u ON s.updated_by = u.id
      WHERE s.user_id = $1 AND s.date BETWEEN $2 AND $3
      `,
      [userId, startDate, endDate],
    );

    // DEBUG: Log raw schedules from DB
    console.log('[getUserSchedule] User:', userId, 'Range:', startDate, '-', endDate, 'Raw Schedules:', schedules.length, schedules.map((s: any) => ({ id: s.id, date: s.date, shift_id: s.shift_id, is_override: s.is_override })));

    // 2. Get User Assignment (Pattern)
    const userAssignmentResult = await connection.query(
      `
        SELECT sa.*, sp.id as pattern_id, sp.rotation_type
        FROM shift_assignments sa
        JOIN schedule_patterns sp ON sa.pattern_id = sp.id
        WHERE sa.user_id = $1
      `,
      [userId],
    );
    const userAssignment = userAssignmentResult[0];

    // 3. Get Pattern Weeks (if assigned)
    let rotationWeeks: any[] = [];
    if (userAssignment && userAssignment.pattern_id) {
      rotationWeeks = await connection.query(
        `
            SELECT rw.*, rw.week_number
            FROM rotation_weeks rw
            WHERE rw.pattern_id = $1
            ORDER BY rw.week_number
            `,
        [userAssignment.pattern_id]
      );
    }

    // 4. Get All Shifts (for pattern lookup - cache optimization)
    const allShifts = await connection.query(`SELECT * FROM shifts`);
    const shiftsMap = new Map<string, any>(
      allShifts.map((s: any) => [s.id, s]),
    );

    const result: any[] = [];

    // Effective date normalization
    const effectiveDateStr = userAssignment
      ? new Date(userAssignment.effective_date).toISOString().split('T')[0]
      : '1970-01-01';
    const effectiveDate = new Date(effectiveDateStr + 'T00:00:00.000Z');

    // Loop through dates
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];

      // A. Check for Override
      // IMPORTANT: PostgreSQL DATE columns can return dates shifted by timezone.
      // For UTC+3, midnight local time is 21:00 UTC the previous day.
      // We use the date string stored in DB (which should be the correct local date).
      const override = schedules.find((s: any) => {
        // PostgreSQL DATE type: when stringified, the date object shows UTC time.
        // We need to extract the intended local date.
        // For a date stored as "2025-12-15" in a DATE column, PostgreSQL returns 
        // it at midnight in the DB timezone. The trick is that the DATE column
        // stores just the date, so we should use the date as-is without time parsing.
        // The simplest fix: treat the date as a string directly from DB if possible,
        // or add the timezone offset hours to get local time equivalent.
        const dbDate = new Date(s.date);
        // Add 3 hours to shift from UTC to local (UTC+3) then extract date
        const localDate = new Date(dbDate.getTime() + (3 * 60 * 60 * 1000));
        const sDate = localDate.toISOString().split('T')[0];
        return sDate === dateStr;
      });

      if (override) {
        // Safe destructuring to ensure date is not overwritten by DB date object
        const { date: _dbDate, ...overrideDetails } = override;
        result.push({
          user_id: userId,
          date: dateStr,
          type: 'Manual',
          ...overrideDetails,
          shift: override.shift_id
            ? {
              id: override.shift_id,
              name: override.shift_name,
              start_time: override.start_time,
              end_time: override.end_time,
              color: override.color,
            }
            : null,
        });
      } else if (userAssignment && rotationWeeks.length > 0) {
        // B. Calculate Pattern (Allow retroactive)

        // Calculate week number same as getUserAttendanceRecords
        const diffTime = current.getTime() - effectiveDate.getTime();
        const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
        const totalWeeks = rotationWeeks.length || 1;

        // Handle simple rotation logic
        const startWeek = userAssignment.current_week_in_rotation || 1;
        const currentWeekIndex = (startWeek - 1 + diffWeeks) % totalWeeks;
        // Ensure positive index
        const safeIndex = currentWeekIndex < 0 ? currentWeekIndex + totalWeeks : currentWeekIndex;
        const weekNumber = safeIndex + 1;

        const rotationWeek = rotationWeeks.find((rw: any) => rw.week_number === weekNumber);

        if (rotationWeek) {
          // Check if today matches days_off
          const dayOfWeek = current.getUTCDay(); // 0 = Sun
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayName = days[dayOfWeek];

          const daysOff = rotationWeek.days_off || [];
          if (daysOff.includes(dayName)) {
            result.push({
              user_id: userId,
              date: dateStr,
              type: 'Pattern',
              is_day_off: true,
              shift: null
            });
          } else {
            const shiftDetails = rotationWeek.shift_id ? shiftsMap.get(rotationWeek.shift_id) : null;
            if (shiftDetails) {
              result.push({
                user_id: userId,
                date: dateStr,
                type: 'Pattern',
                is_day_off: false,
                shift_id: rotationWeek.shift_id,
                shift: {
                  id: shiftDetails.id,
                  name: shiftDetails.name,
                  start_time: shiftDetails.start_time,
                  end_time: shiftDetails.end_time,
                  color: shiftDetails.color
                }
              });
            } else {
              result.push({ user_id: userId, date: dateStr, type: 'PatternShiftMissing', is_day_off: true });
            }
          }
        } else {
          result.push({ user_id: userId, date: dateStr, type: 'PatternValuesMissing', is_day_off: true });
        }
      } else {
        result.push({ user_id: userId, date: dateStr, type: 'Empty', is_day_off: true });
      }

      // Increment date by 1 day
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  // ============ SCHEDULING AUDIT LOGS ============
  async getSchedulingAuditLogs(
    tenantId: string,
    query: { page?: number; limit?: number; search?: string } = {},
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAuditTable(connection);

    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;
    const search = query.search ? `% ${query.search}% ` : null;

    let whereClause = `
      WHERE a.action IN(
        'CREATE_SHIFT', 'UPDATE_SHIFT', 'DELETE_SHIFT',
        'CREATE_PATTERN', 'UPDATE_PATTERN', 'DELETE_PATTERN',
        'ASSIGN_SCHEDULE', 'ASSIGN_PATTERN', 'REMOVE_ASSIGNMENT'
      )
    `;
    const params: any[] = [];

    if (search) {
      whereClause += ` AND(
        u.full_name ILIKE $1 OR 
        u.email ILIKE $1 OR
        a.action ILIKE $1 OR
        a.details:: text ILIKE $1
      )`;
      params.push(search);
    }

    const countRes = await connection.query(
      `SELECT COUNT(*) as total 
       FROM audit_logs a 
       LEFT JOIN users u ON a.user_id = u.id 
       ${whereClause} `,
      params,
    );
    const total = parseInt(countRes[0].total, 10);

    const logs = await connection.query(
      `
            SELECT a.*, u.full_name as user_name, u.email as user_email 
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ${whereClause}
            ORDER BY a.created_at DESC 
            LIMIT ${limit} OFFSET ${offset}
    `,
      params,
    );
    console.error(`[Audit] Retrieved ${logs.length} logs for tenant ${tenantId}(Page ${page})`);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Helper to ensure audit table exists
  private async ensureAuditTable(connection: any) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      action VARCHAR(100),
      target_id VARCHAR(255),
      details JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `);
  }

  // ============ ATTENDANCE CORRECTION ============
  async correctAttendance(
    tenantId: string,
    recordId: string,
    updates: {
      status?: string;
      clock_in?: string;
      clock_out?: string;
      reason?: string;
    },
    correctedBy: string,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // 1. Get the existing record with user info
    const existingResult = await connection.query(
      `SELECT ar.*, u.full_name as target_user_name 
       FROM attendance_records ar
       LEFT JOIN users u ON ar.user_id = u.id
       WHERE ar.id = $1`,
      [recordId],
    );

    if (!existingResult || existingResult.length === 0) {
      throw new NotFoundException(`Attendance record not found: ${recordId} `);
    }

    const existing = existingResult[0];
    const previousState = {
      status: existing.status,
      clock_in: existing.actual_in,
      clock_out: existing.actual_out,
    };

    // 2. Get corrector's name
    const correctorResult = await connection.query(
      `SELECT full_name FROM users WHERE id = $1`,
      [correctedBy],
    );
    const correctorName = correctorResult[0]?.full_name || 'Unknown Admin';

    // 3. Build update query
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined && updates.status !== '') {
      setClauses.push(`status = $${paramIndex++} `);
      values.push(updates.status);
    }
    // Format existing.date (Date object) to YYYY-MM-DD
    const dateObj = new Date(existing.date);
    const dateStr = dateObj.toISOString().split('T')[0];

    // Only update actual_in if it has a value (allow independent updates)
    if (updates.clock_in !== undefined && updates.clock_in !== '') {
      setClauses.push(`actual_in = $${paramIndex++} `);
      // Combine date + time for TIMESTAMP column
      // Time is in tenant timezone (same as scheduled times)
      const timeStr = updates.clock_in.length === 5 ? updates.clock_in : updates.clock_in.substring(0, 5);
      values.push(`${dateStr} ${timeStr}:00`);
    }
    // Only update actual_out if it has a value (allow independent updates)
    if (updates.clock_out !== undefined && updates.clock_out !== '') {
      setClauses.push(`actual_out = $${paramIndex++} `);
      const timeStr = updates.clock_out.length === 5 ? updates.clock_out : updates.clock_out.substring(0, 5);
      values.push(`${dateStr} ${timeStr}:00`);
    }
    if (updates.reason !== undefined) {
      setClauses.push(`remarks = $${paramIndex++} `);
      values.push(updates.reason);
    }

    if (setClauses.length === 0) {
      throw new BadRequestException('No updates provided');
    }

    setClauses.push(`updated_at = NOW()`);
    setClauses.push(`is_corrected = true`);
    setClauses.push(`corrected_by = $${paramIndex++} `);
    values.push(correctedBy);
    values.push(recordId);

    // 4. Update the record
    const updateResult = await connection.query(
      `UPDATE attendance_records 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
    RETURNING * `,
      values,
    );

    const updatedRecord = updateResult[0];
    const newState = {
      status: updatedRecord.status,
      clock_in: updatedRecord.actual_in,
      clock_out: updatedRecord.actual_out,
    };

    // 5. Log the correction to audit logs
    await this.logToTenantAudit(
      tenantId,
      correctedBy,
      'CORRECT_ATTENDANCE',
      recordId,
      {
        corrected_by: correctedBy,
        corrected_by_name: correctorName,
        target_user_id: existing.user_id,
        target_user_name: existing.target_user_name,
        date: existing.date,
        previous_state: previousState,
        new_state: newState,
        reason: updates.reason || 'No reason provided',
        corrected_at: new Date().toISOString(),
      },
    );

    console.log(`[Attendance] Correction made by ${correctorName} for ${existing.target_user_name}: ${JSON.stringify(previousState)} → ${JSON.stringify(newState)} `);

    // 6. Emit WebSocket update
    try {
      this.attendanceGateway.emitAttendanceUpdate(tenantId, {
        ...updatedRecord,
        full_name: existing.target_user_name,
        corrected: true,
        corrected_by_name: correctorName,
      });
    } catch (error) {
      console.error('[WebSocket] Failed to emit correction update:', error);
    }

    // 7. Create notification for the user whose attendance was corrected
    try {
      const notification = await this.notificationsService.createNotification(
        tenantId,
        existing.user_id,
        {
          type: 'attendance_correction',
          referenceId: recordId,
          title: 'Attendance Corrected',
          message: `${correctorName} corrected your attendance for ${dateStr}.Reason: ${updates.reason || 'No reason provided'}.`
        }
      );

      this.notificationsGateway.pushToUser(tenantId, existing.user_id, notification);
    } catch (notifError) {
      console.error('[AttendanceService] Failed to send attendance correction notification:', notifError);
    }

    return {
      ...updatedRecord,
      previous_state: previousState,
      corrected_by_name: correctorName,
    };
  }

  // Get attendance correction audit logs (for a specific user or all)
  async getAttendanceCorrectionLogs(
    tenantId: string,
    query: { userId?: string; page?: number; limit?: number } = {},
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAuditTable(connection);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE a.action = 'CORRECT_ATTENDANCE'`;
    const params: any[] = [];

    // Filter by target user if specified (for employee self-view)
    if (query.userId) {
      params.push(query.userId);
      whereClause += ` AND a.details ->> 'target_user_id' = $${params.length} `;
    }

    params.push(limit, offset);

    const logs = await connection.query(
      `SELECT a.*, u.full_name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length} `,
      params,
    );

    // Map logs to flatten details for the frontend
    const mappedLogs = logs.map(log => {
      // Audit logs store custom data in 'details' JSON column
      // We need to extract these common fields for the UI
      const details = log.details || {};
      return {
        id: log.id,
        action: log.action,
        created_at: log.created_at, // System timestamp

        // Fields expected by frontend CorrectionLog interface
        previous_state: details.previous_state,
        new_state: details.new_state,
        reason: details.reason,

        // Prefer explicit corrected_at from details, fallback to created_at
        corrected_at: details.corrected_at || log.created_at,

        // Names
        corrected_by_name: details.corrected_by_name || log.user_name || 'System',
        target_user_name: details.target_user_name || 'Unknown User',
      };
    });

    // Get total count for pagination
    const countParams = query.userId ? [query.userId] : [];
    const countResult = await connection.query(
      `SELECT COUNT(*) as total 
       FROM audit_logs a 
       ${whereClause} `,
      countParams,
    );
    const total = parseInt(countResult[0]?.total || '0');

    return {
      data: mappedLogs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============ REAL-TIME OT MONITORING ============

  async getOvertimeWorkers(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    // Get company timezone (optional, defaulting to server time for query simplicity as current_time usually works if db is configured)

    // Query: Users clocked in, not clocked out, and scheduled_out < NOW
    // Note: CURRENT_TIME in Postgres returns time with time zone. 
    // AND ar.date = CURRENT_DATE checks if the shift started today.
    // Ideally we handles cross-night shifts too, but basic logic:
    // If clock_in is NOT NULL, clock_out IS NULL, and (Now > Scheduled Out)
    const sql = `
    SELECT
    ar.id as record_id,
      ar.user_id,
      ar.user_id,
      u.full_name,
      u.department as department_name,
      ar.shift_id,
      s.name as shift_name,
      s.name as shift_name,
      ar.actual_in as clock_in,
      ar.scheduled_out,
      EXTRACT(EPOCH FROM(CURRENT_TIMESTAMP - (ar.date + ar.scheduled_out):: timestamp)) / 3600 as estimated_ot_hours
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      LEFT JOIN shifts s ON ar.shift_id = s.id
      WHERE ar.actual_in IS NOT NULL 
        AND ar.actual_out IS NULL
        AND ar.scheduled_out IS NOT NULL
    AND(ar.date + ar.scheduled_out):: timestamp < CURRENT_TIMESTAMP
      ORDER BY ar.scheduled_out ASC
    `;

    const result = await connection.query(sql);
    return result;
  }

  async forceClockOut(tenantId: string, adminId: string, targetUserId: string, reason?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    // Find the active record to close
    const pendingRecord = await connection.query(
      `SELECT id FROM attendance_records 
       WHERE user_id = $1 
         AND actual_in IS NOT NULL 
         AND actual_out IS NULL
       ORDER BY date DESC
       LIMIT 1`,
      [targetUserId]
    );

    if (!pendingRecord || pendingRecord.length === 0) {
      throw new NotFoundException('No active attendance record found to force clock-out');
    }

    const recordId = pendingRecord[0].id;

    // Retrieve Admin Name for the log
    const admin = await connection.query(`SELECT full_name FROM users WHERE id = $1`, [adminId]);
    const adminName = admin.length > 0 ? admin[0].full_name : 'Admin';

    // Update the record
    await connection.query(
      `UPDATE attendance_records
    SET
    actual_out = CURRENT_TIMESTAMP,
      forced_clock_out_by = $1,
      forced_at = CURRENT_TIMESTAMP,
      status = 'Present',
      remarks = CASE 
            WHEN remarks IS NULL THEN $2 
            ELSE remarks || '; ' || $2
    END
       WHERE id = $3`,
      [adminId, `Force Clock Out by ${adminName}: ${reason || 'No reason provided'} `, recordId]
    );

    // Emit socket event
    if (this.attendanceGateway) {
      this.attendanceGateway.emitAttendanceUpdate(tenantId, {
        type: 'force_clockout',
        userId: targetUserId,
        recordId
      });
    }

    return { message: 'User force clocked out successfully', recordId };
  }


  // ============ ATTENDANCE RECORDS ============
  async getUserAttendanceRecords(
    tenantId: string,
    userId: string,
    filters?: { month?: number; year?: number },
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const now = new Date();
    const month = filters?.month || now.getMonth() + 1;
    const year = filters?.year || now.getFullYear();

    // Get first and last day of the month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

    // Get actual attendance records with shift information
    // Get overrides/manual schedules
    const overrides = await connection.query(
      `
      SELECT sc.*, s.name as shift_name, s.start_time, s.end_time, s.color
      FROM schedules sc
      LEFT JOIN shifts s ON sc.shift_id = s.id
      WHERE sc.user_id = $1 AND sc.date >= $2 AND sc.date <= $3
      `,
      [userId, startDate, endDate],
    );

    // Get actual attendance records with shift information
    const attendanceRecords = await connection.query(
      `
      SELECT DISTINCT ON(ar.date, ar.user_id) ar.id, ar.user_id, ar.date, ar.shift_id,
      ar.scheduled_in, ar.scheduled_out, ar.actual_in, ar.actual_out,
      ar.status, ar.work_hours, ar.remarks,
      ar.is_corrected, ar.corrected_by, ar.updated_at,
      s.name as shift_name, s.color as shift_color,
      corrector.full_name as corrected_by_name
      FROM attendance_records ar
      LEFT JOIN shifts s ON ar.shift_id = s.id
      LEFT JOIN users corrector ON ar.corrected_by = corrector.id
      WHERE ar.user_id = $1 
        AND ar.date >= $2 
        AND ar.date <= $3
      ORDER BY ar.date DESC, ar.user_id, ar.updated_at DESC
      `,
      [userId, startDate, endDate],
    );

    console.log("DEBUG getUserAttendanceRecords:", attendanceRecords.map(r => ({
      id: r.id,
      date: r.date,
      actual_in: r.actual_in,
      is_corrected: r.is_corrected,
      corrected_by: r.corrected_by,
      corrected_by_name: r.corrected_by_name
    })));

    // Get user's shift assignment and schedule pattern
    const assignment = await connection.query(
      `
      SELECT sa.*, sp.name as pattern_name, sp.rotation_type, sp.auto_rotate
      FROM shift_assignments sa
      LEFT JOIN schedule_patterns sp ON sa.pattern_id = sp.id
      WHERE sa.user_id = $1
      `,
      [userId],
    );

    // If no assignment AND no overrides, just return attendance records
    // But we should show overrides even if no pattern is assigned!
    const hasAssignment = assignment && assignment.length > 0;
    const userAssignment = hasAssignment ? assignment[0] : null;

    let rotationWeeks: any[] = [];
    if (userAssignment) {
      rotationWeeks =
        (await connection.query(
          `
          SELECT rw.*, s.name as shift_name, s.start_time, s.end_time, s.color
          FROM rotation_weeks rw
          LEFT JOIN shifts s ON rw.shift_id = s.id
          WHERE rw.pattern_id = $1
          ORDER BY rw.week_number
        `,
          [userAssignment.pattern_id],
        )) || [];
    }

    // Helper function to get day name
    const getDayName = (dayOfWeek: number): string => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[dayOfWeek];
    };

    // Helper function to calculate which week in rotation based on date
    const getWeekNumber = (date: Date): number => {
      if (!userAssignment || userAssignment.rotation_type === 'fixed') {
        return 1;
      }
      const effectiveDate = new Date(userAssignment.effective_date);
      const diffTime = date.getTime() - effectiveDate.getTime();
      const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
      const totalWeeks = rotationWeeks.length;
      if (totalWeeks === 0) return 1;

      const currentWeekIndex =
        (userAssignment.current_week_in_rotation - 1 + diffWeeks) % totalWeeks;
      return currentWeekIndex + 1;
    };

    const effectiveDateStr = userAssignment
      ? new Date(userAssignment.effective_date).toISOString().split('T')[0]
      : '1970-01-01';
    const effectiveDate = new Date(effectiveDateStr + 'T00:00:00.000Z');

    // Get HR Settings & Holidays
    const hrSettings = await this.settingsService.getHRSettings(tenantId);
    const workingDays = hrSettings.work_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const stdStart = hrSettings.standard_start_time || '09:00';
    const stdEnd = hrSettings.standard_end_time || '17:00';

    const holidays = await this.holidaysService.findAll(tenantId);
    const holidayDateMap = new Map();
    holidays.forEach((h: any) => holidayDateMap.set(h.date, h.name));

    // Generate scheduled entries for all days
    const scheduledDays: any[] = [];
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const date = new Date(dateStr + 'T00:00:00.000Z');

      // Check for Manual Override FIRST
      const override = overrides?.find((o: any) => {
        // Careful with date formats from DB
        const oDate = new Date(o.date).toISOString().split('T')[0];
        return oDate === dateStr;
      });

      let finalShiftId: string | null = null;
      let finalStartTime: string | null = null;
      let finalEndTime: string | null = null;
      let finalShiftName: string | null = null;
      let finalColor: string | null = null;
      let isDayOff = false;
      let isOverride = false;
      let note: string | null = null;

      // Check Holiday
      const holidayName = holidayDateMap.get(dateStr);

      if (override) {
        isOverride = true;
        note = override.note;
        if (override.is_day_off || !override.shift_id) {
          isDayOff = true;
        } else {
          finalShiftId = override.shift_id;
          finalStartTime = override.start_time;
          finalEndTime = override.end_time;
          finalShiftName = override.shift_name;
          finalColor = override.color;
        }
      } else {
        // No override, Check Holiday first
        if (holidayName) {
          isDayOff = true;
          note = holidayName; // Set remarks to holiday name
        } else if (!userAssignment || !userAssignment.pattern_id) {
          // Standard Schedule
          const dayOfWeek = date.getUTCDay();
          const dayName = getDayName(dayOfWeek);
          const isWorkingDay = workingDays.some((wd: string) => wd.startsWith(dayName));

          if (isWorkingDay) {
            finalShiftId = 'STANDARD';
            finalStartTime = stdStart;
            finalEndTime = stdEnd;
            finalShiftName = 'Standard';
            finalColor = '#3b82f6';
          } else {
            isDayOff = true;
          }

        } else {
          // Pattern Logic
          if (date < effectiveDate) continue;

          const dayOfWeek = date.getUTCDay();
          const dayName = getDayName(dayOfWeek);
          const weekNumber = getWeekNumber(date);
          const rotationWeek = rotationWeeks.find(
            (rw) => rw.week_number === weekNumber,
          );

          if (rotationWeek && rotationWeek.shift_id) {
            const daysOff = rotationWeek.days_off || [];
            if (daysOff.includes(dayName)) {
              isDayOff = true;
            } else {
              finalShiftId = rotationWeek.shift_id;
              finalStartTime = rotationWeek.start_time;
              finalEndTime = rotationWeek.end_time;
              finalShiftName = rotationWeek.shift_name;
              finalColor = rotationWeek.color;
            }
          } else {
            // No rotation week defined or no shift = Day Off or Empty
            continue;
          }
        }
      }

      if ((!isDayOff && finalShiftId) || (isDayOff && holidayName)) {
        // Check if existing attendance record
        const existingRecord = attendanceRecords?.find((r: any) => {
          const recordDate = r.date.toISOString
            ? r.date.toISOString().split('T')[0]
            : r.date.split('T')[0];
          return recordDate === dateStr;
        });

        if (!existingRecord) {
          scheduledDays.push({
            id: `scheduled-${dateStr}`,
            user_id: userId,
            date: dateStr,
            shift_id: finalShiftId,
            scheduled_in: finalStartTime,
            scheduled_out: finalEndTime,
            actual_in: null,
            actual_out: null,
            status: holidayName ? 'Day Off' : (isOverride ? 'Rescheduled' : 'Scheduled'),
            work_hours: null,
            remarks: note,
            shift_name: finalShiftName,
            shift_color: finalColor,
            is_scheduled: true,
            is_override: isOverride,
            holiday_name: holidayName
          });
        }
      }
    }

    // Merge attendance records and scheduled days
    const combined = [...(attendanceRecords || []), ...scheduledDays];

    // Sort by date descending
    combined.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });

    return combined;
  }

  async getAttendanceRecords(
    tenantId: string,
    filters?: { date?: string; user_id?: string; status?: string },
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    let query = `
      SELECT ar.*,
      u.full_name, u.email, u.department, u.avatar_url,
      s.name as shift_name, s.color as shift_color,
      corrector.full_name as corrected_by_name,
      lms.late_minutes
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      LEFT JOIN shifts s ON ar.shift_id = s.id
      LEFT JOIN users corrector ON ar.corrected_by = corrector.id
      LEFT JOIN late_minutes_summary lms ON ar.user_id = lms.user_id AND ar.date = lms.date
      WHERE 1 = 1
      `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.date) {
      query += ` AND ar.date = $${paramIndex} `;
      params.push(filters.date);
      paramIndex++;
    }

    if (filters?.user_id) {
      query += ` AND ar.user_id = $${paramIndex} `;
      params.push(filters.user_id);
      paramIndex++;
    }

    if (filters?.status) {
      query += ` AND ar.status = $${paramIndex} `;
      params.push(filters.status);
      paramIndex++;
    }

    query += ` ORDER BY ar.date DESC, u.full_name`;

    const result = await connection.query(query, params);
    return result || [];
  }

  async getAttendanceRecordById(tenantId: string, recordId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
      SELECT ar.*,
      u.full_name, u.email, u.department, u.avatar_url,
      s.name as shift_name, s.color as shift_color
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      LEFT JOIN shifts s ON ar.shift_id = s.id
      WHERE ar.id = $1
      `,
      [recordId],
    );

    return result[0] || null;
  }

  async recordAttendance(tenantId: string, data: any) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(
      `
      INSERT INTO attendance_records(user_id, date, shift_id, scheduled_in, scheduled_out, actual_in, actual_out, status, remarks)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT(user_id, date) DO UPDATE SET
    shift_id = COALESCE($3, attendance_records.shift_id),
      scheduled_in = COALESCE($4, attendance_records.scheduled_in),
      scheduled_out = COALESCE($5, attendance_records.scheduled_out),
      actual_in = COALESCE($6, attendance_records.actual_in),
      actual_out = COALESCE($7, attendance_records.actual_out),
      status = COALESCE($8, attendance_records.status),
      remarks = COALESCE($9, attendance_records.remarks),
      updated_at = NOW()
    RETURNING *
      `,
      [
        data.user_id,
        data.date,
        data.shift_id,
        data.scheduled_in,
        data.scheduled_out,
        data.actual_in,
        data.actual_out,
        data.status || 'Pending',
        data.remarks,
      ],
    );

    return result[0];
  }

  async clockIn(tenantId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Check for any open session (Clock-In without Clock-Out)
    // This prevents consecutive Clock-Ins even across different days
    const openSessions = await connection.query(
      `SELECT * FROM attendance_records WHERE user_id = $1 AND actual_in IS NOT NULL AND actual_out IS NULL`,
      [userId],
    );

    if (openSessions && openSessions.length > 0) {
      throw new BadRequestException(
        'You are already clocked in. Please clock out first.',
      );
    }

    // Get company timezone and current time
    const timezone = await this.getCompanyTimezone(connection);
    const { now, today, currentMinutes } =
      this.getCurrentTimeInTimezone(timezone);

    console.log(
      `[ClockIn] Using timezone: ${timezone}, today: ${today}, currentMinutes: ${currentMinutes} `,
    );

    // Get late tolerance and absent settings from HR settings
    const hrSettings = await this.getHRSettings(connection);
    const lateTolerance = hrSettings?.late_tolerance_minutes || 15;
    const markLateInsteadOfAbsent =
      hrSettings?.mark_late_instead_of_absent === true;

    // Get user's assigned shift for today
    const assignment = await connection.query(
      `
      SELECT sa.*, sp.rotation_type, rw.shift_id, rw.days_off,
      s.start_time, s.end_time, s.grace_minutes
      FROM shift_assignments sa
      JOIN schedule_patterns sp ON sa.pattern_id = sp.id
      JOIN rotation_weeks rw ON rw.pattern_id = sp.id AND rw.week_number = sa.current_week_in_rotation
      LEFT JOIN shifts s ON rw.shift_id = s.id
      WHERE sa.user_id = $1
      `,
      [userId],
    );

    let shiftId = null;
    let scheduledIn = null;
    let scheduledOut = null;
    let status = 'Present';
    let lateMinutes = 0;

    if (assignment && assignment.length > 0) {
      const shift = assignment[0];
      shiftId = shift.shift_id;
      scheduledIn = shift.start_time;
      scheduledOut = shift.end_time;

      // CHECK IF USER IS ALREADY MARKED ABSENT
      const existing = await connection.query(
        `
    SELECT * FROM attendance_records WHERE user_id = $1 AND date = $2
      `,
        [userId, today],
      );

      if (existing && existing.length > 0) {
        const record = existing[0];
        if (record.status === 'Absent') {
          if (markLateInsteadOfAbsent) {
            console.log(
              `[ClockIn] User ${userId} was Absent, converting to Late based on settings.`,
            );
            // Continue to mark as Late (logic below will handle late calculation)
            // But we must ensure status becomes 'Late' or 'Present' depending on calculation,
            // overriding the 'Absent' status.
          } else {
            console.log(
              `[ClockIn] User ${userId} is marked Absent and conversion is disabled.`,
            );
            throw new BadRequestException(
              'You have been marked Absent for today. Please contact your supervisor.',
            );
          }
        } else if (
          record.status !== 'Pending' &&
          record.status !== 'Scheduled'
        ) {
          // Already clocked in or out
          throw new BadRequestException(
            'You are already clocked in or have a record for today.',
          );
        }
      }

      // Check if late using HR settings late_tolerance_minutes
      if (shift.start_time) {
        const [hours, mins] = shift.start_time.split(':').map(Number);
        const shiftStartMinutes = hours * 60 + mins;

        // Calculate minutes late using timezone-aware current time
        const diffMins = currentMinutes - shiftStartMinutes;

        if (diffMins > lateTolerance) {
          status = 'Late';
          lateMinutes = diffMins;

          // [NEW] Record Late Minutes Penalty
          try {
            this.lateMinuteService.recordLateArrival(
              tenantId,
              userId,
              new Date(today),
              lateMinutes,
              scheduledIn || '',
              now.toTimeString().split(' ')[0]
            ).catch(e => console.error(`Failed to record late penalty: ${e.message} `));
          } catch (e) {
            console.error(`Failed to record late penalty for ${userId}: `, e);
          }
        }
      }
    }

    const remarks =
      status === 'Late'
        ? `Late by ${lateMinutes} minutes(tolerance: ${lateTolerance} min)`
        : null;

    const result = await connection.query(
      `
      INSERT INTO attendance_records(user_id, date, shift_id, scheduled_in, scheduled_out, actual_in, status, remarks)
    VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT(user_id, date) DO UPDATE SET
    actual_in = $6,
      status = $7,
      remarks = COALESCE($8, attendance_records.remarks),
      updated_at = NOW()
    RETURNING *
      `,
      [userId, today, shiftId, scheduledIn, scheduledOut, now, status, remarks],
    );

    const record = result[0];

    // Get user details and emit WebSocket event
    try {
      const userDetails = await connection.query(
        `
        SELECT u.id, u.full_name, u.email, u.department, u.position, u.avatar_url,
      s.name as shift_name, s.color as shift_color
        FROM users u
        LEFT JOIN shifts s ON s.id = $1
        WHERE u.id = $2
      `,
        [shiftId, userId],
      );

      if (userDetails && userDetails.length > 0) {
        const enrichedRecord = {
          ...record,
          ...userDetails[0],
        };
        this.attendanceGateway.emitClockIn(tenantId, enrichedRecord);
        console.log(`[WebSocket] Clock -in event emitted for user ${userId}`);
      }
    } catch (wsError) {
      console.error('[WebSocket] Failed to emit clock-in event:', wsError);
    }

    return record;
  }

  async clockOut(tenantId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Get company timezone and current time (same as clockIn)
    const timezone = await this.getCompanyTimezone(connection);
    const { now, today } = this.getCurrentTimeInTimezone(timezone);

    // Find the LAST open session (latest actual_in with null actual_out)
    const openSessions = await connection.query(
      `SELECT * FROM attendance_records WHERE user_id = $1 AND actual_in IS NOT NULL AND actual_out IS NULL ORDER BY actual_in DESC LIMIT 1`,
      [userId],
    );

    if (!openSessions || openSessions.length === 0) {
      throw new BadRequestException('You are not clocked in.');
    }

    const attendance = openSessions[0];
    let status = attendance.status;

    // Check for early leave
    // We must reconstruct the Shift End timestamp relative to the Attendance Date
    if (attendance.scheduled_out && attendance.scheduled_in) {
      const recordDate = new Date(attendance.date); // Base date of the record

      const [inH, inM] = attendance.scheduled_in.split(':').map(Number);
      const [outH, outM] = attendance.scheduled_out.split(':').map(Number);

      const shiftStart = new Date(recordDate);
      shiftStart.setHours(inH, inM, 0, 0);

      const shiftEnd = new Date(recordDate);
      shiftEnd.setHours(outH, outM, 0, 0);

      // Handle overnight shift: If End Time < Start Time (e.g. 02:00 < 22:00), it implies next day
      if (shiftEnd < shiftStart) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }

      // If Now is before Shift End (with tolerance usually, but strict here), mark Early Leave
      if (now < shiftEnd) {
        // Only change status if it wasn't already Late?
        // User might be both Late AND Early Leave. 
        // System usually prioritizes one or appends. 
        // Current logic: status = 'Early Leave' overrides unless 'Late'?
        // The original code: status = 'Early Leave'.
        // Let's Append or Set.
        // Original code line 1710: status = 'Early Leave';
        // Original code line 1726: status = CASE WHEN status = 'Late' THEN 'Late' ELSE $3 ...
        // This implies Late > Early Leave in priority in SQL? 
        // Or SQL line 1726 preserves 'Late' and ignores new status ($3).
        // So if I pass 'Early Leave' as $3, and DB has 'Late', it stays 'Late'.
        // If DB has 'Present', it becomes 'Early Leave'. This seems fine.
        status = 'Early Leave';
      }
    }

    // Calculate work hours
    const actualIn = new Date(attendance.actual_in);
    const workMs = now.getTime() - actualIn.getTime();
    const workHours = Math.floor(workMs / (1000 * 60 * 60));
    const workMins = Math.floor((workMs % (1000 * 60 * 60)) / (1000 * 60));
    const workInterval = `${workHours} hours ${workMins} minutes`;

    const result = await connection.query(
      `
      UPDATE attendance_records SET
    actual_out = $1,
      work_hours = $2:: interval,
        status = CASE WHEN status = 'Late' THEN 'Late' ELSE $3 END,
          updated_at = NOW()
      WHERE id = $4
    RETURNING *
      `,
      [now, workInterval, status, attendance.id],
    );

    const updatedRecord = result[0];

    // Get user details and emit WebSocket event
    try {
      const userDetails = await connection.query(
        `
        SELECT u.id, u.full_name, u.email, u.department, u.position, u.avatar_url,
      s.name as shift_name, s.color as shift_color
        FROM users u
        LEFT JOIN shifts s ON s.id = $1
        WHERE u.id = $2
      `,
        [attendance.shift_id, userId],
      );

      if (userDetails && userDetails.length > 0) {
        const enrichedRecord = {
          ...updatedRecord,
          ...userDetails[0],
        };
        this.attendanceGateway.emitClockOut(tenantId, enrichedRecord);
        console.log(`[WebSocket] Clock - out event emitted for user ${userId}`);
      }
    } catch (wsError) {
      console.error('[WebSocket] Failed to emit clock-out event:', wsError);
    }

    return updatedRecord;
  }

  // Get users without shift assignments (for assignment dropdown)
  async getUnassignedUsers(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(`
      SELECT u.id, u.full_name, u.email, u.department, u.position, u.avatar_url
      FROM users u
      LEFT JOIN shift_assignments sa ON u.id = sa.user_id
      WHERE u.is_active = true AND sa.id IS NULL
      ORDER BY u.full_name
      `);

    return result || [];
  }

  // Get all users with their assignment status
  async getUsersWithAssignments(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(`
      SELECT u.id, u.full_name, u.email, u.department, u.position, u.avatar_url,
      sa.pattern_id, sa.current_week_in_rotation, sa.effective_date,
      sp.name as pattern_name, sp.rotation_type
      FROM users u
      LEFT JOIN shift_assignments sa ON u.id = sa.user_id
      LEFT JOIN schedule_patterns sp ON sa.pattern_id = sp.id
      WHERE u.is_active = true
      ORDER BY u.full_name
    `);

    return result || [];
  }

  // ============ QR CODE & DEVICE BINDING ============

  // Generate a new rotating QR code (valid for 30 seconds)
  async generateQRCode(
    tenantId: string,
    type: 'clock_in' | 'clock_out' = 'clock_in',
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Clean up expired codes
    await connection.query(
      `DELETE FROM attendance_qr_codes WHERE expires_at < NOW()`,
    );

    // Generate unique code
    const code = `${tenantId} -${type} -${Date.now()} -${Math.random().toString(36).substring(2, 15)} `;
    const expiresAt = new Date(Date.now() + 30 * 1000); // 30 seconds

    const result = await connection.query(
      `
      INSERT INTO attendance_qr_codes(code, type, expires_at)
    VALUES($1, $2, $3)
    RETURNING *
      `,
      [code, type, expiresAt],
    );

    return result[0];
  }

  // Get current valid QR code or generate new one
  async getCurrentQRCode(
    tenantId: string,
    type: 'clock_in' | 'clock_out' = 'clock_in',
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Get valid code
    const existing = await connection.query(
      `
    SELECT * FROM attendance_qr_codes 
      WHERE type = $1 AND expires_at > NOW()
      ORDER BY expires_at DESC
      LIMIT 1
      `,
      [type],
    );

    if (existing && existing.length > 0) {
      return existing[0];
    }

    // Generate new one
    return this.generateQRCode(tenantId, type);
  }

  // Validate QR code
  async validateQRCode(tenantId: string, code: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
    SELECT * FROM attendance_qr_codes 
      WHERE code = $1 AND expires_at > NOW()
      `,
      [code],
    );

    return result && result.length > 0;
  }

  // Register user device (only one device per user allowed)
  async registerDevice(
    tenantId: string,
    userId: string,
    deviceInfo: {
      device_id: string;
      device_name?: string;
      device_type?: string;
    },
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Check if user already has a registered device
    const userDevices = await connection.query(
      `
    SELECT * FROM user_devices 
      WHERE user_id = $1 AND is_active = true
      `,
      [userId],
    );

    if (userDevices && userDevices.length > 0) {
      const existingDevice = userDevices[0];
      // If it's the same device, just return it
      if (existingDevice.device_id === deviceInfo.device_id) {
        return existingDevice;
      }
      // Otherwise, user already has a different device registered
      throw new BadRequestException(
        'You already have a registered device. Please contact your administrator to remove it before registering a new one.',
      );
    }

    // Check if device is already registered to another user
    const existing = await connection.query(
      `
    SELECT * FROM user_devices 
      WHERE device_id = $1 AND user_id != $2 AND is_active = true
      `,
      [deviceInfo.device_id, userId],
    );

    if (existing && existing.length > 0) {
      throw new BadRequestException(
        'This device is already registered to another user',
      );
    }

    const result = await connection.query(
      `
      INSERT INTO user_devices(user_id, device_id, device_name, device_type)
    VALUES($1, $2, $3, $4)
      ON CONFLICT(user_id, device_id) DO UPDATE SET
    device_name = COALESCE($3, user_devices.device_name),
      device_type = COALESCE($4, user_devices.device_type),
      is_active = true,
      last_used_at = NOW()
    RETURNING *
      `,
      [
        userId,
        deviceInfo.device_id,
        deviceInfo.device_name,
        deviceInfo.device_type,
      ],
    );

    return result[0];
  }

  // Get user's registered devices
  async getUserDevices(tenantId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(
      `
    SELECT * FROM user_devices 
      WHERE user_id = $1 AND is_active = true
      ORDER BY registered_at DESC
      `,
      [userId],
    );

    return result || [];
  }

  // Check if device is registered for user
  async isDeviceRegistered(tenantId: string, userId: string, deviceId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
    SELECT * FROM user_devices 
      WHERE user_id = $1 AND device_id = $2 AND is_active = true
      `,
      [userId, deviceId],
    );

    return result && result.length > 0;
  }

  // Remove device
  async removeDevice(tenantId: string, userId: string, deviceId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(
      `
      UPDATE user_devices SET is_active = false 
      WHERE user_id = $1 AND device_id = $2
      `,
      [userId, deviceId],
    );

    return { message: 'Device removed successfully' };
  }

  // Get user's schedule for today
  async getUserTodaySchedule(tenantId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Get company timezone
    const timezone = await this.getCompanyTimezone(connection);
    const { dayAbbrev: todayAbbrev } = this.getDayOfWeekInTimezone(timezone);
    const { today } = this.getCurrentTimeInTimezone(timezone);

    console.log(
      `[Attendance] Using timezone: ${timezone}, Day: ${todayAbbrev}, Date: ${today} `,
    );

    // 1. Check for Manual Override (schedules table)
    const overrideResult = await connection.query(
      `
      SELECT s.*, sh.name as shift_name, sh.start_time, sh.end_time, sh.grace_minutes, sh.color
      FROM schedules s
      LEFT JOIN shifts sh ON s.shift_id = sh.id
      WHERE s.user_id = $1 AND s.date = $2
      `,
      [userId, today],
    );

    if (overrideResult.length > 0) {
      const override = overrideResult[0];
      if (override.is_day_off) {
        return { isOffDay: true };
      }

      // If override has a shift
      if (override.shift_id && override.start_time) {
        return {
          shift: {
            id: override.shift_id,
            name: override.shift_name,
            start_time: override.start_time,
            end_time: override.end_time,
            grace_minutes: override.grace_minutes,
            color: override.color,
          },
          assignment: override, // Use override as source
          isOffDay: false,
        };
      }
      // If override exists but not day off and no shift? fallback to pattern? 
      // Usually override implies explicit intent. If just "Work" but no shift, maybe error?
      // For now, if override says not off, but no shift, effectively no schedule logic might apply
    }

    // 2. Fallback to Pattern Assignment


    // Get user's shift assignment with rotation week and shift details
    const assignment = await connection.query(
      `
      SELECT sa.*, sp.name as pattern_name, sp.rotation_type,
      rw.shift_id, rw.days_off,
      s.id as shift_id, s.name as shift_name, s.start_time, s.end_time, s.grace_minutes, s.color
      FROM shift_assignments sa
      JOIN schedule_patterns sp ON sa.pattern_id = sp.id
      LEFT JOIN rotation_weeks rw ON rw.pattern_id = sp.id AND rw.week_number = sa.current_week_in_rotation
      LEFT JOIN shifts s ON rw.shift_id = s.id
      WHERE sa.user_id = $1
      `,
      [userId],
    );

    if (!assignment || assignment.length === 0) {
      return null; // No schedule assigned
    }

    const userAssignment = assignment[0];

    // Check if today is a day off
    const daysOff = userAssignment.days_off || ['Sat', 'Sun'];
    if (daysOff.includes(todayAbbrev)) {
      return { isOffDay: true }; // Off day
    }

    // Check if shift exists
    if (!userAssignment.shift_id || !userAssignment.start_time) {
      return null; // No shift configured for this rotation week
    }

    return {
      shift: {
        id: userAssignment.shift_id,
        name: userAssignment.shift_name,
        start_time: userAssignment.start_time,
        end_time: userAssignment.end_time,
        grace_minutes: userAssignment.grace_minutes,
        color: userAssignment.color,
      },
      assignment: userAssignment,
      isOffDay: false,
    };
  }

  // Get HR attendance settings
  async getHRAttendanceSettings(tenantId: string): Promise<{
    early_punch_in_minutes: number;
    late_tolerance_minutes: number;
  }> {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    try {
      const result = await connection.query(`
        SELECT data FROM settings WHERE category = 'hr'
      `);

      if (result && result.length > 0 && result[0].data) {
        const hrSettings = result[0].data;
        return {
          early_punch_in_minutes: hrSettings.early_punch_in_minutes || 30,
          late_tolerance_minutes: hrSettings.late_tolerance_minutes || 15,
        };
      }
    } catch (error) {
      console.error('Error getting HR settings:', error);
    }

    return { early_punch_in_minutes: 30, late_tolerance_minutes: 15 };
  }

  // Get early punch in setting from HR settings
  async getEarlyPunchInMinutes(tenantId: string): Promise<number> {
    const settings = await this.getHRAttendanceSettings(tenantId);
    return settings.early_punch_in_minutes;
  }

  // Get late tolerance from HR settings
  async getLateTolerance(tenantId: string): Promise<number> {
    const settings = await this.getHRAttendanceSettings(tenantId);
    return settings.late_tolerance_minutes;
  }

  // Validate schedule timing for clock in
  async validateClockInTiming(tenantId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    const schedule = await this.getUserTodaySchedule(tenantId, userId);

    if (!schedule) {
      return {
        canClockIn: false,
        message:
          'You do not have a schedule assigned. Please contact your administrator.',
        isLate: false,
      };
    }

    if (schedule.isOffDay) {
      return {
        canClockIn: false,
        message: 'Today is your day off. You cannot clock in on off days.',
        isLate: false,
      };
    }

    const shift = schedule.shift;
    if (!shift || !shift.start_time || !shift.end_time) {
      return {
        canClockIn: false,
        message:
          'Your shift is not properly configured. Please contact your administrator.',
        isLate: false,
      };
    }

    // Get current time in company timezone
    const timezone = await this.getCompanyTimezone(connection);
    const { currentMinutes: currentTime, today } =
      this.getCurrentTimeInTimezone(timezone);

    console.log(
      `[Attendance] Validating clock -in: timezone = ${timezone}, currentMinutes = ${currentTime}, today = ${today} `,
    );

    // Parse shift times
    const [startHour, startMin] = shift.start_time.split(':').map(Number);
    const [endHour, endMin] = shift.end_time.split(':').map(Number);
    const shiftStartMinutes = startHour * 60 + startMin;
    const shiftEndMinutes = endHour * 60 + endMin;

    // Get HR settings
    const hrSettings = await this.getHRAttendanceSettings(tenantId);
    const earlyMinutes = hrSettings.early_punch_in_minutes;
    const lateTolerance = hrSettings.late_tolerance_minutes;
    const earliestClockIn = shiftStartMinutes - earlyMinutes;

    // Check if too early
    if (currentTime < earliestClockIn) {
      const waitMinutes = earliestClockIn - currentTime;
      return {
        canClockIn: false,
        message: `It's too early to clock in. Your shift starts at ${shift.start_time}. You can clock in ${earlyMinutes} minutes before your shift (at ${this.formatMinutesToTime(earliestClockIn)}). Please wait ${waitMinutes} more minutes.`,
        isLate: false,
      };
    }

    // Check if shift has passed (allow clock in up to shift end time + grace period)
    const graceMinutes = shift.grace_minutes || 0;
    const latestClockIn = shiftEndMinutes + graceMinutes;

    if (currentTime > latestClockIn) {
      return {
        canClockIn: false,
        message: `Your shift has ended at ${shift.end_time}. Please contact your administrator if you need to record your attendance.`,
        isLate: false,
      };
    }

    // Check if user will be marked as late
    const minutesLate = currentTime - shiftStartMinutes;
    const isLate = minutesLate > lateTolerance;
    let message = 'Ready to clock in.';

    if (isLate) {
      message = `Warning: You are ${minutesLate} minutes late. You will be marked as "Late" (tolerance: ${lateTolerance} min).`;
    } else if (minutesLate > 0) {
      message = `You are ${minutesLate} minutes past shift start, but within tolerance (${lateTolerance} min). You will be marked as "Present".`;
    }

    return {
      canClockIn: true,
      shift: shift,
      message: message,
      isLate: isLate,
      minutesLate: minutesLate > 0 ? minutesLate : 0,
      lateTolerance: lateTolerance,
    };
  }

  // Helper to format minutes to time string
  private formatMinutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Secure clock in with QR code, device, and network validation
  async secureClockIn(
    tenantId: string,
    userId: string,
    qrCode: string,
    deviceId: string,
    clientIp?: string,
  ) {
    // Validate network if IP provided
    if (clientIp) {
      const networkCheck = await this.isNetworkAllowed(tenantId, clientIp);
      if (!networkCheck.allowed) {
        throw new BadRequestException(networkCheck.message);
      }
    }

    // First validate schedule timing
    const timingValidation = await this.validateClockInTiming(tenantId, userId);
    if (!timingValidation.canClockIn) {
      throw new BadRequestException(timingValidation.message);
    }

    // Validate QR code
    const isValidQR = await this.validateQRCode(tenantId, qrCode);
    if (!isValidQR) {
      throw new BadRequestException(
        'Invalid or expired QR code. Please scan a fresh code.',
      );
    }

    // Validate device
    const isValidDevice = await this.isDeviceRegistered(
      tenantId,
      userId,
      deviceId,
    );
    if (!isValidDevice) {
      throw new BadRequestException(
        'This device is not registered. Please register your device first.',
      );
    }

    // Check if device is approved
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    const deviceCheck = await connection.query(
      `
      SELECT * FROM user_devices 
      WHERE user_id = $1 AND device_id = $2 AND is_active = true
    `,
      [userId, deviceId],
    );

    if (deviceCheck && deviceCheck.length > 0 && !deviceCheck[0].approved_at) {
      throw new BadRequestException(
        'Your device is pending approval. Please wait for admin approval.',
      );
    }

    // Update device last used
    await connection.query(
      `
      UPDATE user_devices SET last_used_at = NOW() 
      WHERE user_id = $1 AND device_id = $2
    `,
      [userId, deviceId],
    );

    // Proceed with clock in
    return this.clockIn(tenantId, userId);
  }

  // Secure clock out with QR code, device, and network validation
  async secureClockOut(
    tenantId: string,
    userId: string,
    qrCode: string,
    deviceId: string,
    clientIp?: string,
  ) {
    // Validate network if IP provided
    if (clientIp) {
      const networkCheck = await this.isNetworkAllowed(tenantId, clientIp);
      if (!networkCheck.allowed) {
        throw new BadRequestException(networkCheck.message);
      }
    }

    // Validate QR code
    const isValidQR = await this.validateQRCode(tenantId, qrCode);
    if (!isValidQR) {
      throw new BadRequestException(
        'Invalid or expired QR code. Please scan a fresh code.',
      );
    }

    // Validate device
    const isValidDevice = await this.isDeviceRegistered(
      tenantId,
      userId,
      deviceId,
    );
    if (!isValidDevice) {
      throw new BadRequestException(
        'This device is not registered. Please register your device first.',
      );
    }

    // Update device last used
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await connection.query(
      `
      UPDATE user_devices SET last_used_at = NOW() 
      WHERE user_id = $1 AND device_id = $2
    `,
      [userId, deviceId],
    );

    // Proceed with clock out
    return this.clockOut(tenantId, userId);
  }

  // Admin: Get all registered devices
  async getAllDevices(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(`
      SELECT ud.*, u.full_name, u.email, u.department
      FROM user_devices ud
      JOIN users u ON ud.user_id = u.id
      WHERE ud.is_active = true
      ORDER BY ud.registered_at DESC
    `);
    return result || [];
  }



  // ============ REPORTS / SUMMARY ============
  async getLatenessSummary(tenantId: string, dateStr?: string, userId?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    // Use provided date or today (server time)
    const dateObj = dateStr ? new Date(dateStr) : new Date();
    const dateOnly = dateObj.toISOString().split('T')[0];

    // Calculate Week Start (Monday)
    const d = new Date(dateOnly);
    const day = d.getDay();
    // day: 0 (Sun) to 6 (Sat). We want Monday (1) as start.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const month = new Date(dateOnly).getMonth() + 1;
    const year = new Date(dateOnly).getFullYear();

    let userFilter = "";
    if (userId) {
      userFilter = `AND u.id = '${userId}'`;
    }

    const query = `
      SELECT 
        u.id, u.full_name, u.department, u.avatar_url,
        COALESCE(day_stats.late_minutes, 0) as today_late,
        COALESCE(week_stats.total, 0) as week_late,
        COALESCE(month_stats.total, 0) as month_late
      FROM users u
      LEFT JOIN late_minutes_summary day_stats ON u.id = day_stats.user_id AND day_stats.date = $1
      LEFT JOIN (
        SELECT user_id, SUM(late_minutes) as total 
        FROM late_minutes_summary 
        WHERE week_start_date = $2
        GROUP BY user_id
      ) week_stats ON u.id = week_stats.user_id
      LEFT JOIN (
        SELECT user_id, SUM(late_minutes) as total 
        FROM late_minutes_summary 
        WHERE month = $3 AND year = $4
        GROUP BY user_id
      ) month_stats ON u.id = month_stats.user_id
      WHERE u.is_active = true 
      AND (COALESCE(day_stats.late_minutes, 0) > 0 OR COALESCE(week_stats.total, 0) > 0 OR COALESCE(month_stats.total, 0) > 0)
      ${userFilter}
      ORDER BY today_late DESC, week_late DESC
    `;

    return connection.query(query, [dateOnly, weekStartStr, month, year]);
  }

  // Hack: passing userId via dateStr due to controller signature limitation or update controller
  // Better: Update controller signature. But staying minimal changes:
  // Actually, let's update the signature properly.





  // Admin: Get all pending device registrations
  async getPendingDevices(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(`
      SELECT ud.*, u.full_name, u.email, u.department
      FROM user_devices ud
      JOIN users u ON ud.user_id = u.id
      WHERE ud.is_active = true AND ud.approved_at IS NULL
      ORDER BY ud.registered_at DESC
    `);

    return result || [];
  }

  // Admin: Approve device
  async approveDevice(
    tenantId: string,
    deviceRecordId: string,
    approverId: string,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(
      `
      UPDATE user_devices SET 
        approved_by = $1, 
        approved_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [approverId, deviceRecordId],
    );

    return result[0];
  }

  // Admin: Reject/remove device
  async rejectDevice(tenantId: string, deviceRecordId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(
      `
      UPDATE user_devices SET is_active = false 
      WHERE id = $1
    `,
      [deviceRecordId],
    );

    return { message: 'Device rejected' };
  }

  // ============ NETWORK MANAGEMENT ============

  // Get all allowed networks
  async getAllowedNetworks(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(`
      SELECT * FROM allowed_networks WHERE is_active = true ORDER BY name
    `);
    return result || [];
  }

  // Add allowed network
  async addAllowedNetwork(
    tenantId: string,
    data: {
      name: string;
      ip_address: string;
      subnet_mask?: string;
      description?: string;
    },
    createdBy: string,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    const result = await connection.query(
      `
      INSERT INTO allowed_networks (name, ip_address, subnet_mask, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [
        data.name,
        data.ip_address,
        data.subnet_mask || '255.255.255.0',
        data.description,
        createdBy,
      ],
    );

    return result[0];
  }

  // Remove allowed network
  async removeAllowedNetwork(tenantId: string, networkId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    await connection.query(
      `
      UPDATE allowed_networks SET is_active = false WHERE id = $1
    `,
      [networkId],
    );

    return { message: 'Network removed' };
  }

  // Validate if IP is in allowed networks
  async isNetworkAllowed(
    tenantId: string,
    clientIp: string,
  ): Promise<{ allowed: boolean; message: string; clientIp: string }> {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Get all allowed networks
    const networks = await connection.query(`
      SELECT * FROM allowed_networks WHERE is_active = true
    `);

    // If no networks configured, allow all (for initial setup)
    if (!networks || networks.length === 0) {
      return {
        allowed: true,
        message: 'No network restrictions configured',
        clientIp,
      };
    }

    // Clean up client IP (remove IPv6 prefix if present)
    let cleanIp = clientIp;
    if (cleanIp.startsWith('::ffff:')) {
      cleanIp = cleanIp.substring(7);
    }

    // Check if client IP matches any allowed network
    for (const network of networks) {
      if (
        this.isIpInNetwork(cleanIp, network.ip_address, network.subnet_mask)
      ) {
        return {
          allowed: true,
          message: `Connected from allowed network: ${network.name}`,
          clientIp: cleanIp,
        };
      }
    }

    return {
      allowed: false,
      message: `You must be connected to the office network to clock in/out. Your current IP (${cleanIp}) is not in the allowed list.`,
      clientIp: cleanIp,
    };
  }

  // Helper: Check if IP is in network range
  private isIpInNetwork(
    clientIp: string,
    networkIp: string,
    subnetMask: string,
  ): boolean {
    try {
      // For exact IP match (common case)
      if (clientIp === networkIp) {
        return true;
      }

      // For subnet matching
      const clientParts = clientIp.split('.').map(Number);
      const networkParts = networkIp.split('.').map(Number);
      const maskParts = subnetMask.split('.').map(Number);

      if (
        clientParts.length !== 4 ||
        networkParts.length !== 4 ||
        maskParts.length !== 4
      ) {
        return false;
      }

      for (let i = 0; i < 4; i++) {
        if (
          (clientParts[i] & maskParts[i]) !==
          (networkParts[i] & maskParts[i])
        ) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  // Mark users absent for a specific tenant
  async processAbsentUsers(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureAttendanceTables(connection);

    // Get company timezone
    const timezone = await this.getCompanyTimezone(connection);
    const { today, currentMinutes } = this.getCurrentTimeInTimezone(timezone);

    console.log(
      `[Absent] Checking absent users for tenant ${tenantId}, timezone: ${timezone}, today: ${today}`,
    );

    let markedCount = 0;
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMore = true;

    // Get current day of week
    const todayDate = new Date(today + 'T00:00:00.000Z');
    const dayOfWeek = todayDate.getUTCDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayDayName = dayNames[dayOfWeek];

    console.log(`[Absent] Today is ${todayDayName} (dayOfWeek: ${dayOfWeek})`);

    // Get HR settings for global wait time
    const hrSettings = await this.getHRSettings(connection);
    const globalWaitMinutes = hrSettings?.wait_for_absent_minutes;

    while (hasMore) {
      console.log(
        `[Absent] Processing batch: Offset ${offset}, Limit ${BATCH_SIZE}`,
      );

      // Get batch of users with active shift assignments using NEW schema
      const usersWithShifts = await connection.query(
        `
        WITH user_shifts_today AS (
          SELECT 
            usp.user_id,
            u.full_name,
            u.email,
            u.department,
            u.avatar_url,
            usp.start_date,
            usp.day_off_days,
            usp.auto_rotate_dayoff,
            sp.cycle_length_days,
            sp.shifts as pattern_shifts
          FROM user_shift_patterns usp
          JOIN users u ON usp.user_id = u.id
          LEFT JOIN shift_patterns sp ON usp.pattern_id = sp.id
          WHERE u.is_active = true
            AND (usp.end_date IS NULL OR usp.end_date >= $3)
          LIMIT $1 OFFSET $2
        )
        SELECT DISTINCT 
          ust.user_id,
          ust.full_name,
          ust.email,
          ust.department,
          ust.avatar_url,
          s.id as shift_id,
          s.name as shift_name,
          s.start_time,
          s.end_time,
          s.grace_minutes,
          s.color,
          s.wait_for_absent_minutes,
          ust.day_off_days
        FROM user_shifts_today ust
        CROSS JOIN LATERAL (
          SELECT 
            CASE 
              WHEN ust.cycle_length_days IS NOT NULL AND ust.pattern_shifts IS NOT NULL THEN
                -- Calculate which day in the cycle we're on
                (
                  SELECT (ps->>'shift_id')::uuid
                  FROM jsonb_array_elements(ust.pattern_shifts) ps
                  WHERE (ps->>'day_number')::int = 
                    (($3::date - ust.start_date::date) % ust.cycle_length_days) + 1
                    AND (ps->>'is_day_off')::boolean = false
                  LIMIT 1
                )
              ELSE NULL
            END as calculated_shift_id
        ) calc
        LEFT JOIN shifts s ON s.id = calc.calculated_shift_id
        WHERE s.id IS NOT NULL
        ORDER BY ust.user_id
      `,
        [BATCH_SIZE, offset, today],
      );

      console.log(`[Absent] 📊 SQL Query returned ${usersWithShifts ? usersWithShifts.length : 0} users`);

      if (!usersWithShifts || usersWithShifts.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`[Absent] Found ${usersWithShifts.length} users with shifts in this batch`);

      for (const user of usersWithShifts) {
        console.log(`[Absent] 🔍 Checking user: ${user.full_name} (ID: ${user.user_id}), Shift: ${user.shift_name}, Start: ${user.start_time}, End: ${user.end_time}`);

        // Check if today is a day off for this user
        const daysOff = user.days_off || [];
        console.log(`[Absent]   Days off: ${JSON.stringify(daysOff)}, Today: ${todayDayName}`);

        if (daysOff.includes(todayDayName)) {
          console.log(`[Absent]   ❌ SKIPPED: ${user.full_name} - Today (${todayDayName}) is a day off`);
          continue;
        }

        // Check if user already has attendance record for today
        const existingRecord = await connection.query(
          `
          SELECT id, status FROM attendance_records 
          WHERE user_id = $1 AND date = $2
        `,
          [user.user_id, today],
        );

        // Skip if user already clocked in
        if (existingRecord && existingRecord.length > 0) {
          console.log(`[Absent]   ❌ SKIPPED: ${user.full_name} - Already has record (${existingRecord[0].status})`);
          continue;
        }

        // Check if shift has ended (shift end time + grace period has passed)
        if (user.end_time && user.start_time) {
          let cutoffMinutes = 0;
          let shouldUseWaitLogic = false;

          // Determine effective wait time
          // Priority: Shift Override -> Global Setting -> Default (End of Shift)
          let effectiveWait = user.wait_for_absent_minutes; // shift override
          if (effectiveWait === null || effectiveWait === undefined) {
            effectiveWait = globalWaitMinutes; // global setting
          }


          if (effectiveWait !== null && effectiveWait !== undefined && effectiveWait > 0) {
            // Option 1: Mark absent after X minutes from START
            const [startHour, startMin] = user.start_time
              .split(':')
              .map(Number);
            cutoffMinutes = startHour * 60 + startMin + effectiveWait;
            shouldUseWaitLogic = true;
          } else {
            // Option 2 (Default): Mark absent after END + GRACE
            const [endHour, endMin] = user.end_time.split(':').map(Number);
            cutoffMinutes = endHour * 60 + endMin + (user.grace_minutes || 0);
          }

          // If current time has passed cutoff, mark as absent
          if (currentMinutes > cutoffMinutes) {
            const reason = shouldUseWaitLogic
              ? `Automatically marked absent - ${effectiveWait} min passed since shift start`
              : `Automatically marked absent - shift ended`;

            console.log(
              `[Absent] 🚨 ${user.full_name}: Cutoff ${Math.floor(cutoffMinutes / 60)}:${(cutoffMinutes % 60).toString().padStart(2, '0')} passed (Current: ${Math.floor(currentMinutes / 60)}:${(currentMinutes % 60).toString().padStart(2, '0')}) - MARKING ABSENT`,
            );
            try {
              const result = await connection.query(
                `
                INSERT INTO attendance_records 
                  (user_id, date, shift_id, scheduled_in, scheduled_out, status, remarks)
                VALUES ($1, $2, $3, $4, $5, 'Absent', $6)
                ON CONFLICT (user_id, date) DO NOTHING
                RETURNING *
              `,
                [
                  user.user_id,
                  today,
                  user.shift_id,
                  user.start_time,
                  user.end_time,
                  reason,
                ],
              );

              if (result && result.length > 0) {
                markedCount++;

                // [NEW] Process Absence Penalty
                try {
                  const systemUserId = '00000000-0000-0000-0000-000000000000'; // System ID
                  await this.absencePenaltyService.createAbsencePenalty(
                    tenantId,
                    user.user_id,
                    new Date(today),
                    systemUserId
                  );
                } catch (e) {
                  console.error(`Failed to create absence penalty for ${user.user_id}: ${e.message}`);
                }

                // Emit WebSocket event
                const enrichedRecord = {
                  ...result[0],
                  full_name: user.full_name,
                  email: user.email,
                  department: user.department,
                  avatar_url: user.avatar_url,
                  shift_name: user.shift_name,
                  shift_color: user.color,
                };

                this.attendanceGateway.emitAttendanceUpdate(
                  tenantId,
                  enrichedRecord,
                );
                console.log(
                  `[Absent] ✅ Marked user ${user.user_id} (${user.full_name}) as absent`,
                );
              }
            } catch (error) {
              console.error(
                `[Absent] ❌ Failed to mark user ${user.user_id} as absent:`,
                error,
              );
            }
          } else {
            // console.log(`[Absent] ⏳ ${user.full_name}: Cutoff ${Math.floor(cutoffMinutes / 60)}:${(cutoffMinutes % 60).toString().padStart(2, '0')} not yet reached (Current: ${Math.floor(currentMinutes / 60)}:${(currentMinutes % 60).toString().padStart(2, '0')})`);
          }
        }
      }

      // Move to next batch
      offset += BATCH_SIZE;

      // Optional: Small delay to prevent complete CPU hogging
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log(
      `[Absent] Marked ${markedCount} users as absent for tenant ${tenantId}`,
    );
    return { markedAbsent: markedCount };
  }

  // Audit Log Helper
  private async logToTenantAudit(
    tenantId: string,
    userId: string,
    action: string,
    targetId: string,
    details: any,
  ) {
    try {
      console.error(`[Audit] Logging action: ${action} by user: ${userId}`);
      const connection = await this.databaseService.getTenantConnectionById(tenantId);
      await this.ensureAuditTable(connection);
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, target_id, details) VALUES ($1, $2, $3, $4)`,
        [userId, action, targetId, details],
      );
      console.error(`[Audit] Successfully logged action: ${action}`);
    } catch (error) {
      console.error('Failed to log audit:', error);
    }
  }
}
