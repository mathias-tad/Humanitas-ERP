import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignPatternDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  pattern_id?: string;

  @ApiProperty()
  @IsDateString()
  start_date: string; // YYYY-MM-DD when day 1 of pattern starts

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  end_date?: string;

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
