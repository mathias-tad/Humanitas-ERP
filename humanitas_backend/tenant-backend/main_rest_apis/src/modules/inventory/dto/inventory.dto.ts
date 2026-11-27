import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Trimmed strings, and '' becomes undefined so a blank field is not stored as an empty string. */
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);

export const LOCATION_USAGES = ['internal', 'view', 'supplier', 'customer', 'inventory', 'transit', 'production', 'scrap'] as const;
export type LocationUsage = (typeof LOCATION_USAGES)[number];

export const REMOVAL_STRATEGIES = ['fifo', 'fefo', 'lifo', 'closest'] as const;
export const COSTING_METHODS = ['fifo', 'avco', 'standard'] as const;
export const TRACKING_MODES = ['none', 'lot', 'serial'] as const;

export const TRANSFER_TYPES = ['receipt', 'delivery', 'internal', 'return_in', 'return_out'] as const;
export const TRANSFER_STATES = ['draft', 'waiting', 'ready', 'in_progress', 'done', 'cancelled'] as const;

export const MOVE_TYPES = ['receipt', 'delivery', 'internal', 'scrap', 'adjustment', 'production', 'consumption', 'return'] as const;

export const COUNT_TYPES = ['cycle', 'full', 'blind', 'spot'] as const;
export const COUNT_STATES = ['draft', 'counting', 'review', 'posted', 'cancelled'] as const;

export const LOT_KINDS = ['lot', 'serial'] as const;
export const QUALITY_STATES = ['available', 'quarantined', 'expired', 'recalled', 'rejected'] as const;

const CODE = /^[A-Za-z0-9._\-/]+$/;
const codeMessage = 'may contain letters, digits, dot, dash, underscore and slash only';

// ── Warehouses ───────────────────────────────────────────────────────────────────

export class CreateWarehouseDto {
  @Transform(trim) @IsString() @Length(1, 16) @Matches(CODE, { message: `code ${codeMessage}` })
  code: string;

  @Transform(trim) @IsString() @Length(1, 200)
  name: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(32)
  short_name?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000)
  address?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  city?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(50)
  phone?: string;

  @IsOptional() @IsUUID()
  manager_id?: string;

  /**
   * Create the virtual locations (stock, input, output, transit, view) and the default storage
   * location with the warehouse, so receipts and deliveries work immediately.
   */
  @IsOptional() @IsBoolean()
  create_default_locations?: boolean;

  @IsOptional() @IsUUID()
  company_id?: string | null;

  @IsOptional() @IsUUID()
  branch_id?: string | null;
}

export class UpdateWarehouseDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 16) @Matches(CODE, { message: `code ${codeMessage}` })
  code?: string;

  @IsOptional() @Transform(trim) @IsString() @Length(1, 200)
  name?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(32)
  short_name?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000)
  address?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  city?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(50)
  phone?: string | null;

  @IsOptional() @IsUUID()
  manager_id?: string | null;

  @IsOptional() @IsBoolean()
  is_active?: boolean;

  @IsOptional() @IsUUID()
  company_id?: string | null;

  @IsOptional() @IsUUID()
  branch_id?: string | null;
}

export class ListWarehousesQueryDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  search?: string;

  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  include_archived?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;
}

// ── Locations ────────────────────────────────────────────────────────────────────

export class CreateLocationDto {
  @IsOptional() @IsUUID()
  warehouse_id?: string | null;

  @IsOptional() @IsUUID()
  parent_id?: string | null;

  @Transform(trim) @IsString() @Length(1, 64) @Matches(CODE, { message: `code ${codeMessage}` })
  code: string;

  @Transform(trim) @IsString() @Length(1, 200)
  name: string;

  @IsOptional() @IsIn(LOCATION_USAGES)
  usage?: LocationUsage;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(128)
  barcode?: string;

  @IsOptional() @IsIn(REMOVAL_STRATEGIES)
  removal_strategy?: (typeof REMOVAL_STRATEGIES)[number];

  @IsOptional() @IsUUID()
  replenish_location_id?: string | null;

  @IsOptional() @IsUUID()
  company_id?: string | null;

  @IsOptional() @IsUUID()
  branch_id?: string | null;
}

export class UpdateLocationDto {
  @IsOptional() @IsUUID()
  parent_id?: string | null;

  @IsOptional() @Transform(trim) @IsString() @Length(1, 64) @Matches(CODE, { message: `code ${codeMessage}` })
  code?: string;

  @IsOptional() @Transform(trim) @IsString() @Length(1, 200)
  name?: string;

  @IsOptional() @IsIn(LOCATION_USAGES)
  usage?: LocationUsage;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(128)
  barcode?: string | null;

  @IsOptional() @IsIn(REMOVAL_STRATEGIES)
  removal_strategy?: (typeof REMOVAL_STRATEGIES)[number];

  @IsOptional() @IsUUID()
  replenish_location_id?: string | null;

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}

export class ListLocationsQueryDto {
  @IsOptional() @IsUUID()
  warehouse_id?: string;

  @IsOptional() @IsIn(LOCATION_USAGES)
  usage?: LocationUsage;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  search?: string;

  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  include_archived?: boolean;
}

// ── Stock ────────────────────────────────────────────────────────────────────────

export class ListStockQueryDto {
  @IsOptional() @IsUUID()
  product_id?: string;

  @IsOptional() @IsUUID()
  warehouse_id?: string;

  @IsOptional() @IsUUID()
  location_id?: string;

  @IsOptional() @IsUUID()
  lot_id?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  search?: string;

  /** Only rows holding stock (quantity > 0). */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  in_stock_only?: boolean;

  /** Only rows below their reorder point (featureslist §2 low stock). */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  below_reorder?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;
}

/** A manual stock adjustment: +in / -out from a location, with the reason recorded. */
export class AdjustStockDto {
  @IsUUID()
  product_id: string;

  @IsOptional() @IsUUID()
  lot_id?: string | null;

  @IsUUID()
  location_id: string;

  /** Positive adds stock, negative removes it. */
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 })
  quantity: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  unit_cost?: number;

  @Transform(trim) @IsString() @Length(1, 255)
  reason: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000)
  notes?: string;
}

// ── Transfers ────────────────────────────────────────────────────────────────────

export class CreateMoveDto {
  @IsUUID()
  product_id: string;

  @IsOptional() @IsUUID()
  lot_id?: string | null;

  @IsOptional() @IsUUID()
  from_location_id?: string | null;

  @IsOptional() @IsUUID()
  to_location_id?: string | null;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 })
  quantity: number;

  @IsOptional() @IsUUID()
  uom_id?: string;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  unit_cost?: number;

  @IsOptional() @IsIn(MOVE_TYPES)
  move_type?: (typeof MOVE_TYPES)[number];
}

export class CreateTransferDto {
  @IsIn(TRANSFER_TYPES)
  transfer_type: (typeof TRANSFER_TYPES)[number];

  @IsOptional() @Transform(trim) @IsString() @MaxLength(128)
  origin?: string;

  @IsOptional() @IsUUID()
  partner_contact_id?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(255)
  partner_name?: string;

  @IsOptional() @IsUUID()
  from_warehouse_id?: string | null;

  @IsOptional() @IsUUID()
  to_warehouse_id?: string | null;

  @IsOptional() @IsDateString()
  scheduled_date?: string;

  @IsOptional() @IsUUID()
  responsible_user_id?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(255)
  reason?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000)
  notes?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateMoveDto)
  moves?: CreateMoveDto[];

  @IsOptional() @IsUUID()
  company_id?: string | null;

  @IsOptional() @IsUUID()
  branch_id?: string | null;
}

export class UpdateTransferDto {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(128)
  origin?: string | null;

  @IsOptional() @IsUUID()
  partner_contact_id?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(255)
  partner_name?: string | null;

  @IsOptional() @IsUUID()
  from_warehouse_id?: string | null;

  @IsOptional() @IsUUID()
  to_warehouse_id?: string | null;

  @IsOptional() @IsDateString()
  scheduled_date?: string | null;

  @IsOptional() @IsUUID()
  responsible_user_id?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(255)
  reason?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000)
  notes?: string | null;
}

export class AddMoveDto extends CreateMoveDto {}

export class ListTransfersQueryDto {
  @IsOptional() @IsIn(TRANSFER_TYPES)
  transfer_type?: (typeof TRANSFER_TYPES)[number];

  @IsOptional() @IsIn(TRANSFER_STATES)
  state?: (typeof TRANSFER_STATES)[number];

  @IsOptional() @IsUUID()
  warehouse_id?: string;

  @IsOptional() @IsUUID()
  product_id?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  search?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;
}

// ── Stock counts ─────────────────────────────────────────────────────────────────

export class CreateCountDto {
  @IsOptional() @IsIn(COUNT_TYPES)
  count_type?: (typeof COUNT_TYPES)[number];

  @IsOptional() @IsUUID()
  warehouse_id?: string | null;

  @IsOptional() @IsUUID()
  location_id?: string | null;

  /** Hides the expected quantity from the person counting. */
  @IsOptional() @IsBoolean()
  is_blind?: boolean;

  @IsOptional() @IsDateString()
  scheduled_date?: string;

  @IsOptional() @IsUUID()
  responsible_user_id?: string;

  @IsOptional() @IsBoolean()
  requires_approval?: boolean;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000)
  notes?: string;

  /** Fill the lines from the current stock in the chosen warehouse or location. */
  @IsOptional() @IsBoolean()
  fill_from_stock?: boolean;

  @IsOptional() @IsUUID()
  company_id?: string | null;

  @IsOptional() @IsUUID()
  branch_id?: string | null;
}

export class UpdateCountDto {
  @IsOptional() @IsIn(COUNT_TYPES)
  count_type?: (typeof COUNT_TYPES)[number];

  @IsOptional() @IsUUID()
  warehouse_id?: string | null;

  @IsOptional() @IsUUID()
  location_id?: string | null;

  @IsOptional() @IsBoolean()
  is_blind?: boolean;

  @IsOptional() @IsDateString()
  scheduled_date?: string | null;

  @IsOptional() @IsUUID()
  responsible_user_id?: string | null;

  @IsOptional() @IsBoolean()
  requires_approval?: boolean;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000)
  notes?: string | null;
}

export class CountLineDto {
  @IsOptional() @IsUUID()
  id?: string;

  @IsUUID()
  product_id: string;

  @IsOptional() @IsUUID()
  lot_id?: string | null;

  @IsOptional() @IsUUID()
  location_id?: string | null;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 })
  counted_qty: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000)
  notes?: string;
}

/** The counted quantities of one or more lines. */
export class RecordCountLinesDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CountLineDto)
  lines: CountLineDto[];
}

export class ListCountsQueryDto {
  @IsOptional() @IsIn(COUNT_STATES)
  state?: (typeof COUNT_STATES)[number];

  @IsOptional() @IsUUID()
  warehouse_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;
}

// ── Lots & serials ───────────────────────────────────────────────────────────────

export class CreateLotDto {
  @IsUUID()
  product_id: string;

  @IsOptional() @IsIn(LOT_KINDS)
  kind?: (typeof LOT_KINDS)[number];

  @Transform(trim) @IsString() @Length(1, 128)
  name: string;

  @IsOptional() @IsDateString()
  expiry_date?: string;

  @IsOptional() @IsDateString()
  manufacture_date?: string;

  @IsOptional() @IsDateString()
  alert_date?: string;

  @IsOptional() @IsUUID()
  supplier_contact_id?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(255)
  supplier_name?: string;

  @IsOptional() @IsUUID()
  company_id?: string | null;

  @IsOptional() @IsUUID()
  branch_id?: string | null;
}

export class UpdateLotDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 128)
  name?: string;

  @IsOptional() @IsDateString()
  expiry_date?: string | null;

  @IsOptional() @IsDateString()
  manufacture_date?: string | null;

  @IsOptional() @IsDateString()
  alert_date?: string | null;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(255)
  supplier_name?: string | null;
}

export class SetLotQualityDto {
  @IsIn(QUALITY_STATES)
  quality_state: (typeof QUALITY_STATES)[number];

  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000)
  quality_note?: string;
}

export class ListLotsQueryDto {
  @IsOptional() @IsUUID()
  product_id?: string;

  @IsOptional() @IsIn(LOT_KINDS)
  kind?: (typeof LOT_KINDS)[number];

  @IsOptional() @IsIn(QUALITY_STATES)
  quality_state?: (typeof QUALITY_STATES)[number];

  @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  search?: string;

  /** Only lots expiring within this many days (default 30), or already expired. */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  expiring_soon?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650)
  expiry_days?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;
}

// ── Per-product inventory configuration ──────────────────────────────────────────

export class UpdateProductConfigDto {
  @IsOptional() @IsIn(TRACKING_MODES)
  tracking?: (typeof TRACKING_MODES)[number];

  @IsOptional() @IsIn(COSTING_METHODS)
  costing_method?: (typeof COSTING_METHODS)[number];

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  standard_cost?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  reorder_point?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  reorder_max?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650)
  lead_days?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650)
  shelf_life_days?: number | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650)
  expiry_warn_days?: number;

  @IsOptional() @IsBoolean()
  allow_negative?: boolean;
}

// ── Reorder points ───────────────────────────────────────────────────────────────

export class CreateOrderpointDto {
  @IsUUID()
  product_id: string;

  @IsOptional() @IsUUID()
  warehouse_id?: string | null;

  @IsOptional() @IsUUID()
  location_id?: string | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  min_qty?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  max_qty?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  multiple_qty?: number;

  @IsOptional() @IsBoolean()
  is_active?: boolean;

  @IsOptional() @IsUUID()
  company_id?: string | null;

  @IsOptional() @IsUUID()
  branch_id?: string | null;
}

export class UpdateOrderpointDto {
  @IsOptional() @IsUUID()
  location_id?: string | null;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  min_qty?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  max_qty?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0)
  multiple_qty?: number;

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}

// ── Putaway rules ────────────────────────────────────────────────────────────────

export class CreatePutawayRuleDto {
  @IsOptional() @IsUUID()
  warehouse_id?: string | null;

  @IsOptional() @IsUUID()
  product_id?: string | null;

  @IsOptional() @IsUUID()
  category_id?: string | null;

  @IsUUID()
  location_id: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000)
  sequence?: number;

  @IsOptional() @IsBoolean()
  is_active?: boolean;

  @IsOptional() @IsUUID()
  company_id?: string | null;

  @IsOptional() @IsUUID()
  branch_id?: string | null;
}

export class UpdatePutawayRuleDto {
  @IsOptional() @IsUUID()
  location_id?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000)
  sequence?: number;

  @IsOptional() @IsBoolean()
  is_active?: boolean;
}

// ── Inventory settings ───────────────────────────────────────────────────────────

export class UpdateInventorySettingsDto {
  @IsOptional() @IsIn(COSTING_METHODS)
  default_costing_method?: (typeof COSTING_METHODS)[number];

  @IsOptional() @IsIn(REMOVAL_STRATEGIES)
  default_removal_strategy?: (typeof REMOVAL_STRATEGIES)[number];

  @IsOptional() @IsBoolean()
  allow_negative_stock?: boolean;

  @IsOptional() @IsBoolean()
  auto_reserve?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3)
  receipt_steps?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3)
  delivery_steps?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650)
  expiry_warn_days?: number;

  @IsOptional() @IsBoolean()
  low_stock_alert?: boolean;
}