import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max,
  MaxLength, Min,
} from 'class-validator';

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
export const ACTIVITY_TYPES = ['call', 'meeting', 'email', 'visit', 'todo'] as const;
export const RELATED_TYPES = ['lead', 'opportunity', 'contact'] as const;


class Paged {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

// ── Leads ────────────────────────────────────────────────────────────────────
export class CreateLeadDto {
  @IsString() @Length(1, 255) title: string;
  @IsOptional() @IsString() @MaxLength(255) person_name?: string | null;
  @IsOptional() @IsString() @MaxLength(255) company_name?: string | null;
  @IsOptional() @IsString() @MaxLength(100) job_title?: string | null;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string | null;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(30) mobile?: string | null;
  @IsOptional() @IsString() @MaxLength(100) city?: string | null;
  @IsOptional() @IsUUID() source_id?: string | null;
  @IsOptional() @IsUUID() owner_id?: string | null;
  @IsOptional() @IsIn(['new', 'contacted', 'qualified']) status?: 'new' | 'contacted' | 'qualified';
  @IsOptional() @IsString() @MaxLength(5000) need?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) budget?: number | null;
  @IsOptional() @IsString() @MaxLength(100) timeline?: string | null;
  @IsOptional() @IsString() @MaxLength(255) decision_maker?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) expected_revenue?: number | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
  @IsOptional() @IsUUID() company_id?: string | null;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class ListLeadsQueryDto extends Paged {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn([...LEAD_STATUSES, 'open']) status?: (typeof LEAD_STATUSES)[number] | 'open';
  @IsOptional() @IsString() @MaxLength(40) owner_id?: string;
  @IsOptional() @IsUUID() source_id?: string;
  @IsOptional() @IsIn(['active', 'archived']) archived?: 'active' | 'archived';
}

export class LoseDto {
  @IsUUID() lost_reason_id: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string | null;
}

/** Convert a lead: a new or existing contact, and optionally an opportunity. */
export class ConvertLeadDto {
  /** Existing company (or person) contact; leave out to create one from the lead. */
  @IsOptional() @IsUUID() contact_id?: string;
  @IsOptional() @IsBoolean() create_opportunity?: boolean;
  @IsOptional() @IsString() @MaxLength(255) opportunity_name?: string;
  @IsOptional() @IsUUID() pipeline_id?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) expected_revenue?: number;
  @IsOptional() @IsDateString() expected_close_date?: string;
}

// ── Opportunities ────────────────────────────────────────────────────────────
export class CreateOpportunityDto {
  @IsString() @Length(1, 255) name: string;
  @IsOptional() @IsUUID() contact_id?: string | null;
  @IsOptional() @IsUUID() person_id?: string | null;
  @IsOptional() @IsUUID() pipeline_id?: string;
  @IsOptional() @IsUUID() stage_id?: string;
  @IsOptional() @IsUUID() owner_id?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) expected_revenue?: number;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) probability?: number | null;
  @IsOptional() @IsDateString() expected_close_date?: string | null;
  @IsOptional() @IsUUID() source_id?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
  @IsOptional() @IsUUID() company_id?: string | null;
}

export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {}

export class ListOpportunitiesQueryDto extends Paged {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() pipeline_id?: string;
  @IsOptional() @IsUUID() stage_id?: string;
  @IsOptional() @IsIn(['open', 'won', 'lost']) status?: 'open' | 'won' | 'lost';
  @IsOptional() @IsString() @MaxLength(40) owner_id?: string;
  @IsOptional() @IsUUID() contact_id?: string;
  /** Open deals past their close date or with no planned activity. */
  @IsOptional() @IsIn(['overdue', 'no_activity', 'stuck']) attention?: 'overdue' | 'no_activity' | 'stuck';
  @IsOptional() @IsIn(['active', 'archived']) archived?: 'active' | 'archived';
}

export class BoardQueryDto {
  @IsOptional() @IsUUID() pipeline_id?: string;
  @IsOptional() @IsString() @MaxLength(40) owner_id?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export class MoveStageDto {
  @IsUUID() stage_id: string;
}

export class ForecastQueryDto {
  @IsOptional() @IsUUID() pipeline_id?: string;
  @IsOptional() @IsString() @MaxLength(40) owner_id?: string;
}

// ── Activities ───────────────────────────────────────────────────────────────
export class CreateActivityDto {
  @IsIn(ACTIVITY_TYPES) activity_type: (typeof ACTIVITY_TYPES)[number];
  @IsString() @Length(1, 255) subject: string;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
  @IsDateString() due_at: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440) duration_minutes?: number | null;
  /** Defaults to the person creating it. */
  @IsOptional() @IsUUID() assigned_to?: string;
  @IsOptional() @IsIn(RELATED_TYPES) related_type?: (typeof RELATED_TYPES)[number] | null;
  @IsOptional() @IsUUID() related_id?: string | null;
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}

export class CompleteActivityDto {
  @IsOptional() @IsString() @MaxLength(5000) outcome?: string | null;
}

export class ListActivitiesQueryDto extends Paged {
  /** me (default), all, or a user id. */
  @IsOptional() @IsString() @MaxLength(40) assigned_to?: string;
  @IsOptional() @IsIn(['overdue', 'today', 'upcoming', 'open', 'done']) when?: 'overdue' | 'today' | 'upcoming' | 'open' | 'done';
  @IsOptional() @IsIn(RELATED_TYPES) related_type?: (typeof RELATED_TYPES)[number];
  @IsOptional() @IsUUID() related_id?: string;
}

// ── Set-up ───────────────────────────────────────────────────────────────────
export class PipelineDto {
  @IsString() @Length(1, 100) name: string;
  @IsOptional() @IsBoolean() is_default?: boolean;
  @IsOptional() @IsUUID() company_id?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
}
export class UpdatePipelineDto extends PartialType(PipelineDto) {
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class StageDto {
  @IsString() @Length(1, 100) name: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) probability?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) rotting_days?: number | null;
  @IsOptional() @IsBoolean() is_won?: boolean;
  @IsOptional() @IsBoolean() is_lost?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
}
export class UpdateStageDto extends PartialType(StageDto) {}

export class ReorderStagesDto {
  @IsArray() @ArrayMaxSize(50) @IsUUID('all', { each: true }) stage_ids: string[];
}

export class ListItemDto {
  @IsString() @Length(1, 100) name: string;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
}
export class UpdateListItemDto extends PartialType(ListItemDto) {
  @IsOptional() @IsBoolean() is_active?: boolean;
}
