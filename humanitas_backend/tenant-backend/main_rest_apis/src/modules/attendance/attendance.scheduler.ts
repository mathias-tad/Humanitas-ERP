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
        if (process.env.ENABLE_CRON !== 'true') {
            return;
        }
        this.logger.log('[Cron] ⏰ Running absent user check...');

        try {
            // Get all active tenants
            const tenants = await this.databaseService.getAllTenants();

            if (!tenants || tenants.length === 0) {
                this.logger.log('[Cron] No tenants found');
                return;
            }

            this.logger.log(
                `[Cron] Checking ${tenants.length} tenants for absent users...`,
            );

            // Process each tenant
            for (const tenant of tenants) {
                try {
                    const result = await this.attendanceService.processAbsentUsers(
                        tenant.id,
                    );
                    if (result.markedAbsent > 0) {
                        this.logger.log(
                            `[Cron] Marked ${result.markedAbsent} users absent for tenant ${tenant.slug}`,
                        );
                    }
                } catch (tenantError: any) {
                    this.logger.error(
                        `[Cron] Error processing tenant ${tenant.slug}: ${tenantError.message}`,
                    );
                }
            }
        } catch (error: any) {
            this.logger.error(
                `[Cron] Error in absent user scheduler: ${error.message}`,
                error.stack,
            );
        }
    }
}
