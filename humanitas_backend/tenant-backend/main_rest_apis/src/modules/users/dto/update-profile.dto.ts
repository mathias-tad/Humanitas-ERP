import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  IsBoolean,
  IsDateString,
  IsNumber,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birth_date?: string;

  // Address fields
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postal_code?: string;

  // Additional personal info
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marital_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  national_id?: string;

  // Emergency contact
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_relationship?: string;

  // Employment info
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hire_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employment_type?: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional()
  @IsString()
  current_password: string;

  @ApiPropertyOptional()
  @IsString()
  @MinLength(8)
  new_password: string;
}

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  full_name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Optional - if not provided, a setup email will be sent',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employee_category_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branch_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birth_date?: string;

  // Address fields
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postal_code?: string;

  // Additional personal info
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marital_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  national_id?: string;

  // Emergency contact
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_relationship?: string;

  // Employment info
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hire_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employment_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  basic_salary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  desert_allowance_percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hardship_allowance_percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  transport_allowance_percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  account_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  allowance_settings?: {
    income_type_id: string;
    tier: string;
    custom_amount?: number;
  }[];
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employee_category_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branch_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  basic_salary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  desert_allowance_percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  hardship_allowance_percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  transport_allowance_percent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  desert_allowance_override?: string; // 'none' | 'min' | 'mid' | 'max' | 'custom'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hardship_allowance_override?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transport_allowance_override?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  per_diem_allowance_override?: string;

  // Address fields
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postal_code?: string;

  // Additional personal info
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  marital_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  national_id?: string;

  // Emergency contact
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_relationship?: string;

  // Employment info
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  hire_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employment_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  account_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  allowance_settings?: {
    income_type_id: string;
    tier: string;
    custom_amount?: number;
  }[];
}
