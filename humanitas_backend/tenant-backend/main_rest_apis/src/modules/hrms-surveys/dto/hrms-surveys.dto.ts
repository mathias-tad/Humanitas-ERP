import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SurveyType {
  PULSE = 'pulse',
  ENGAGEMENT = 'engagement',
  CULTURE = 'culture',
  ONBOARDING = 'onboarding',
  EXIT = 'exit',
  CUSTOM = 'custom',
}

export enum SurveyStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

export enum QuestionType {
  RATING_SCALE = 'rating_scale', // 1-5
  NPS = 'nps',                   // 0-10
  MULTIPLE_CHOICE = 'multiple_choice',
  TEXT = 'text',
}

export class CreateQuestionDto {
  @IsString()
  question_text: string;

  @IsEnum(QuestionType)
  question_type: QuestionType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  is_required?: boolean;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

export class CreateSurveyDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SurveyType)
  survey_type?: SurveyType;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;

  @IsOptional()
  @IsNumber()
  min_responses_for_results?: number;

  @IsOptional()
  @IsString()
  target_audience?: string; // all, department, branch

  @IsOptional()
  @IsString()
  target_department?: string;

  @IsOptional()
  @IsString()
  target_branch_id?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}

export class AnswerItemDto {
  @IsString()
  question_id: string;

  @IsOptional()
  @IsNumber()
  rating_value?: number;

  @IsOptional()
  @IsString()
  text_value?: string;

  @IsOptional()
  @IsString()
  selected_option?: string;
}

export class SubmitSurveyResponseDto {
  @IsString()
  survey_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerItemDto)
  answers: AnswerItemDto[];
}

export class CreateSurveyActionItemDto {
  @IsString()
  survey_id: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assigned_to_user_id?: string;

  @IsOptional()
  @IsString()
  due_date?: string;
}

export class UpdateSurveyActionItemDto {
  @IsOptional()
  @IsString()
  status?: string; // open, in_progress, completed

  @IsOptional()
  @IsString()
  resolution_notes?: string;
}
