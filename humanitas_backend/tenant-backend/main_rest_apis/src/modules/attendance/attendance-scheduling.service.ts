import {
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  getCompanyTimezone,
  getCurrentTimeInTimezone,
  logToTenantAudit,
} from './attendance.helpers';

/** Shifts, schedule patterns, shift/schedule assignments and per-user schedules. */
@Injectable()
export class AttendanceSchedulingService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
  ) { }

  // ============ SHIFTS ============
  async getShifts(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    const result = await connection.query(`
    SELECT * FROM shifts WHERE is_active = true ORDER BY name
      `);
    return result || [];
  }


  async createShift(tenantId: string, data: any, userId?: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

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
      await logToTenantAudit(this.databaseService, tenantId, userId, 'CREATE_SHIFT', shift.id, data);
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
      await logToTenantAudit(this.databaseService, tenantId, userId, 'UPDATE_SHIFT', shiftId, data);
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
      await logToTenantAudit(this.databaseService, tenantId, userId, 'DELETE_SHIFT', shiftId, { deleted_at: new Date() });
    }

    return { message: 'Shift deleted successfully' };
  }


  // ============ SCHEDULE PATTERNS ============
  async getSchedulePatterns(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

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
      await logToTenantAudit(this.databaseService, tenantId, userId, 'CREATE_PATTERN', pattern.id, data);
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
      await logToTenantAudit(this.databaseService, tenantId, userId, 'UPDATE_PATTERN', patternId, data);
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
      await logToTenantAudit(this.databaseService, tenantId, userId, 'DELETE_PATTERN', patternId, { deleted_at: new Date() });
    }

    return { message: 'Schedule pattern deleted successfully' };
  }



  // ============ SHIFT ASSIGNMENTS ============
  async getShiftAssignments(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

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
      await logToTenantAudit(this.databaseService, 
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
      await logToTenantAudit(this.databaseService, tenantId, userId, 'REMOVE_ASSIGNMENT', targetUserId, { target_user: targetUserId });
    }

    return { message: 'Assignment removed successfully' };
  }


  // ============ ROSTER / SCHEDULE MANAGEMENT (Moved/Shared from SchedulingService due to 404s) ============

  // Assign/Override specific day
  async assignSchedule(tenantId: string, data: any, userId?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

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
      await logToTenantAudit(this.databaseService, 
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
    const params: unknown[] = [];

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


  // Get users without shift assignments (for assignment dropdown)
  async getUnassignedUsers(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

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


  // Get user's schedule for today
  async getUserTodaySchedule(tenantId: string, userId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Get company timezone
    const timezone = await getCompanyTimezone(connection);
    const { dayAbbrev: todayAbbrev } = this.getDayOfWeekInTimezone(timezone);
    const { today } = getCurrentTimeInTimezone(timezone);

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
}
