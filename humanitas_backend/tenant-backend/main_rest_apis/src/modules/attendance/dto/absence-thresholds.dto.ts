import { IsBoolean, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AbsenceThresholdsDto {
  @ApiProperty({ description: 'Consecutive absence days threshold', default: 3 })
  @IsNumber()
  @Min(1)
  consecutive_threshold: number;

  @ApiProperty({ description: 'Monthly absence days threshold', default: 5 })
  @IsNumber()
  @Min(1)
  monthly_threshold: number;

  @ApiProperty({ description: 'Notify employee when threshold is met', default: true })
  @IsBoolean()
  notify_employee: boolean;

  @ApiProperty({ description: 'Notify supervisor/manager when threshold is met', default: true })
  @IsBoolean()
  notify_supervisor: boolean;

  @ApiProperty({ description: 'Notify HR admin when threshold is met', default: true })
  @IsBoolean()
  notify_hr: boolean;

  @ApiProperty({ description: 'Enable absence threshold alerts', default: true })
  @IsBoolean()
  is_enabled: boolean;
}
