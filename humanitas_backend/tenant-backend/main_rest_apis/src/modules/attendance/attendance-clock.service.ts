import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AttendanceGateway } from './attendance.gateway';
import { SettingsService } from '../settings/settings.service';
import { HolidaysService } from '../holidays/holidays.service';
import { LateMinuteService } from '../payroll/late-minute.service';
import { AttendanceSchedulingService } from './attendance-scheduling.service';
import { AttendanceDevicesService } from './attendance-devices.service';
import {
  getCompanyTimezone,
  getHRSettings,
  getCurrentTimeInTimezone,
} from './attendance.helpers';

/** Clock-in/out (manual and secure), attendance records, overtime workers and lateness. */
@Injectable()
export class AttendanceClockService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => AttendanceGateway))
    private readonly attendanceGateway: AttendanceGateway,
    private readonly settingsService: SettingsService,
    private readonly holidaysService: HolidaysService,
    private readonly lateMinuteService: LateMinuteService,
    private readonly scheduling: AttendanceSchedulingService,
    private readonly devices: AttendanceDevicesService,
  ) { }


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


  async forceClockOut(tenantId: string, adminId: string, targetUserId: string, reason?: string, grantOvertime: boolean = false) {
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
      ar.clock_method, ar.device_id,
      bd.name as device_name,
      s.name as shift_name, s.color as shift_color,
      corrector.full_name as corrected_by_name
      FROM attendance_records ar
      LEFT JOIN shifts s ON ar.shift_id = s.id
      LEFT JOIN biometric_devices bd ON ar.device_id = bd.id
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
    filters?: {
      date?: string;
      startDate?: string;
      endDate?: string;
      user_id?: string;
      status?: string;
      department?: string;
      branch_id?: string;
      company_id?: string;
    },
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    let query = `
      SELECT ar.*,
      u.full_name, u.email, u.department, u.avatar_url,
      s.name as shift_name, s.color as shift_color,
      bd.name as device_name,
      corrector.full_name as corrected_by_name,
      lms.late_minutes
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      LEFT JOIN shifts s ON ar.shift_id = s.id
      LEFT JOIN biometric_devices bd ON ar.device_id = bd.id
      LEFT JOIN users corrector ON ar.corrected_by = corrector.id
      LEFT JOIN late_minutes_summary lms ON ar.user_id = lms.user_id AND ar.date = lms.date
      WHERE 1 = 1
      `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.startDate && filters?.endDate) {
      query += ` AND ar.date >= $${paramIndex} AND ar.date <= $${paramIndex + 1} `;
      params.push(filters.startDate, filters.endDate);
      paramIndex += 2;
    } else if (filters?.date) {
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

    if (filters?.department) {
      query += ` AND u.department = $${paramIndex} `;
      params.push(filters.department);
      paramIndex++;
    }

    if (filters?.branch_id) {
      query += ` AND (ar.branch_id = $${paramIndex} OR u.branch_id = $${paramIndex}) `;
      params.push(filters.branch_id);
      paramIndex++;
    }

    if (filters?.company_id) {
      query += ` AND (ar.company_id = $${paramIndex} OR u.company_id = $${paramIndex}) `;
      params.push(filters.company_id);
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


  async clockIn(
    tenantId: string,
    userId: string,
    clockMethod: string = 'manual',
    deviceId: string | null = null,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

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
    const timezone = await getCompanyTimezone(connection);
    const { now, today, currentMinutes } =
      getCurrentTimeInTimezone(timezone);

    console.log(
      `[ClockIn] Using timezone: ${timezone}, today: ${today}, currentMinutes: ${currentMinutes} `,
    );

    // Get late tolerance and absent settings from HR settings
    const hrSettings = await getHRSettings(connection);
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
      INSERT INTO attendance_records(
        user_id, date, shift_id, scheduled_in, scheduled_out, actual_in, status, remarks, clock_method, device_id
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT(user_id, date) DO UPDATE SET
        actual_in = $6,
        status = $7,
        remarks = COALESCE($8, attendance_records.remarks),
        clock_method = COALESCE($9, attendance_records.clock_method),
        device_id = COALESCE($10, attendance_records.device_id),
        updated_at = NOW()
      RETURNING *
      `,
      [userId, today, shiftId, scheduledIn, scheduledOut, now, status, remarks, clockMethod, deviceId],
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


  async clockOut(
    tenantId: string,
    userId: string,
    clockMethod?: string,
    deviceId?: string,
  ) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Get company timezone and current time (same as clockIn)
    const timezone = await getCompanyTimezone(connection);
    const { now, today } = getCurrentTimeInTimezone(timezone);

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
        work_hours = $2::interval,
        status = CASE WHEN status = 'Late' THEN 'Late' ELSE $3 END,
        clock_method = COALESCE($5, clock_method),
        device_id = COALESCE($6, device_id),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [now, workInterval, status, attendance.id, clockMethod || null, deviceId || null],
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
    const schedule = await this.scheduling.getUserTodaySchedule(tenantId, userId);

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
    const timezone = await getCompanyTimezone(connection);
    const { currentMinutes: currentTime, today } =
      getCurrentTimeInTimezone(timezone);

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
      const networkCheck = await this.devices.isNetworkAllowed(tenantId, clientIp);
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
    const isValidQR = await this.devices.validateQRCode(tenantId, qrCode);
    if (!isValidQR) {
      throw new BadRequestException(
        'Invalid or expired QR code. Please scan a fresh code.',
      );
    }

    // Validate device
    const isValidDevice = await this.devices.isDeviceRegistered(
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

    // Check allowed attendance methods from HR settings
    const hrSettings = await getHRSettings(connection);
    const allowedMethods = Array.isArray(hrSettings?.allowed_attendance_methods)
      ? hrSettings.allowed_attendance_methods
      : ['biometric', 'qr'];
    if (!allowedMethods.includes('qr') && !allowedMethods.includes('qr_code')) {
      throw new BadRequestException('QR code attendance check-in is disabled by company policy.');
    }

    // Proceed with clock in
    return this.clockIn(tenantId, userId, 'qr_code');
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
      const networkCheck = await this.devices.isNetworkAllowed(tenantId, clientIp);
      if (!networkCheck.allowed) {
        throw new BadRequestException(networkCheck.message);
      }
    }

    // Validate QR code
    const isValidQR = await this.devices.validateQRCode(tenantId, qrCode);
    if (!isValidQR) {
      throw new BadRequestException(
        'Invalid or expired QR code. Please scan a fresh code.',
      );
    }

    // Validate device
    const isValidDevice = await this.devices.isDeviceRegistered(
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

    // Check allowed attendance methods from HR settings
    const hrSettings = await getHRSettings(connection);
    const allowedMethods = Array.isArray(hrSettings?.allowed_attendance_methods)
      ? hrSettings.allowed_attendance_methods
      : ['biometric', 'qr'];
    if (!allowedMethods.includes('qr') && !allowedMethods.includes('qr_code')) {
      throw new BadRequestException('QR code attendance check-out is disabled by company policy.');
    }

    // Proceed with clock out
    return this.clockOut(tenantId, userId, 'qr_code');
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
}
