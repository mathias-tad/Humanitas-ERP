import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchAttendanceStatusDto {
  @ApiProperty({ description: 'Array of attendance record UUIDs', type: [String] })
  @IsArray()
  @IsNotEmpty()
  record_ids: string[];

  @ApiProperty({ description: 'New attendance status', enum: ['Present', 'Absent', 'Excused'] })
  @IsIn(['Present', 'Absent', 'Excused'])
  status: 'Present' | 'Absent' | 'Excused';

  @ApiPropertyOptional({ description: 'Remarks or reason for batch update' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
