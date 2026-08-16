import { PartialType } from '@nestjs/swagger';
import { CreateTenantDto } from './create-tenant.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsNumber, IsArray, IsEnum } from 'class-validator';
import { SubscriptionStatus } from '../entities/tenant.entity';

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscription_status?: SubscriptionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max_users?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max_devices?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  storage_limit_gb?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  enabled_features?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
