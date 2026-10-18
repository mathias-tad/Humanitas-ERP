import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GeneralSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_format?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;
}

export class CompanySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tax_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo_url?: string;
}

export class NotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email_notifications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sms_notifications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  push_notifications?: string;
}

export class LeaveTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  days_per_year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  is_paid?: boolean;
}

export class HRSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  standard_start_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  standard_end_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  late_tolerance_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  overtime_threshold_hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  early_punch_in_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  payroll_run_day?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auto_payroll_enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  late_penalty_per_minute?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  wait_for_absent_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  mark_late_instead_of_absent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  employee_pension_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  employer_pension_rate?: number;

  @ApiPropertyOptional({ type: [LeaveTypeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveTypeDto)
  leave_types?: LeaveTypeDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  probation_period_days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  leave_calculation_day?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  leave_increase_per_year?: number;

  // [NEW] Advanced HR Settings
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  work_days?: string[]; // e.g. ["Monday", "Tuesday", ...]

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  half_day_allowed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  require_approval_for_overtime?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  work_hours_per_month?: number; // Default 192

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  days_in_month_mode?: 'FIXED_30' | 'ACTUAL';

  @ApiPropertyOptional({ description: 'Allowed attendance check-in methods (biometric, qr, manual)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_attendance_methods?: string[];

  @ApiPropertyOptional({ description: 'Biometric verification mode: optional, strict_finger_face, strict_all' })
  @IsOptional()
  @IsString()
  biometric_verification_mode?: 'optional' | 'strict_finger_face' | 'strict_all';
}

export class CategoryRule {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  calculation_mode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fixed_amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  percentage_value?: number;
}

export class IncomeTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  taxable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  pensionable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tax_rate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  custom_tax_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  calculation_type?: 'fixed' | 'percentage';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_category_specific?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  universal_calculation_mode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  universal_fixed_amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  universal_percentage_value?: number;

  @ApiPropertyOptional({ type: [CategoryRule] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryRule)
  category_rules?: CategoryRule[];
}

export class TaxRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  min_income?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max_income?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tax_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deductible?: number;
}

export class PayrollSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pay_period?: string;

  @ApiPropertyOptional({ type: [IncomeTypeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncomeTypeDto)
  income_types?: IncomeTypeDto[];

  @ApiPropertyOptional({ type: [TaxRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxRuleDto)
  tax_rules?: TaxRuleDto[];

  // [NEW] Advanced Payroll Settings
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  ot_rate_normal?: number; // 1.25

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  ot_rate_night?: number; // 1.5

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  ot_rate_dayoff?: number; // 1.5

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  ot_rate_holiday?: number; // 2.0

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  monthly_working_hours?: number; // 160

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minimum_ot_duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ot_requires_approval?: boolean;



  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  penalty_base?: 'NET' | 'GROSS'; // Default NET

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max_deduction_percent?: number; // Default 33.333 (1/3)

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bonus_tax_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  employee_pension_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  employer_pension_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  late_penalty_per_minute?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  payroll_run_day?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auto_payroll_enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allow_employee_loans?: boolean; // Default false

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  acting_allowance_percentage?: number; // Default 10.0

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  acting_allowance_additional_type?: 'PERCENTAGE' | 'FIXED' | 'NONE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  acting_allowance_additional_value?: number;
}

export class TaskStatusDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class TaskPriorityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class TaskSettingsDto {
  @ApiPropertyOptional({ type: [TaskStatusDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskStatusDto)
  statuses?: TaskStatusDto[];

  @ApiPropertyOptional({ type: [TaskPriorityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskPriorityDto)
  priorities?: TaskPriorityDto[];
}

export class RatingScaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;
}

export class KPISettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  review_cycle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kpi_criteria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  kpi_weightage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedback_method?: string;

  @ApiPropertyOptional({ type: [RatingScaleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RatingScaleDto)
  rating_scale?: RatingScaleDto[];
}

export class EmailSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtp_host?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  smtp_port?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtp_user?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtp_pass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  smtp_secure?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from_email?: string;
}

export class ThemeSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primary_color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primary_foreground?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  radius?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  font_family?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sidebar_color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mode?: 'light' | 'dark' | 'system';
}

export class IntegrationsSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  krinai_api_key?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  krinai_webhook_secret?: string;
}
