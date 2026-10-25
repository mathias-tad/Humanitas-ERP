import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString, IsArray, IsNumber, Min, Max } from 'class-validator';

export enum ReviewCycleType {
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semi_annual',
  ANNUAL = 'annual',
  CUSTOM = 'custom',
}

export enum ReviewCycleStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CALIBRATING = 'calibrating',
  CLOSED = 'closed',
}

export enum EmployeeReviewStatus {
  PENDING_SELF = 'pending_self',
  PENDING_PEERS = 'pending_peers',
  PENDING_MANAGER = 'pending_manager',
  CALIBRATING = 'calibrating',
  COMPLETED = 'completed',
}

export enum ReviewerType {
  SELF = 'self',
  MANAGER = 'manager',
  PEER = 'peer',
  UPWARD = 'upward',
}

export enum PipStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED_SUCCESSFULLY = 'completed_successfully',
  EXTENDED = 'extended',
  TERMINATED = 'terminated',
}

export class CreateReviewCycleDto {
  @IsString()
  title: string;

  @IsEnum(ReviewCycleType)
  cycle_type: ReviewCycleType;

  @IsDateString()
  start_date: string;

  @IsDateString()
  due_date: string;

  @IsOptional()
  @IsDateString()
  self_review_due_date?: string;

  @IsOptional()
  @IsDateString()
  peer_review_due_date?: string;

  @IsOptional()
  @IsDateString()
  manager_review_due_date?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_peer_review_enabled?: boolean;

  @IsOptional()
  @IsNumber()
  min_peers?: number;

  @IsOptional()
  @IsNumber()
  max_peers?: number;

  @IsOptional()
  @IsBoolean()
  is_upward_review_enabled?: boolean;

  @IsOptional()
  @IsArray()
  participant_ids?: string[];
}

export class UpdateReviewCycleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(ReviewCycleStatus)
  status?: ReviewCycleStatus;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class NominatePeersDto {
  @IsArray()
  peer_ids: string[];
}

export class CompetencyScoreDto {
  @IsString()
  competency_id: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  score: number;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class SubmitFeedbackDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  overall_rating: number;

  @IsOptional()
  @IsString()
  general_feedback?: string;

  @IsOptional()
  @IsString()
  strengths?: string;

  @IsOptional()
  @IsString()
  improvements?: string;

  @IsOptional()
  @IsArray()
  competency_scores?: CompetencyScoreDto[];
}

export class CalibrateReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  calibrated_rating: number;

  @IsOptional()
  @IsString()
  manager_summary?: string;

  @IsOptional()
  @IsString()
  strengths?: string;

  @IsOptional()
  @IsString()
  areas_for_growth?: string;

  @IsOptional()
  @IsEnum(EmployeeReviewStatus)
  status?: EmployeeReviewStatus;
}

export class CreatePipDto {
  @IsString()
  employee_id: string;

  @IsOptional()
  @IsString()
  review_id?: string;

  @IsString()
  title: string;

  @IsString()
  reason: string;

  @IsString()
  action_plan: string;

  @IsString()
  success_criteria: string;

  @IsOptional()
  @IsString()
  support_resources?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  target_end_date: string;

  @IsOptional()
  @IsString()
  check_in_frequency?: string;
}

export class UpdatePipDto {
  @IsOptional()
  @IsEnum(PipStatus)
  status?: PipStatus;

  @IsOptional()
  @IsString()
  action_plan?: string;

  @IsOptional()
  @IsString()
  outcome_notes?: string;

  @IsOptional()
  @IsDateString()
  outcome_date?: string;
}
