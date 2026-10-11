import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ──────────────────────────────────────────────
// Income Type DTOs
// ──────────────────────────────────────────────

export class CategoryRuleDto {
  @IsString()
  @IsNotEmpty()
  category_id: string;

  @IsString()
  @IsOptional()
  @IsIn(['fixed_only', 'percentage_only', 'both_highest'])
  calculation_mode?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  fixed_amount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  percentage_value?: number;
}

export class CreateIncomeTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_taxable?: boolean;

  @IsBoolean()
  @IsOptional()
  taxable?: boolean;

  @IsBoolean()
  @IsOptional()
  is_pensionable?: boolean;

  @IsBoolean()
  @IsOptional()
  pensionable?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['fixed', 'percentage', 'hybrid'])
  calculation_type?: string;

  @IsBoolean()
  @IsOptional()
  is_category_specific?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  universal_fixed_amount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  universal_percentage_value?: number;

  @IsString()
  @IsOptional()
  @IsIn(['fixed_only', 'percentage_only', 'both_highest'])
  universal_calculation_mode?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CategoryRuleDto)
  category_rules?: CategoryRuleDto[];
}

export class UpdateIncomeTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  is_taxable?: boolean;

  @IsBoolean()
  @IsOptional()
  taxable?: boolean;

  @IsBoolean()
  @IsOptional()
  is_pensionable?: boolean;

  @IsBoolean()
  @IsOptional()
  pensionable?: boolean;

  @IsBoolean()
  @IsOptional()
  is_category_specific?: boolean;

  @IsNumber()
  @IsOptional()
  universal_fixed_amount?: number;

  @IsNumber()
  @IsOptional()
  universal_percentage_value?: number;

  @IsString()
  @IsOptional()
  @IsIn(['fixed_only', 'percentage_only', 'both_highest'])
  universal_calculation_mode?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CategoryRuleDto)
  category_rules?: CategoryRuleDto[];
}

// ──────────────────────────────────────────────
// User Income DTOs
// ──────────────────────────────────────────────

export class AssignUserIncomeDto {
  @IsString()
  @IsNotEmpty()
  income_type_id: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;

  @IsBoolean()
  @IsOptional()
  is_taxable?: boolean;

  @IsString()
  @IsOptional()
  alias?: string;

  @IsString()
  @IsOptional()
  start_date?: string;

  @IsString()
  @IsOptional()
  end_date?: string;
}

export class UpdateUserIncomeDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;

  @IsBoolean()
  @IsOptional()
  is_taxable?: boolean;

  @IsString()
  @IsOptional()
  alias?: string;
}

// ──────────────────────────────────────────────
// Employee Category DTO
// ──────────────────────────────────────────────

export class UpdateEmployeeCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  default_transport_allowance?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  default_per_diem_fixed?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  per_diem_no_receipt_fixed?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  per_diem_no_receipt_percent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  per_diem_receipt_fixed?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  per_diem_receipt_percent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  desert_min_percent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  desert_mid_percent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  desert_max_percent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  hardship_min_percent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  hardship_mid_percent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  hardship_max_percent?: number;
}

// ──────────────────────────────────────────────
// Tax Rule DTOs
// ──────────────────────────────────────────────

export class CreateTaxRuleDto {
  @IsNumber()
  @Min(0)
  min_salary: number;

  @IsNumber()
  @IsOptional()
  max_salary?: number;

  @IsNumber()
  @Min(0)
  tax_rate: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  deductible?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTaxRuleDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  min_salary?: number;

  @IsNumber()
  @IsOptional()
  max_salary?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  tax_rate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  deductible?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

// ──────────────────────────────────────────────
// Holiday DTOs
// ──────────────────────────────────────────────

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsBoolean()
  @IsOptional()
  is_recurring?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateHolidayDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  date?: string;

  @IsBoolean()
  @IsOptional()
  is_recurring?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}
