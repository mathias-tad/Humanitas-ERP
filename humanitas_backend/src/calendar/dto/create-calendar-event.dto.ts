import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsArray,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { EventCategory } from '../entities/calendar-event.entity';

export class CreateCalendarEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsBoolean()
  @IsOptional()
  all_day?: boolean;

  @IsEnum(['common', 'workforce', 'projects', 'commercial', 'financial'])
  @IsOptional()
  category?: EventCategory;

  @IsString()
  @IsOptional()
  event_type?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  route_url?: string;

  @IsString()
  @IsOptional()
  recurrence_rule?: string;

  @IsBoolean()
  @IsOptional()
  is_public?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attendee_ids?: string[];

  @IsString()
  @IsOptional()
  module_key?: string;

  @IsString()
  @IsOptional()
  source_id?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;

  @IsString()
  @IsOptional()
  department_id?: string;
}
