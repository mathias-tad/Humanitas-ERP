import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../../common/records/record-context';
import { csvCell } from '../../common/records/csv';
import type { Queryable } from '../../common/records/record-scope';
import { InventoryBase, ENTITY, blankToNull, type InventoryScope, type LedgerMove } from './inventory.base';
import { ValuationClient, type ValuationMove } from './valuation-client';
import type { CountLineDto, CountScanDto, CreateStocktakeDto, UpdateCountLineDto } from './stocktakes.dto';

export type CountState = 'draft' | 'counting' | 'review' | 'posted' | 'cancelled';
type Row = Record<string, unknown>;
/** A connection that can open a transaction (the tenant DataSource). */
type Tx = Queryable & { transaction<T>(fn: (m: Queryable) => Promise<T>): Promise<T> };

/** States in which people may still count. */
const COUNTING: CountState[] = ['counting', 'review'];

/**
 * A count line's variance and what it is worth (pure; tested). The variance is counted minus
 * expected; an uncounted line has none.
 */
export function lineVariance(line: { counted_qty?: unknown; expected_qty?: unknown; unit_cost?: unknown }) {
  if (line.counted_qty === null || line.counted_qty === undefined) return { variance: 0, value: 0 };
  const variance = round4(Number(line.counted_qty) - Number(line.expected_qty ?? 0));
  return { variance, value: Math.round(variance * Number(line.unit_cost ?? 0) * 100) / 100 };
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Totals for a count: progress, accuracy and the value gained and lost (pure; tested). */
export function countTotals(lines: { counted_qty?: unknown; expected_qty?: unknown; unit_cost?: unknown }[]) {
  let counted = 0;
  let matching = 0;
  let withVariance = 0;
  let gain = 0;
  let loss = 0;
  let netQty = 0;
  for (const l of lines) {
    if (l.counted_qty === null || l.counted_qty === undefined) continue;
    counted += 1;
    const { variance, value } = lineVariance(l);
    netQty = round4(netQty + variance);
    if (variance === 0) matching += 1;
    else {
      withVariance += 1;
      if (value > 0) gain = Math.round((gain + value) * 100) / 100;
      else loss = Math.round((loss - value) * 100) / 100;
    }
  }
  return {
    lines: lines.length,
    counted,
    uncounted: lines.length - counted,
    with_variance: withVariance,
    /** Share of counted lines that matched what was expected (inventory record accuracy). */
    accuracy: counted ? Math.round((matching / counted) * 1000) / 10 : null,
    net_quantity: netQty,
    variance_value_gain: gain,
    variance_value_loss: loss,
    variance_value: Math.round((gain - loss) * 100) / 100,
  };
}

/** A serial number is one item: it is counted as 0 or 1 (pure; tested). */
export function countProblem(tracking: string, lotId: string | null | undefined, counted: number): string | null {
  if (tracking !== 'none' && !lotId) return `This product is tracked by ${tracking}; scan or choose its ${tracking} number`;
  if (tracking === 'serial' && counted !== 0 && counted !== 1) return 'A serial number is one item: count it as 0 or 1';
  return null;
}

/**
 * Stocktakes (featureslist §2; Odoo "Physical Inventory", and more): cycle, full, blind and spot
 * counts of a warehouse or a location tree, optionally of one category or a list of products.
 *
 *  - Start freezes what the system expects per product, location and lot (the snapshot).
 *  - People count by scanning (location barcode, then product barcodes, SKUs or lot/serial
 *    numbers) or by typing; products found where they were not expected are added.
 *  - A blind count hides the expected quantity from the counters until it is posted.
 *  - Submit sends it for review; posting needs approve_stocktakes and writes one adjustment move
 *    per line with a difference, all in one transaction, against the quantity on hand at that
 *    moment (counted − on hand), so stock that moved while counting is never adjusted twice.
 *  - Every line keeps who counted it and when, and the move it made: the variance is auditable.
 *
 * Multi-company/branch (rule 16): a count lives in its warehouse's company and branch; every read
 * goes through the scope.
 */
@Injectable()
export class StocktakesService extends InventoryBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
    @Optional() private readonly valuation?: ValuationClient,
  ) {
    super();
  }

  async list(ctx: CatalogContext, q: { state?: string; warehouse_id?: string; search?: string; page?: number; limit?: number }) {
    const { conn, scope } = await this.open(ctx);
    const params: unknown[] = [q.state || null, q.warehouse_id || null, q.search?.trim() ? `%${q.search.trim()}%` : null];
    const where = [
      '($1::text IS NULL OR c.state = $1)',
      '($2::uuid IS NULL OR c.warehouse_id = $2)',
      '($3::text IS NULL OR c.name ILIKE $3 OR c.notes ILIKE $3)',
    ];
    const f = this.scopeFilter(scope, 'c', params);
    if (f) { params.push(...f.param); where.push(f.sql); }
    const limit = Math.min(q.limit ?? 40, 200);
    const page = q.page ?? 1;
    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await conn.query(`SELECT count(*)::int AS total FROM inventory_counts c ${w}`, params);
    const data = await conn.query(
      `SELECT c.*, w.name AS warehouse_name, l.code AS location_code, u.full_name AS responsible_name,
              (SELECT count(*)::int FROM inventory_count_lines x WHERE x.count_id = c.id) AS line_count,
              (SELECT count(*)::int FROM inventory_count_lines x WHERE x.count_id = c.id AND x.counted_qty IS NOT NULL) AS counted_count
         FROM inventory_counts c
         LEFT JOIN inventory_warehouses w ON w.id = c.warehouse_id
         LEFT JOIN inventory_locations l ON l.id = c.location_id
         LEFT JOIN users u ON u.id = c.responsible_user_id
         ${w}
        ORDER BY c.created_at DESC, c.id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return { data, meta: { page, limit, total } };
  }

  /** The count with its totals. Expected quantities of a blind count stay hidden from counters until it is posted. */
  async get(ctx: CatalogContext, id: string, opts: { revealExpected?: boolean } = {}) {
    const { conn, scope } = await this.open(ctx);
    const count = await this.visibleCount(conn, scope, id);
    const lines = (await conn.query(
      `SELECT counted_qty, expected_qty, unit_cost FROM inventory_count_lines WHERE count_id = $1`, [id],
    )) as Row[];
    const totals = countTotals(lines);
    const hidden = this.hidesExpected(count, opts.revealExpected);
    return {
      ...count,
      expected_hidden: hidden,
      totals: hidden ? { lines: totals.lines, counted: totals.counted, uncounted: totals.uncounted } : totals,
    };
  }

  /** The lines of a count, page by page: all, not counted yet, with a difference, or one location. */
  async lines(
    ctx: CatalogContext,
    id: string,
    q: { filter?: string; location_id?: string; search?: string; page?: number; limit?: number },
    opts: { revealExpected?: boolean } = {},
  ) {
    const { conn, scope } = await this.open(ctx);
    const count = await this.visibleCount(conn, scope, id);
    const params: unknown[] = [id, q.location_id || null, q.search?.trim() ? `%${q.search.trim()}%` : null];
    const where = [
      'x.count_id = $1',
      '($2::uuid IS NULL OR x.location_id = $2)',
      '($3::text IS NULL OR p.name ILIKE $3 OR p.sku ILIKE $3 OR lot.name ILIKE $3 OR loc.code ILIKE $3)',
    ];
    if (q.filter === 'uncounted') where.push('x.counted_qty IS NULL');
    if (q.filter === 'counted') where.push('x.counted_qty IS NOT NULL');
    if (q.filter === 'variance') where.push('x.counted_qty IS NOT NULL AND x.counted_qty <> x.expected_qty');
    if (q.filter === 'unexpected') where.push('x.is_unexpected');
    const limit = Math.min(q.limit ?? 100, 500);
    const page = q.page ?? 1;
    const w = `WHERE ${where.join(' AND ')}`;
    const from = `FROM inventory_count_lines x
      JOIN products p ON p.id = x.product_id
      LEFT JOIN inventory_lots lot ON lot.id = x.lot_id
      LEFT JOIN inventory_locations loc ON loc.id = x.location_id
      LEFT JOIN users cu ON cu.id = x.counted_by`;
    const [{ total }] = await conn.query(`SELECT count(*)::int AS total ${from} ${w}`, params);
    const rows = (await conn.query(
      `SELECT x.*, p.name AS product_name, p.sku, lot.name AS lot_name, lot.expiry_date, loc.code AS location_code,
              loc.name AS location_name, cu.full_name AS counted_by_name
         ${from} ${w}
        ORDER BY loc.code NULLS LAST, p.name, lot.name NULLS FIRST, x.id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    )) as Row[];
    const hidden = this.hidesExpected(count, opts.revealExpected);
    const data = rows.map((r) => {
      if (hidden) {
        const { expected_qty: _e, variance: _v, on_hand_at_post: _o, ...rest } = r;
        return rest;
      }
      const { variance, value } = lineVariance(r);
      return { ...r, variance, variance_value: value };
    });
    return { data, meta: { page, limit, total }, expected_hidden: hidden };
  }

  async create(ctx: CatalogContext, dto: CreateStocktakeDto) {
    const { conn, scope } = await this.open(ctx);
    const warehouse = await this.findVisible<Row>(conn, scope, 'inventory_warehouses', dto.warehouse_id, 'warehouse');
    if (warehouse.is_active === false) throw new BadRequestException('That warehouse is archived');
    if (dto.location_id) {
      const loc = await this.findVisible<Row>(conn, scope, 'inventory_locations', dto.location_id, 'location');
      if (loc.warehouse_id !== warehouse.id) throw new BadRequestException('That location is not in this warehouse');
    }
    const countType = dto.count_type ?? (dto.is_blind ? 'blind' : 'cycle');
    const blind = dto.is_blind ?? countType === 'blind';
    const companyId = (warehouse.company_id as string | null) ?? null;
    const branchId = (warehouse.branch_id as string | null) ?? null;
    const id = await conn.transaction(async (m: Queryable) => {
      const name = await this.nextNumber(m, 'count', companyId);
      const [row] = await m.query(
        `INSERT INTO inventory_counts
           (name, count_type, warehouse_id, location_id, is_blind, category_id, product_ids, scheduled_date, responsible_user_id,
            notes, company_id, branch_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::uuid[], $8, $9, $10, $11, $12, $13, $13)
         RETURNING id`,
        [
          name, countType, warehouse.id, dto.location_id ?? null, blind, dto.category_id ?? null, dto.product_ids ?? [],
          dto.scheduled_date ?? null, dto.responsible_user_id ?? ctx.user?.sub ?? null, blankToNull(dto.notes) ?? null,
          companyId, branchId, ctx.user?.sub ?? null,
        ],
      ).catch((e: unknown) => this.rethrow(e));
      return row.id as string;
    });
    await this.record(ctx, ENTITY.count, id, 'created', `Stocktake created for ${warehouse.name}`);
    return this.get(ctx, id, { revealExpected: true });
  }

  /** Freezes what is expected: one line per product, location and lot with stock in what the count covers. */
  async start(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const count = await this.visibleCount(conn, scope, id);
    if (count.state !== 'draft') throw new BadRequestException('This stocktake has already started');
    const locations = await this.countLocations(conn, count);
    if (!locations.length) throw new BadRequestException('This warehouse has no storage location to count');
    const params: unknown[] = [id, locations, count.company_id ?? null, count.branch_id ?? null];
    const where = ['q.location_id = ANY($2::uuid[])', 'q.quantity <> 0', 'NOT p.has_variants'];
    if (count.category_id) where.push(`p.category_id = $${params.push(count.category_id)}`);
    const products = (count.product_ids as string[] | null) ?? [];
    if (products.length) where.push(`q.product_id = ANY($${params.push(products)}::uuid[])`);
    await conn.transaction(async (m: Queryable) => {
      await m.query(
        `INSERT INTO inventory_count_lines (count_id, product_id, lot_id, location_id, expected_qty, unit_cost, company_id, branch_id)
         SELECT $1, q.product_id, q.lot_id, q.location_id, q.quantity, q.unit_cost, $3, $4
           FROM inventory_quants q JOIN products p ON p.id = q.product_id
          WHERE ${where.join(' AND ')}
         ON CONFLICT DO NOTHING`,
        params,
      );
      await m.query(
        `UPDATE inventory_counts SET state = 'counting', started_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`,
        [id, ctx.user?.sub ?? null],
      );
    });
    await this.record(ctx, ENTITY.count, id, 'updated', 'Counting started');
    return this.get(ctx, id);
  }

  /** Records a counted quantity (replacing it, or adding to it when scanning one by one). */
  async setLine(ctx: CatalogContext, id: string, dto: CountLineDto) {
    const { conn, scope } = await this.open(ctx);
    const count = await this.countingCount(conn, scope, id);
    await this.checkCountLocation(conn, count, dto.location_id);
    const product = await this.visibleProduct(conn, scope, dto.product_id);
    if (dto.lot_id) await this.visibleLot(conn, scope, dto.lot_id, dto.product_id);
    const config = await this.config(conn, dto.product_id);
    const line = await this.upsertLine(conn, ctx, count, {
      product_id: dto.product_id, location_id: dto.location_id, lot_id: dto.lot_id ?? null,
      quantity: dto.counted_qty, add: dto.add === true, notes: dto.notes, tracking: String(config.tracking ?? 'none'), cost: Number(product.cost_price ?? 0),
    });
    return this.lineOut(conn, count, line.id as string);
  }

  async updateLine(ctx: CatalogContext, id: string, lineId: string, dto: UpdateCountLineDto) {
    const { conn, scope } = await this.open(ctx);
    const count = await this.countingCount(conn, scope, id);
    const [line] = await conn.query(`SELECT * FROM inventory_count_lines WHERE id = $1 AND count_id = $2`, [lineId, id]);
    if (!line) throw new NotFoundException('That count line was not found');
    if (dto.counted_qty !== undefined && dto.counted_qty !== null) {
      const config = await this.config(conn, line.product_id as string);
      const problem = countProblem(String(config.tracking ?? 'none'), line.lot_id as string | null, dto.counted_qty);
      if (problem) throw new BadRequestException(problem);
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    if (dto.counted_qty !== undefined) {
      params.push(dto.counted_qty);
      sets.push(`counted_qty = $${params.length}`, `is_counted = ${dto.counted_qty === null ? 'false' : 'true'}`);
      params.push(dto.counted_qty === null ? null : ctx.user?.sub ?? null);
      sets.push(`counted_by = $${params.length}`, `counted_at = ${dto.counted_qty === null ? 'NULL' : 'now()'}`);
    }
    if (dto.notes !== undefined) {
      params.push(blankToNull(dto.notes) ?? null);
      sets.push(`notes = $${params.length}`);
    }
    if (sets.length) {
      params.push(lineId);
      await conn.query(`UPDATE inventory_count_lines SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
    }
    return this.lineOut(conn, count, lineId);
  }

  /**
   * One scan while counting: a location barcode (or code) moves the counter to that location; a
   * lot or serial number counts that lot; a product barcode or SKU counts one of the product.
   */
  async scan(ctx: CatalogContext, id: string, dto: CountScanDto) {
    const { conn, scope } = await this.open(ctx);
    const count = await this.countingCount(conn, scope, id);
    const code = dto.code.trim();
    const locations = await this.countLocations(conn, count);
    const [loc] = await conn.query(
      `SELECT id, code, name FROM inventory_locations
        WHERE id = ANY($1::uuid[]) AND (lower(barcode) = lower($2) OR lower(code) = lower($2)) LIMIT 1`,
      [locations, code],
    );
    if (loc) return { kind: 'location' as const, location: loc };
    if (!dto.location_id) throw new BadRequestException('Scan the location first, then the products in it');
    await this.checkCountLocation(conn, count, dto.location_id);
    const qty = dto.quantity ?? 1;
    // A lot or serial number names both the product and the lot.
    const lots = (await conn.query(`SELECT id, product_id, kind FROM inventory_lots WHERE lower(name) = lower($1) LIMIT 5`, [code])) as Row[];
    let productId: string | null = null;
    let lotId: string | null = null;
    if (lots.length === 1) {
      productId = lots[0].product_id as string;
      lotId = lots[0].id as string;
    } else if (lots.length > 1) {
      throw new BadRequestException('Several products have a lot with this number; scan the product first');
    } else {
      const [p] = await conn.query(
        `SELECT p.id FROM products p
          WHERE lower(p.sku) = lower($1)
             OR EXISTS (SELECT 1 FROM product_barcodes b WHERE b.product_id = p.id AND b.barcode = $1)
          LIMIT 1`,
        [code],
      );
      productId = (p?.id as string | undefined) ?? null;
    }
    if (!productId) throw new NotFoundException(`Nothing has the code ${code}`);
    const product = await this.visibleProduct(conn, scope, productId);
    if (lotId) await this.visibleLot(conn, scope, lotId, productId);
    const config = await this.config(conn, productId);
    const line = await this.upsertLine(conn, ctx, count, {
      product_id: productId, location_id: dto.location_id, lot_id: lotId, quantity: qty, add: true,
      tracking: String(config.tracking ?? 'none'), cost: Number(product.cost_price ?? 0),
    });
    return { kind: 'line' as const, line: await this.lineOut(conn, count, line.id as string) };
  }

  /** Counting is finished: it goes to review (still editable until posted). */
  async submit(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const count = await this.visibleCount(conn, scope, id);
    if (count.state !== 'counting') throw new BadRequestException('Only a stocktake being counted can be sent for review');
    const [{ counted }] = await conn.query(
      `SELECT count(*)::int AS counted FROM inventory_count_lines WHERE count_id = $1 AND counted_qty IS NOT NULL`, [id],
    );
    if (!counted) throw new BadRequestException('Nothing has been counted yet');
    await conn.query(
      `UPDATE inventory_counts SET state = 'review', submitted_at = now(), counted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`,
      [id, ctx.user?.sub ?? null],
    );
    await this.record(ctx, ENTITY.count, id, 'updated', `Sent for review: ${counted} line${counted === 1 ? '' : 's'} counted`);
    return this.get(ctx, id, { revealExpected: true });
  }

  /**
   * Posts the count: every counted line with a difference becomes one adjustment move of
   * (counted − on hand now), in one transaction; uncounted lines change nothing. The valuation
   * engine then adds layers for gains and consumes layers for losses.
   */
  async post(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const count = await this.visibleCount(conn, scope, id);
    if (!COUNTING.includes(count.state as CountState)) throw new BadRequestException('Only a stocktake being counted or in review can be posted');
    const lines = (await conn.query(
      `SELECT x.*, p.name AS product_name, p.cost_price FROM inventory_count_lines x JOIN products p ON p.id = x.product_id
        WHERE x.count_id = $1 AND x.counted_qty IS NOT NULL ORDER BY x.id`,
      [id],
    )) as Row[];
    if (!lines.length) throw new BadRequestException('Nothing has been counted yet');
    const moves: ValuationMove[] = [];
    let adjusted = 0;
    await conn.transaction(async (m: Queryable) => {
      for (const l of lines) {
        const [q] = await m.query(
          `SELECT quantity, unit_cost FROM inventory_quants
            WHERE product_id = $1 AND location_id = $2 AND lot_id IS NOT DISTINCT FROM $3 FOR UPDATE`,
          [l.product_id, l.location_id, l.lot_id ?? null],
        );
        const onHand = Number(q?.quantity ?? 0);
        const diff = round4(Number(l.counted_qty) - onHand);
        const cost = Number(q?.unit_cost ?? 0) || Number(l.unit_cost ?? 0) || Number(l.cost_price ?? 0);
        let moveId: string | null = null;
        if (diff !== 0) {
          const gain = diff > 0;
          const qty = Math.abs(diff);
          const [row] = await m.query(
            `INSERT INTO inventory_moves
               (reference, move_type, product_id, lot_id, from_location_id, to_location_id, quantity, done_quantity, unit_cost,
                state, source, source_document_id, reason, operator_user_id, company_id, branch_id, created_by, updated_by)
             VALUES ($1, 'adjustment', $2, $3, $4, $5, $6, $6, $7, 'draft', 'count', $8, $9, $10, $11, $12, $10, $10)
             RETURNING id`,
            [
              count.name, l.product_id, l.lot_id ?? null, gain ? null : l.location_id, gain ? l.location_id : null, qty, cost, id,
              `Stocktake ${count.name}`, ctx.user?.sub ?? null, count.company_id ?? null, count.branch_id ?? null,
            ],
          );
          moveId = row.id as string;
          const move: LedgerMove = {
            id: moveId, product_id: l.product_id as string, lot_id: (l.lot_id as string | null) ?? null,
            from_location_id: gain ? null : (l.location_id as string), to_location_id: gain ? (l.location_id as string) : null,
            quantity: qty, inbound_cost: gain ? cost : null,
            company_id: (count.company_id as string | null) ?? null, branch_id: (count.branch_id as string | null) ?? null,
          };
          // Counting sets the absolute quantity, so the result is the counted figure (never below zero).
          await this.applyMove(m, move, { allowNegative: true, actorId: ctx.user?.sub });
          moves.push({
            move_id: moveId, product_id: move.product_id, lot_id: move.lot_id, from_location_id: move.from_location_id,
            to_location_id: move.to_location_id, quantity: qty, unit_cost: cost, company_id: move.company_id, branch_id: move.branch_id,
          });
          adjusted += 1;
        }
        await m.query(
          `UPDATE inventory_count_lines SET on_hand_at_post = $1, variance = $2, unit_cost = $3, adjustment_move_id = $4, updated_at = now() WHERE id = $5`,
          [onHand, diff, cost, moveId, l.id],
        );
      }
      await m.query(
        `UPDATE inventory_counts SET state = 'posted', posted_at = now(), approved_by = $2, approved_at = now(),
                counted_at = COALESCE(counted_at, now()), updated_by = $2, updated_at = now() WHERE id = $1`,
        [id, ctx.user?.sub ?? null],
      );
    });
    await this.record(ctx, ENTITY.count, id, 'updated', `Posted: ${adjusted} adjustment${adjusted === 1 ? '' : 's'} from ${lines.length} counted line${lines.length === 1 ? '' : 's'}`);
    await this.valuation?.notify(ctx.tenantId, moves);
    return this.get(ctx, id, { revealExpected: true });
  }

  async cancel(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const count = await this.visibleCount(conn, scope, id);
    if (count.state === 'posted') throw new BadRequestException('A posted stocktake cannot be cancelled; count again to correct it');
    if (count.state === 'cancelled') return this.get(ctx, id);
    await conn.query(`UPDATE inventory_counts SET state = 'cancelled', updated_by = $2, updated_at = now() WHERE id = $1`, [id, ctx.user?.sub ?? null]);
    await this.record(ctx, ENTITY.count, id, 'updated', 'Stocktake cancelled');
    return this.get(ctx, id, { revealExpected: true });
  }

  /** The count sheet (to count on paper, or the result once posted). */
  async sheetCsv(ctx: CatalogContext, id: string, opts: { revealExpected?: boolean; showMoney?: boolean } = {}): Promise<string> {
    const out: Row[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const r = await this.lines(ctx, id, { page, limit: 500 }, opts);
      out.push(...(r.data as Row[]));
      if (r.data.length < 500) break;
    }
    const count = await this.get(ctx, id, opts);
    const showExpected = !count.expected_hidden;
    const head = ['Location', 'Product', 'SKU', 'Lot / serial', 'Expiry', ...(showExpected ? ['Expected'] : []), 'Counted',
      ...(showExpected ? ['Difference'] : []), ...(showExpected && opts.showMoney ? ['Difference value'] : []), 'Counted by', 'Notes'];
    const body = out.map((r) => [
      r.location_code, r.product_name, r.sku, r.lot_name ?? '', r.expiry_date ?? '',
      ...(showExpected ? [r.expected_qty] : []), r.counted_qty ?? '',
      ...(showExpected ? [r.counted_qty == null ? '' : r.variance] : []),
      ...(showExpected && opts.showMoney ? [r.counted_qty == null ? '' : r.variance_value] : []),
      r.counted_by_name ?? '', r.notes ?? '',
    ].map(csvCell).join(','));
    return [head.map(csvCell).join(','), ...body].join('\n');
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private hidesExpected(count: Row, reveal?: boolean): boolean {
    return Boolean(count.is_blind) && !reveal && (count.state === 'draft' || count.state === 'counting');
  }

  private async visibleCount(conn: Queryable, scope: InventoryScope, id: string): Promise<Row> {
    const count = await this.findVisible<Row>(conn, scope, 'inventory_counts', id, 'stocktake');
    const [extra] = await conn.query(
      `SELECT w.name AS warehouse_name, l.code AS location_code, u.full_name AS responsible_name, pc.name AS category_name
         FROM inventory_counts c
         LEFT JOIN inventory_warehouses w ON w.id = c.warehouse_id
         LEFT JOIN inventory_locations l ON l.id = c.location_id
         LEFT JOIN users u ON u.id = c.responsible_user_id
         LEFT JOIN product_categories pc ON pc.id = c.category_id
        WHERE c.id = $1`,
      [id],
    );
    return { ...count, ...(extra ?? {}) };
  }

  private async countingCount(conn: Queryable, scope: InventoryScope, id: string): Promise<Row> {
    const count = await this.visibleCount(conn, scope, id);
    if (!COUNTING.includes(count.state as CountState)) {
      throw new BadRequestException(count.state === 'draft' ? 'Start the stocktake before counting' : 'This stocktake is closed');
    }
    return count;
  }

  /** The storage locations a count covers: its location and everything under it, or the warehouse's. */
  private async countLocations(conn: Queryable, count: Row): Promise<string[]> {
    const rows = count.location_id
      ? await conn.query(
          `WITH RECURSIVE tree AS (
             SELECT id, usage, is_active FROM inventory_locations WHERE id = $1
             UNION ALL
             SELECT l.id, l.usage, l.is_active FROM inventory_locations l JOIN tree t ON l.parent_id = t.id
           ) SELECT id FROM tree WHERE usage = 'internal' AND is_active`,
          [count.location_id],
        )
      : await conn.query(
          `SELECT id FROM inventory_locations WHERE warehouse_id = $1 AND usage = 'internal' AND is_active`,
          [count.warehouse_id],
        );
    return (rows as Row[]).map((r) => r.id as string);
  }

  private async checkCountLocation(conn: Queryable, count: Row, locationId: string) {
    const locations = await this.countLocations(conn, count);
    if (!locations.includes(locationId)) throw new BadRequestException('That location is not part of this stocktake');
  }

  /** Sets or adds to a line; a product found where it was not expected gets a new line (expected = on hand now). */
  private async upsertLine(
    conn: Tx,
    ctx: CatalogContext,
    count: Row,
    l: { product_id: string; location_id: string; lot_id: string | null; quantity: number; add: boolean; notes?: string; tracking: string; cost: number },
  ): Promise<Row> {
    return conn.transaction(async (m: Queryable) => {
      const [existing] = await m.query(
        `SELECT * FROM inventory_count_lines
          WHERE count_id = $1 AND product_id = $2 AND location_id = $3 AND lot_id IS NOT DISTINCT FROM $4 FOR UPDATE`,
        [count.id, l.product_id, l.location_id, l.lot_id],
      );
      const next = round4((l.add ? Number(existing?.counted_qty ?? 0) : 0) + l.quantity);
      const problem = countProblem(l.tracking, l.lot_id, next);
      if (problem) throw new BadRequestException(problem);
      if (existing) {
        await m.query(
          `UPDATE inventory_count_lines SET counted_qty = $1, is_counted = true, counted_by = $2, counted_at = now(),
                  notes = COALESCE($3, notes), updated_at = now() WHERE id = $4`,
          [next, ctx.user?.sub ?? null, blankToNull(l.notes) ?? null, existing.id],
        );
        return existing as Row;
      }
      const [q] = await m.query(
        `SELECT quantity, unit_cost FROM inventory_quants WHERE product_id = $1 AND location_id = $2 AND lot_id IS NOT DISTINCT FROM $3`,
        [l.product_id, l.location_id, l.lot_id],
      );
      const [row] = await m.query(
        `INSERT INTO inventory_count_lines
           (count_id, product_id, lot_id, location_id, expected_qty, counted_qty, is_counted, counted_by, counted_at, is_unexpected,
            unit_cost, notes, company_id, branch_id)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, now(), true, $8, $9, $10, $11)
         RETURNING *`,
        [
          count.id, l.product_id, l.lot_id, l.location_id, Number(q?.quantity ?? 0), next, ctx.user?.sub ?? null,
          Number(q?.unit_cost ?? 0) || l.cost, blankToNull(l.notes) ?? null, count.company_id ?? null, count.branch_id ?? null,
        ],
      );
      return row as Row;
    });
  }

  private async lineOut(conn: Queryable, count: Row, lineId: string) {
    const [r] = await conn.query(
      `SELECT x.*, p.name AS product_name, p.sku, lot.name AS lot_name, loc.code AS location_code
         FROM inventory_count_lines x JOIN products p ON p.id = x.product_id
         LEFT JOIN inventory_lots lot ON lot.id = x.lot_id
         LEFT JOIN inventory_locations loc ON loc.id = x.location_id
        WHERE x.id = $1`,
      [lineId],
    );
    if (!r) throw new NotFoundException('That count line was not found');
    if (this.hidesExpected(count)) {
      const { expected_qty: _e, variance: _v, on_hand_at_post: _o, ...rest } = r as Row;
      return rest;
    }
    const { variance, value } = lineVariance(r as Row);
    return { ...(r as Row), variance, variance_value: value };
  }
}
