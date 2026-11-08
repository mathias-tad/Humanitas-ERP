import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AttendanceService } from './attendance.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AttendanceScheduler {
    private readonly logger = new Logger(AttendanceScheduler.name);

    constructor(
        private readonly attendanceService: AttendanceService,
        private readonly databaseService: DatabaseService,
    ) { }

    // Cron job to mark users absent when shift ends without clock-in
    // Runs every 5 minutes
    @Cron(CronExpression.EVERY_5_MINUTES)
    async markAbsentUsers() {
        if (process.env.ENABLE_CRON !== 'true') return;
        try {
            const tenants = await this.databaseService.getAllTenants();
            if (!tenants || tenants.length === 0) return;

            for (const tenant of tenants) {
                try {
                    await this.attendanceService.processAbsentUsers(tenant.id);
                } catch (e: any) {
                    this.logger.error(`[Cron] Absent users check failed for ${tenant.slug}: ${e.message}`);
                }
            }
        } catch (error: any) {
            this.logger.error(`[Cron] Error in absent user scheduler: ${error.message}`);
        }
    }

    // Cron job to trigger urgent missed clock-in ringing alarm during grace period
    // Runs every minute
    @Cron(CronExpression.EVERY_MINUTE)
    async checkMissedClockInAlarms() {
        if (process.env.ENABLE_CRON !== 'true') return;
        try {
            const tenants = await this.databaseService.getAllTenants();
            if (!tenants) return;
            for (const tenant of tenants) {
                try {
                    await this.attendanceService.checkMissedClockInAlarms(tenant.id);
                } catch (e: any) {
                    this.logger.error(`[Cron] Missed clock-in alarm failed for ${tenant.slug}: ${e.message}`);
                }
            }
        } catch (error: any) {
            this.logger.error(`[Cron] Error in missed clock-in alarm scheduler: ${error.message}`);
        }
    }

    // Cron job for 5-minute and 1-minute pre-shift-end clock-out reminders
    // Runs every minute
    @Cron(CronExpression.EVERY_MINUTE)
    async checkPreShiftEndReminders() {
        if (process.env.ENABLE_CRON !== 'true') return;
        try {
            const tenants = await this.databaseService.getAllTenants();
            if (!tenants) return;
            for (const tenant of tenants) {
                try {
                    await this.attendanceService.checkPreShiftEndReminders(tenant.id);
                    await this.attendanceService.checkVetShiftReminders(tenant.id);
                } catch (e: any) {
                    this.logger.error(`[Cron] Pre-shift-end reminder failed for ${tenant.slug}: ${e.message}`);
                }
            }
        } catch (error: any) {
            this.logger.error(`[Cron] Error in pre-shift-end reminder scheduler: ${error.message}`);
        }
    }

    // Cron job for 23:15 pre-midnight warning to employees & managers
    @Cron('15 23 * * *')
    async sendPreMidnightWarning() {
        if (process.env.ENABLE_CRON !== 'true') return;
        this.logger.log('[Cron] Running 23:15 pre-midnight attendance warning...');
        try {
            const tenants = await this.databaseService.getAllTenants();
            if (!tenants) return;
            for (const tenant of tenants) {
                try {
                    await this.attendanceService.sendPreMidnightWarning(tenant.id);
                } catch (e: any) {
                    this.logger.error(`[Cron] Pre-midnight warning failed for ${tenant.slug}: ${e.message}`);
                }
            }
        } catch (error: any) {
            this.logger.error(`[Cron] Error in pre-midnight warning scheduler: ${error.message}`);
        }
    }

    // Cron job for 00:00 midnight auto-close of day shifts (Zero OT)
    @Cron('0 0 * * *')
    async autoCloseDayShiftsAtMidnight() {
        if (process.env.ENABLE_CRON !== 'true') return;
        this.logger.log('[Cron] Running midnight auto-close for day shifts...');
        try {
            const tenants = await this.databaseService.getAllTenants();
            if (!tenants) return;
            for (const tenant of tenants) {
                try {
                    await this.attendanceService.autoCloseDayShiftsAtMidnight(tenant.id);
                } catch (e: any) {
                    this.logger.error(`[Cron] Midnight auto-close failed for ${tenant.slug}: ${e.message}`);
                }
            }
        } catch (error: any) {
            this.logger.error(`[Cron] Error in midnight auto-close scheduler: ${error.message}`);
        }
    }

    // Cron job for 06:00 morning buffer auto-close of overnight shifts (Zero OT)
    @Cron('0 6 * * *')
    async autoCloseOvernightShifts() {
        if (process.env.ENABLE_CRON !== 'true') return;
        this.logger.log('[Cron] Running 06:00 morning buffer auto-close for overnight shifts...');
        try {
            const tenants = await this.databaseService.getAllTenants();
            if (!tenants) return;
            for (const tenant of tenants) {
                try {
                    await this.attendanceService.autoCloseOvernightShifts(tenant.id);
                } catch (e: any) {
                    this.logger.error(`[Cron] Overnight auto-close failed for ${tenant.slug}: ${e.message}`);
                }
            }
        } catch (error: any) {
            this.logger.error(`[Cron] Error in overnight auto-close scheduler: ${error.message}`);
        }
    }
}
