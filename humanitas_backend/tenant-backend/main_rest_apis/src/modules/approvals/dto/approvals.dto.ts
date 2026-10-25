import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum WorkflowRoutingMode {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
}

export enum ApprovalActionType {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ESCALATED = 'escalated',
}

export enum ApprovalRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export class CreateWorkflowStepDto {
  @IsNumber()
  @Min(1)
  step_order: number;

  @IsString()
  step_name: string;

  @IsOptional()
  @IsString()
  approver_role?: string;

  @IsOptional()
  @IsUUID()
  approver_user_id?: string;

  @IsOptional()
  @IsBoolean()
  require_all_in_step?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  escalation_hours?: number;
}

export class CreateWorkflowDto {
  @IsString()
  workflow_type: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(WorkflowRoutingMode)
  routing_mode?: WorkflowRoutingMode;

  @IsOptional()
  @IsNumber()
  threshold_amount?: number;

  @IsOptional()
  @IsString()
  threshold_currency?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps: CreateWorkflowStepDto[];
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(WorkflowRoutingMode)
  routing_mode?: WorkflowRoutingMode;

  @IsOptional()
  @IsNumber()
  threshold_amount?: number;

  @IsOptional()
  @IsString()
  threshold_currency?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps?: CreateWorkflowStepDto[];
}

export class SubmitApprovalRequestDto {
  @IsString()
  workflow_type: string;

  @IsString()
  entity_type: string;

  @IsString()
  entity_id: string;

  @IsOptional()
  @IsString()
  reference_number?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;
}

export class DecideApprovalRequestDto {
  @IsEnum(ApprovalActionType)
  action: ApprovalActionType;

  @IsOptional()
  @IsString()
  comments?: string;
}
