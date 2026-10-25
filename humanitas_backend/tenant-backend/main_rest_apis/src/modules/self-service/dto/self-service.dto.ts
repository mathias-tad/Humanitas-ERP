import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
} from 'class-validator';

export class UpdateProfileSelfDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;

  @IsOptional()
  @IsString()
  emergency_contact_relationship?: string;
}

export class RequestSensitiveChangeDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['account_number', 'bank_name', 'tin', 'national_id'])
  field_name: 'account_number' | 'bank_name' | 'tin' | 'national_id';

  @IsString()
  @IsNotEmpty()
  proposed_value: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  supporting_doc_url?: string;
}

export class ReviewSensitiveChangeDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  reviewer_notes?: string;
}
