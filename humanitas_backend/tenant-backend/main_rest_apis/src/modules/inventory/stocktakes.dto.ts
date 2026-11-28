import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min,
} from 'class-validator';

export const COUNT_TYPES = ['cycle', 'full', 'blind', 'spot'] as const;
export type CountType = (typeof COUNT_TYPES)[number];

/** A new stocktake: where, what and how (featureslist §2). */
export class CreateStocktakeDto {
  @IsUUID()
  warehouse_id!: string;

  /** Count only this location and the locations under it; otherwise every storage location of the warehouse. */
  @IsOptional() @IsUUID()
  location_id?: string;

  @IsOptional() @IsIn(COUNT_TYPES)
  count_type?: CountType;

  /** Hide what the system expects from the people counting. */
  @IsOptional() @IsBoolean()
  is_blind?: boolean;

  @IsOptional() @IsUUID()
  category_id?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true })
  product_ids?: string[];

  @IsOptional() @IsDateString()
  scheduled_date?: string;

  @IsOptional() @IsUUID()
  responsible_user_id?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;
}

/** A counted quantity for one product at one location (and lot). */
export class CountLineDto {
  @IsUUID()
  product_id!: string;

  @IsUUID()
  location_id!: string;

  @IsOptional() @IsUUID()
  lot_id?: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(1_000_000_000)
  counted_qty!: number;

  /** Add to what is already counted (scanning one by one) instead of replacing it. */
  @IsOptional() @IsBoolean()
  add?: boolean;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class UpdateCountLineDto {
  /** null clears the count (the line is not counted any more). */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(1_000_000_000)
  counted_qty?: number | null;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

/** A scanned code: a location barcode switches the location, a product barcode, SKU or lot/serial counts one. */
export class CountScanDto {
  @IsString() @Length(1, 128)
  code!: string;

  @IsOptional() @IsUUID()
  location_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000)
  quantity?: number;
}
