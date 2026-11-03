import { IsOptional, IsString, IsDateString, IsEnum, IsBoolean } from 'class-validator';
import { EventCategory } from '../entities/calendar-event.entity';

export class QueryCalendarEventsDto {
  @IsDateString()
  @IsOptional()
  start?: string;

  @IsDateString()
  @IsOptional()
  end?: string;

  @IsString()
  @IsOptional()
  sources?: string; // comma-separated module_keys

  @IsEnum(['common', 'workforce', 'projects', 'commercial', 'financial'])
  @IsOptional()
  category?: EventCategory;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;

  @IsBoolean()
  @IsOptional()
  my_events?: boolean; // only return events for current user
}
