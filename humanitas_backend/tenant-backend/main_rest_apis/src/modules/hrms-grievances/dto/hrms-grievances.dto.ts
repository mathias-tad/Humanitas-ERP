import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString, IsNumber, Min, Max, IsArray } from 'class-validator';

export enum GrievanceCategory {
  HARASSMENT = 'harassment',
  DISCRIMINATION = 'discrimination',
  SAFETY = 'safety',
  POLICY_VIOLATION = 'policy_violation',
  WORKPLACE_CONFLICT = 'workplace_conflict',
  COMPENSATION_DISPUTE = 'compensation_dispute',
  OTHER = 'other',
}

export enum GrievancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum GrievanceStatus {
  FILED = 'filed',
  ACKNOWLEDGED = 'acknowledged',
  INVESTIGATING = 'investigating',
  RESOLUTION_PROPOSED = 'resolution_proposed',
  CLOSED = 'closed',
}

export class FileGrievanceDto {
  @IsEnum(GrievanceCategory)
  category: GrievanceCategory;

  @IsString()
  subject: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(GrievancePriority)
  priority?: GrievancePriority = GrievancePriority.MEDIUM;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean = false;

  @IsOptional()
  @IsDateString()
  incident_date?: string;

  @IsOptional()
  @IsString()
  incident_location?: string;

  @IsOptional()
  @IsString()
  accused_parties?: string;

  @IsOptional()
  @IsString()
  witnesses?: string;

  @IsOptional()
  @IsArray()
  attachments?: {
    file_name: string;
    file_url: string;
    file_size?: number;
    file_type?: string;
  }[];
}

export class UpdateGrievanceStatusDto {
  @IsEnum(GrievanceStatus)
  status: GrievanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignInvestigatorDto {
  @IsString()
  investigator_id: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProposeResolutionDto {
  @IsString()
  resolution_summary: string;

  @IsOptional()
  @IsString()
  action_items?: string;

  @IsOptional()
  @IsBoolean()
  retaliation_monitoring_flag?: boolean = false;
}

export class SubmitSatisfactionFeedbackDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  satisfaction_score: number;

  @IsOptional()
  @IsString()
  satisfaction_feedback?: string;
}

export class AddGrievanceNoteDto {
  @IsString()
  notes: string;

  @IsOptional()
  @IsBoolean()
  is_confidential?: boolean = false;
}
