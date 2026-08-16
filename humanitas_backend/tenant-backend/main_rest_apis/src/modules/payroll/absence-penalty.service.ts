

import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class AbsencePenaltyService {
    private readonly logger = new Logger(AbsencePenaltyService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
    ) { }

    /**
     * Calculate daily salary based on HR settings
     */
    private calculateDailySalary(basicSalary: number, daysInMonthMode: 'FIXED_30' | 'ACTUAL', date: Date): number {
        if (daysInMonthMode === 'FIXED_30') {
            return basicSalary / 30;
        } else {
            // Get actual days in the specific month
            const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            return basicSalary / daysInMonth;
        }
    }

    /**
     * Create an absence penalty for a user
     */
    async createAbsencePenalty(
        tenantId: string,
        userId: string,
        date: Date,
        systemUserId: string // ID of system user/bot creating the penalty
    ): Promise<void> {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        try {
            // 1. Get User Salary & HR Settings
            const userRes = await connection.query(`SELECT basic_salary, full_name, email FROM users WHERE id = $1`, [userId]);
            if (!userRes.length) {
                this.logger.warn(`User ${userId} not found for absence penalty`);
                return;
            }
            const user = userRes[0];
            const basicSalary = Number(user.basic_salary || 0);

            const settingsRes = await connection.query(`SELECT data FROM settings WHERE category = 'hr'`);
            const hrSettings = settingsRes[0]?.data || {};
            const daysInMonthMode = hrSettings.days_in_month_mode || 'FIXED_30';

            // Notification Settings
            const notifEnabled = hrSettings.absent_notification_enabled === true;
            const notifRoles = hrSettings.absent_notification_roles || [];

            // 2. Calculate Penalty Amount
            const penaltyAmount = this.calculateDailySalary(basicSalary, daysInMonthMode, date);

            // 3. Create Penalty Record (Pending Approval)
            const result = await connection.query(
                `INSERT INTO user_penalties (
          user_id, amount, reason, status, penalty_type, month, year, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [
                    userId,
                    penaltyAmount,
                    `Automatic stats: Absent on ${date.toISOString().split('T')[0]}`,
                    'Pending',
                    'Absence',
                    date.getMonth() + 1,
                    date.getFullYear(),
                    systemUserId
                ]
            );
            const penaltyId = result[0]?.id;

            // 4. Update Absence Summary
            await this.updateAbsenceSummary(connection, userId, date);

            this.logger.log(`Created absence penalty for user ${userId} on ${date.toISOString()}`);

            // 5. Send Notifications (if enabled)
            if (notifEnabled) {
                const dateStr = date.toISOString().split('T')[0];

                // A. Notify the Absent User
                try {
                    const userNotif = await this.notificationsService.createNotification(
                        tenantId,
                        userId,
                        {
                            type: 'absence_penalty',
                            referenceId: penaltyId || userId,
                            title: 'Absence Penalty Generated',
                            message: `You have been marked absent for ${dateStr}. A penalty has been generated.`
                        }
                    );
                    this.notificationsGateway.pushToUser(tenantId, userId, userNotif);
                } catch (e) {
                    this.logger.error(`Failed to notify absent user ${userId}: ${e.message}`);
                }

                // B. Notify Selected Roles
                if (notifRoles.length > 0) {
                    try {
                        // Find users with these roles (Enum string OR UUID match)
                        const roleUsers = await connection.query(
                            `SELECT id FROM users WHERE (role = ANY($1) OR role_id::text = ANY($1)) AND is_active = true`,
                            [notifRoles]
                        );

                        if (roleUsers.length > 0) {
                            for (const roleUser of roleUsers) {
                                // Don't notify the absent user again if they are also an admin (edge case)
                                if (roleUser.id === userId) continue;

                                await this.notificationsService.createNotification(
                                    tenantId,
                                    roleUser.id,
                                    {
                                        type: 'absence_penalty_alert',
                                        referenceId: penaltyId || userId,
                                        title: 'Employee Marked Absent',
                                        message: `${user.full_name} has been marked absent for ${dateStr}.`
                                    }
                                ).then(notif => {
                                    this.notificationsGateway.pushToUser(tenantId, roleUser.id, notif);
                                });
                            }
                        }
                    } catch (e) {
                        this.logger.error(`Failed to notify roles for absence: ${e.message}`);
                    }
                }
            }

        } catch (error) {
            this.logger.error(`Failed to create absence penalty for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update or create absence summary stats
     */
    private async updateAbsenceSummary(connection: any, userId: string, date: Date) {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1)); // Adjust to Monday

        // Check previous consecutive absences
        const prevDate = new Date(date);
        prevDate.setDate(date.getDate() - 1);

        // Simple logic: This should ideally check the DB for the *actual* previous record to be robust,
        // but for now we increment based on current state or re-calculate.
        // Better: Re-calculate consecutive from attendance/penalties to be safe? 
        // Optimization: Just increment 'consecutive' if yesterday was absent.

        // Let's use an UPSERT approach
        await connection.query(`
      INSERT INTO absence_summary (
        user_id, week_start_date, month, year, 
        weekly_absent_count, monthly_absent_count, consecutive_absent_count, last_absent_date
      ) VALUES ($1, $2, $3, $4, 1, 1, 1, $5)
      ON CONFLICT (user_id, week_start_date) 
      DO UPDATE SET
        weekly_absent_count = absence_summary.weekly_absent_count + 1,
        monthly_absent_count = absence_summary.monthly_absent_count + 1,
        last_absent_date = $5,
        updated_at = NOW(),
        -- Logic for consecutive: if last_absent_date was yesterday, increment, else reset to 1
        consecutive_absent_count = CASE 
          WHEN absence_summary.last_absent_date = $5::date - INTERVAL '1 day' THEN absence_summary.consecutive_absent_count + 1
          ELSE 1
        END
    `, [
            userId,
            startOfWeek,
            date.getMonth() + 1,
            date.getFullYear(),
            date
        ]);
    }
}
