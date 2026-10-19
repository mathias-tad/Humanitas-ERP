import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignPatternDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => (!value || value === '' || value === 'standard' ? null : value))
  @IsUUID()
  @IsOptional()
  pattern_id?: string | null;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD when day 1 of pattern starts (defaults to today if omitted)' })
  @IsDateString()
  @IsOptional()
  start_date?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Current week in rotation (1-based)' })
  @IsNumber()
  @IsOptional()
  current_week_in_rotation?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string; // Audit

  @ApiPropertyOptional({ description: 'List of day indices to be off (0=Mon, 6=Sun)' })
  @IsOptional()
  day_off_days?: number[];

  @ApiPropertyOptional({ description: 'Whether day offs rotate each week' })
  @IsBoolean()
  @IsOptional()
  auto_rotate_dayoff?: boolean;
}
