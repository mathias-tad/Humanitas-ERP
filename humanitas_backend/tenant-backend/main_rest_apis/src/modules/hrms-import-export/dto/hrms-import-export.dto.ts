import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsNumber, IsObject } from 'class-validator';

export enum ImportExportType {
  IMPORT = 'import',
  EXPORT = 'export',
}

export enum EntityType {
  EMPLOYEES = 'employees',
  ATTENDANCE = 'attendance',
  LEAVE_BALANCES = 'leave_balances',
  PAYROLL_ADJUSTMENTS = 'payroll_adjustments',
  ASSETS = 'assets',
  TRAINING_RECORDS = 'training_records',
}

export enum FileFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

export enum JobStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  VALIDATED = 'validated',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export enum ImportMode {
  CREATE_ONLY = 'create_only',
  UPSERT = 'upsert',
}

export class ValidateImportDto {
  @IsEnum(EntityType)
  entity_type: EntityType;

  @IsEnum(ImportMode)
  @IsOptional()
  mode?: ImportMode;

  @IsArray()
  rows: Record<string, any>[];

  @IsString()
  @IsOptional()
  file_name?: string;
}

export class CommitImportDto {
  @IsString()
  job_id: string;

  @IsEnum(EntityType)
  entity_type: EntityType;

  @IsEnum(ImportMode)
  @IsOptional()
  mode?: ImportMode;

  @IsArray()
  validated_rows: Record<string, any>[];
}

export class TriggerExportDto {
  @IsEnum(EntityType)
  entity_type: EntityType;

  @IsEnum(FileFormat)
  format: FileFormat;

  @IsArray()
  @IsOptional()
  selected_fields?: string[];

  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;
}

export class CreateExportTemplateDto {
  @IsString()
  name: string;

  @IsEnum(EntityType)
  entity_type: EntityType;

  @IsArray()
  selected_fields: string[];

  @IsObject()
  @IsOptional()
  filter_config?: Record<string, any>;

  @IsString()
  @IsOptional()
  schedule_cron?: string;

  @IsString()
  @IsOptional()
  delivery_email?: string;
}

export class UpdateExportTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsOptional()
  selected_fields?: string[];

  @IsObject()
  @IsOptional()
  filter_config?: Record<string, any>;

  @IsString()
  @IsOptional()
  schedule_cron?: string;

  @IsString()
  @IsOptional()
  delivery_email?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
