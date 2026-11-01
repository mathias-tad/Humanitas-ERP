import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../auth/entities/tenant.entity';
import { PayrollService } from './payroll.service';
import { DatabaseService } from '../database/database.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class PayrollScheduler {
  private readonly context = 'PayrollScheduler';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly payrollService: PayrollService,
    private readonly databaseService: DatabaseService,
    private readonly loggerService: LoggerService,
  ) { }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    tenantSlug: string,
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        this.loggerService.error(
          `${operationName} failed for ${tenantSlug} (attempt ${attempt}/${this.MAX_RETRIES}): ${error.message}`,
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
      `${operationName} failed after ${this.MAX_RETRIES} attempts for ${tenantSlug}`,
      undefined,
      this.context,
    );
    return null;
  }

  // Run every day at 1:00 AM
  @Cron('0 1 * * *')
  async handleAutoPayroll() {
    const today = new Date();
    const currentDay = today.getDate();

    this.loggerService.log(
      `Checking auto payroll for day ${currentDay}...`,
      this.context,
    );

    try {
      // Get all active tenants
      const tenants = await this.tenantRepository.find({
        where: { is_active: true },
      });

      for (const tenant of tenants) {
        try {
          // Get tenant's HR settings
          const connection = await this.databaseService.getTenantConnection(
            tenant.database_name,
          );

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

          const autoPayrollEnabled = hrSettings.auto_payroll_enabled === true;
          const payrollRunDay = hrSettings.payroll_run_day || 25;

          // Check if auto payroll is enabled and today is the run day
          if (autoPayrollEnabled && currentDay === payrollRunDay) {
            this.loggerService.log(
              `Running auto payroll for tenant: ${tenant.slug}`,
              this.context,
            );

            // Calculate payroll period (previous month)
            const year =
              today.getMonth() === 0
                ? today.getFullYear() - 1
                : today.getFullYear();
            const month = today.getMonth() === 0 ? 12 : today.getMonth();

            // Check if payroll already run for this period
            const existingPayroll = await connection.query(
              `
              SELECT id FROM payroll_records 
              WHERE year = $1 AND month = $2 
              LIMIT 1
            `,
              [year, month],
            );

            if (existingPayroll && existingPayroll.length > 0) {
              this.loggerService.log(
                `Payroll already run for ${tenant.slug} - ${year}/${month}`,
                this.context,
              );
              continue;
            }

            // Run payroll with retry (using 'system' as userId for auto-run)
            const result = await this.runWithRetry(
              async () => {
                const response = await fetch('http://localhost:8000/api/payroll/run', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    tenant_id: tenant.id,
                    month,
                    year,
                    user_id: 'system-auto'
                  })
                });
                if (!response.ok) throw new Error(response.statusText);
                return response.json();
              },
              'Auto payroll',
              tenant.slug,
            );
            if (result) {
              this.loggerService.log(
                `Auto payroll completed for tenant: ${tenant.slug}`,
                this.context,
              );
            }
          }
        } catch (tenantError: any) {
          this.loggerService.error(
            `Error processing auto payroll for tenant ${tenant.slug}: ${tenantError.message}`,
            tenantError.stack,
            this.context,
          );
        }
      }
    } catch (error: any) {
      this.loggerService.error(
        `Error in auto payroll scheduler: ${error.message}`,
        error.stack,
        this.context,
      );
    }
  }

  // Manual trigger for testing
  async triggerAutoPayroll(tenantId: string) {
    try {
      const today = new Date();
      // Current month payroll (not previous month)
      const year = today.getFullYear();
      const month = today.getMonth() + 1; // Current month

      this.loggerService.log(
        `Manually triggering payroll for tenant ${tenantId}, ${year}/${month}`,
        this.context,
      );

      const response = await fetch('http://localhost:8000/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          month,
          year,
          user_id: 'system-auto'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to queue payroll: ${response.statusText}`);
      }
      
      const result = await response.json();

      this.loggerService.log(
        `Manual payroll trigger completed for tenant ${tenantId}`,
        this.context,
      );

      return {
        success: true,
        message: `Payroll triggered for ${year}/${month}`,
        result,
      };
    } catch (error: any) {
      this.loggerService.error(
        `Manual payroll trigger failed: ${error.message}`,
        error.stack,
        this.context,
      );
      throw error;
    }
  }
}
