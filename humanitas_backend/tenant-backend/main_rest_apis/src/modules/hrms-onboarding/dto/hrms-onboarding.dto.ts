import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsIn,
} from 'class-validator';

export enum OnboardingStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
}

export enum OffboardingStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TaskCategory {
  IT = 'it',
  HR = 'hr',
  MANAGER = 'manager',
  FACILITIES = 'facilities',
  FINANCE = 'finance',
  GENERAL = 'general',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

export enum ProbationOutcome {
  CONFIRMED = 'confirmed',
  EXTENDED = 'extended',
  TERMINATED = 'terminated',
}

export class CreateChecklistTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  employment_type?: string;

  @IsIn(['onboarding', 'offboarding'])
  type: 'onboarding' | 'offboarding';
}

export class CreateChecklistItemDto {
  @IsString()
  template_id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TaskCategory)
  category: TaskCategory;

  @IsOptional()
  @IsString()
  assignee_role?: string;

  @IsOptional()
  @IsNumber()
  due_days_from_start?: number;

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

export class StartOnboardingDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsNumber()
  probation_days?: number;
}

export class UpdateOnboardingTaskDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  completed_by?: string;
}

export class RecordProbationOutcomeDto {
  @IsString()
  onboarding_id: string;

  @IsEnum(ProbationOutcome)
  outcome: ProbationOutcome;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  extended_until?: string;
}

export class StartOffboardingDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsString()
  template_id?: string;

  @IsOptional()
  @IsDateString()
  last_working_day?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateOffboardingTaskDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitExitInterviewDto {
  @IsString()
  offboarding_id: string;

  @IsOptional()
  @IsNumber()
  satisfaction_score?: number;

  @IsOptional()
  @IsString()
  reason_for_leaving?: string;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;
}

export class OnboardingFilterDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  company_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;
}
