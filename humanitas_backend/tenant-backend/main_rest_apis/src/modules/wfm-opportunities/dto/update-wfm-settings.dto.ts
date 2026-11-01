import { IsBoolean, IsIn, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class UpdateWfmSettingsDto {
  @IsOptional()
  @IsBoolean()
  vet_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  vto_enabled?: boolean;

  @IsOptional()
  @IsIn(['fcfs', 'seniority', 'fairness'])
  vet_claim_strategy?: 'fcfs' | 'seniority' | 'fairness';

  @IsOptional()
  @IsIn(['fcfs', 'seniority', 'fairness'])
  vto_claim_strategy?: 'fcfs' | 'seniority' | 'fairness';

  @IsOptional()
  @IsBoolean()
  vet_auto_approval?: boolean;

  @IsOptional()
  @IsBoolean()
  vto_auto_approval?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_weekly_ot_hours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_rest_hours_between_shifts?: number;

  @IsOptional()
  @IsBoolean()
  vto_allow_pto_funding?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vet_cancellation_cutoff_hours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vto_cancellation_cutoff_hours?: number;

  @IsOptional()
  @IsBoolean()
  notify_via_push?: boolean;

  @IsOptional()
  @IsBoolean()
  notify_via_email?: boolean;

  @IsOptional()
  @IsBoolean()
  notify_via_in_app?: boolean;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;
}
