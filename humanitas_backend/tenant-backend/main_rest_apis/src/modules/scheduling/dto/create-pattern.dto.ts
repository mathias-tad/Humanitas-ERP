import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class PatternDayDto {
  @ApiProperty()
  @IsNumber()
  day_number: number; // 1-based index in cycle

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  shift_id?: string;

  @ApiProperty()
  @IsBoolean()
  is_day_off: boolean;
}

export class CreateShiftPatternDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsNumber()
  cycle_length_days: number;

  @ApiProperty({ type: [PatternDayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatternDayDto)
  shifts: PatternDayDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Enable rotating day-offs through the week (7-week cycle)' })
  @IsBoolean()
  @IsOptional()
  enable_dayoff_rotation?: boolean;
}

export class UpdateShiftPatternDto extends PartialType(CreateShiftPatternDto) {}

