import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from './entities/settings.entity';
import {
  UpdateGeneralSettingsDto,
  UpdateEmailSettingsDto,
  UpdateDatabaseSettingsDto,
  UpdateSecuritySettingsDto,
  UpdateServicesSettingsDto,
  TestEmailDto,
} from './dto/update-settings.dto';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepository: Repository<PlatformSettings>,
  ) {}

  async onModuleInit() {
    try {
      await this.settingsRepository.query(`
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS from_name VARCHAR;
        ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT true;
      `);
    } catch (err) {
      // Table might not exist yet or columns already exist
    }
  }

  async getSettings(): Promise<PlatformSettings> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    
    // Create default settings if none exist
    if (!settings) {
      settings = this.settingsRepository.create({});
      await this.settingsRepository.save(settings);
    }

    // Hide sensitive data
    const result = { ...settings };
    if (result.smtp_password) {
      result.smtp_password = '********';
    }
    
    return result;
  }

  async getGeneralSettings(): Promise<Partial<PlatformSettings>> {
    const settings = await this.getSettings();
    return {
      platform_name: settings.platform_name,
      domain: settings.domain,
      support_email: settings.support_email,
      default_trial_days: settings.default_trial_days,
      max_tenants: settings.max_tenants,
    };
  }

  async getEmailSettings(): Promise<Partial<PlatformSettings>> {
    const settings = await this.getSettings();
    return {
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port,
      smtp_username: settings.smtp_username,
      smtp_password: settings.smtp_password ? '********' : undefined,
      from_email: settings.from_email,
      from_name: settings.from_name,
      smtp_secure: settings.smtp_secure ?? true,
    };
  }

  async getDatabaseSettings(): Promise<Partial<PlatformSettings>> {
    const settings = await this.getSettings();
    return {
      db_host: settings.db_host,
      db_port: settings.db_port,
      master_db_name: settings.master_db_name,
      tenant_db_prefix: settings.tenant_db_prefix,
    };
  }

  async getSecuritySettings(): Promise<Partial<PlatformSettings>> {
    const settings = await this.getSettings();
    return {
      session_timeout_minutes: settings.session_timeout_minutes,
      max_login_attempts: settings.max_login_attempts,
      password_min_length: settings.password_min_length,
      lockout_duration_minutes: settings.lockout_duration_minutes,
      require_2fa_for_admins: settings.require_2fa_for_admins,
    };
  }

  async updateGeneralSettings(dto: UpdateGeneralSettingsDto): Promise<Partial<PlatformSettings>> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepository.create({});
    }
    
    Object.assign(settings, dto);
    await this.settingsRepository.save(settings);
    
    return this.getGeneralSettings();
  }

  async updateEmailSettings(dto: UpdateEmailSettingsDto): Promise<Partial<PlatformSettings>> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepository.create({});
    }
    
    // Only update password if provided and not masked
    if (!dto.smtp_password || dto.smtp_password === '********' || dto.smtp_password.trim() === '') {
      delete dto.smtp_password;
    }
    
    Object.assign(settings, dto);
    await this.settingsRepository.save(settings);
    
    return this.getEmailSettings();
  }

  async updateDatabaseSettings(dto: UpdateDatabaseSettingsDto): Promise<Partial<PlatformSettings>> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepository.create({});
    }
    
    Object.assign(settings, dto);
    await this.settingsRepository.save(settings);
    
    return this.getDatabaseSettings();
  }

  async updateSecuritySettings(dto: UpdateSecuritySettingsDto): Promise<Partial<PlatformSettings>> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepository.create({});
    }
    
    Object.assign(settings, dto);
    await this.settingsRepository.save(settings);
    
    return this.getSecuritySettings();
  }

  async testEmailConnection(dto?: TestEmailDto): Promise<{ success: boolean; message: string }> {
    const settings = await this.settingsRepository.findOne({ where: {} });

    const host = dto?.smtp_host || settings?.smtp_host;
    const port = dto?.smtp_port || settings?.smtp_port;
    const username = dto?.smtp_username || settings?.smtp_username;
    let password = dto?.smtp_password;
    if (!password || password === '********') {
      password = settings?.smtp_password;
    }
    const fromEmail = dto?.from_email || settings?.from_email || username;
    const fromName = dto?.from_name || settings?.from_name || 'Humanitas Admin';
    const isTls = dto?.smtp_secure !== undefined ? dto.smtp_secure : (settings?.smtp_secure ?? true);

    if (!host || !port) {
      return { success: false, message: 'SMTP Host and Port must be configured.' };
    }

    if (!username || !password) {
      return { success: false, message: 'SMTP Username and Password must be configured.' };
    }

    const recipient = dto?.to_email || fromEmail || username;

    if (!recipient) {
      return { success: false, message: 'Recipient email address is required.' };
    }

    try {
      const isPort465 = Number(port) === 465;
      const transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: isPort465, // true for port 465, false for other ports
        requireTLS: Boolean(isTls) && !isPort465,
        auth: {
          user: username,
          pass: password,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.verify();

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: recipient,
        subject: '✅ Humanitas SMTP Test Email',
        text: `Humanitas SMTP Connection Test\n\nYour SMTP settings have been verified and an email was sent successfully to ${recipient}.\n\nHost: ${host}:${port}\nFrom: ${fromEmail}\nTLS: ${isTls ? 'Enabled' : 'Disabled'}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="margin-bottom: 20px;">
              <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 600;">SMTP Connection Verified</h2>
            </div>
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-top: 0;">
              Congratulations! Your SMTP configuration is working properly and ready to deliver transactional emails for your platform.
            </p>
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; width: 110px;">SMTP Host:</td>
                  <td style="padding: 6px 0; font-family: monospace; color: #0f172a;">${host}:${port}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600;">Sender:</td>
                  <td style="padding: 6px 0; font-family: monospace; color: #0f172a;">"${fromName}" &lt;${fromEmail}&gt;</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600;">Security:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${isPort465 ? 'SSL (Port 465)' : (isTls ? 'STARTTLS (Port 587)' : 'Plain / Non-TLS')}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600;">Delivered To:</td>
                  <td style="padding: 6px 0; font-family: monospace; color: #0f172a;">${recipient}</td>
                </tr>
              </table>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
              This is an automated test email sent from the Humanitas Admin Console.
            </p>
          </div>
        `,
      });

      return {
        success: true,
        message: `Test email sent successfully to ${recipient}! (Message ID: ${info.messageId})`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `SMTP error: ${error.message || 'Connection failed'}`,
      };
    }
  }

  async getServicesSettings(): Promise<Partial<PlatformSettings>> {
    const settings = await this.getSettings();
    return {
      redis_url: settings.redis_url ? '********' : undefined,
      redis_enabled: settings.redis_enabled,
      calculation_service_url: settings.calculation_service_url,
    };
  }

  async updateServicesSettings(dto: UpdateServicesSettingsDto): Promise<Partial<PlatformSettings>> {
    let settings = await this.settingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepository.create({});
    }
    
    // Only update redis_url if it's not the masked value
    if (dto.redis_url === '********') {
      delete dto.redis_url;
    }
    
    Object.assign(settings, dto);
    await this.settingsRepository.save(settings);
    
    return this.getServicesSettings();
  }

  async testRedisConnection(redisUrl?: string): Promise<{ success: boolean; message: string }> {
    const settings = await this.settingsRepository.findOne({ where: {} });
    const url = redisUrl || settings?.redis_url;
    
    if (!url) {
      return { success: false, message: 'Redis URL not configured' };
    }

    try {
      // Upstash requires TLS and specific settings
      const redis = new Redis(url, {
        tls: url.startsWith('rediss://') ? {} : undefined,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
      });
      
      const pong = await redis.ping();
      await redis.quit();
      
      if (pong === 'PONG') {
        return { success: true, message: 'Redis connection successful!' };
      }
      return { success: false, message: 'Redis ping failed' };
    } catch (error) {
      return { success: false, message: `Redis connection failed: ${error.message}` };
    }
  }
}
