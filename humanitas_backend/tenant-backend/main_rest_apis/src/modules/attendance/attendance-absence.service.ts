import {
  Injectable,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AttendanceGateway } from './attendance.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { AbsencePenaltyService } from '../payroll/absence-penalty.service';
import { AbsenceThresholdsDto } from './dto/absence-thresholds.dto';
import {
  getCompanyTimezone,
  getHRSettings,
  getCurrentTimeInTimezone,
} from './attendance.helpers';

/** Absent-user processing, batch status updates and absence thresholds. */
@Injectable()
export class AttendanceAbsenceService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => AttendanceGateway))
    private readonly attendanceGateway: AttendanceGateway,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    private readonly absencePenaltyService: AbsencePenaltyService,
  ) { }


  // Mark users absent for a specific tenant
  async processAbsentUsers(tenantId: string) {
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Get company timezone
    const timezone = await getCompanyTimezone(connection);
    const { today, currentMinutes } = getCurrentTimeInTimezone(timezone);

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
    const hrSettings = await getHRSettings(connection);
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
                this.checkAbsenceThresholds(tenantId, user.user_id, today).catch(e =>
                  console.error(`Failed to check absence thresholds for ${user.user_id}: ${e.message}`),
                );
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


  // ============ BATCH ATTENDANCE & ABSENCE THRESHOLDS ============

  async batchUpdateAttendanceStatus(
    tenantId: string,
    recordIds: string[],
    status: 'Present' | 'Absent' | 'Excused',
    remarks?: string,
    updatedBy?: string,
  ) {
    if (!recordIds || recordIds.length === 0) {
      return { success: true, count: 0 };
    }
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const records = await connection.query(
      `SELECT id, user_id, date, status FROM attendance_records WHERE id = ANY($1)`,
      [recordIds],
    );

    await connection.query(
      `UPDATE attendance_records
       SET status = $1,
           remarks = COALESCE($2, remarks),
           is_corrected = true,
           corrected_by = $3,
           updated_at = NOW()
       WHERE id = ANY($4)`,
      [status, remarks || null, updatedBy || null, recordIds],
    );

    if (status === 'Absent') {
      const distinctUsers = Array.from(new Set(records.map((r: any) => r.user_id)));
      for (const uId of distinctUsers) {
        const userRec = records.find((r: any) => r.user_id === uId);
        const dateStr = userRec ? new Date(userRec.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        this.checkAbsenceThresholds(tenantId, uId as string, dateStr).catch(e =>
          console.error(`[BatchStatus] Error checking absence threshold for ${uId}:`, e),
        );
      }
    }

    return {
      success: true,
      updated_count: records.length,
      status,
    };
  }


  async getAbsenceThresholds(tenantId: string): Promise<AbsenceThresholdsDto> {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    try {
      const res = await connection.query(`SELECT data FROM settings WHERE category = 'hr'`);
      if (res && res.length > 0 && res[0].data?.absence_alert_rules) {
        return res[0].data.absence_alert_rules;
      }
    } catch (err) {
      console.warn('[Attendance] Failed to load absence alert rules', err);
    }
    return {
      consecutive_threshold: 3,
      monthly_threshold: 5,
      notify_employee: true,
      notify_supervisor: true,
      notify_hr: true,
      is_enabled: true,
    };
  }


  async updateAbsenceThresholds(tenantId: string, dto: AbsenceThresholdsDto): Promise<AbsenceThresholdsDto> {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const existing = await connection.query(`SELECT id, data FROM settings WHERE category = 'hr'`);
    if (existing && existing.length > 0) {
      const currentData = existing[0].data || {};
      currentData.absence_alert_rules = dto;
      await connection.query(
        `UPDATE settings SET data = $1, updated_at = NOW() WHERE category = 'hr'`,
        [JSON.stringify(currentData)],
      );
    } else {
      await connection.query(
        `INSERT INTO settings (category, data, created_at, updated_at) VALUES ('hr', $1, NOW(), NOW())`,
        [JSON.stringify({ absence_alert_rules: dto })],
      );
    }
    return dto;
  }


  async checkAbsenceThresholds(tenantId: string, userId: string, asOfDate: string): Promise<void> {
    const rules = await this.getAbsenceThresholds(tenantId);
    if (!rules?.is_enabled) return;

    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    // 1. Monthly absences count
    const monthStart = asOfDate.substring(0, 7) + '-01';
    const monthlyRes = await connection.query(
      `SELECT COUNT(*)::int as count 
       FROM attendance_records 
       WHERE user_id = $1 
         AND status = 'Absent' 
         AND date >= $2 
         AND date <= $3`,
      [userId, monthStart, asOfDate],
    );
    const monthlyAbsences = Number(monthlyRes[0]?.count || 0);

    // 2. Consecutive absences leading up to asOfDate
    const recentRecords = await connection.query(
      `SELECT date, status 
       FROM attendance_records 
       WHERE user_id = $1 
         AND date <= $2 
       ORDER BY date DESC 
       LIMIT 30`,
      [userId, asOfDate],
    );

    let consecutiveAbsences = 0;
    for (const rec of recentRecords) {
      if (rec.status === 'Absent') {
        consecutiveAbsences++;
      } else {
        break;
      }
    }

    const consecutiveThreshold = rules.consecutive_threshold || 3;
    const monthlyThreshold = rules.monthly_threshold || 5;

    let alertReason: string | null = null;
    if (consecutiveAbsences >= consecutiveThreshold) {
      alertReason = `${consecutiveAbsences} consecutive unauthorized absences`;
    } else if (monthlyAbsences >= monthlyThreshold) {
      alertReason = `${monthlyAbsences} unauthorized absences this month (threshold: ${monthlyThreshold})`;
    }

    if (alertReason) {
      // Check if already notified today
      const existingNotification = await connection.query(
        `SELECT id FROM notifications 
         WHERE user_id = $1 
           AND type = 'absence_threshold_alert' 
           AND created_at >= CURRENT_DATE`,
        [userId],
      );
      if (existingNotification.length === 0) {
        const userRes = await connection.query(
          `SELECT u.full_name, u.email, u.supervisor_id, u.department, s.full_name as supervisor_name
           FROM users u
           LEFT JOIN users s ON u.supervisor_id = s.id
           WHERE u.id = $1`,
          [userId],
        );
        const user = userRes[0];
        const userName = user?.full_name || 'Employee';

        // 1. Notify Employee
        if (rules.notify_employee) {
          await this.notificationsService.createNotification(tenantId, userId, {
            type: 'absence_threshold_alert',
            title: 'Attendance Alert: Absence Limit Reached',
            message: `You have reached ${alertReason}. Please contact your supervisor or HR immediately.`,
            priority: 'urgent',
            deep_link: '/attendance',
          }).catch(e => console.warn('[Attendance] Failed to notify employee:', e));
        }

        // 2. Notify Supervisor
        if (rules.notify_supervisor && user?.supervisor_id) {
          await this.notificationsService.createNotification(tenantId, user.supervisor_id, {
            type: 'absence_threshold_alert',
            title: `Absence Limit Alert: ${userName}`,
            message: `${userName} has recorded ${alertReason}. Review or intervention may be required.`,
            priority: 'urgent',
            deep_link: `/attendance?userId=${userId}`,
          }).catch(e => console.warn('[Attendance] Failed to notify supervisor:', e));
        }

        // 3. Notify HR Admins
        if (rules.notify_hr) {
          const hrAdmins = await connection.query(
            `SELECT u.id FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE r.name IN ('Administrator', 'HR Manager') OR r.permissions @> '["manage_attendance"]'::jsonb
             LIMIT 5`,
          );
          for (const admin of hrAdmins) {
            if (admin.id !== user?.supervisor_id) {
              await this.notificationsService.createNotification(tenantId, admin.id, {
                type: 'absence_threshold_alert',
                title: `Absence Threshold Alert: ${userName}`,
                message: `${userName} (${user?.department || 'Staff'}) has exceeded absence limits: ${alertReason}.`,
                priority: 'urgent',
                deep_link: `/attendance?userId=${userId}`,
              }).catch(e => console.warn('[Attendance] Failed to notify HR admin:', e));
            }
          }
        }
      }
    }
  }
}
