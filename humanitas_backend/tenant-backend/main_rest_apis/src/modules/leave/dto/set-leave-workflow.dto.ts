import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LeaveWorkflowStepDto {
  @IsString()
  @IsNotEmpty()
  role_required: string;

  @IsBoolean()
  @IsOptional()
  is_final?: boolean;

  @IsNumber()
  @Min(1)
  @IsOptional()
  step_order?: number;
}

export class SetLeaveWorkflowDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveWorkflowStepDto)
  steps: LeaveWorkflowStepDto[];
}
