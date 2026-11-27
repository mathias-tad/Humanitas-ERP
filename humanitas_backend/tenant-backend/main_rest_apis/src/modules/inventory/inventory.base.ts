import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { ActivityEventType } from '../activity-timeline/activity-timeline.types';
import type { CatalogContext } from '../../common/records/record-context';
import {
  assertBranchAssignable,
  assertCompanyAssignable,
  companyFilter,
  defaultRecordBranch,
  defaultRecordCompany,
  isVisible,
  resolveCompanyScope,
  type CompanyScope,
  type Queryable,
} from '../../common/records/record-scope';

/** The company and branch scope of an inventory request. Stock is always read through it. */
export type InventoryScope = CompanyScope;

/** Timeline entity types of inventory records. */
export const ENTITY = {
  warehouse: 'inventory_warehouse',
  location: 'inventory_location',
  transfer: 'inventory_transfer',
  move: 'inventory_move',
  count: 'inventory_count',
  lot: 'inventory_lot',
  config: 'inventory_product_config',
  orderpoint: 'inventory_orderpoint',
  putaway: 'inventory_putaway_rule',
  settings: 'inventory_settings',
} as const;

/** A trimmed value, or null when it is blank, for text columns that must not store ''. */
export const blankToNull = (v: unknown) => (typeof v === 'string' ? v.trim() || null : v);

/** The one move line `applyMove` needs to post. */
export interface LedgerMove {
  id: string;
  product_id: string;
  lot_id: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  quantity: string | number;
  /**
   * Cost applied to the RECEIVING quant on the inbound side (null = leave its existing cost
   * untouched). Outbound moves never change a quant's cost. The caller resolves the product's
   * cost_price here when no explicit cost was given, so a cost basis always reaches the engine.
   */
  inbound_cost?: number | null;
  company_id: string | null;
  branch_id: string | null;
}

/**
 * Shared plumbing of the Inventory services: tenant connection, company and branch scope,
 * product/lot lookups with scope and variant checks, numbering, the append-only stock ledger, and
 * history.
 *
 * Stock rules enforced here (schema notes in 20261123000001_inventory_core.sql):
 *  - inventory_quants is the only place a balance lives.
 *  - inventory_moves is append-only: a done move is never edited, it is reversed.
 *  - valuation arithmetic belongs to the Python calculation service (AGENTS.md rule 8);
 *    this class only records the quantities and costs and hands them over.
 *
 * Multi-company/branch (AGENTS.md rule 16): every record read goes through `findVisible`, so a
 * person can never see or move another company's or branch's stock.
 */
export abstract class InventoryBase {
  protected abstract readonly databaseService: DatabaseService;
  protected abstract readonly timeline: ActivityTimelineService;

  protected async open(ctx: CatalogContext) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader, ctx.branchHeader);
    return { conn, scope };
  }

  /** The company and branch a new record belongs to, checked against the person's access. */
  protected placement(scope: InventoryScope, companyId?: string | null, branchId?: string | null) {
    const company = companyId !== undefined ? companyId : defaultRecordCompany(scope);
    assertCompanyAssignable(scope, company);
    const branch = branchId !== undefined ? branchId : defaultRecordBranch(scope);
    assertBranchAssignable(scope, branch);
    return { company_id: company ?? null, ...(branch ? { branch_id: branch } : {}) };
  }

  /** A record the scope may see, or 404. Never leaks the existence of another company's/branch's row. */
  protected async findVisible<T extends { company_id?: string | null; branch_id?: string | null }>(
    conn: Queryable,
    scope: InventoryScope,
    table: string,
    id: string,
    what: string,
    extraWhere = '',
  ): Promise<T> {
    if (!/^[a-z_]+$/.test(table)) throw new Error(`Unsafe table name: ${table}`);
    const [row] = await conn.query(
      `SELECT * FROM ${table} WHERE id = $1${extraWhere ? ` AND ${extraWhere}` : ''}`,
      [id],
    );
    if (!row || !isVisible(scope, row.company_id, row.branch_id)) {
      throw new NotFoundException(`That ${what} was not found`);
    }
    return row as T;
  }

  /**
   * A product usable in a move/adjust/count (rule 20): it must be visible in the scope and not a
   * variant parent. Returns the product with its cost basis and scope columns.
   */
  protected async visibleProduct(conn: Queryable, scope: InventoryScope, id: string): Promise<Record<string, unknown>> {
    const [p] = await conn.query(
      `SELECT id, name, sku, product_type, uom_id, cost_price, has_variants, is_active, company_id, branch_id
         FROM products WHERE id = $1`,
      [id],
    );
    if (!p) throw new NotFoundException('That product was not found');
    if (!isVisible(scope, p.company_id, p.branch_id)) {
      throw new NotFoundException('That product is not in your company or branch');
    }
    if (p.has_variants) {
      throw new BadRequestException('A product with variants cannot hold stock; pick one of its variants');
    }
    if (p.product_type === 'service') {
      throw new BadRequestException(`"${p.name}" is a service; services are not kept in stock`);
    }
    if (p.is_active === false) throw new BadRequestException(`"${p.name}" is archived; restore it before moving its stock`);
    return p as Record<string, unknown>;
  }

  /**
   * A location a move may use (rule 16): visible in the scope and able to hold stock. A view
   * location only groups others; an archived one takes nothing new.
   */
  protected async usableLocation(conn: Queryable, scope: InventoryScope, id: string): Promise<Record<string, unknown>> {
    const loc = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_locations', id, 'location');
    if (loc.usage === 'view') throw new BadRequestException(`"${loc.name}" only groups other locations; choose a storage location`);
    if (loc.is_active === false) throw new BadRequestException(`"${loc.name}" is archived`);
    return loc;
  }

  /** Whether a product may go below zero: allowed on the product, or for the whole company. */
  protected async allowsNegative(conn: Queryable, productId: string, companyId: string | null): Promise<boolean> {
    const config = await this.config(conn, productId);
    if (config?.allow_negative) return true;
    return Boolean((await this.settingsFor(conn, companyId)).allow_negative_stock);
  }

  /** A lot/serial usable in a move/adjust/count (rule 16): visible and, when given, on this product. */
  protected async visibleLot(conn: Queryable, scope: InventoryScope, lotId: string, productId?: string): Promise<Record<string, unknown>> {
    const [lot] = await conn.query(`SELECT * FROM inventory_lots WHERE id = $1`, [lotId]);
    if (!lot) throw new BadRequestException('That lot or serial number was not found');
    if (productId && lot.product_id !== productId) throw new BadRequestException('That lot belongs to another product');
    if (!isVisible(scope, lot.company_id, lot.branch_id)) {
      throw new NotFoundException('That lot is not in your company or branch');
    }
    return lot as Record<string, unknown>;
  }

  protected record(
    ctx: CatalogContext,
    entityType: string,
    entityId: string,
    eventType: ActivityEventType,
    summary: string,
    payload?: Record<string, unknown>,
  ) {
    return this.timeline.record(ctx.tenantId, {
      entityType, entityId, eventType, moduleKey: 'inventory', summary, payload, actorId: ctx.user?.sub, client: ctx.client,
    });
  }

  /** The next document number of its kind for the company (WH/IN/00001, WH/CNT/00003…). */
  protected async nextNumber(conn: Queryable, kind: string, companyId: string | null): Promise<string> {
    const [row] = await conn.query(
      `INSERT INTO inventory_sequences (kind, prefix, next_number, company_id)
       VALUES ($1, '', 2, $2)
       ON CONFLICT (kind, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid))
       DO UPDATE SET next_number = inventory_sequences.next_number + 1, updated_at = now()
       RETURNING prefix, next_number - 1 AS n`,
      [kind, companyId],
    );
    if (!row) throw new BadRequestException('Could not number this document');
    const prefix = String(row.prefix ?? '').trim();
    const n = Number(row.n ?? 1);
    return `${prefix}${String(n).padStart(prefix ? 5 : 1, '0')}`;
  }

  /**
   * Post one move onto the stock quants and stamp its ledger row done.
   *
   * Runs inside the caller's `conn.transaction(...)` so a transfer or a stocktake is all-or-nothing.
   * The `FOR UPDATE` lock on the quant (in adjustQuant) is what serialises concurrent moves; it
   * holds for the whole transaction.
   *
   *  - outbound (the source quant) NEVER changes the quant's unit_cost;
   *  - inbound applies `inbound_cost` to the receiving quant; when it is null the existing cost is
   *    left untouched (the caller resolves the product's cost_price into it).
   */
  protected async applyMove(
    conn: Queryable,
    move: LedgerMove,
    opts: { allowNegative: boolean; actorId?: string | null },
  ): Promise<void> {
    const qty = Number(move.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('A move must carry a quantity greater than zero');
    }
    if (move.from_location_id) await this.adjustQuant(conn, move, -qty, null, opts);
    if (move.to_location_id) await this.adjustQuant(conn, move, qty, move.inbound_cost ?? null, opts);
    await conn.query(
      `UPDATE inventory_moves SET state = 'done', done_quantity = $1, done_at = now(), updated_at = now() WHERE id = $2`,
      [qty, move.id],
    );
  }

  /** Upsert one side of a move onto its quant, refusing to go below zero unless negative stock is on. */
  private async adjustQuant(
    conn: Queryable,
    move: LedgerMove,
    delta: number,
    cost: number | null,
    opts: { allowNegative: boolean; actorId?: string | null },
  ): Promise<void> {
    const locationId = delta < 0 ? move.from_location_id : move.to_location_id;
    const [existing] = await conn.query(
      `SELECT id, quantity FROM inventory_quants
        WHERE product_id = $1 AND location_id = $2 AND lot_id IS NOT DISTINCT FROM $3
        FOR UPDATE`,
      [move.product_id, locationId, move.lot_id],
    );
    const next = Number(existing?.quantity ?? 0) + delta;
    if (next < 0 && !opts.allowNegative) {
      throw new BadRequestException(
        'There is not enough stock in that location; turn on negative stock in Inventory Settings, or receive stock first',
      );
    }
    if (existing) {
      // Only an inbound side with an explicit cost moves the quant's cost; everything else keeps it.
      if (delta > 0 && cost != null) {
        await conn.query(
          `UPDATE inventory_quants SET quantity = $1, unit_cost = $2, updated_at = now() WHERE id = $3`,
          [next, cost, existing.id],
        );
      } else {
        await conn.query(`UPDATE inventory_quants SET quantity = $1, updated_at = now() WHERE id = $2`, [next, existing.id]);
      }
      return;
    }
    // A brand-new quant: carry the inbound cost when there is one, otherwise zero (the valuation
    // engine owns the authoritative layers).
    const unitCost = delta > 0 && cost != null ? cost : 0;
    await conn.query(
      `INSERT INTO inventory_quants (product_id, location_id, lot_id, quantity, unit_cost, company_id, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [move.product_id, locationId, move.lot_id, next, unitCost, move.company_id, move.branch_id],
    );
  }

  /** A product's inventory configuration, created with the defaults the first time it is needed. */
  protected async config(conn: Queryable, productId: string): Promise<Record<string, unknown>> {
    const [existing] = await conn.query(`SELECT * FROM inventory_product_config WHERE product_id = $1`, [productId]);
    if (existing) return existing;
    const [created] = await conn.query(
      `INSERT INTO inventory_product_config (product_id) VALUES ($1)
       ON CONFLICT (product_id) DO UPDATE SET updated_at = now() RETURNING *`,
      [productId],
    );
    return created;
  }

  /**
   * Inventory settings for a record's company (the switcher's, rule 16): the company's own row if it
   * has one, else the shared (company NULL) row, else the built-in defaults.
   */
  protected async settingsFor(conn: Queryable, company: string | null): Promise<Record<string, unknown>> {
    let s: Record<string, unknown> | undefined;
    if (company) s = (await conn.query(`SELECT * FROM inventory_settings WHERE company_id = $1 LIMIT 1`, [company]))[0];
    if (!s) s = (await conn.query(`SELECT * FROM inventory_settings WHERE company_id IS NULL LIMIT 1`))[0];
    return s ?? {
      default_costing_method: 'fifo', default_removal_strategy: 'fefo', allow_negative_stock: false,
      auto_reserve: true, receipt_steps: 1, delivery_steps: 1, expiry_warn_days: 30, low_stock_alert: true,
    };
  }

  /** Postgres unique-constraint errors as readable conflicts. */
  protected rethrow(e: unknown): never {
    const err = e as { code?: string; constraint?: string };
    if (err?.code === '23505') {
      const messages: Record<string, string> = {
        uq_inventory_warehouses_code: 'Another warehouse already uses this code in this company',
        uq_inventory_locations_code: 'This warehouse already has a location with this code',
        uq_inventory_locations_barcode: 'Another location already uses this barcode',
        uq_inventory_transfers_name: 'Another transfer already has this number',
        uq_inventory_counts_name: 'Another stocktake already has this number',
        uq_inventory_product_config_product: 'This product already has inventory settings',
        uq_inventory_orderpoints: 'This product already has a reorder point in that warehouse',
        uq_inventory_lots_product_name: 'This product already has a lot or serial with this name',
        uq_inventory_sequences: 'This numbering counter already exists',
      };
      throw new ConflictException(messages[err.constraint ?? ''] ?? 'This would duplicate an existing record');
    }
    throw e;
  }

  /** The scope filter for a listing query, or null when the person sees everything. */
  protected scopeFilter(scope: InventoryScope, alias: string, params: unknown[]) {
    return companyFilter(scope, alias, params.length + 1);
  }
}
