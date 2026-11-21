import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EIMS_TAX_CODE_LIST, HS_CODE_PATTERN, ITEM_CODE_PATTERN, type EimsTaxCode } from '../products.eims';

export const PRODUCT_TYPES = ['storable', 'consumable', 'service'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export const BARCODE_TYPES = ['ean13', 'ean8', 'upca', 'code128', 'qr', 'other'] as const;

export class ProductBarcodeDto {
  @IsString()
  @Length(1, 128)
  @Matches(/^\S+$/, { message: 'barcode must not contain spaces' })
  barcode: string;

  @IsOptional()
  @IsIn(BARCODE_TYPES)
  barcode_type?: (typeof BARCODE_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  packaging?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

/** Only `name` is required, so POS/Sales quick-create (featureslist §29) can create a product in one step. */
export class CreateProductDto {
  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9._\-/]+$/, { message: 'sku may contain letters, digits, dot, dash, underscore and slash only' })
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(PRODUCT_TYPES)
  product_type?: ProductType;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  /** Defaults to the "Units" reference unit. */
  @IsOptional()
  @IsUUID()
  uom_id?: string;

  /** Defaults to uom_id; must be in the same unit category. */
  @IsOptional()
  @IsUUID()
  purchase_uom_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  sales_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  cost_price?: number;

  /** MoR line tax code (rule 28). The tax rate is derived from it. Defaults to VAT15. */
  @IsOptional()
  @IsIn(EIMS_TAX_CODE_LIST)
  tax_code?: EimsTaxCode;

  /** MoR ItemCode (max 15). Generated when omitted, so quick-created products can be e-invoiced. */
  @IsOptional()
  @IsString()
  @Matches(ITEM_CODE_PATTERN, { message: 'item_code must be 1-15 letters, digits, dot, dash, underscore or slash' })
  item_code?: string;

  /** HS / harmonization code (max 15); required by MoR for some taxpayers and exports. */
  @IsOptional()
  @IsString()
  @Matches(HS_CODE_PATTERN, { message: 'harmonization_code must be 2-15 digits or letters' })
  harmonization_code?: string | null;

  /** Excise rate in %; omit to use the category's rate. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(500)
  excise_rate?: number | null;

  /** Description sent to MoR (max 100); defaults to the product name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoice_description?: string | null;

  @IsOptional()
  @IsBoolean()
  can_be_sold?: boolean;

  @IsOptional()
  @IsBoolean()
  can_be_purchased?: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  image_url?: string;

  /** null = shared by every company of the tenant. */
  @IsOptional()
  @IsUUID()
  company_id?: string | null;

  @IsOptional()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductBarcodeDto)
  barcodes?: ProductBarcodeDto[];
}

export class UpdateProductDto {
  @IsOptional() @IsString() @Length(1, 255) name?: string;
  @IsOptional() @IsString() @Length(1, 64)
  @Matches(/^[A-Za-z0-9._\-/]+$/, { message: 'sku may contain letters, digits, dot, dash, underscore and slash only' })
  sku?: string | null;
  @IsOptional() @IsString() @MaxLength(5000) description?: string | null;
  @IsOptional() @IsIn(PRODUCT_TYPES) product_type?: ProductType;
  @IsOptional() @IsUUID() category_id?: string | null;
  @IsOptional() @IsUUID() uom_id?: string;
  @IsOptional() @IsUUID() purchase_uom_id?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) sales_price?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) cost_price?: number;
  @IsOptional() @IsIn(EIMS_TAX_CODE_LIST) tax_code?: EimsTaxCode;
  @IsOptional() @IsString()
  @Matches(ITEM_CODE_PATTERN, { message: 'item_code must be 1-15 letters, digits, dot, dash, underscore or slash' })
  item_code?: string;
  @IsOptional() @IsString() @Matches(HS_CODE_PATTERN, { message: 'harmonization_code must be 2-15 digits or letters' })
  harmonization_code?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(500) excise_rate?: number | null;
  @IsOptional() @IsString() @MaxLength(100) invoice_description?: string | null;
  @IsOptional() @IsBoolean() can_be_sold?: boolean;
  @IsOptional() @IsBoolean() can_be_purchased?: boolean;
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(2000) image_url?: string | null;
  @IsOptional() @IsUUID() company_id?: string | null;
  /** When present, replaces the product's barcodes. */
  @IsOptional() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ProductBarcodeDto)
  barcodes?: ProductBarcodeDto[];
}

export class ListProductsQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() category_id?: string;
  @IsOptional() @IsIn(PRODUCT_TYPES) product_type?: ProductType;
  /** active (default) | archived | all */
  @IsOptional() @IsIn(['active', 'archived', 'all']) status?: 'active' | 'archived' | 'all';
  /** ready | not_ready: filter by e-invoicing readiness (rule 28). */
  @IsOptional() @IsIn(['ready', 'not_ready']) eims?: 'ready' | 'not_ready';
  @IsOptional() @IsIn(['name', 'sku', 'item_code', 'sales_price', 'created_at', 'updated_at']) sort?: string;
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(200) limit?: number;
}

export class CreateProductCategoryDto {
  @IsString() @Length(1, 150) name: string;
  @IsOptional() @IsUUID() parent_id?: string | null;
  @IsOptional() @IsString() @Length(1, 50) code?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  /** Excise rate in % for products in this category (MoR tax guide). */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(500) excise_rate?: number;
  @IsOptional() @IsUUID() company_id?: string | null;
}

export class UpdateProductCategoryDto {
  @IsOptional() @IsString() @Length(1, 150) name?: string;
  @IsOptional() @IsUUID() parent_id?: string | null;
  @IsOptional() @IsString() @Length(1, 50) code?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(500) excise_rate?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsUUID() company_id?: string | null;
}

export class CreateUomCategoryDto {
  @IsString() @Length(1, 100) name: string;
  /** Every unit category starts with its reference unit (ratio 1), e.g. "kg" for Weight. */
  @IsString() @Length(1, 100) reference_unit: string;
  @IsOptional() @IsString() @MaxLength(20) reference_symbol?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9 ]{1,20}$/, { message: 'mor_code must be a MoR unit code such as PCS or KLG' }) reference_mor_code?: string;
}

export class CreateUomDto {
  @IsUUID() category_id: string;
  @IsString() @Length(1, 100) name: string;
  @IsOptional() @IsString() @MaxLength(20) symbol?: string;
  /** 1 of this unit = ratio × the category's reference unit. */
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 8 }) @Min(0.00000001) ratio: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) rounding?: number;
  /** MoR unit code sent on e-invoices (PCS, KLG, LTR, MTR, ROL…). */
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9 ]{1,20}$/, { message: 'mor_code must be a MoR unit code such as PCS or KLG' }) mor_code?: string | null;
}

export class UpdateUomDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsString() @MaxLength(20) symbol?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 8 }) @Min(0.00000001) ratio?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) rounding?: number;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9 ]{1,20}$/, { message: 'mor_code must be a MoR unit code such as PCS or KLG' }) mor_code?: string | null;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
