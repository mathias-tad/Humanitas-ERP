import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const ATTRIBUTE_DISPLAY_TYPES = ['pills', 'select', 'color'] as const;
export type AttributeDisplayType = (typeof ATTRIBUTE_DISPLAY_TYPES)[number];

const CODE = /^[A-Za-z0-9-]{1,20}$/;
const COLOR = /^#[0-9A-Fa-f]{6}$/;

export class AttributeValueDto {
  @IsString() @Length(1, 100) name: string;
  /** Short code for generated variant SKUs (RED, XL); defaults from the name. */
  @IsOptional() @IsString() @Matches(CODE, { message: 'code may contain letters, digits and dashes (up to 20)' }) code?: string | null;
  @IsOptional() @IsString() @Matches(COLOR, { message: 'html_color must look like #D32F2F' }) html_color?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
}

export class UpdateAttributeValueDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsString() @Matches(CODE, { message: 'code may contain letters, digits and dashes (up to 20)' }) code?: string | null;
  @IsOptional() @IsString() @Matches(COLOR, { message: 'html_color must look like #D32F2F' }) html_color?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class CreateAttributeDto {
  @IsString() @Length(1, 100) name: string;
  @IsOptional() @IsIn(ATTRIBUTE_DISPLAY_TYPES) display_type?: AttributeDisplayType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => AttributeValueDto)
  values?: AttributeValueDto[];
}

export class UpdateAttributeDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsIn(ATTRIBUTE_DISPLAY_TYPES) display_type?: AttributeDisplayType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class VariantAttributeLineDto {
  @IsUUID() attribute_id: string;
  @IsArray() @ArrayMinSize(1, { message: 'Choose at least one value for each attribute' }) @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  value_ids: string[];
}

/** The attributes (and values) a product's variants are made from. An empty list removes the variants. */
export class SaveVariantConfigDto {
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => VariantAttributeLineDto)
  attributes: VariantAttributeLineDto[];
}
