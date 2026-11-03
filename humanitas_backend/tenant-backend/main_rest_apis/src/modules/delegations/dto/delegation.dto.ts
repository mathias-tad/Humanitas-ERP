import { IsNotEmpty, IsUUID, IsString, IsOptional, IsDateString, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDelegationDto {
  @ApiPropertyOptional({ description: 'Delegator user ID (defaults to current authenticated user)' })
  @IsOptional()
  @IsUUID()
  delegator_id?: string;

  @ApiProperty({ description: 'User ID of the person receiving authority' })
  @IsNotEmpty()
  @IsUUID()
  delegatee_id: string;

  @ApiProperty({ description: 'Delegation start timestamp' })
  @IsNotEmpty()
  @IsDateString()
  start_date: string;

  @ApiProperty({ description: 'Delegation end timestamp' })
  @IsNotEmpty()
  @IsDateString()
  end_date: string;

  @ApiPropertyOptional({ description: 'Delegation authority scope (e.g. ALL, APPROVALS, ATTENDANCE, PMS)', default: 'ALL' })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({ description: 'Reason for authority delegation (e.g. Annual Leave, Medical Leave)' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Target Company ID' })
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @ApiPropertyOptional({ description: 'Target Branch ID' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  // HR Acting Assignment & Allowance Extension
  @ApiPropertyOptional({ description: 'Whether this delegation is registered as an official HR acting assignment', default: false })
  @IsOptional()
  @IsBoolean()
  is_acting_assignment?: boolean;

  @ApiPropertyOptional({ description: 'Acting position title (e.g. Acting Head of Operations)' })
  @IsOptional()
  @IsString()
  acting_position_title?: string;

  @ApiPropertyOptional({ description: 'Acting allowance calculation mode (percentage | fixed_amount)', default: 'percentage' })
  @IsOptional()
  @IsString()
  acting_allowance_type?: string;

  @ApiPropertyOptional({ description: 'Acting allowance percentage of target salary (e.g. 15.00 for 15%)', default: 0.00 })
  @IsOptional()
  @IsNumber()
  acting_allowance_percentage?: number;

  @ApiPropertyOptional({ description: 'Fixed acting allowance amount per month', default: 0.00 })
  @IsOptional()
  @IsNumber()
  acting_allowance_amount?: number;

  @ApiPropertyOptional({ description: 'Additional notes or acting approval reference' })
  @IsOptional()
  @IsString()
  acting_notes?: string;
}

export class DelegationsFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  delegator_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  delegatee_id?: string;

  @ApiPropertyOptional({ description: 'Filter acting assignments only' })
  @IsOptional()
  @IsBoolean()
  is_acting_assignment?: boolean;
}

export class LogDelegatedActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  delegation_id?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  performed_by: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  on_behalf_of: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  details?: Record<string, any>;
}
