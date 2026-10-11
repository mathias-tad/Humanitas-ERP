import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class ApplyLeaveDto {
  @IsString()
  @IsNotEmpty()
  leave_type_id: string;

  @IsString()
  @IsNotEmpty()
  leave_type_name: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
