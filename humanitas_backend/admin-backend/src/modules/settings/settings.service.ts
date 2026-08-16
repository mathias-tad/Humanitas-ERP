import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from './entities/settings.entity';
import {
  UpdateGeneralSettingsDto,
  UpdateEmailSettingsDto,
  UpdateDatabaseSettingsDto,
  UpdateSecuritySettingsDto,
  UpdateServicesSettingsDto,
} from './dto/update-settings.dto';
import Redis from 'ioredis';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepository: Repository<PlatformSettings>,
  ) {}

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
    
    // Only update password if it's not the masked value
    if (dto.smtp_password === '********') {
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

  async testEmailConnection(): Promise<{ success: boolean; message: string }> {
    const settings = await this.settingsRepository.findOne({ where: {} });
    
    if (!settings?.smtp_host || !settings?.smtp_port) {
      return { success: false, message: 'SMTP settings not configured' };
    }

    // In production, you would actually test the connection here
    // For now, just return success if settings exist
    return { success: true, message: 'Email settings are configured (test not implemented)' };
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
