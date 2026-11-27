import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../../common/records/record-context';
import { InventoryBase, ENTITY, blankToNull, type LedgerMove } from './inventory.base';
import { csvCell } from '../../common/records/csv';
import type { Queryable } from '../../common/records/record-scope';
import type { AdjustStockDto, ListStockQueryDto } from './dto/inventory.dto';
import { ValuationClient } from './valuation-client';

/**
 * Stock: what is on hand, where, and the manual adjustment that changes it.
 *
 * Balances are read from inventory_stock_on_hand (the view over inventory_quants) and never
 * recomputed here. Every change goes through the append-only move ledger so valuation can always
 * be replayed (schema notes, featureslist §2).
 *
 * Multi-company/branch (rule 16): every read is filtered through the scope, and products and lots
 * used in an adjustment must be visible in it.
 */
@Injectable()
export class StockService extends InventoryBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
    /** Optional so the specs can build the service without the engine. */
    @Optional() private readonly valuation?: ValuationClient,
  ) {
    super();
  }

  /** On-hand rows, one per product × location × lot. */
  async list(ctx: CatalogContext, q: ListStockQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const params: unknown[] = [
      q.product_id ?? null, q.warehouse_id ?? null, q.location_id ?? null, q.lot_id ?? null,
      q.search ? `%${q.search}%` : null, q.in_stock_only ?? false, q.below_reorder ?? false,
    ];
    const where = [
      '($1::uuid IS NULL OR s.product_id = $1)',
      '($2::uuid IS NULL OR s.warehouse_id = $2)',
      '($3::uuid IS NULL OR s.location_id = $3)',
      '($4::uuid IS NULL OR s.lot_id = $4)',
      '($5::text IS NULL OR s.product_name ILIKE $5 OR s.sku ILIKE $5 OR s.location_code ILIKE $5 OR s.lot_name ILIKE $5)',
      '($6::boolean = false OR s.quantity <> 0)',
      `($7::boolean = false OR EXISTS (
          SELECT 1 FROM inventory_orderpoints op
           WHERE op.product_id = s.product_id AND COALESCE(op.warehouse_id, s.warehouse_id) = s.warehouse_id
             AND op.is_active AND s.quantity < op.min_qty))`,
    ];
    const f = this.scopeFilter(scope, 's', params);
    if (f) { params.push(...f.param); where.push(f.sql); }
    const limit = Math.min(q.limit ?? 100, 500);
    const page = q.page ?? 1;
    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await conn.query(`SELECT count(*)::int AS total FROM inventory_stock_on_hand s ${w}`, params);
    const data = await conn.query(
      `SELECT s.* FROM inventory_stock_on_hand s ${w} ORDER BY s.product_name, s.location_code LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return { data, meta: { page, limit, total } };
  }

  /** Totals per product: on hand, reserved, free and value, across the whole scope. */
  async summary(ctx: CatalogContext, q: ListStockQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const params: unknown[] = [q.search ? `%${q.search}%` : null, q.warehouse_id ?? null];
    const where = ['($1::text IS NULL OR s.product_name ILIKE $1 OR s.sku ILIKE $1)', '($2::uuid IS NULL OR s.warehouse_id = $2)'];
    const f = this.scopeFilter(scope, 's', params);
    if (f) { params.push(...f.param); where.push(f.sql); }
    const data = await conn.query(
      `SELECT s.product_id, s.product_name, s.sku,
              sum(s.quantity)                    AS quantity,
              sum(s.reserved_quantity)           AS reserved_quantity,
              sum(s.free_quantity)               AS free_quantity,
              sum(s.stock_value)                 AS stock_value
         FROM inventory_stock_on_hand s
        WHERE ${where.join(' AND ')}
        GROUP BY s.product_id, s.product_name, s.sku
        ORDER BY s.product_name LIMIT 500`,
      params,
    );
    return { data };
  }

  /** One product's stock broken down by warehouse and location. */
  async forProduct(ctx: CatalogContext, productId: string) {
    const { conn, scope } = await this.open(ctx);
    await this.visibleProduct(conn, scope, productId);
    const params: unknown[] = [productId];
    const where = ['s.product_id = $1'];
    const f = this.scopeFilter(scope, 's', params);
    if (f) { params.push(...f.param); where.push(f.sql); }
    const data = await conn.query(
      `SELECT s.* FROM inventory_stock_on_hand s WHERE ${where.join(' AND ')} ORDER BY s.warehouse_name, s.location_code`,
      params,
    );
    const [config] = await conn.query(`SELECT * FROM inventory_product_config WHERE product_id = $1`, [productId]);
    const totals = { quantity: 0, reserved: 0, free: 0, value: 0 };
    for (const r of data as Record<string, unknown>[]) {
      totals.quantity += Number(r.quantity ?? 0);
      totals.reserved += Number(r.reserved_quantity ?? 0);
      totals.free += Number(r.free_quantity ?? 0);
      totals.value += Number(r.stock_value ?? 0);
    }
    return { data, totals, config: config ?? null };
  }

  /**
   * A manual adjustment: adds or removes stock at one location and records why.
   *
   * Writes a single 'adjustment' move (with its reason and notes in the INSERT, so they are
   * auditable and never lost) and applies it inside one `conn.transaction`, so the ledger and the
   * balance can never disagree. Outbound moves never change a quant's cost; an inbound move with no
   * explicit cost takes the product's cost_price, so a cost basis always reaches the engine.
   */
  async adjust(ctx: CatalogContext, dto: AdjustStockDto) {
    const { conn, scope } = await this.open(ctx);
    const location = await this.usableLocation(conn, scope, dto.location_id);
    if (['supplier', 'customer'].includes(String(location.usage))) {
      throw new BadRequestException(`A ${location.usage} location cannot hold stock; choose a storage location`);
    }
    if (!dto.quantity) throw new BadRequestException('Enter a quantity to add or remove');
    const product = await this.visibleProduct(conn, scope, dto.product_id);
    if (dto.lot_id) await this.visibleLot(conn, scope, dto.lot_id, dto.product_id);
    const config = await this.config(conn, dto.product_id);
    if (config.tracking !== 'none' && !dto.lot_id) {
      throw new BadRequestException(`This product is tracked by ${config.tracking}; choose its ${config.tracking} number`);
    }
    const companyId = (location.company_id as string | null) ?? null;
    const allowNegative = await this.allowsNegative(conn, dto.product_id, companyId);
    const outbound = dto.quantity < 0;
    const quantity = Math.abs(dto.quantity);

    // An inbound move carries a cost basis: the one given, else the product's cost_price.
    const inboundCost = outbound ? null : (dto.unit_cost ?? Number(product.cost_price ?? 0));

    const move: LedgerMove = {
      id: '', product_id: dto.product_id, lot_id: dto.lot_id ?? null,
      from_location_id: outbound ? dto.location_id : null,
      to_location_id: outbound ? null : dto.location_id,
      quantity,
      inbound_cost: inboundCost,
      company_id: companyId,
      branch_id: (location.branch_id as string | null) ?? null,
    };

    await conn.transaction(async (m: Queryable) => {
      const name = await this.nextNumber(m, 'scrap', companyId);
      const [row] = await m.query(
        `INSERT INTO inventory_moves
           (reference, move_type, product_id, lot_id, from_location_id, to_location_id, quantity, done_quantity,
            unit_cost, state, source, reason, notes, operator_user_id, company_id, branch_id, created_by, updated_by)
         VALUES ($1, 'adjustment', $2, $3, $4, $5, $6, $6, $7, 'draft', 'manual', $8, $9, $10, $11, $12, $13, $13)
         RETURNING id`,
        [
          name, dto.product_id, dto.lot_id ?? null,
          outbound ? dto.location_id : null, outbound ? null : dto.location_id,
          quantity, inboundCost ?? 0, blankToNull(dto.reason) ?? null, dto.notes ?? null,
          ctx.user?.sub ?? null, companyId, move.branch_id, ctx.user?.sub ?? null,
        ],
      );
      move.id = row.id as string;
      await this.applyMove(m, move, { allowNegative, actorId: ctx.user?.sub });
    });

    await this.record(ctx, ENTITY.move, dto.product_id, 'updated',
      `Stock adjusted ${dto.quantity > 0 ? '+' : ''}${dto.quantity} of "${product.name}" — ${dto.reason}`);
    // The valuation layers follow (rule 8): an inbound adjustment adds a layer, an outbound one consumes.
    await this.valuation?.notify(ctx.tenantId, [{
      move_id: move.id, product_id: move.product_id, lot_id: move.lot_id, from_location_id: move.from_location_id,
      to_location_id: move.to_location_id, quantity, unit_cost: inboundCost ?? 0, company_id: move.company_id, branch_id: move.branch_id,
    }]);
    return this.forProduct(ctx, dto.product_id);
  }

  /** Stock movement history for the reports (featureslist §2), from the ledger view. */
  async movements(ctx: CatalogContext, q: { product_id?: string; warehouse_id?: string; from?: string; to?: string; limit?: number; page?: number }) {
    const { conn, scope } = await this.open(ctx);
    const params: unknown[] = [q.product_id ?? null, q.warehouse_id ?? null, q.from ?? null, q.to ?? null];
    const where = [
      '($1::uuid IS NULL OR h.product_id = $1)',
      `($2::uuid IS NULL OR h.from_location_id IN (SELECT id FROM inventory_locations WHERE warehouse_id = $2)
         OR h.to_location_id IN (SELECT id FROM inventory_locations WHERE warehouse_id = $2))`,
      '($3::timestamptz IS NULL OR h.done_at >= $3)',
      '($4::timestamptz IS NULL OR h.done_at <= $4)',
      "h.state = 'done'",
    ];
    const f = this.scopeFilter(scope, 'h', params);
    if (f) { params.push(...f.param); where.push(f.sql); }
    const limit = Math.min(q.limit ?? 100, 500);
    const page = q.page ?? 1;
    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await conn.query(`SELECT count(*)::int AS total FROM inventory_movement_history h ${w}`, params);
    const data = await conn.query(
      `SELECT h.* FROM inventory_movement_history h ${w} ORDER BY h.done_at DESC NULLS LAST, h.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return { data, meta: { page, limit, total } };
  }

  /** Stock CSV (featureslist §2 reports export). */
  async exportCsv(ctx: CatalogContext, q: ListStockQueryDto, showMoney = true): Promise<string> {
    const { data } = await this.list(ctx, { ...q, limit: 500, page: 1 });
    const rows = data as Record<string, unknown>[];
    const head = ['Product', 'SKU', 'Lot', 'Expiry', 'Warehouse', 'Location', 'On hand', 'Reserved', 'Free', ...(showMoney ? ['Unit cost', 'Value'] : [])];
    const body = rows.map((r) => [
      r.product_name, r.sku, r.lot_name ?? '', r.expiry_date ?? '', r.warehouse_name ?? '', r.location_code,
      r.quantity, r.reserved_quantity, r.free_quantity, ...(showMoney ? [r.unit_cost, r.stock_value] : []),
    ].map(csvCell).join(','));
    return [head.map(csvCell).join(','), ...body].join('\n');
  }

  /** A product with stock context (rule 20): visible and not a variant parent. */
  async product(ctx: CatalogContext, productId: string) {
    const { conn, scope } = await this.open(ctx);
    return this.visibleProduct(conn, scope, productId);
  }

  /** The per-product settings record, created on demand (used by the config screen). */
  async configRecord(ctx: CatalogContext, productId: string) {
    const { conn } = await this.open(ctx);
    return this.config(conn, productId);
  }
}
