import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShiftDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'start_time must be in HH:mm format',
  })
  start_time: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'end_time must be in HH:mm format',
  })
  end_time: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_overnight?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string; // Audit

  @ApiPropertyOptional()
  @IsOptional()
  grace_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  wait_for_absent_minutes?: number;
}
