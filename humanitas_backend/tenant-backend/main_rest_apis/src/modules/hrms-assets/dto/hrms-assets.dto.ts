import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export enum AssetStatus {
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  MAINTENANCE = 'maintenance',
  REPAIR = 'repair',
  RETIRED = 'retired',
  LOST = 'lost',
}

export enum AssetCondition {
  NEW = 'new',
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  DAMAGED = 'damaged',
  MISSING = 'missing',
}

export class CreateAssetCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateAssetDto {
  @IsString()
  name: string;

  @IsString()
  category_id: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serial_number?: string;

  @IsOptional()
  @IsString()
  asset_tag?: string;

  @IsOptional()
  @IsNumber()
  purchase_cost?: number;

  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @IsOptional()
  @IsDateString()
  warranty_expiry?: string;

  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  company_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serial_number?: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsEnum(AssetCondition)
  condition?: AssetCondition;

  @IsOptional()
  @IsNumber()
  purchase_cost?: number;

  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @IsOptional()
  @IsDateString()
  warranty_expiry?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignAssetDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsDateString()
  assigned_date?: string;

  @IsOptional()
  @IsDateString()
  expected_return_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReturnAssetDto {
  @IsOptional()
  @IsEnum(AssetCondition)
  return_condition?: AssetCondition;

  @IsOptional()
  @IsDateString()
  returned_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMaintenanceLogDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsString()
  service_provider?: string;

  @IsOptional()
  @IsDateString()
  service_date?: string;

  @IsOptional()
  @IsDateString()
  next_service_date?: string;

  @IsOptional()
  @IsString()
  status?: string; // scheduled, in_progress, completed
}
