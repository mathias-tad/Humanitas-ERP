import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEmail,
  Min,
  Max,
} from 'class-validator';

export class UpdateGeneralSettingsDto {
  @ApiPropertyOptional({ example: 'HRM SaaS' })
  @IsOptional()
  @IsString()
  platform_name?: string;

  @ApiPropertyOptional({ example: 'yoursaas.com' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ example: 'support@yoursaas.com' })
  @IsOptional()
  @IsEmail()
  support_email?: string;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  default_trial_days?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tenants?: number;
}

export class UpdateEmailSettingsDto {
  @ApiPropertyOptional({ example: 'smtp.example.com' })
  @IsOptional()
  @IsString()
  smtp_host?: string;

  @ApiPropertyOptional({ example: 587 })
  @IsOptional()
  @IsNumber()
  smtp_port?: number;

  @ApiPropertyOptional({ example: 'username' })
  @IsOptional()
  @IsString()
  smtp_username?: string;

  @ApiPropertyOptional({ example: 'password' })
  @IsOptional()
  @IsString()
  smtp_password?: string;

  @ApiPropertyOptional({ example: 'noreply@yoursaas.com' })
  @IsOptional()
  @IsEmail()
  from_email?: string;

  @ApiPropertyOptional({ example: 'Humanitas' })
  @IsOptional()
  @IsString()
  from_name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  smtp_secure?: boolean;
}

export class TestEmailDto {
  @ApiPropertyOptional({ example: 'admin@example.com' })
  @IsOptional()
  @IsEmail()
  to_email?: string;

  @ApiPropertyOptional({ example: 'mail.ziontech.tech' })
  @IsOptional()
  @IsString()
  smtp_host?: string;

  @ApiPropertyOptional({ example: 587 })
  @IsOptional()
  @IsNumber()
  smtp_port?: number;

  @ApiPropertyOptional({ example: 'noreply@mybookingspot.com' })
  @IsOptional()
  @IsString()
  smtp_username?: string;

  @ApiPropertyOptional({ example: 'password' })
  @IsOptional()
  @IsString()
  smtp_password?: string;

  @ApiPropertyOptional({ example: 'noreply@mybookingspot.com' })
  @IsOptional()
  @IsEmail()
  from_email?: string;

  @ApiPropertyOptional({ example: 'MyBookingSpot' })
  @IsOptional()
  @IsString()
  from_name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  smtp_secure?: boolean;
}

export class UpdateDatabaseSettingsDto {
  @ApiPropertyOptional({ example: 'localhost' })
  @IsOptional()
  @IsString()
  db_host?: string;

  @ApiPropertyOptional({ example: 5432 })
  @IsOptional()
  @IsNumber()
  db_port?: number;

  @ApiPropertyOptional({ example: 'master_db' })
  @IsOptional()
  @IsString()
  master_db_name?: string;

  @ApiPropertyOptional({ example: 'tenant_' })
  @IsOptional()
  @IsString()
  tenant_db_prefix?: string;
}

export class UpdateSecuritySettingsDto {
  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  session_timeout_minutes?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  max_login_attempts?: number;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(6)
  @Max(32)
  password_min_length?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  lockout_duration_minutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  require_2fa_for_admins?: boolean;
}

export class UpdateServicesSettingsDto {
  @ApiPropertyOptional({ example: 'rediss://default:xxx@xxx.upstash.io:6379' })
  @IsOptional()
  @IsString()
  redis_url?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  redis_enabled?: boolean;

  @ApiPropertyOptional({ example: 'http://localhost:8000' })
  @IsOptional()
  @IsString()
  calculation_service_url?: string;
}

export class TestRedisDto {
  @ApiPropertyOptional({ example: 'rediss://default:xxx@xxx.upstash.io:6379' })
  @IsOptional()
  @IsString()
  redis_url?: string;
}
