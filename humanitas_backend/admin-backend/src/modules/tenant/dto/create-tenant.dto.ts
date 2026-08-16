import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsArray,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { SubscriptionPlan } from '../entities/tenant.entity';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  company_name: string;

  @ApiProperty({ example: 'acme', description: 'Unique tenant identifier (lowercase, alphanumeric, hyphens)' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  contact_email: string;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  contact_phone?: string;

  @ApiPropertyOptional({ example: '123 Business St' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'New York' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'USA' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsOptional()
  @IsString()
  postal_code?: string;

  @ApiPropertyOptional({ enum: SubscriptionPlan, default: SubscriptionPlan.BASIC })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  subscription_plan?: SubscriptionPlan;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ 
    example: ['hr', 'pms', 'attendance', 'leave'],
    description: 'List of enabled service modules for the tenant'
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabled_features?: string[];
}
