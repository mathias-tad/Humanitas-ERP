import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, IsNumber, Min } from 'class-validator';

export class CreateKnowledgeDocumentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  @IsIn([
    'company_policy',
    'legal_proclamation',
    'employment_agreement',
    'code_of_conduct',
    'benefits_guide',
    'disciplinary_rules',
    'health_and_safety',
    'custom',
  ])
  category?: string;

  @IsString()
  @IsOptional()
  @IsIn(['text', 'file'])
  content_type?: string;

  @IsString()
  @IsOptional()
  raw_text?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class UpdateKnowledgeDocumentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  raw_text?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class SearchKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  company_id?: string;

  @IsString()
  @IsOptional()
  branch_id?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  limit?: number;
}
