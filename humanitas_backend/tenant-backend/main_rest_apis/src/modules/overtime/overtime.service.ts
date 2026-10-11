import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { CalculationType } from '../system-logs/entities/calculation-log.entity';
import { UpdateOvertimeDto } from './dto/update-overtime.dto';

@Injectable()
export class OvertimeService {
    constructor(
        private readonly databaseService: DatabaseService,
        @Inject(forwardRef(() => NotificationsService))
        private readonly notificationsService: NotificationsService,
        @Inject(forwardRef(() => NotificationsGateway))
        private readonly notificationsGateway: NotificationsGateway,
        private readonly systemLogsService: SystemLogsService,
    ) { }

    /**
     * Get the current payroll period phase for OT calculations
     * Phases: ACTIVE (can calc/adjust), PROCESSING (adjust only), FROZEN (view only)
     */
    async getPeriodPhase(tenantId: string): Promise<{
        phase: 'ACTIVE' | 'PROCESSING' | 'FROZEN';
        runDay: number;
        periodStart: string;
        periodEnd: string;
        periodLabel: string;
        canCalculate: boolean;
        canAdjust: boolean;
        message: string;
    }> {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        // Get payroll settings with null checks
        let runDay = 25; // default
        try {
            const settingsRes = await connection.query("SELECT data FROM settings WHERE category = 'payroll'");
            const payrollSettings = settingsRes?.[0]?.data || {};
            runDay = Number(payrollSettings.payroll_run_day || 25);
        } catch (e) {
            console.error('[OT] Error fetching payroll settings:', e);
        }

        // Get general settings for date format with null checks
        let dateFormat = 'YYYY-MM-DD';
        try {
            const generalRes = await connection.query("SELECT data FROM settings WHERE category = 'general'");
            const generalSettings = generalRes?.[0]?.data || {};
            dateFormat = generalSettings.date_format || 'YYYY-MM-DD';
        } catch (e) {
            console.error('[OT] Error fetching general settings:', e);
        }

        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Calculate period boundaries
        // Period End = Run Day - 2 of current month
        // Period Start = Run Day - 1 of previous month
        const cutOffDay = runDay - 2;

        let periodEnd: Date;
        let periodStart: Date;

        if (currentDay >= runDay) {
            // We're past run day - this month's period is frozen, next period is active
            periodEnd = new Date(currentYear, currentMonth, cutOffDay);
            periodStart = new Date(currentYear, currentMonth - 1, cutOffDay + 1);
        } else {
            // Current period
            periodEnd = new Date(currentYear, currentMonth, cutOffDay);
            periodStart = new Date(currentYear, currentMonth - 1, cutOffDay + 1);
        }

        // Format dates
        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const periodStartStr = formatDate(periodStart);
        const periodEndStr = formatDate(periodEnd);

        // Format period label using tenant's date format preference
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const periodLabel = dateFormat.includes('MMM')
            ? `${monthNames[periodEnd.getMonth()].slice(0, 3)} ${periodEnd.getFullYear()}`
            : `${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, '0')}`;

        // Determine phase
        let phase: 'ACTIVE' | 'PROCESSING' | 'FROZEN';
        let canCalculate = false;
        let canAdjust = false;
        let message = '';

        if (currentDay >= runDay) {
            // FROZEN: On or after payroll run day
            phase = 'FROZEN';
            message = `Payroll period is closed. No changes allowed after day ${runDay}.`;
        } else if (currentDay >= cutOffDay) {
            // PROCESSING: Between cutoff and run day (inclusive of cutoff)
            phase = 'PROCESSING';
            canAdjust = true;
            message = `Processing period (Day ${cutOffDay}-${runDay - 1}). Only individual OT adjustments allowed.`;
        } else {
            // ACTIVE: Before cutoff day
            phase = 'ACTIVE';
            canCalculate = true;
            canAdjust = true;
            message = 'Active period. Full calculation and adjustments allowed.';
        }

        return {
            phase,
            runDay,
            periodStart: periodStartStr,
            periodEnd: periodEndStr,
            periodLabel,
            canCalculate,
            canAdjust,
            message
        };
    }


    async findAll(tenantId: string, filters: {
        startDate?: string,
        endDate?: string,
        status?: string,
        userId?: string
    }) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        let query = `
      SELECT oe.*, u.full_name, u.department, u.position
      FROM overtime_entries oe
      JOIN users u ON oe.user_id = u.id
      WHERE 1=1
    `;
        const params: any[] = [];
        let pIdx = 1;

        if (filters.startDate) {
            query += ` AND oe.date >= $${pIdx}`;
            params.push(filters.startDate);
            pIdx++;
        }
        if (filters.endDate) {
            query += ` AND oe.date <= $${pIdx}`;
            params.push(filters.endDate);
            pIdx++;
        }
        if (filters.status && filters.status !== 'all') {
            query += ` AND oe.status = $${pIdx}`;
            params.push(filters.status);
            pIdx++;
        }
        if (filters.userId) {
            query += ` AND oe.user_id = $${pIdx}`;
            params.push(filters.userId);
            pIdx++;
        }

        query += ` ORDER BY oe.date DESC`;

        const result = await connection.query(query, params);
        return result;
    }

    async update(tenantId: string, id: string, userId: string, updateDto: UpdateOvertimeDto) {
        // Check period phase - block updates during FROZEN phase
        const phaseInfo = await this.getPeriodPhase(tenantId);
        if (!phaseInfo.canAdjust) {
            throw new BadRequestException(phaseInfo.message);
        }

        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        // Ensure entry exists
        const check = await connection.query('SELECT * FROM overtime_entries WHERE id = $1', [id]);
        if (!check.length) throw new NotFoundException('Overtime entry not found');

        const { normal, night, holiday, dayoff } = updateDto;

        // Calculate total hours
        const total = Number(normal || 0) + Number(night || 0) + Number(holiday || 0) + Number(dayoff || 0);

        // Calculate amount
        const amount = await this.calculateOvertimeAmount(connection, userId, {
            normal: Number(normal || 0),
            night: Number(night || 0),
            holiday: Number(holiday || 0),
            dayoff: Number(dayoff || 0)
        });

        // Update
        await connection.query(
            `UPDATE overtime_entries 
       SET normal_ot_hours = $1, night_ot_hours = $2, holiday_ot_hours = $3, dayoff_ot_hours = $4,
           total_amount = $5, is_manual = true, status = 'Pending', updated_at = NOW()
       WHERE id = $6`,
            [normal, night, holiday, dayoff, amount, id]
        );

        return { message: 'Overtime updated successfully' };
    }

    private async calculateOvertimeAmount(connection: any, userId: string, hours: { normal: number, night: number, holiday: number, dayoff: number }) {
        try {
            // 1. Get Payroll Settings
            const settingsRes = await connection.query("SELECT data FROM settings WHERE category = 'payroll'");
            const settings = settingsRes[0]?.data || {};

            const monthlyHours = Number(settings.monthly_working_hours || 160);
            const rateNormal = Number(settings.ot_rate_normal || 1.25);
            const rateNight = Number(settings.ot_rate_night || 1.5);
            const rateHoliday = Number(settings.ot_rate_holiday || 2.0);
            const rateDayoff = Number(settings.ot_rate_dayoff || 1.5);

            // 2. Get User Basic Salary
            const userRes = await connection.query("SELECT basic_salary FROM users WHERE id = $1", [userId]);
            const basicSalary = Number(userRes[0]?.basic_salary || 0);

            if (basicSalary <= 0 || monthlyHours <= 0) return 0;

            const hourlyRate = basicSalary / monthlyHours;

            const amount =
                (hours.normal * rateNormal * hourlyRate) +
                (hours.night * rateNight * hourlyRate) +
                (hours.holiday * rateHoliday * hourlyRate) +
                (hours.dayoff * rateDayoff * hourlyRate);

            return Number(amount.toFixed(2));
        } catch (error) {
            console.error('[OT] Error calculating amount:', error);
            return 0;
        }
    }

    async bulkApprove(tenantId: string, adminId: string, ids: string[]) {
        if (!ids.length) return { count: 0 };
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        // Get affected user IDs before update
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        const entriesRes = await connection.query(
            `SELECT id, user_id, date FROM overtime_entries WHERE id IN (${placeholders})`,
            ids
        );

        // Convert array to $1, $2... syntax for update
        const updatePlaceholders = ids.map((_, i) => `$${i + 2}`).join(',');
        const query = `
      UPDATE overtime_entries 
      SET status = 'Approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id IN (${updatePlaceholders})
    `;

        await connection.query(query, [adminId, ...ids]);

        // Send notifications to affected users
        try {
            for (const entry of entriesRes) {
                const dateStr = entry.date ? new Date(entry.date).toLocaleDateString() : 'Unknown';
                await this.notificationsService.createNotification(
                    tenantId,
                    entry.user_id,
                    {
                        type: 'OVERTIME',
                        referenceId: entry.id,
                        title: 'Overtime Approved',
                        message: `Your overtime for ${dateStr} has been approved.`
                    }
                );
                this.notificationsGateway.pushToUser(tenantId, entry.user_id, {
                    type: 'OVERTIME',
                    title: 'Overtime Approved',
                    message: `Your overtime for ${dateStr} has been approved.`
                });
            }
        } catch (e) {
            console.error('[OvertimeService] Failed to send approval notifications:', e);
        }

        return { message: 'Approved successfully', count: ids.length };
    }

    async bulkReject(tenantId: string, adminId: string, ids: string[]) {
        if (!ids.length) return { count: 0 };
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        // Get affected user IDs before update
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        const entriesRes = await connection.query(
            `SELECT id, user_id, date FROM overtime_entries WHERE id IN (${placeholders})`,
            ids
        );

        const updatePlaceholders = ids.map((_, i) => `$${i + 2}`).join(',');
        const query = `
      UPDATE overtime_entries 
      SET status = 'Rejected', approved_by = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id IN (${updatePlaceholders})
    `;

        await connection.query(query, [adminId, ...ids]);

        // Send notifications to affected users
        try {
            for (const entry of entriesRes) {
                const dateStr = entry.date ? new Date(entry.date).toLocaleDateString() : 'Unknown';
                await this.notificationsService.createNotification(
                    tenantId,
                    entry.user_id,
                    {
                        type: 'OVERTIME',
                        referenceId: entry.id,
                        title: 'Overtime Rejected',
                        message: `Your overtime for ${dateStr} has been rejected.`
                    }
                );
                this.notificationsGateway.pushToUser(tenantId, entry.user_id, {
                    type: 'OVERTIME',
                    title: 'Overtime Rejected',
                    message: `Your overtime for ${dateStr} has been rejected.`
                });
            }
        } catch (e) {
            console.error('[OvertimeService] Failed to send rejection notifications:', e);
        }

        return { message: 'Rejected successfully', count: ids.length };
    }

    async triggerCalculation(tenantId: string, dateStr: string) {
        // Call Python calculation service API directly
        const calcServiceUrl = process.env.CALCULATION_SERVICE_URL || 'http://localhost:8000';

        // --- Freeze Period Logic ---
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const settingsRes = await connection.query("SELECT data FROM settings WHERE category = 'payroll'");
        const settings = settingsRes.rows[0]?.data || {};
        const runDay = Number(settings.payroll_run_day || 25);

        const today = new Date();
        const currentDay = today.getDate();

        // Logic: Disable manual calc if today is in [RunDay-2, RunDay]
        // Note: Simple check on day number assumes monthly cycle.
        const cutOffStart = runDay - 2;
        if (currentDay >= cutOffStart && currentDay <= runDay) {
            throw new BadRequestException(
                `Manual calculation is disabled during payroll processing period (Day ${cutOffStart} to ${runDay}). You can only edit existing entries.`
            );
        }
        // ---------------------------

        try {
            console.log(`[OT] Triggering calculation for tenant ${tenantId} on ${dateStr}`);

            // 1. Create System Log
            const log = await this.systemLogsService.createLog(
                tenantId,
                CalculationType.OVERTIME,
                { date_str: dateStr },
                'manual' // As this is triggered via API manually usually
            );

            const response = await fetch(`${calcServiceUrl}/api/overtime/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    date_str: dateStr,
                    log_id: log.id
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error(`[OT] Calculation failed: ${error}`);
                throw new BadRequestException(`Calculation failed: ${error}`);
            }

            const result = await response.json();
            console.log(`[OT] Calculation complete:`, result);

            // Async response - Notifications handled via Webhook

            return {
                message: 'Calculation completed successfully',
                ...result
            };
        } catch (error: any) {
            console.error(`[OT] Error calling calculation service:`, error.message);
            throw new BadRequestException(error.message || `Failed to calculate OT: ${error}`);
        }
    }

    async triggerPeriodCalculation(tenantId: string, year?: number, month?: number, startDate?: string, endDate?: string) {
        // Call Python calculation service API for period-based calculation
        const calcServiceUrl = process.env.CALCULATION_SERVICE_URL || 'http://localhost:8000';

        try {
            console.log(`[OT] Triggering period calculation for tenant ${tenantId}, year=${year}, month=${month}`);

            // Validation: Check if requested period is locked
            const periodPhase = await this.getPeriodPhase(tenantId);
            const today = new Date();
            const requestedYear = year || today.getFullYear();
            const requestedMonth = month || (today.getMonth() + 1);
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth() + 1;

            // Block past months
            if (requestedYear < currentYear || (requestedYear === currentYear && requestedMonth < currentMonth)) {
                throw new BadRequestException(`Cannot calculate OT for ${requestedMonth}/${requestedYear}. This is a frozen period.`);
            }

            // Block current month if past cutoff
            if (requestedYear === currentYear && requestedMonth === currentMonth) {
                const cutoffDay = periodPhase.runDay - 2;
                if (today.getDate() >= cutoffDay) {
                    throw new BadRequestException(`Cannot calculate OT for ${requestedMonth}/${requestedYear}. Cutoff for bulk calculations was day ${cutoffDay}. Only individual edits are allowed.`);
                }
            }

            // 1. Create System Log
            const log = await this.systemLogsService.createLog(
                tenantId,
                CalculationType.OVERTIME,
                { year, month, start_date: startDate, end_date: endDate },
                'manual'
            );

            const response = await fetch(`${calcServiceUrl}/api/overtime/calculate-period`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    year,
                    month,
                    start_date: startDate,
                    end_date: endDate,
                    log_id: log.id
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error(`[OT] Period calculation failed: ${error}`);
                throw new BadRequestException(`Period calculation failed: ${error}`);
            }

            const result = await response.json();
            console.log(`[OT] Period calculation complete:`, result);

            // Async response - Notifications handled via Webhook

            return {
                message: 'Period calculation completed successfully',
                ...result
            };
        } catch (error: any) {
            console.error(`[OT] Error calling period calculation service:`, error.message);
            throw new BadRequestException(`Failed to calculate period OT: ${error.message}`);
        }
    }

    /**
     * Get list of available periods from overtime_entries
     */
    async getAvailablePeriods(tenantId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        const result = await connection.query(`
            SELECT 
                COALESCE(period_label, 'Unassigned') as period_label,
                COALESCE(period_start, MIN(date)) as period_start,
                COALESCE(period_end, MAX(date)) as period_end,
                COUNT(*) as entry_count,
                SUM(total_amount) as total_amount
            FROM overtime_entries
            GROUP BY period_label, period_start, period_end
            ORDER BY period_end DESC
            LIMIT 12
        `);

        return result.map((row: any) => ({
            label: row.period_label,
            periodStart: row.period_start,
            periodEnd: row.period_end,
            entryCount: Number(row.entry_count),
            totalAmount: Number(row.total_amount || 0)
        }));
    }

    /**
     * Update OT entry hours and auto-recalculate amount
     */
    async updateEntryWithRecalc(
        tenantId: string,
        id: string,
        adminId: string,
        updateDto: { normal_ot_hours?: number; night_ot_hours?: number; holiday_ot_hours?: number; dayoff_ot_hours?: number }
    ) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        // Get current entry
        const entryRes = await connection.query(
            'SELECT * FROM overtime_entries WHERE id = $1',
            [id]
        );

        if (!entryRes.length) {
            throw new NotFoundException('Overtime entry not found');
        }

        const entry = entryRes[0];

        // Merge updates
        const normal = updateDto.normal_ot_hours ?? Number(entry.normal_ot_hours || 0);
        const night = updateDto.night_ot_hours ?? Number(entry.night_ot_hours || 0);
        const holiday = updateDto.holiday_ot_hours ?? Number(entry.holiday_ot_hours || 0);
        const dayoff = updateDto.dayoff_ot_hours ?? Number(entry.dayoff_ot_hours || 0);

        // Recalculate amount
        const amount = await this.calculateOvertimeAmount(connection, entry.user_id, {
            normal, night, holiday, dayoff
        });

        // Update entry
        await connection.query(`
            UPDATE overtime_entries SET
                normal_ot_hours = $1,
                night_ot_hours = $2,
                holiday_ot_hours = $3,
                dayoff_ot_hours = $4,
                total_amount = $5,
                is_manual = true,
                status = 'Pending',
                updated_at = NOW()
            WHERE id = $6
        `, [normal, night, holiday, dayoff, amount, id]);

        // Send notification to the affected user
        try {
            const dateStr = entry.date ? new Date(entry.date).toLocaleDateString() : 'Unknown';
            await this.notificationsService.createNotification(
                tenantId,
                entry.user_id,
                {
                    type: 'OVERTIME',
                    referenceId: id,
                    title: 'Overtime Entry Updated',
                    message: `Your overtime entry for ${dateStr} has been adjusted. New total: ${(normal + night + holiday + dayoff).toFixed(1)} hours.`
                }
            );
            // Emit real-time notification
            this.notificationsGateway.pushToUser(tenantId, entry.user_id, {
                type: 'OVERTIME',
                title: 'Overtime Entry Updated',
                message: `Your overtime hours for ${dateStr} have been modified.`
            });
        } catch (e) {
            console.error('[OvertimeService] Failed to send update notification:', e);
        }

        return {
            message: 'Overtime entry updated and recalculated',
            newAmount: amount,
            hours: { normal, night, holiday, dayoff }
        };
    }
}
