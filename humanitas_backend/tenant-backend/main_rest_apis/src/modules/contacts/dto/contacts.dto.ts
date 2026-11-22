import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max,
  MaxLength, Min, ValidateNested,
} from 'class-validator';

export const CONTACT_TYPES = ['company', 'person'] as const;
export const CONTACT_ROLES = ['customer', 'vendor'] as const;
export const INTERACTION_KINDS = ['note', 'call', 'meeting', 'email', 'visit'] as const;

/** A person created together with their company. */
export class ContactPersonDto {
  @IsString() @Length(1, 255) name: string;
  @IsOptional() @IsString() @MaxLength(100) job_title?: string | null;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(30) mobile?: string | null;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string | null;
}

export class CreateContactDto {
  @IsString() @Length(1, 255) name: string;
  @IsOptional() @IsIn(CONTACT_TYPES) contact_type?: (typeof CONTACT_TYPES)[number];
  /** A person's company. */
  @IsOptional() @IsUUID() parent_id?: string | null;
  @IsOptional() @IsBoolean() is_primary_contact?: boolean;
  @IsOptional() @IsString() @MaxLength(100) job_title?: string | null;
  @IsOptional() @IsString() @MaxLength(30) code?: string;
  @IsOptional() @IsString() @MaxLength(255) legal_name?: string | null;
  /** Ethiopian TIN, 10 digits (spaces and dashes allowed). */
  @IsOptional() @IsString() @MaxLength(20) tin?: string | null;
  @IsOptional() @IsString() @MaxLength(30) vat_number?: string | null;
  @IsOptional() @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(30) mobile?: string | null;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string | null;
  @IsOptional() @IsString() @MaxLength(255) website?: string | null;
  @IsOptional() @Matches(/^[A-Z]{2}$/) country?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string | null;
  @IsOptional() @IsString() @MaxLength(100) city?: string | null;
  @IsOptional() @IsString() @MaxLength(100) subcity?: string | null;
  @IsOptional() @IsString() @MaxLength(100) woreda?: string | null;
  @IsOptional() @IsString() @MaxLength(255) street?: string | null;
  @IsOptional() @IsUUID() category_id?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsBoolean() is_customer?: boolean;
  @IsOptional() @IsBoolean() is_vendor?: boolean;
  @IsOptional() @IsUUID() price_list_id?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) credit_limit?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) payment_terms_days?: number;
  @IsOptional() @IsUUID() account_manager_id?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string | null;
  @IsOptional() @IsUUID() company_id?: string | null;
  /** People created with a company (the first one is the primary contact). */
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ContactPersonDto) people?: ContactPersonDto[];
  /** Save even though another contact has the same TIN. */
  @IsOptional() @IsBoolean() allow_duplicate?: boolean;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

export class ListContactsQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(CONTACT_ROLES) role?: (typeof CONTACT_ROLES)[number];
  @IsOptional() @IsIn(CONTACT_TYPES) contact_type?: (typeof CONTACT_TYPES)[number];
  @IsOptional() @IsUUID() parent_id?: string;
  @IsOptional() @IsUUID() category_id?: string;
  @IsOptional() @IsString() @MaxLength(40) tag?: string;
  @IsOptional() @IsUUID() account_manager_id?: string;
  @IsOptional() @IsIn(['active', 'archived', 'all']) status?: 'active' | 'archived' | 'all';
  @IsOptional() @IsIn(['name', 'code', 'created_at', 'updated_at']) sort?: 'name' | 'code' | 'created_at' | 'updated_at';
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class DuplicatesQueryDto {
  @IsOptional() @IsString() @MaxLength(20) tin?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) mobile?: string;
  @IsOptional() @IsString() @MaxLength(255) email?: string;
  @IsOptional() @IsUUID() exclude_id?: string;
}

/** A call, meeting, email, visit or note on the contact's history (communication history). */
export class ContactInteractionDto {
  @IsIn(INTERACTION_KINDS) kind: (typeof INTERACTION_KINDS)[number];
  @IsString() @Length(1, 2000) summary: string;
  @IsOptional() @IsIn(['inbound', 'outbound']) direction?: 'inbound' | 'outbound';
  @IsOptional() @IsDateString() occurred_at?: string;
  /** For a company: which of its people it was with. */
  @IsOptional() @IsUUID() person_id?: string;
}

export class ContactCategoryDto {
  @IsString() @Length(1, 100) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string | null;
  @IsOptional() @IsUUID() price_list_id?: string | null;
  @IsOptional() @IsUUID() company_id?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
}

export class UpdateContactCategoryDto extends PartialType(ContactCategoryDto) {
  @IsOptional() @IsBoolean() is_active?: boolean;
}
