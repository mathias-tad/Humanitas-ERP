import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsArray,
  Min,
  Max,
} from 'class-validator';

export enum BenefitPlanType {
  MEDICAL = 'medical',
  DENTAL = 'dental',
  VISION = 'vision',
  LIFE_INSURANCE = 'life_insurance',
  PENSION = 'pension',
  HOUSING_ALLOWANCE = 'housing_allowance',
  TRANSPORT_ALLOWANCE = 'transport_allowance',
  EDUCATION_ASSISTANCE = 'education_assistance',
  WELLNESS = 'wellness',
}

export enum BenefitPlanTier {
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  EXECUTIVE = 'executive',
}

export enum CoverageTier {
  INDIVIDUAL = 'individual',
  INDIVIDUAL_PLUS_SPOUSE = 'individual_plus_spouse',
  INDIVIDUAL_PLUS_CHILDREN = 'individual_plus_children',
  FAMILY = 'family',
}

export enum EnrollmentType {
  OPEN_ENROLLMENT = 'open_enrollment',
  NEW_HIRE = 'new_hire',
  QUALIFYING_LIFE_EVENT = 'qualifying_life_event',
  ADMINISTRATIVE = 'administrative',
}

export enum QualifyingLifeEvent {
  MARRIAGE = 'marriage',
  DIVORCE = 'divorce',
  CHILD_BIRTH = 'child_birth',
  ADOPTION = 'adoption',
  RELOCATION = 'relocation',
  SPOUSE_LOSS_OF_COVERAGE = 'spouse_loss_of_coverage',
}

export class CreateBenefitPlanDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsEnum(BenefitPlanType)
  plan_type: BenefitPlanType;

  @IsOptional()
  @IsEnum(BenefitPlanTier)
  tier?: BenefitPlanTier = BenefitPlanTier.STANDARD;

  @IsOptional()
  @IsString()
  provider_name?: string;

  @IsOptional()
  @IsString()
  policy_number?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  total_cost: number;

  @IsNumber()
  @Min(0)
  employer_contribution: number;

  @IsNumber()
  @Min(0)
  employee_contribution: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  employer_percentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  employee_percentage?: number;

  @IsOptional()
  @IsString()
  contribution_frequency?: string = 'monthly';

  @IsOptional()
  @IsBoolean()
  is_family_covered?: boolean = false;

  @IsOptional()
  @IsNumber()
  max_dependents?: number = 0;

  @IsOptional()
  @IsNumber()
  min_tenure_months?: number = 0;

  @IsOptional()
  @IsArray()
  eligible_employment_types?: string[];

  @IsOptional()
  @IsArray()
  eligible_departments?: string[];
}

export class UpdateBenefitPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  total_cost?: number;

  @IsOptional()
  @IsNumber()
  employer_contribution?: number;

  @IsOptional()
  @IsNumber()
  employee_contribution?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class EnrollEmployeeDto {
  @IsString()
  plan_id: string;

  @IsString()
  user_id: string;

  @IsOptional()
  @IsEnum(CoverageTier)
  coverage_tier?: CoverageTier = CoverageTier.INDIVIDUAL;

  @IsOptional()
  @IsEnum(EnrollmentType)
  enrollment_type?: EnrollmentType = EnrollmentType.OPEN_ENROLLMENT;

  @IsOptional()
  @IsEnum(QualifyingLifeEvent)
  qualifying_life_event?: QualifyingLifeEvent;

  @IsOptional()
  @IsDateString()
  life_event_date?: string;

  @IsDateString()
  effective_start_date: string;

  @IsOptional()
  @IsDateString()
  effective_end_date?: string;

  @IsOptional()
  @IsNumber()
  custom_employee_deduction?: number;

  @IsOptional()
  @IsNumber()
  custom_employer_cost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddDependentDto {
  @IsString()
  full_name: string;

  @IsString()
  relationship: 'spouse' | 'child' | 'parent' | 'other';

  @IsOptional()
  @IsDateString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  national_id?: string;

  @IsOptional()
  @IsString()
  gender?: string;
}

export class CreateOpenEnrollmentDto {
  @IsString()
  title: string;

  @IsNumber()
  plan_year: number;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;
}
