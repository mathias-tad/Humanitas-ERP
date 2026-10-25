import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsBoolean, Min, IsDateString } from 'class-validator';

// ──────────────────────────────────────────────
// Job DTOs
// ──────────────────────────────────────────────

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  employment_type?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  positions?: number;

  @IsDateString()
  @IsOptional()
  closing_date?: string;
}

export class UpdateJobDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  employment_type?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  positions?: number;

  @IsDateString()
  @IsOptional()
  closing_date?: string;
}

// ──────────────────────────────────────────────
// Candidate / Screening DTOs
// ──────────────────────────────────────────────

export class RerankCandidatesDto {
  @IsOptional()
  weights?: Record<string, number>;
}

export class BulkShortlistDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  cutoff_score?: number;

  @IsString()
  @IsOptional()
  strategy?: string;
}

// ──────────────────────────────────────────────
// Export DTOs
// ──────────────────────────────────────────────

export class StartExportDto {
  @IsString()
  @IsNotEmpty()
  scope_type: string;

  @IsString()
  @IsOptional()
  status_filter?: string;

  @IsArray()
  @IsOptional()
  fields?: string[];
}

// ──────────────────────────────────────────────
// Form Definition DTO
// ──────────────────────────────────────────────

export class UpdateFormDto {
  @IsArray()
  @IsOptional()
  fields?: any[];

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

// ──────────────────────────────────────────────
// Application Link DTOs
// ──────────────────────────────────────────────

export class CreateApplicationLinkDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsDateString()
  @IsOptional()
  expires_at?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class ManageJobLinksDto {
  @IsArray()
  @IsOptional()
  link_ids?: string[];
}

// ──────────────────────────────────────────────
// Public Application DTO
// ──────────────────────────────────────────────

export class SubmitApplicationDto {
  // Dynamic fields from form definition — kept as flexible object
  [key: string]: any;
}

export class RecruitmentWebhookDto {
  @IsString()
  @IsOptional()
  event_type?: string;

  @IsOptional()
  data?: any;
}

// ──────────────────────────────────────────────
// Interview DTOs
// ──────────────────────────────────────────────

export class CreateInterviewDto {
  @IsString()
  @IsNotEmpty()
  job_id: string;

  @IsString()
  @IsNotEmpty()
  candidate_id: string;

  @IsString()
  @IsNotEmpty()
  candidate_name: string;

  @IsString()
  @IsOptional()
  candidate_email?: string;

  @IsString()
  @IsOptional()
  interviewer_id?: string;

  @IsString()
  @IsOptional()
  interviewer_name?: string;

  @IsString()
  @IsOptional()
  interview_type?: string;

  @IsDateString()
  @IsNotEmpty()
  scheduled_at: string;

  @IsNumber()
  @IsOptional()
  duration_minutes?: number;

  @IsString()
  @IsOptional()
  meeting_link?: string;

  @IsString()
  @IsOptional()
  feedback?: string;

  @IsNumber()
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;
}

export class UpdateInterviewDto {
  @IsString()
  @IsOptional()
  feedback?: string;

  @IsNumber()
  @IsOptional()
  rating?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  scheduled_at?: string;

  @IsNumber()
  @IsOptional()
  duration_minutes?: number;

  @IsString()
  @IsOptional()
  meeting_link?: string;

  @IsString()
  @IsOptional()
  interview_type?: string;

  @IsString()
  @IsOptional()
  interviewer_id?: string;

  @IsString()
  @IsOptional()
  interviewer_name?: string;
}

export class FilterInterviewDto {
  @IsString()
  @IsOptional()
  job_id?: string;

  @IsString()
  @IsOptional()
  candidate_id?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;
}

// ──────────────────────────────────────────────
// Offer DTOs
// ──────────────────────────────────────────────

export class CreateOfferDto {
  @IsString()
  @IsNotEmpty()
  job_id: string;

  @IsString()
  @IsNotEmpty()
  candidate_id: string;

  @IsString()
  @IsNotEmpty()
  candidate_name: string;

  @IsString()
  @IsOptional()
  candidate_email?: string;

  @IsString()
  @IsNotEmpty()
  position_title: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsNumber()
  @IsNotEmpty()
  offered_salary: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @IsString()
  @IsOptional()
  letter_content?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;
}

export class UpdateOfferStatusDto {
  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsOptional()
  letter_content?: string;

  @IsDateString()
  @IsOptional()
  signed_at?: string;
}

export class FilterOfferDto {
  @IsString()
  @IsOptional()
  job_id?: string;

  @IsString()
  @IsOptional()
  candidate_id?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;
}

// ──────────────────────────────────────────────
// Conversion DTO
// ──────────────────────────────────────────────

export class ConvertCandidateToEmployeeDto {
  @IsString()
  @IsOptional()
  job_id?: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  position_title?: string;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsNumber()
  @IsOptional()
  salary?: number;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;

  @IsString()
  @IsOptional()
  template_id?: string;
}

// ──────────────────────────────────────────────
// Reports Filter DTO
// ──────────────────────────────────────────────

export class RecruitmentReportsFilterDto {
  @IsString()
  @IsOptional()
  job_id?: string;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;
}

