import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../auth/entities/tenant.entity';
import { DatabaseService } from '../database/database.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class LeaveScheduler {
  private readonly context = 'LeaveScheduler';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly databaseService: DatabaseService,
    private readonly loggerService: LoggerService,
  ) { }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    operationContext: string,
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        this.loggerService.error(
          `${operationName} failed for ${operationContext} (attempt ${attempt}/${this.MAX_RETRIES}): ${error.message}`,
          error.stack,
          this.context,
        );
        if (attempt < this.MAX_RETRIES) {
          this.loggerService.log(
            `Retrying in ${this.RETRY_DELAY_MS / 1000} seconds...`,
            this.context,
          );
          await this.delay(this.RETRY_DELAY_MS);
        }
      }
    }
    this.loggerService.error(
      `${operationName} failed after ${this.MAX_RETRIES} attempts for ${operationContext}`,
      undefined,
      this.context,
    );
    return null;
  }

  // Run every day at 2:00 AM (after payroll scheduler at 1:00 AM)
  @Cron('0 2 * * *')
  async handleMonthlyLeaveAccrual() {
    const today = new Date();
    const currentDay = today.getDate();

    this.loggerService.log(
      `Checking leave accrual for day ${currentDay}...`,
      this.context,
    );

    try {
      // Get all active tenants
      const tenants = await this.tenantRepository.find({
        where: { is_active: true },
      });

      for (const tenant of tenants) {
        try {
          const connection = await this.databaseService.getTenantConnection(
            tenant.database_name,
          );

          // Get tenant's HR settings
          const settingsResult = await connection.query(`
            SELECT data FROM settings WHERE category = 'hr' LIMIT 1
          `);

          if (!settingsResult || settingsResult.length === 0) {
            continue;
          }

          const hrSettings =
            typeof settingsResult[0].data === 'string'
              ? JSON.parse(settingsResult[0].data)
              : settingsResult[0].data;

          const leaveCalculationDay = hrSettings.leave_calculation_day || 1;
          const leaveIncreasePerYear = hrSettings.leave_increase_per_year || 1;
          const leaveTypes = hrSettings.leave_types || [];

          // Check if today is the leave calculation day
          if (currentDay === leaveCalculationDay) {
            this.loggerService.log(
              `Running leave accrual for tenant: ${tenant.slug}`,
              this.context,
            );

            // Get all active users
            const users = await connection.query(`
              SELECT id, full_name, hire_date FROM users WHERE is_active = true AND hire_date IS NOT NULL
            `);

            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth() + 1;

            for (const user of users) {
              // Process user with retry
              await this.runWithRetry(
                async () => {
                  const hireDate = new Date(user.hire_date);
                  const yearsOfService = Math.floor(
                    (today.getTime() - hireDate.getTime()) /
                    (365.25 * 24 * 60 * 60 * 1000),
                  );

                  // Calculate monthly accrual for each leave type
                  for (const leaveType of leaveTypes) {
                    const baseDays = leaveType.days_per_year || 0;
                    const isAnnualLeave = leaveType.name
                      ?.toLowerCase()
                      .includes('annual');

                    // Only annual leave gets yearly increase
                    const totalYearlyDays = isAnnualLeave
                      ? baseDays + yearsOfService * leaveIncreasePerYear
                      : baseDays;

                    // Monthly accrual = yearly / 12
                    const monthlyAccrual =
                      Math.round((totalYearlyDays / 12) * 100) / 100;

                    // Get existing balance
                    const existingBalance = await connection.query(
                      `
                      SELECT id, total_days, used_days FROM leave_balances 
                      WHERE user_id = $1 AND leave_type_id = $2 AND year = $3
                    `,
                      [user.id, leaveType.id, currentYear],
                    );

                    if (existingBalance && existingBalance.length > 0) {
                      // Update existing balance - add monthly accrual
                      const newTotal =
                        parseFloat(existingBalance[0].total_days) +
                        monthlyAccrual;
                      await connection.query(
                        `
                        UPDATE leave_balances 
                        SET total_days = $1, updated_at = NOW()
                        WHERE id = $2
                      `,
                        [newTotal, existingBalance[0].id],
                      );
                    } else {
                      // Create new balance record
                      await connection.query(
                        `
                        INSERT INTO leave_balances (user_id, leave_type_id, leave_type_name, total_days, used_days, carried_over, year)
                        VALUES ($1, $2, $3, $4, 0, 0, $5)
                      `,
                        [
                          user.id,
                          leaveType.id,
                          leaveType.name,
                          monthlyAccrual,
                          currentYear,
                        ],
                      );
                    }
                  }

                  this.loggerService.log(
                    `Leave accrual completed for user: ${user.full_name}`,
                    this.context,
                  );
                  return true;
                },
                'Leave accrual',
                `user ${user.full_name}`,
              );
            }

            // Log the accrual run
            await connection
              .query(
                `
              INSERT INTO leave_accrual_logs (run_date, month, year, users_processed, created_at)
              VALUES ($1, $2, $3, $4, NOW())
              ON CONFLICT DO NOTHING
            `,
                [today, currentMonth, currentYear, users.length],
              )
              .catch(() => {
                // Table might not exist, ignore
              });

            this.loggerService.log(
              `Leave accrual completed for tenant: ${tenant.slug}`,
              this.context,
            );
          }
        } catch (tenantError: any) {
          this.loggerService.error(
            `Error processing leave accrual for tenant ${tenant.slug}: ${tenantError.message}`,
            tenantError.stack,
            this.context,
          );
        }
      }
    } catch (error: any) {
      this.loggerService.error(
        `Error in leave accrual scheduler: ${error.message}`,
        error.stack,
        this.context,
      );
    }
  }

  // Manual trigger for testing
  async triggerLeaveAccrual(tenantId: string) {
    const today = new Date();
    const connection =
      await this.databaseService.getTenantConnectionById(tenantId);

    // Get HR settings
    const settingsResult = await connection.query(`
      SELECT data FROM settings WHERE category = 'hr' LIMIT 1
    `);

    if (!settingsResult || settingsResult.length === 0) {
      return { message: 'No HR settings found' };
    }

    const hrSettings =
      typeof settingsResult[0].data === 'string'
        ? JSON.parse(settingsResult[0].data)
        : settingsResult[0].data;

    const leaveIncreasePerYear = hrSettings.leave_increase_per_year || 1;
    const leaveTypes = hrSettings.leave_types || [];
    const currentYear = today.getFullYear();

    // Get all active users
    const users = await connection.query(`
      SELECT id, full_name, hire_date FROM users WHERE is_active = true AND hire_date IS NOT NULL
    `);

    let processedCount = 0;

    for (const user of users) {
      const hireDate = new Date(user.hire_date);
      const yearsOfService = Math.floor(
        (today.getTime() - hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      );

      for (const leaveType of leaveTypes) {
        const baseDays = leaveType.days_per_year || 0;
        const isAnnualLeave = leaveType.name?.toLowerCase().includes('annual');

        const totalYearlyDays = isAnnualLeave
          ? baseDays + yearsOfService * leaveIncreasePerYear
          : baseDays;

        const monthlyAccrual = Math.round((totalYearlyDays / 12) * 100) / 100;

        const existingBalance = await connection.query(
          `
          SELECT id, total_days FROM leave_balances 
          WHERE user_id = $1 AND leave_type_id = $2 AND year = $3
        `,
          [user.id, leaveType.id, currentYear],
        );

        if (existingBalance && existingBalance.length > 0) {
          const newTotal =
            parseFloat(existingBalance[0].total_days) + monthlyAccrual;
          await connection.query(
            `
            UPDATE leave_balances 
            SET total_days = $1, updated_at = NOW()
            WHERE id = $2
          `,
            [newTotal, existingBalance[0].id],
          );
        } else {
          await connection.query(
            `
            INSERT INTO leave_balances (user_id, leave_type_id, leave_type_name, total_days, used_days, carried_over, year)
            VALUES ($1, $2, $3, $4, 0, 0, $5)
          `,
            [
              user.id,
              leaveType.id,
              leaveType.name,
              monthlyAccrual,
              currentYear,
            ],
          );
        }
      }
      processedCount++;
    }

    return {
      message: 'Leave accrual completed',
      users_processed: processedCount,
      accrual_date: today,
    };
  }
}
