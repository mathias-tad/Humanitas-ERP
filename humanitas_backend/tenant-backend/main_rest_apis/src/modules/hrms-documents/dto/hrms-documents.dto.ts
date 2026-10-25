import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export enum DocumentCategory {
  CONTRACT = 'contract',
  IDENTIFICATION = 'identification',
  TAX_LEGAL = 'tax_legal',
  LETTER = 'letter',
  CERTIFICATION = 'certification',
  DISCIPLINARY = 'disciplinary',
  OTHER = 'other',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum SignatureStatus {
  NOT_REQUIRED = 'not_required',
  PENDING = 'pending',
  SIGNED = 'signed',
  DECLINED = 'declined',
}

export class DocumentsFilterDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsEnum(VerificationStatus)
  verificationStatus?: VerificationStatus;

  @IsOptional()
  @IsString()
  expiringWithinDays?: string; // e.g. '30', '60', '90', 'expired'

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  company_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;
}

export class CreateDocumentDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(DocumentCategory)
  @IsNotEmpty()
  category: DocumentCategory;

  @IsString()
  @IsNotEmpty()
  documentType: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsNumber()
  @IsOptional()
  fileSize?: number;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isConfidential?: boolean;

  @IsEnum(SignatureStatus)
  @IsOptional()
  signatureStatus?: SignatureStatus;

  @IsOptional()
  @IsString()
  company_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;
}

export class VerifyDocumentDto {
  @IsEnum(VerificationStatus)
  @IsNotEmpty()
  status: VerificationStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateLetterTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  bodyTemplate: string;

  @IsOptional()
  @IsString()
  company_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;
}

export class UpdateLetterTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  bodyTemplate?: string;
}

export class GenerateLetterDto {
  @IsString()
  @IsNotEmpty()
  templateIdOrCode: string;

  @IsUUID()
  @IsNotEmpty()
  employeeId: string;

  @IsOptional()
  customTokens?: Record<string, string>;

  @IsBoolean()
  @IsOptional()
  saveToVault?: boolean; // If true, saves generated letter into employee's document vault
}
