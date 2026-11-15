import type { DataSource } from 'typeorm';
import {
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AttendanceGateway } from './attendance.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import {
  getCompanyTimezone,
  getCurrentTimeInTimezone,
} from './attendance.helpers';

/** Biometric punches (live, batch and offline import) and reconciliation overtime. */
@Injectable()
export class AttendanceBiometricService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => AttendanceGateway))
    private readonly attendanceGateway: AttendanceGateway,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) { }


  // ============ BIOMETRIC PUNCH INTELLIGENCE & OFFLINE RECONCILIATION ENGINE ============
  async processBiometricPunch(
    tenantId: string,
    punchData: {
      userId: string;
      pin: string;
      deviceId?: string;
      deviceSerialNumber?: string;
      punchTime: Date;
      verifyMethod?: string;
      rawPayload?: string;
      companyId?: string;
      branchId?: string;
      isOfflineSync?: boolean;
    },
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const {
      userId,
      pin,
      deviceId,
      deviceSerialNumber,
      punchTime,
      verifyMethod = 'biometric',
      rawPayload,
      companyId,
      branchId,
      isOfflineSync = false,
    } = punchData;

    // 1. Natural Key Idempotency: skip if exact punch already recorded
    const existingPunch = await connection.query(`
      SELECT id, status FROM biometric_punch_logs
      WHERE COALESCE(device_serial_number, 'MANUAL') = COALESCE($1, 'MANUAL')
        AND pin = $2
        AND punch_time = $3
      LIMIT 1
    `, [deviceSerialNumber, pin, punchTime]);

    if (existingPunch && existingPunch.length > 0) {
      return {
        status: 'duplicate_skipped',
        logId: existingPunch[0].id,
        message: 'Punch already logged in system.',
      };
    }

    // 2. Insert into biometric_punch_logs (Tier 1 Raw Ledger)
    const logInsert = await connection.query(`
      INSERT INTO biometric_punch_logs (
        tenant_id, company_id, branch_id, device_id, device_serial_number,
        pin, user_id, punch_time, punch_type, verify_method, status, raw_payload, is_offline_sync
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'auto', $9, 'pending', $10, $11)
      RETURNING id
    `, [tenantId, companyId, branchId, deviceId, deviceSerialNumber, pin, userId, punchTime, verifyMethod, rawPayload, isOfflineSync]);
    const logId = logInsert[0].id;

    // 3. 5-Minute Auto-Debounce Check (based on hardware punch_time)
    const previousPunches = await connection.query(`
      SELECT id, punch_time FROM biometric_punch_logs
      WHERE user_id = $1 AND id != $2 AND status = 'processed'
      ORDER BY punch_time DESC LIMIT 1
    `, [userId, logId]);

    if (previousPunches && previousPunches.length > 0) {
      const prevPunchTime = new Date(previousPunches[0].punch_time).getTime();
      const currentPunchTime = new Date(punchTime).getTime();
      const diffMs = currentPunchTime - prevPunchTime;

      if (diffMs >= 0 && diffMs < 5 * 60 * 1000) { // < 5 minutes
        await connection.query(`
          UPDATE biometric_punch_logs SET status = 'debounced_duplicate' WHERE id = $1
        `, [logId]);
        return {
          status: 'debounced',
          logId,
          message: 'Ignored duplicate punch within 5-minute cooldown window.',
        };
      }
    }

    // 4. Timezone and Date calculations
    const timezone = await getCompanyTimezone(connection);
    const { today: serverToday } = getCurrentTimeInTimezone(timezone);
    const punchDateObj = new Date(punchTime);

    // Precise date in tenant timezone (YYYY-MM-DD)
    const punchDateInTz = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(punchDateObj);

    const punchHoursInTz = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).format(punchDateObj);
    const [ph, pm] = punchHoursInTz.split(':').map(Number);
    const punchTimeMinutes = (ph || 0) * 60 + (pm || 0);

    const isHistoricalPunch = punchDateInTz < serverToday;

    // =========================================================================
    // BRANCH A: HISTORICAL RECONCILIATION ENGINE (Past Day Offline Punch Sync)
    // =========================================================================
    if (isHistoricalPunch) {
      const histRecord = await connection.query(`
        SELECT * FROM attendance_records WHERE user_id = $1 AND date = $2
      `, [userId, punchDateInTz]);

      const histShift = await this.getAssignedShiftForDate(connection, userId, punchDateInTz);

      if (histRecord && histRecord.length > 0) {
        const rec = histRecord[0];

        // Subcase A1: Record exists with clock-in, but missing/auto-closed clock-out
        if (rec.actual_in && (!rec.actual_out || rec.auto_closed_at || rec.missed_punch_type === 'missed_out' || rec.status === 'Incomplete')) {
          const actualInTime = new Date(rec.actual_in).getTime();
          const punchMs = new Date(punchTime).getTime();

          if (punchMs > actualInTime) {
            // Check if punch exceeded scheduled shift end + 15m grace for overtime review
            let pendingOt = false;
            let pendingOtHours = 0;
            if (rec.scheduled_out || histShift?.end_time) {
              const shiftEndTimeStr = rec.scheduled_out || histShift?.end_time;
              const [seh, sem] = shiftEndTimeStr.split(':').map(Number);
              const shiftEndMinutes = seh * 60 + sem;
              if (punchTimeMinutes > shiftEndMinutes + 15) {
                pendingOt = true;
                pendingOtHours = parseFloat(((punchTimeMinutes - shiftEndMinutes) / 60).toFixed(2));
              }
            }

            const result = await connection.query(`
              UPDATE attendance_records
              SET actual_out = $1,
                  work_hours = ($1 - actual_in),
                  status = 'Present',
                  missed_punch_type = 'none',
                  out_punch_log_id = $2,
                  reconciled_from_offline_sync = true,
                  pending_overtime_approval = $3,
                  pending_overtime_hours = $4,
                  updated_at = NOW()
              WHERE id = $5
              RETURNING *
            `, [punchTime, logId, pendingOt, pendingOtHours, rec.id]);

            await connection.query(`
              UPDATE biometric_punch_logs 
              SET status = 'processed', reconciled_record_id = $1, reconciled_at = NOW() 
              WHERE id = $2
            `, [rec.id, logId]);

            if (this.attendanceGateway) {
              this.attendanceGateway.emitClockOut(tenantId, result[0]);
            }
            return {
              status: 'reconciled_clock_out',
              reconciled: true,
              record: result[0],
              message: 'Reconciled historical shift with offline biometric clock-out.',
            };
          }
        }

        // Subcase A2: Record was missing morning clock-in but had exit
        if (!rec.actual_in && rec.actual_out) {
          const actualOutTime = new Date(rec.actual_out).getTime();
          const punchMs = new Date(punchTime).getTime();

          if (punchMs < actualOutTime) {
            const result = await connection.query(`
              UPDATE attendance_records
              SET actual_in = $1,
                  work_hours = (actual_out - $1),
                  status = 'Present',
                  missed_punch_type = 'none',
                  in_punch_log_id = $2,
                  reconciled_from_offline_sync = true,
                  updated_at = NOW()
              WHERE id = $3
              RETURNING *
            `, [punchTime, logId, rec.id]);

            await connection.query(`
              UPDATE biometric_punch_logs 
              SET status = 'processed', reconciled_record_id = $1, reconciled_at = NOW() 
              WHERE id = $2
            `, [rec.id, logId]);

            return {
              status: 'reconciled_clock_in',
              reconciled: true,
              record: result[0],
              message: 'Reconciled historical shift with offline biometric clock-in.',
            };
          }
        }

        // Subcase A3: Record was marked Absent during outage
        if (rec.status === 'Absent' && !rec.actual_in && !rec.actual_out) {
          const result = await connection.query(`
            UPDATE attendance_records
            SET actual_in = $1,
                status = 'Present',
                missed_punch_type = 'none',
                in_punch_log_id = $2,
                reconciled_from_offline_sync = true,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
          `, [punchTime, logId, rec.id]);

          await connection.query(`
            UPDATE biometric_punch_logs 
            SET status = 'processed', reconciled_record_id = $1, reconciled_at = NOW() 
            WHERE id = $2
          `, [rec.id, logId]);

          return {
            status: 'reconciled_absent_to_present',
            reconciled: true,
            record: result[0],
            message: 'Reconciled absent day to present with offline clock-in.',
          };
        }
      } else {
        // Subcase A4: No record at all existed for that past date -> Create reconstructed record
        const result = await connection.query(`
          INSERT INTO attendance_records (
            user_id, date, shift_id, scheduled_in, scheduled_out, actual_in,
            status, source, is_overnight, missed_punch_type, in_punch_log_id,
            reconciled_from_offline_sync, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'Present', 'biometric', $7, 'none', $8, true, NOW(), NOW())
          ON CONFLICT (user_id, date) DO UPDATE SET
            actual_in = COALESCE(attendance_records.actual_in, $6),
            status = 'Present',
            reconciled_from_offline_sync = true,
            in_punch_log_id = $8,
            updated_at = NOW()
          RETURNING *
        `, [
          userId,
          punchDateInTz,
          histShift?.id || null,
          histShift?.start_time || null,
          histShift?.end_time || null,
          punchTime,
          histShift?.is_overnight || false,
          logId,
        ]);

        await connection.query(`
          UPDATE biometric_punch_logs 
          SET status = 'processed', reconciled_record_id = $1, reconciled_at = NOW() 
          WHERE id = $2
        `, [result[0].id, logId]);

        return {
          status: 'reconciled_new_historical',
          reconciled: true,
          record: result[0],
          message: 'Created historical attendance record from offline punch.',
        };
      }
    }

    // =========================================================================
    // BRANCH B: ACTIVE / TODAY SHIFT PROCESSING
    // =========================================================================
    const yesterdayDate = new Date(new Date(punchDateInTz).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // STEP B1: Check Yesterday's Overnight Shift
    const yesterdayRecord = await connection.query(`
      SELECT ar.*, s.is_overnight, s.end_time as shift_end_time, s.start_time as shift_start_time
      FROM attendance_records ar
      LEFT JOIN shifts s ON ar.shift_id = s.id
      WHERE ar.user_id = $1 AND ar.date = $2
    `, [userId, yesterdayDate]);

    if (yesterdayRecord && yesterdayRecord.length > 0 && yesterdayRecord[0].actual_in && !yesterdayRecord[0].actual_out) {
      const rec = yesterdayRecord[0];
      const isOvernight = rec.is_overnight || (rec.shift_start_time && rec.shift_end_time && rec.shift_start_time > rec.shift_end_time);

      if (isOvernight) {
        let endMinutes = 2 * 60; // default 02:00
        if (rec.shift_end_time) {
          const [eh, em] = rec.shift_end_time.split(':').map(Number);
          endMinutes = eh * 60 + em;
        }
        const exitWindowMax = Math.min(endMinutes + 240, 10 * 60); // max 10:00 AM
        if (punchTimeMinutes <= exitWindowMax) {
          // CLOCK OUT for Yesterday's Overnight Shift!
          const result = await connection.query(`
            UPDATE attendance_records
            SET actual_out = $1,
                work_hours = ($1 - actual_in),
                status = 'Present',
                is_overnight = true,
                missed_punch_type = 'none',
                out_punch_log_id = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
          `, [punchTime, logId, rec.id]);

          await connection.query(`UPDATE biometric_punch_logs SET status = 'processed' WHERE id = $1`, [logId]);
          if (this.attendanceGateway) {
            this.attendanceGateway.emitClockOut(tenantId, result[0]);
          }
          return { status: 'clock_out', isOvernight: true, record: result[0] };
        }
      }

      // Auto-close yesterday's stale day shift as missed out (OT = 0)
      await connection.query(`
        UPDATE attendance_records
        SET status = 'Incomplete',
            missed_punch_type = 'missed_out',
            auto_closed_at = NOW(),
            auto_close_reason = 'Stale open session auto-closed on next day punch',
            overtime_hours = 0,
            updated_at = NOW()
        WHERE id = $1
      `, [rec.id]);
    }

    // STEP B2: Process for Today
    const todayRecord = await connection.query(`
      SELECT * FROM attendance_records WHERE user_id = $1 AND date = $2
    `, [userId, punchDateInTz]);

    if (todayRecord && todayRecord.length > 0 && todayRecord[0].actual_in && !todayRecord[0].actual_out) {
      // Open session exists for today -> CLOCK OUT
      const rec = todayRecord[0];
      const result = await connection.query(`
        UPDATE attendance_records
        SET actual_out = $1,
            work_hours = ($1 - actual_in),
            status = CASE WHEN status = 'Incomplete' THEN 'Present' ELSE status END,
            missed_punch_type = 'none',
            out_punch_log_id = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [punchTime, logId, rec.id]);

      await connection.query(`UPDATE biometric_punch_logs SET status = 'processed' WHERE id = $1`, [logId]);
      if (this.attendanceGateway) {
        this.attendanceGateway.emitClockOut(tenantId, result[0]);
      }
      return { status: 'clock_out', record: result[0] };
    }

    // No open session for today -> Differentiate Clock In vs Missed Clock-In using Shift Midpoint
    const todayShift = await this.getAssignedShiftForDate(connection, userId, punchDateInTz);
    let isClockIn = true;

    if (todayShift && todayShift.start_time && todayShift.end_time) {
      const [sh, sm] = todayShift.start_time.split(':').map(Number);
      const [eh, em] = todayShift.end_time.split(':').map(Number);
      const startMin = sh * 60 + sm;
      let endMin = eh * 60 + em;
      if (todayShift.is_overnight || endMin < startMin) {
        endMin += 24 * 60;
      }
      const midMin = Math.round(startMin + (endMin - startMin) / 2) % (24 * 60);

      if (!todayShift.is_overnight && punchTimeMinutes > midMin && punchTimeMinutes >= startMin + 120) {
        isClockIn = false;
      }
    }

    if (isClockIn) {
      let status = 'Present';
      if (todayShift && todayShift.start_time) {
        const [sh, sm] = todayShift.start_time.split(':').map(Number);
        const grace = todayShift.grace_minutes || 15;
        if (punchTimeMinutes > (sh * 60 + sm + grace)) {
          status = 'Late';
        }
      }

      const result = await connection.query(`
        INSERT INTO attendance_records (
          user_id, date, shift_id, scheduled_in, scheduled_out, actual_in,
          status, source, is_overnight, missed_punch_type, in_punch_log_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'biometric', $8, 'none', $9, NOW(), NOW())
        ON CONFLICT (user_id, date) DO UPDATE SET
          actual_in = COALESCE(attendance_records.actual_in, $6),
          shift_id = COALESCE(attendance_records.shift_id, $3),
          scheduled_in = COALESCE(attendance_records.scheduled_in, $4),
          scheduled_out = COALESCE(attendance_records.scheduled_out, $5),
          status = $7,
          is_overnight = $8,
          in_punch_log_id = $9,
          updated_at = NOW()
        RETURNING *
      `, [
        userId,
        punchDateInTz,
        todayShift?.id || null,
        todayShift?.start_time || null,
        todayShift?.end_time || null,
        punchTime,
        status,
        todayShift?.is_overnight || false,
        logId,
      ]);

      await connection.query(`UPDATE biometric_punch_logs SET status = 'processed' WHERE id = $1`, [logId]);
      if (this.attendanceGateway) {
        this.attendanceGateway.emitClockIn(tenantId, result[0]);
      }
      return { status: 'clock_in', record: result[0] };
    } else {
      // Missed Morning Clock-In -> Registered as Shift Exit (actual_out) with missed_punch_type = 'missed_in'
      const result = await connection.query(`
        INSERT INTO attendance_records (
          user_id, date, shift_id, scheduled_in, scheduled_out, actual_out,
          status, source, is_overnight, missed_punch_type, out_punch_log_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'Incomplete', 'biometric', $7, 'missed_in', $8, NOW(), NOW())
        ON CONFLICT (user_id, date) DO UPDATE SET
          actual_out = COALESCE(attendance_records.actual_out, $6),
          shift_id = COALESCE(attendance_records.shift_id, $3),
          scheduled_in = COALESCE(attendance_records.scheduled_in, $4),
          scheduled_out = COALESCE(attendance_records.scheduled_out, $5),
          status = 'Incomplete',
          missed_punch_type = 'missed_in',
          out_punch_log_id = $8,
          updated_at = NOW()
        RETURNING *
      `, [
        userId,
        punchDateInTz,
        todayShift?.id || null,
        todayShift?.start_time || null,
        todayShift?.end_time || null,
        punchTime,
        todayShift?.is_overnight || false,
        logId,
      ]);

      await connection.query(`UPDATE biometric_punch_logs SET status = 'processed' WHERE id = $1`, [logId]);
      if (this.attendanceGateway) {
        this.attendanceGateway.emitClockOut(tenantId, result[0]);
      }

      await this.notificationsService.createNotification(tenantId, userId, {
        type: 'attendance_clock_out_reminder',
        title: '⚠️ Missed Clock-In Detected',
        message: 'Your punch was recorded as a shift exit because no arrival punch was found. Please submit an Attendance Regularization Request.',
        priority: 'high',
        deep_link: '/attendance',
      }).catch(e => console.warn('[Attendance] Failed to notify missed check-in:', e));

      return { status: 'missed_in_clock_out', record: result[0] };
    }
  }


  // ============ CHRONOLOGICAL BATCH PUNCH PROCESSING ============
  async processBiometricPunchesBatch(
    tenantId: string,
    punches: Array<{
      userId: string;
      pin: string;
      deviceId?: string;
      deviceSerialNumber?: string;
      punchTime: Date;
      verifyMethod?: string;
      rawPayload?: string;
      companyId?: string;
      branchId?: string;
      isOfflineSync?: boolean;
    }>,
  ) {
    const summary = {
      total: punches.length,
      processed: 0,
      reconciled: 0,
      debounced: 0,
      duplicatesSkipped: 0,
      errors: 0,
    };

    // 1. Group punches per user
    const userGroups = new Map<string, typeof punches>();
    for (const p of punches) {
      if (!userGroups.has(p.userId)) {
        userGroups.set(p.userId, []);
      }
      userGroups.get(p.userId)!.push(p);
    }

    // 2. Sort each user's punches chronologically (punchTime ASC)
    for (const [userId, userPunches] of userGroups.entries()) {
      userPunches.sort((a, b) => new Date(a.punchTime).getTime() - new Date(b.punchTime).getTime());

      for (const punch of userPunches) {
        try {
          const res = await this.processBiometricPunch(tenantId, punch);
          if (res.status === 'debounced') {
            summary.debounced++;
          } else if (res.status === 'duplicate_skipped') {
            summary.duplicatesSkipped++;
          } else if (res.status?.startsWith('reconciled')) {
            summary.reconciled++;
          } else {
            summary.processed++;
          }
        } catch (err: any) {
          console.error(`Batch punch processing error for user ${userId}: ${err.message}`);
          summary.errors++;
        }
      }
    }

    return summary;
  }


  // ============ OFFLINE LOGS IMPORT (USB / CSV / TXT EXPORT) ============
  async importOfflinePunchLogs(
    tenantId: string,
    deviceSerialNumber: string,
    fileContent: string,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    const parsedPunches: any[] = [];

    for (const line of lines) {
      // Support Tab, Comma, or Multi-space delimiters
      let parts = line.split('\t').map(p => p.trim());
      if (parts.length < 2) parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) parts = line.split(/\s{2,}/).map(p => p.trim());
      if (parts.length < 2) continue;

      const pin = parts[0];
      const timeStr = parts[1];
      const punchTime = new Date(timeStr);
      if (isNaN(punchTime.getTime())) continue;

      // Resolve userId by PIN
      const mapped = await connection.query(
        `SELECT user_id FROM device_users WHERE (enrollment_number = $1 OR device_user_id = $1) AND is_active = true LIMIT 1`,
        [pin],
      );
      let userId = mapped?.[0]?.user_id;

      if (!userId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pin);
        const users = await connection.query(
          isUUID
            ? `SELECT id FROM users WHERE id = $1 AND is_active = true LIMIT 1`
            : `SELECT id FROM users WHERE (email = $1 OR phone = $1) AND is_active = true LIMIT 1`,
          [pin],
        );
        userId = users?.[0]?.id;
      }

      if (userId) {
        parsedPunches.push({
          userId,
          pin,
          deviceSerialNumber: deviceSerialNumber || 'OFFLINE_IMPORT',
          punchTime,
          verifyMethod: 'usb_offline_import',
          rawPayload: line,
          isOfflineSync: true,
        });
      }
    }

    return this.processBiometricPunchesBatch(tenantId, parsedPunches);
  }


  // ============ PENDING OVERTIME APPROVALS FROM RECONCILIATION ============
  async getPendingReconciliationOvertime(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    return connection.query(`
      SELECT ar.*, u.first_name, u.last_name, u.email,
             d.name as department_name, s.name as shift_name
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN shifts s ON ar.shift_id = s.id
      WHERE ar.pending_overtime_approval = true
      ORDER BY ar.date DESC, ar.actual_out DESC
    `);
  }


  async decideReconciliationOvertime(
    tenantId: string,
    recordId: string,
    grantOvertime: boolean,
    reviewerId: string,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const rec = await connection.query(`
      SELECT * FROM attendance_records WHERE id = $1
    `, [recordId]);

    if (!rec || rec.length === 0) {
      throw new NotFoundException('Attendance record not found');
    }

    const target = rec[0];
    const otHours = grantOvertime ? (Number(target.pending_overtime_hours) || 0) : 0;

    const result = await connection.query(`
      UPDATE attendance_records
      SET pending_overtime_approval = false,
          overtime_hours = $1,
          ot_approved = $2,
          corrected_by = $3,
          corrected_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [otHours, grantOvertime, reviewerId, recordId]);

    return result[0];
  }


  private async getAssignedShiftForDate(connection: DataSource, userId: string, dateStr: string): Promise<any> {
    // 1. Check direct schedule override
    const override = await connection.query(`
      SELECT s.*, sh.name as shift_name, sh.start_time, sh.end_time, sh.grace_minutes, sh.is_overnight
      FROM schedules s
      LEFT JOIN shifts sh ON s.shift_id = sh.id
      WHERE s.user_id = $1 AND s.date = $2
    `, [userId, dateStr]);

    if (override && override.length > 0 && override[0].shift_id) {
      return override[0];
    }

    // 2. Fallback to rotation assignment
    const assignment = await connection.query(`
      SELECT sa.*, sh.id, sh.name as shift_name, sh.start_time, sh.end_time, sh.grace_minutes, sh.is_overnight
      FROM shift_assignments sa
      JOIN rotation_weeks rw ON sa.pattern_id = rw.pattern_id AND rw.week_number = sa.current_week_in_rotation
      JOIN shifts sh ON rw.shift_id = sh.id
      WHERE sa.user_id = $1
    `, [userId]);

    if (assignment && assignment.length > 0) {
      return assignment[0];
    }

    // 3. Fallback to default active shift
    const defaultShift = await connection.query(`
      SELECT * FROM shifts WHERE is_active = true ORDER BY created_at ASC LIMIT 1
    `);
    return defaultShift && defaultShift.length > 0 ? defaultShift[0] : null;
  }
}
