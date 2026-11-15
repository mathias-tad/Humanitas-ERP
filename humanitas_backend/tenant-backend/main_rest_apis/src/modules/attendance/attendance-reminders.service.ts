import {
  Injectable,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  getCompanyTimezone,
  getCurrentTimeInTimezone,
} from './attendance.helpers';

/** Missed clock-in alarms, shift reminders and midnight auto-close jobs. */
@Injectable()
export class AttendanceRemindersService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) { }


  async dismissMissedClockInAlarm(tenantId: string, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const timezone = await getCompanyTimezone(connection);
    const { today } = getCurrentTimeInTimezone(timezone);

    await connection.query(`
      INSERT INTO attendance_alarm_dismissals (user_id, date, dismissed_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id, date) DO UPDATE SET dismissed_at = NOW()
    `, [userId, today]);

    return { success: true, message: 'Alarm silenced for today' };
  }


  // ============ AUTOMATED CRON WORKERS & REMINDERS ============
  async checkMissedClockInAlarms(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const timezone = await getCompanyTimezone(connection);
    const { today, currentMinutes } = getCurrentTimeInTimezone(timezone);

    // Find users with shifts starting today whose start_time <= current time <= start_time + grace_minutes
    const usersWithShift = await connection.query(`
      SELECT DISTINCT u.id as user_id, u.full_name, sh.start_time, COALESCE(sh.grace_minutes, 15) as grace_minutes
      FROM users u
      LEFT JOIN schedules s ON u.id = s.user_id AND s.date = $1
      LEFT JOIN shifts sh ON s.shift_id = sh.id
      WHERE u.is_active = true 
        AND sh.start_time IS NOT NULL
        AND u.id NOT IN (SELECT user_id FROM attendance_alarm_dismissals WHERE date = $1)
        AND u.id NOT IN (SELECT user_id FROM attendance_records WHERE date = $1 AND actual_in IS NOT NULL)
    `, [today]);

    for (const u of usersWithShift) {
      const [sh, sm] = u.start_time.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const graceEndMin = startMin + u.grace_minutes;

      if (currentMinutes >= startMin && currentMinutes <= graceEndMin) {
        await this.notificationsService.createNotification(tenantId, u.user_id, {
          type: 'attendance_missed_clock_in_alarm',
          title: '⏰ URGENT: Shift Started - Clock In Required',
          message: `Your shift started at ${u.start_time.substring(0, 5)}. Please punch in immediately before grace ends at ${Math.floor(graceEndMin/60).toString().padStart(2, '0')}:${(graceEndMin%60).toString().padStart(2, '0')}.`,
          priority: 'urgent',
          deep_link: '/attendance/clock-in',
        }).catch(e => console.warn('[Attendance] Failed to send alarm:', e));
      }
    }
  }


  async checkPreShiftEndReminders(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const timezone = await getCompanyTimezone(connection);
    const { today, currentMinutes } = getCurrentTimeInTimezone(timezone);

    // Find active clocked-in sessions
    const activeSessions = await connection.query(`
      SELECT ar.id, ar.user_id, COALESCE(ar.scheduled_out, sh.end_time) as scheduled_out
      FROM attendance_records ar
      LEFT JOIN shifts sh ON ar.shift_id = sh.id
      WHERE ar.date = $1 AND ar.actual_in IS NOT NULL AND ar.actual_out IS NULL
        AND COALESCE(ar.scheduled_out, sh.end_time) IS NOT NULL
    `, [today]);

    for (const s of activeSessions) {
      const [eh, em] = s.scheduled_out.split(':').map(Number);
      const endMin = eh * 60 + em;
      const diff = endMin - currentMinutes;

      if (diff === 5) {
        await this.notificationsService.createNotification(tenantId, s.user_id, {
          type: 'attendance_clock_out_reminder',
          title: 'Shift Ending in 5 Minutes',
          message: 'Gentle reminder: Your shift ends in 5 minutes. Please remember to clock out before leaving.',
          priority: 'medium',
          deep_link: '/attendance',
        }).catch(e => console.warn('[Attendance] Reminder error:', e));
      } else if (diff === 1) {
        await this.notificationsService.createNotification(tenantId, s.user_id, {
          type: 'attendance_clock_out_reminder',
          title: 'Shift Ending in 1 Minute',
          message: 'Your shift ends in 1 minute. Please punch out to finalize your hours.',
          priority: 'high',
          deep_link: '/attendance',
        }).catch(e => console.warn('[Attendance] Reminder error:', e));
      }
    }
  }


  async checkVetShiftReminders(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const timezone = await getCompanyTimezone(connection);
    const { today, currentMinutes } = getCurrentTimeInTimezone(timezone);

    // Check wfm_opportunities of type 'VET'
    const vetClaims = await connection.query(`
      SELECT c.user_id, o.start_time, o.end_time, o.date
      FROM wfm_opportunity_claims c
      JOIN wfm_opportunities o ON c.opportunity_id = o.id
      WHERE o.date = $1 AND o.type = 'VET' AND c.status = 'approved'
    `, [today]).catch(() => []);

    for (const claim of vetClaims) {
      if (!claim.start_time) continue;
      const [sh, sm] = claim.start_time.split(':').map(Number);
      const startMin = sh * 60 + sm;

      if (currentMinutes === startMin) {
        await this.notificationsService.createNotification(tenantId, claim.user_id, {
          type: 'attendance_vet_shift_reminder',
          title: '⚡ VET Overtime Shift Starting',
          message: 'Your regular shift has completed and your scheduled VET shift is starting. Please punch out from your regular shift and clock in for your VET Overtime session.',
          priority: 'high',
          deep_link: '/attendance/clock-in',
        }).catch(e => console.warn('[Attendance] VET reminder error:', e));
      }

      if (claim.end_time) {
        const [eh, em] = claim.end_time.split(':').map(Number);
        const endMin = eh * 60 + em;
        if (endMin - currentMinutes === 5 || endMin - currentMinutes === 1) {
          await this.notificationsService.createNotification(tenantId, claim.user_id, {
            type: 'attendance_vet_shift_reminder',
            title: `VET Overtime Ending in ${endMin - currentMinutes} min`,
            message: 'Please remember to punch out to record and finalize your approved VET overtime hours.',
            priority: 'high',
            deep_link: '/attendance',
          }).catch(e => console.warn('[Attendance] VET reminder error:', e));
        }
      }
    }
  }


  async sendPreMidnightWarning(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const timezone = await getCompanyTimezone(connection);
    const { today } = getCurrentTimeInTimezone(timezone);

    const openDayShifts = await connection.query(`
      SELECT ar.id, ar.user_id, u.full_name, u.department
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      WHERE ar.date = $1 AND ar.actual_in IS NOT NULL AND ar.actual_out IS NULL AND ar.is_overnight = false
    `, [today]);

    if (!openDayShifts || openDayShifts.length === 0) return;

    // 1. Notify Employees
    for (const rec of openDayShifts) {
      await this.notificationsService.createNotification(tenantId, rec.user_id, {
        type: 'attendance_day_close_warning',
        title: '⚠️ Pre-Midnight Attendance Notice',
        message: 'Your attendance session for today is still open and will be automatically closed at midnight with zero overtime. If working Overtime, please punch out or alert your supervisor.',
        priority: 'high',
        deep_link: '/attendance',
      }).catch(e => console.warn('[Attendance] Pre-midnight employee warning failed:', e));
    }

    // 2. Notify Supervisors with Overtime Monitor link
    const supervisors = await connection.query(`
      SELECT id FROM users WHERE role IN ('Administrator', 'Manager') AND is_active = true
    `);
    const names = openDayShifts.map((r: any) => r.full_name).join(', ');

    for (const sup of supervisors) {
      await this.notificationsService.createNotification(tenantId, sup.id, {
        type: 'attendance_day_close_warning',
        title: '📋 Day Close Alert: Open Sessions Pending',
        message: `${openDayShifts.length} employees have unclosed shifts: ${names}. Review on Live OT Monitor before midnight auto-close.`,
        priority: 'high',
        deep_link: '/attendance/overtime-monitor',
      }).catch(e => console.warn('[Attendance] Pre-midnight supervisor warning failed:', e));
    }
  }


  async autoCloseDayShiftsAtMidnight(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const timezone = await getCompanyTimezone(connection);
    const { today } = getCurrentTimeInTimezone(timezone);
    const yesterday = new Date(new Date(today).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await connection.query(`
      UPDATE attendance_records
      SET status = 'Incomplete',
          missed_punch_type = 'missed_out',
          auto_closed_at = NOW(),
          auto_close_reason = 'Midnight auto-close (Zero OT)',
          overtime_hours = 0,
          ot_approved = false,
          updated_at = NOW()
      WHERE date = $1 AND actual_in IS NOT NULL AND actual_out IS NULL AND is_overnight = false
      RETURNING id, user_id, date
    `, [yesterday]);

    for (const rec of result) {
      await this.notificationsService.createNotification(tenantId, rec.user_id, {
        type: 'attendance_day_close_warning',
        title: 'Attendance Day Closed (Missed Clock-Out)',
        message: `Your shift on ${rec.date} was auto-closed at midnight without overtime. You can request punch regularization from your attendance timecard.`,
        priority: 'medium',
        deep_link: '/attendance',
      }).catch(e => console.warn('[Attendance] Auto-close notify failed:', e));
    }
  }


  async autoCloseOvernightShifts(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    const timezone = await getCompanyTimezone(connection);
    const { today } = getCurrentTimeInTimezone(timezone);
    const yesterday = new Date(new Date(today).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await connection.query(`
      UPDATE attendance_records
      SET status = 'Incomplete',
          missed_punch_type = 'missed_out',
          auto_closed_at = NOW(),
          auto_close_reason = 'Overnight morning buffer auto-close (Zero OT)',
          overtime_hours = 0,
          ot_approved = false,
          updated_at = NOW()
      WHERE date = $1 AND actual_in IS NOT NULL AND actual_out IS NULL AND is_overnight = true
      RETURNING id, user_id, date
    `, [yesterday]);

    for (const rec of result) {
      await this.notificationsService.createNotification(tenantId, rec.user_id, {
        type: 'attendance_day_close_warning',
        title: 'Overnight Shift Closed (Missed Clock-Out)',
        message: `Your overnight shift starting on ${rec.date} was closed at the morning buffer. Please submit an attendance correction request if you worked past scheduled hours.`,
        priority: 'medium',
        deep_link: '/attendance',
      }).catch(e => console.warn('[Attendance] Overnight auto-close notify failed:', e));
    }
  }
}
