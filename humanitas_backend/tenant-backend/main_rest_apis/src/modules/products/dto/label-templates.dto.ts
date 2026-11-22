import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { BARCODE_FORMATS, LABEL_LAYOUTS, type BarcodeFormat, type LabelLayoutKind } from '../label-templates.layout';

export class CreateLabelTemplateDto {
  @IsString() @Length(1, 100) name: string;
  @IsOptional() @IsIn(LABEL_LAYOUTS) layout?: LabelLayoutKind;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(10) @Max(300) label_width_mm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(10) @Max(300) label_height_mm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(20) @Max(600) page_width_mm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(20) @Max(600) page_height_mm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) columns?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(40) rows?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) margin_top_mm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) margin_left_mm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) gap_x_mm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) gap_y_mm?: number;
  @IsOptional() @IsIn(BARCODE_FORMATS) barcode_format?: BarcodeFormat;
  @IsOptional() @IsBoolean() show_name?: boolean;
  @IsOptional() @IsBoolean() show_variant?: boolean;
  @IsOptional() @IsBoolean() show_sku?: boolean;
  @IsOptional() @IsBoolean() show_price?: boolean;
  @IsOptional() @IsBoolean() show_barcode_text?: boolean;
  @IsOptional() @IsBoolean() show_company?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(4) @Max(36) font_size_pt?: number;
  /** The list prices come from; null = the default list. */
  @IsOptional() @IsUUID() price_list_id?: string | null;
  /** null = shared by every company. */
  @IsOptional() @IsUUID() company_id?: string | null;
  /** null = shared by every branch (users with every branch only). */
  @IsOptional() @IsUUID() branch_id?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
}

export class UpdateLabelTemplateDto extends PartialType(CreateLabelTemplateDto) {
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class ListLabelTemplatesQueryDto {
  @IsOptional() @IsIn(['true', 'false']) include_archived?: string;
}

/** Prices for the labels being printed, from one price list. */
export class LabelPricesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsUUID('all', { each: true }) product_ids: string[];
  @IsOptional() @IsUUID() price_list_id?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) quantity?: number;
}
