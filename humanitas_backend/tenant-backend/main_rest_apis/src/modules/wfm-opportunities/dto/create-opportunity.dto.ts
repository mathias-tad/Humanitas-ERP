import { IsString, IsNotEmpty, IsIn, IsNumber, IsOptional, IsUUID, IsDateString, Min } from 'class-validator';

export class CreateOpportunityDto {
  @IsNotEmpty()
  @IsIn(['VET', 'VTO'])
  type: 'VET' | 'VTO';

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsUUID()
  shift_id?: string;

  @IsOptional()
  @IsString()
  start_time?: string;

  @IsOptional()
  @IsString()
  end_time?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.5)
  hours: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  slots_available: number;

  @IsOptional()
  @IsIn(['unpaid', 'paid'])
  vto_compensation_type?: 'unpaid' | 'paid';

  @IsOptional()
  @IsNumber()
  ot_rate_multiplier?: number;

  @IsOptional()
  @IsIn(['normal', 'night', 'dayoff', 'holiday'])
  ot_category?: 'normal' | 'night' | 'dayoff' | 'holiday';

  @IsOptional()
  @IsIn(['normal', 'high', 'critical'])
  urgency?: 'normal' | 'high' | 'critical';

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
