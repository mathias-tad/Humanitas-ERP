import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OvertimeService } from './overtime.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class OvertimeScheduler {
    private readonly logger = new Logger(OvertimeScheduler.name);

    constructor(
        private readonly overtimeService: OvertimeService,
        private readonly databaseService: DatabaseService,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async checkAndTriggerOvertime() {
        if (process.env.ENABLE_CRON !== 'true') return;

        this.logger.log('[OT Scheduler] 📅 Running daily overtime check...');

        try {
            const tenants = await this.databaseService.getAllTenants();
            if (!tenants.length) return;

            const today = new Date();
            const currentDay = today.getDate(); // 1-31

            for (const tenant of tenants) {
                try {
                    // Get Payload Run Day
                    const connection = await this.databaseService.getTenantConnectionById(tenant.id);
                    const settingsRes = await connection.query("SELECT data FROM settings WHERE category = 'payroll'");
                    const settings = settingsRes.rows[0]?.data || {};
                    const runDay = Number(settings.payroll_run_day || 25);

                    // Logic: Trigger 2 days before Run Day
                    const cutOffDay = runDay - 2;
                    // Handle wrap around if needed (e.g. RunDay=1 -> CutOff=-1?) 
                    // Assuming RunDay >= 3 for simplicity or simple match.
                    // If RunDay is 1, CutOffDay would be last day of prev month in real logic,
                    // but here we check 'getDate()'.
                    // If currentDay matches cutOffDay, we trigger.
                    // If cutOffDay < 1, we need to check if currentDay is '2 days before 1st of next month'.
                    // This is complex. Let's simplify: only valid if runDay > 2.

                    if (runDay > 2 && currentDay === cutOffDay) {
                        this.logger.log(`[OT Scheduler] Triggering auto-calc for Tenant ${tenant.slug} (RunDay: ${runDay}, Today: ${currentDay})`);

                        // Calculate Period:
                        // EndDate = Today (CutOff Date)
                        // StartDate = (RunDay - 2) of Prev Month + 1 Day

                        const endDate = new Date(today);
                        const startDate = new Date(today);
                        startDate.setMonth(startDate.getMonth() - 1);
                        startDate.setDate(startDate.getDate() + 1);

                        // Format YYYY-MM-DD
                        const endStr = endDate.toISOString().split('T')[0];
                        const startStr = startDate.toISOString().split('T')[0];

                        await this.overtimeService.triggerPeriodCalculation(
                            tenant.id,
                            undefined,
                            undefined,
                            startStr,
                            endStr
                        );
                    }
                } catch (tError) {
                    this.logger.error(`[OT Scheduler] Failed for tenant ${tenant.slug}: ${tError}`);
                }
            }
        } catch (error) {
            this.logger.error('[OT Scheduler] Error in scheduler:', error);
        }
    }
}
