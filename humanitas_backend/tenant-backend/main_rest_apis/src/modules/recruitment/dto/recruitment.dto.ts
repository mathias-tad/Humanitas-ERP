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

