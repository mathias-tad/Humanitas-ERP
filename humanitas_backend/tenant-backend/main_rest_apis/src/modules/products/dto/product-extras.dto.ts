import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { EIMS_TAX_CODE_LIST, type EimsTaxCode } from '../products.eims';
import { PRODUCT_TYPES, type ProductType } from './products.dto';
import { CATALOG_ISSUES, COMPOSITIONS, PACKAGING_LEVELS, type CatalogIssue, type Composition, type PackagingLevel } from '../product-structure';

export class UpdateProductSettingsDto {
  @IsOptional() @IsIn(['manual', 'auto']) sku_mode?: 'manual' | 'auto';
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9._/-]{0,10}$/, { message: 'The SKU prefix may have up to 10 letters, digits, dot, dash, underscore or slash' }) sku_prefix?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) sku_padding?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) sku_next?: number;
  @IsOptional() @IsIn(['manual', 'ean13']) barcode_mode?: 'manual' | 'ean13';
  @IsOptional() @IsString() @Matches(/^[0-9]{2,10}$/, { message: 'The barcode prefix is 2 to 10 digits (20-29 are free for in-store numbers)' }) barcode_prefix?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) barcode_next?: number;
  @IsOptional() @IsIn(PRODUCT_TYPES) default_product_type?: ProductType;
  @IsOptional() @IsIn(EIMS_TAX_CODE_LIST) default_tax_code?: EimsTaxCode;
  @IsOptional() @IsUUID() default_uom_id?: string | null;
  @IsOptional() @IsUUID() default_category_id?: string | null;
  @IsOptional() @IsBoolean() require_category?: boolean;
  @IsOptional() @IsBoolean() require_barcode?: boolean;
  @IsOptional() @IsBoolean() warn_below_cost?: boolean;
}

export class PackagingDto {
  @IsString() @Length(1, 50) name: string;
  @IsOptional() @IsIn(PACKAGING_LEVELS) level?: PackagingLevel;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) quantity: number;
  @IsOptional() @IsString() @Matches(/^([0-9]{8}|[0-9]{12,14})$/, { message: 'A GTIN is 8, 12, 13 or 14 digits' }) gtin?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) weight_kg?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) length_cm?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) width_cm?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) height_cm?: number | null;
  @IsOptional() @IsBoolean() can_sell?: boolean;
  @IsOptional() @IsBoolean() can_buy?: boolean;
}

export class SavePackagingsDto {
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PackagingDto) packagings: PackagingDto[];
}

export class ComponentDto {
  @IsUUID() component_id: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) quantity: number;
}

export class ComboChoiceDto {
  @IsUUID() component_id: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0.0001) quantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) extra_price?: number;
  @IsOptional() @IsBoolean() is_default?: boolean;
}

export class ComboGroupDto {
  @IsString() @Length(1, 100) name: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(50) min_choices: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) max_choices: number;
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ComboChoiceDto) choices: ComboChoiceDto[];
}

/** The whole structure in one go: single (no components), a kit, or a combo. */
export class SaveCompositionDto {
  @IsIn(COMPOSITIONS) composition: Composition;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ComponentDto) components?: ComponentDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ComboGroupDto) groups?: ComboGroupDto[];
}

export class UpdateMediaDto {
  @IsOptional() @IsString() @MaxLength(150) title?: string | null;
  @IsOptional() @IsBoolean() is_primary?: boolean;
}

export class ReorderMediaDto {
  @IsArray() @ArrayMaxSize(60) @IsUUID('all', { each: true }) media_ids: string[];
}

export class ReportQueryDto {
  @IsOptional() @IsIn(CATALOG_ISSUES) issue?: CatalogIssue;
  @IsOptional() @IsUUID() category_id?: string;
}

export class SetPriceListCustomersDto {
  @IsArray() @ArrayMaxSize(2000) @IsUUID('all', { each: true }) contact_ids: string[];
}
