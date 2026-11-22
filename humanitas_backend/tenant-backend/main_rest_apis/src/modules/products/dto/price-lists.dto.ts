import { OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export const RULE_SCOPES = ['product', 'category', 'all'] as const;
export const RULE_COMPUTES = ['fixed', 'discount', 'markup'] as const;

export class CreatePriceListDto {
  @IsString() @Length(1, 100) name: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,30}$/, { message: 'code may contain letters, digits, - and _ (up to 30)' }) code?: string | null;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter code such as ETB or USD' }) currency?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsBoolean() is_default?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
  /** null = shared by every company (users with every company only). */
  @IsOptional() @IsUUID() company_id?: string | null;
  /** null = shared by every branch (users with every branch only). */
  @IsOptional() @IsUUID() branch_id?: string | null;
}

export class UpdatePriceListDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,30}$/, { message: 'code may contain letters, digits, - and _ (up to 30)' }) code?: string | null;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter code such as ETB or USD' }) currency?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsBoolean() is_default?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
  @IsOptional() @IsUUID() company_id?: string | null;
  /** null = shared by every branch (users with every branch only). */
  @IsOptional() @IsUUID() branch_id?: string | null;
}

export class PriceRuleDto {
  @IsIn(RULE_SCOPES) applies_to: (typeof RULE_SCOPES)[number];
  @IsOptional() @IsUUID() product_id?: string | null;
  @IsOptional() @IsUUID() category_id?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) min_quantity?: number;
  @IsIn(RULE_COMPUTES) compute: (typeof RULE_COMPUTES)[number];
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) fixed_price?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(-100) @Max(1000) percent?: number | null;
  @IsOptional() @IsDateString() date_start?: string | null;
  @IsOptional() @IsDateString() date_end?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
}

/** The same rule for several products at once: one rule per product. */
export class BulkPriceRulesDto extends OmitType(PriceRuleDto, ['applies_to', 'product_id', 'category_id'] as const) {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsUUID('all', { each: true }) product_ids: string[];
}

export class UpdatePriceRuleDto {
  @IsOptional() @IsIn(RULE_SCOPES) applies_to?: (typeof RULE_SCOPES)[number];
  @IsOptional() @IsUUID() product_id?: string | null;
  @IsOptional() @IsUUID() category_id?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) min_quantity?: number;
  @IsOptional() @IsIn(RULE_COMPUTES) compute?: (typeof RULE_COMPUTES)[number];
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) fixed_price?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(-100) @Max(1000) percent?: number | null;
  @IsOptional() @IsDateString() date_start?: string | null;
  @IsOptional() @IsDateString() date_end?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class PriceQueryDto {
  @IsUUID() product_id: string;
  @IsOptional() @IsUUID() price_list_id?: string;
  /** The customer's own list when no price_list_id is given (then the default list). */
  @IsOptional() @IsUUID() customer_id?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsDateString() date?: string;
}

export class CompareQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() category_id?: string;
  /** Comma-separated price list ids; all active lists when omitted. */
  @IsOptional() @IsString() @MaxLength(2000) price_list_ids?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}

export class ListPriceListsQueryDto {
  @IsOptional() @IsIn(['true', 'false']) include_archived?: string;
}

