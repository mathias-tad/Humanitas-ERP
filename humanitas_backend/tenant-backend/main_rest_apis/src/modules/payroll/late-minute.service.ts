
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class LateMinuteService {
    private readonly logger = new Logger(LateMinuteService.name);

    constructor(private readonly databaseService: DatabaseService) { }

    async recordLateArrival(
        tenantSlug: string,
        userId: string,
        date: Date,
        minutesLate: number,
        scheduledIn: string,
        actualIn: string
    ): Promise<void> {
        const connection = await this.databaseService.getTenantConnection(tenantSlug);

        try {
            // 1. Get HR Settings for Penalty Rate
            const settingsRes = await connection.query(`SELECT data FROM settings WHERE category = 'hr'`);
            const hrSettings = settingsRes[0]?.data || {};
            const penaltyPerMinute = Number(hrSettings.late_penalty_per_minute || 0);

            const penaltyAmount = minutesLate * penaltyPerMinute;

            // 2. Create/Update Late Summary for the day
            // Decision: We'll create a user_penalty record if amount > 0.

            if (penaltyAmount > 0) {
                await connection.query(
                    `INSERT INTO user_penalties (
              user_id, amount, reason, status, penalty_type, month, year, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                    [
                        userId,
                        penaltyAmount,
                        `Late Arrival: ${minutesLate} min late (Sch: ${scheduledIn}, Act: ${actualIn})`,
                        'Approved', // Auto-approved
                        'Late', // Late penalties are automatic
                        date.getMonth() + 1,
                        date.getFullYear(),
                        userId // System/User ID
                    ]
                );
            }

            // 3. Update Late Summary Table
            const startOfWeek = new Date(date);
            startOfWeek.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));

            await connection.query(`
        INSERT INTO late_minutes_summary (
          user_id, date, week_start_date, month, year,
          late_minutes, late_penalty_amount,
          weekly_late_minutes, weekly_late_penalty,
          monthly_late_minutes, monthly_late_penalty
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7, $6, $7)
        ON CONFLICT (user_id, date)
        DO UPDATE SET
          late_minutes = EXCLUDED.late_minutes,
          late_penalty_amount = EXCLUDED.late_penalty_amount,
          updated_at = NOW()
      `, [
                userId,
                date,
                startOfWeek,
                date.getMonth() + 1,
                date.getFullYear(),
                minutesLate,
                penaltyAmount
            ]);

            // Update aggregates
            await this.updateAggregates(connection, userId, startOfWeek, date.getMonth() + 1, date.getFullYear());

            this.logger.log(`Recorded ${minutesLate} late minutes for user ${userId}`);

        } catch (error) {
            this.logger.error(`Failed to record late minutes for ${userId}: ${error.message}`);
            throw error;
        }
    }

    private async updateAggregates(connection: any, userId: string, weekStart: Date, month: number, year: number) {
        // Recalculate totals for the week and month

        // Weekly
        await connection.query(`
        WITH weekly_stats AS (
            SELECT SUM(late_minutes) as m, SUM(late_penalty_amount) as p 
            FROM late_minutes_summary 
            WHERE user_id = $1 AND week_start_date = $2
        )
        UPDATE late_minutes_summary 
        SET weekly_late_minutes = (SELECT m FROM weekly_stats),
            weekly_late_penalty = (SELECT p FROM weekly_stats)
        WHERE user_id = $1 AND week_start_date = $2
      `, [userId, weekStart]);

        // Monthly
        await connection.query(`
        WITH monthly_stats AS (
            SELECT SUM(late_minutes) as m, SUM(late_penalty_amount) as p 
            FROM late_minutes_summary 
            WHERE user_id = $1 AND month = $2 AND year = $3
        )
        UPDATE late_minutes_summary 
        SET monthly_late_minutes = (SELECT m FROM monthly_stats),
            monthly_late_penalty = (SELECT p FROM monthly_stats)
        WHERE user_id = $1 AND month = $2 AND year = $3
      `, [userId, month, year]);
    }
}
