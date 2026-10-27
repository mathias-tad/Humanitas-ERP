import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../auth/entities/tenant.entity';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from './notifications.service';
import { NotificationEmailService } from './notification-email.service';

interface BirthdayCelebrant {
  id: string;
  full_name: string;
  email: string;
  company_id?: string;
  branch_id?: string;
}

@Injectable()
export class BirthdayGreetingsCron {
  private readonly logger = new Logger(BirthdayGreetingsCron.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationEmailService: NotificationEmailService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkAndSendBirthdayGreetings(): Promise<void> {
    this.logger.log('Running daily birthday greetings check at 08:00 AM...');

    let tenants: Tenant[] = [];
    try {
      tenants = await this.tenantRepository.find({ where: { is_active: true } });
    } catch (err: any) {
      this.logger.error(`Failed to fetch active tenants for birthday cron: ${err.message}`);
      return;
    }

    for (const tenant of tenants) {
      await this.processTenantBirthdays(tenant).catch((err: any) =>
        this.logger.error(`Birthday greetings failed for tenant ${tenant.slug}: ${err.message}`),
      );
    }
  }

  async processTenantBirthdays(tenant: Tenant): Promise<{ celebrantsCount: number }> {
    const tenantId = tenant.id;
    const settings = await this.notificationsService.getBirthdayGreetingSettings(tenantId);

    // If tenant deactivated automated birthday greetings, gracefully skip
    if (!settings.enabled) {
      this.logger.debug(`Birthday greetings are disabled for tenant ${tenant.slug}`);
      return { celebrantsCount: 0 };
    }

    const conn = await this.databaseService.getTenantConnectionById(tenantId);

    // Find all active employees whose birthday is today (month & day match current date)
    const celebrants: BirthdayCelebrant[] = await conn.query(`
      SELECT id, full_name, email, company_id, branch_id
      FROM users
      WHERE is_active = TRUE
        AND birth_date IS NOT NULL
        AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM CURRENT_DATE)
    `);

    if (!celebrants || celebrants.length === 0) {
      this.logger.debug(`No birthdays today for tenant ${tenant.slug}`);
      return { celebrantsCount: 0 };
    }

    this.logger.log(`Found ${celebrants.length} birthday celebrant(s) today for tenant ${tenant.slug}`);

    const appUrl = process.env.APP_URL || 'https://app.humanitas.io';
    const companyName = tenant.company_name || tenant.slug || 'Humanitas';

    for (const celebrant of celebrants) {
      // 1. Send personal birthday greeting directly to the celebrant
      try {
        const celebrantChannel = await this.notificationsService.getEffectiveChannel(
          tenantId,
          celebrant.id,
          'birthday_greeting',
        );

        if (celebrantChannel !== 'none') {
          // In-App Notification (and Push if channel includes push)
          await this.notificationsService.createNotification(tenantId, celebrant.id, {
            type: 'birthday_greeting',
            title: `🎂 Happy Birthday, ${celebrant.full_name}!`,
            message: settings.greetingMessage || 'Wishing you a very Happy Birthday filled with joy and success!',
            priority: 'high',
            deep_link: '/dashboard',
          });

          // Email notification if channel includes email
          if (celebrantChannel === 'email' || celebrantChannel === 'both') {
            if (celebrant.email) {
              await this.notificationEmailService.sendBirthdayGreeting(
                tenant.slug,
                celebrant.email,
                { employeeName: celebrant.full_name, companyName },
                appUrl,
                tenantId,
              ).catch(err => {
                this.logger.warn(`Failed to send birthday email to ${celebrant.email}: ${err.message}`);
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.error(`Error sending celebrant greeting to ${celebrant.full_name}: ${err.message}`);
      }

      // 2. Notify all colleagues if tenant setting has notifyColleagues enabled
      if (settings.notifyColleagues) {
        try {
          // Fetch colleagues (all other active employees, filtered by same company/branch scope if present)
          const colleagues: { id: string }[] = await conn.query(
            `
            SELECT id FROM users
            WHERE is_active = TRUE
              AND id != $1
              ${celebrant.company_id ? 'AND (company_id IS NULL OR company_id = $2)' : ''}
          `,
            celebrant.company_id ? [celebrant.id, celebrant.company_id] : [celebrant.id],
          );

          for (const colleague of colleagues) {
            const colleagueChannel = await this.notificationsService.getEffectiveChannel(
              tenantId,
              colleague.id,
              'colleague_birthday_alert',
            );

            if (colleagueChannel !== 'none') {
              await this.notificationsService.createNotification(tenantId, colleague.id, {
                type: 'colleague_birthday_alert',
                referenceId: celebrant.id,
                title: `🎉 Today is ${celebrant.full_name}'s Birthday!`,
                message: `Don't forget to wish ${celebrant.full_name} a very Happy Birthday today!`,
                priority: 'normal',
                deep_link: `/accounts?search=${encodeURIComponent(celebrant.full_name)}`,
              }).catch(() => {});
            }
          }
        } catch (err: any) {
          this.logger.error(`Error broadcasting colleague birthday alerts for ${celebrant.full_name}: ${err.message}`);
        }
      }
    }

    return { celebrantsCount: celebrants.length };
  }
}
