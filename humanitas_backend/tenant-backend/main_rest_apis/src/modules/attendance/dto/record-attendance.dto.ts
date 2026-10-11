import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordAttendanceDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  shift_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scheduled_in?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scheduled_out?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  actual_in?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  actual_out?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  remarks?: string;
}
