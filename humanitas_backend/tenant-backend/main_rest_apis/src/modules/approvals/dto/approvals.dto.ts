import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsIn,
  IsArray,
  ValidateNested,
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
  ESCALATED = 'escalated',
  CANCELLED = 'cancelled',
}

export class CreateWorkflowStepDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  step_order?: number;

  @IsOptional()
  @IsString()
  step_name?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  approver_role?: string;

  @IsOptional()
  @IsString()
  role_name?: string;

  @IsOptional()
  @IsUUID()
  approver_user_id?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsBoolean()
  require_all_in_step?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  escalation_hours?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  sla_hours?: number;
}

export class CreateWorkflowDto {
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsNotEmpty()
  @IsString()
  workflow_type: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['sequential', 'parallel'])
  routing_mode?: WorkflowRoutingMode | 'sequential' | 'parallel';

  @IsOptional()
  @IsNumber()
  threshold_amount?: number;

  @IsOptional()
  @IsNumber()
  min_amount?: number;

  @IsOptional()
  @IsNumber()
  max_amount?: number;

  @IsOptional()
  @IsString()
  threshold_currency?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps: CreateWorkflowStepDto[];
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  workflow_type?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['sequential', 'parallel'])
  routing_mode?: WorkflowRoutingMode | 'sequential' | 'parallel';

  @IsOptional()
  @IsNumber()
  threshold_amount?: number;

  @IsOptional()
  @IsNumber()
  min_amount?: number;

  @IsOptional()
  @IsNumber()
  max_amount?: number;

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
  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsUUID()
  workflow_id?: string;

  @IsNotEmpty()
  @IsString()
  workflow_type: string;

  @IsNotEmpty()
  @IsString()
  entity_type: string;

  @IsNotEmpty()
  @IsString()
  entity_id: string;

  @IsOptional()
  @IsString()
  reference_number?: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUUID()
  submitter_id?: string;

  @IsOptional()
  @IsString()
  submitter_name?: string;

  @IsOptional()
  @IsString()
  submitter_email?: string;

  @IsOptional()
  @IsString()
  department?: string;
}

export class DecideApprovalRequestDto {
  @IsOptional()
  @IsIn(['approved', 'rejected', 'escalated'])
  action?: ApprovalActionType | 'approved' | 'rejected' | 'escalated';

  @IsOptional()
  @IsIn(['approved', 'rejected', 'escalated'])
  decision?: ApprovalActionType | 'approved' | 'rejected' | 'escalated';

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class FilterApprovalRequestsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  workflow_type?: string;

  @IsOptional()
  @IsUUID()
  submitter_id?: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  entity_type?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsBoolean()
  my_pending?: boolean;

  @IsOptional()
  @IsString()
  user_role?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number;
}
