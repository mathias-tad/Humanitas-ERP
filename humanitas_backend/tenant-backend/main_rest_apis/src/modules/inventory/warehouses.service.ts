import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../../common/records/record-context';
import { InventoryBase, ENTITY, blankToNull } from './inventory.base';
import type { Queryable } from '../../common/records/record-scope';
import type {
  CreateLocationDto, CreateWarehouseDto, ListLocationsQueryDto, ListWarehousesQueryDto,
  UpdateLocationDto, UpdateWarehouseDto,
} from './dto/inventory.dto';

/** The virtual locations every warehouse gets, so receipts and deliveries work at once. */
const VIRTUAL_LOCATIONS = [
  { code: 'WH', name: 'Stock', usage: 'internal', key: 'stock_location_id' },
  { code: 'WH/IN', name: 'Input', usage: 'internal', key: 'input_location_id' },
  { code: 'WH/OUT', name: 'Output', usage: 'internal', key: 'output_location_id' },
  { code: 'WH/TRANSIT', name: 'Transit', usage: 'transit', key: 'transit_location_id' },
  { code: 'WH/VIEW', name: 'View', usage: 'view', key: 'view_location_id' },
] as const;

const WAREHOUSE_COLUMNS = ['code', 'name', 'short_name', 'address', 'city', 'phone', 'manager_id', 'is_active'] as const;
const LOCATION_COLUMNS = ['parent_id', 'code', 'name', 'usage', 'barcode', 'removal_strategy', 'replenish_location_id', 'is_active'] as const;

/** Warehouses and their storage locations (featureslist §2, Warehouses & Locations). */
@Injectable()
export class WarehousesService extends InventoryBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
  ) {
    super();
  }

  async list(ctx: CatalogContext, q: ListWarehousesQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const params: unknown[] = [q.search ? `%${q.search}%` : null, q.include_archived ?? false];
    const where = ['($1::text IS NULL OR w.code ILIKE $1 OR w.name ILIKE $1)', '($2::boolean OR w.is_active)'];
    const f = this.scopeFilter(scope, 'w', params);
    if (f) { params.push(...f.param); where.push(f.sql); }
    const limit = Math.min(q.limit ?? 50, 200);
    const page = q.page ?? 1;
    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await conn.query(`SELECT count(*)::int AS total FROM inventory_warehouses w ${w}`, params);
    const data = await conn.query(
      `SELECT w.*, u.full_name AS manager_name,
              (SELECT count(*)::int FROM inventory_locations l WHERE l.warehouse_id = w.id AND l.is_active) AS location_count,
              (SELECT count(DISTINCT q.product_id)::int FROM inventory_quants q
                 JOIN inventory_locations l2 ON l2.id = q.location_id
                WHERE l2.warehouse_id = w.id AND q.quantity <> 0) AS product_count
         FROM inventory_warehouses w
         LEFT JOIN users u ON u.id = w.manager_id
         ${w} ORDER BY w.code LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return { data, meta: { page, limit, total } };
  }

  async get(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    return this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_warehouses', id, 'warehouse');
  }

  async create(ctx: CatalogContext, dto: CreateWarehouseDto) {
    const { conn, scope } = await this.open(ctx);
    await this.checkUser(conn, dto.manager_id);
    const place = this.placement(scope, dto.company_id, dto.branch_id);
    const row = this.clean(dto);
    const cols = WAREHOUSE_COLUMNS.filter((c) => row[c] !== undefined);
    const params = cols.map((c) => row[c]);
    const placeKeys = Object.keys(place) as (keyof typeof place)[];
    // The warehouse and its locations are created together, or not at all.
    const created = await conn.transaction(async (m: Queryable) => {
      const [wh] = await m
        .query(
          `INSERT INTO inventory_warehouses (${cols.join(', ')}${placeKeys.length ? `, ${placeKeys.join(', ')}` : ''}, created_by, updated_by)
           VALUES (${[...cols, ...placeKeys].map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + placeKeys.length + 1}, $${cols.length + placeKeys.length + 1})
           RETURNING id`,
          [...params, ...placeKeys.map((k) => place[k]), ctx.user?.sub ?? null],
        )
        .catch((e: unknown) => this.rethrow(e));
      if (dto.create_default_locations !== false) {
        await this.createDefaultLocations(m, wh.id, row.code as string, row.name as string, place, ctx.user?.sub);
      }
      return wh as { id: string };
    });
    await this.record(ctx, ENTITY.warehouse, created.id, 'created', `Warehouse "${row.name}" created`);
    return this.get(ctx, created.id);
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateWarehouseDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_warehouses', id, 'warehouse');
    await this.checkUser(conn, dto.manager_id);
    const row = this.clean(dto);
    const cols: string[] = WAREHOUSE_COLUMNS.filter((c) => row[c] !== undefined);
    // Moving a warehouse to another company or branch moves its locations and stock with it
    // (trg_cascade_company_branch); a person can only move it within their own access.
    if (dto.company_id !== undefined) {
      this.placement(scope, dto.company_id, undefined);
      cols.push('company_id');
    }
    if (dto.branch_id !== undefined) {
      this.placement(scope, undefined, dto.branch_id);
      cols.push('branch_id');
    }
    if (!cols.length) return before;
    await conn
      .query(
        `UPDATE inventory_warehouses SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')},
                updated_by = $${cols.length + 1}, updated_at = now() WHERE id = $${cols.length + 2}`,
        [...cols.map((c) => row[c]), ctx.user?.sub ?? null, id],
      )
      .catch((e: unknown) => this.rethrow(e));
    const after = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_warehouses', id, 'warehouse');
    await this.timeline.recordChanges(ctx.tenantId, {
      entityType: ENTITY.warehouse, entityId: id, moduleKey: 'inventory', before, after,
      fields: { code: 'Code', name: 'Name', short_name: 'Short name', address: 'Address', city: 'City', phone: 'Phone', manager_id: 'Manager', company_id: 'Company', branch_id: 'Branch', is_active: 'Active' },
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return after;
  }

  /** Archives a warehouse. Stock on hand blocks it: a warehouse holding stock cannot disappear. */
  async archive(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const wh = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_warehouses', id, 'warehouse');
    const [held] = await conn.query(
      `SELECT count(*)::int AS n FROM inventory_quants q JOIN inventory_locations l ON l.id = q.location_id
        WHERE l.warehouse_id = $1 AND q.quantity <> 0`,
      [id],
    );
    if (Number(held?.n ?? 0) > 0) {
      throw new BadRequestException('This warehouse still holds stock; move or count it out before archiving');
    }
    await conn.query(`UPDATE inventory_warehouses SET is_active = false, archived_at = now(), updated_at = now() WHERE id = $1`, [id]);
    await this.record(ctx, ENTITY.warehouse, id, 'deleted', `Warehouse "${wh.name}" archived`);
    return { id, archived: true };
  }

  async restore(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const wh = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_warehouses', id, 'warehouse');
    await conn.query(`UPDATE inventory_warehouses SET is_active = true, archived_at = NULL, updated_at = now() WHERE id = $1`, [id]);
    await this.record(ctx, ENTITY.warehouse, id, 'restored', `Warehouse "${wh.name}" restored`);
    return { id, archived: false };
  }

  /** The virtual locations of a warehouse, with the ids kept on the warehouse row. */
  private async createDefaultLocations(
    conn: Queryable, warehouseId: string, code: string, name: string,
    place: { company_id: string | null; branch_id?: string }, actorId?: string | null,
  ): Promise<void> {
    const ids: Record<string, string> = {};
    for (const v of VIRTUAL_LOCATIONS) {
      const [loc] = await conn.query(
        `INSERT INTO inventory_locations (warehouse_id, code, name, usage, company_id, branch_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT DO NOTHING RETURNING id`,
        [warehouseId, `${code}/${v.code.replace(/^WH\/?/, '') || 'WH'}`, `${name} ${v.name}`, v.usage, place.company_id, place.branch_id ?? null, actorId ?? null],
      );
      if (loc?.id) ids[v.key] = loc.id;
    }
    const keys = Object.keys(ids);
    if (!keys.length) return;
    await conn.query(
      `UPDATE inventory_warehouses SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1}`,
      [...keys.map((k) => ids[k]), warehouseId],
    );
  }

  private clean(dto: object): Record<string, unknown> {
    const out: Record<string, unknown> = { ...(dto as Record<string, unknown>) };
    delete out.create_default_locations;
    for (const k of ['short_name', 'address', 'city', 'phone', 'barcode', 'origin', 'notes']) {
      if (out[k] !== undefined) out[k] = blankToNull(out[k]);
    }
    return out;
  }

  private async checkUser(conn: Queryable, id: string | null | undefined) {
    if (!id) return;
    const [u] = await conn.query(`SELECT id FROM users WHERE id = $1 AND COALESCE(is_active, true)`, [id]);
    if (!u) throw new BadRequestException('That manager is not an active user');
  }

  // ── Locations ──────────────────────────────────────────────────────────────────

  async listLocations(ctx: CatalogContext, q: ListLocationsQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const params: unknown[] = [q.warehouse_id ?? null, q.usage ?? null, q.search ? `%${q.search}%` : null, q.include_archived ?? false];
    const where = [
      '($1::uuid IS NULL OR l.warehouse_id = $1)',
      '($2::text IS NULL OR l.usage = $2)',
      '($3::text IS NULL OR l.code ILIKE $3 OR l.name ILIKE $3 OR l.barcode ILIKE $3)',
      '($4::boolean OR l.is_active)',
    ];
    const f = this.scopeFilter(scope, 'l', params);
    if (f) { params.push(...f.param); where.push(f.sql); }
    const data = await conn.query(
      `SELECT l.*, w.name AS warehouse_name, p.code AS parent_code,
              (SELECT count(*)::int FROM inventory_quants q WHERE q.location_id = l.id AND q.quantity <> 0) AS product_count
         FROM inventory_locations l
         LEFT JOIN inventory_warehouses w ON w.id = l.warehouse_id
         LEFT JOIN inventory_locations p ON p.id = l.parent_id
        WHERE ${where.join(' AND ')} ORDER BY w.code NULLS FIRST, l.code LIMIT 1000`,
      params,
    );
    return { data };
  }

  async getLocation(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    return this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_locations', id, 'location');
  }

  /** The location tree of a warehouse, for the tree view. */
  async locationTree(ctx: CatalogContext, warehouseId?: string) {
    const { data } = await this.listLocations(ctx, { warehouse_id: warehouseId, include_archived: false } as ListLocationsQueryDto);
    const byParent = new Map<string | null, Record<string, unknown>[]>();
    for (const row of data as Record<string, unknown>[]) {
      const key = (row.parent_id as string | null) ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(row);
    }
    const build = (parent: string | null): Record<string, unknown>[] =>
      (byParent.get(parent) ?? []).map((r) => ({ ...r, children: build(r.id as string) }));
    return { data: build(null) };
  }

  async createLocation(ctx: CatalogContext, dto: CreateLocationDto) {
    const { conn, scope } = await this.open(ctx);
    // A location follows its warehouse's company and branch unless given its own.
    let place = this.placement(scope, dto.company_id, dto.branch_id);
    if (dto.warehouse_id) {
      const wh = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_warehouses', dto.warehouse_id, 'warehouse');
      if (dto.company_id === undefined) place = { ...place, company_id: (wh.company_id as string) ?? place.company_id };
      if (dto.branch_id === undefined && wh.branch_id) place = { ...place, branch_id: wh.branch_id as string };
    }
    if (dto.parent_id) {
      const parent = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_locations', dto.parent_id, 'parent location');
      if (dto.warehouse_id && parent.warehouse_id && parent.warehouse_id !== dto.warehouse_id) {
        throw new BadRequestException('The parent location belongs to another warehouse');
      }
      if (!dto.warehouse_id && parent.warehouse_id) {
        const wh = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_warehouses', parent.warehouse_id as string, 'warehouse');
        dto = { ...dto, warehouse_id: parent.warehouse_id as string };
        if (dto.company_id === undefined) place = { ...place, company_id: (wh.company_id as string) ?? place.company_id };
      }
    }
    const row = this.clean(dto);
    const cols = LOCATION_COLUMNS.filter((c) => row[c] !== undefined);
    const placeKeys = Object.keys(place) as (keyof typeof place)[];
    const [created] = await conn
      .query(
        `INSERT INTO inventory_locations (warehouse_id, ${cols.join(', ')}${placeKeys.length ? `, ${placeKeys.join(', ')}` : ''}, created_by, updated_by)
         VALUES ($1, ${[...cols, ...placeKeys].map((_, i) => `$${i + 2}`).join(', ')}, $${cols.length + placeKeys.length + 2}, $${cols.length + placeKeys.length + 2})
         RETURNING id`,
        [dto.warehouse_id ?? null, ...cols.map((c) => row[c]), ...placeKeys.map((k) => place[k]), ctx.user?.sub ?? null],
      )
      .catch((e: unknown) => this.rethrow(e));
    await this.record(ctx, ENTITY.location, created.id, 'created', `Location "${row.name}" created`);
    return this.getLocation(ctx, created.id);
  }

  async updateLocation(ctx: CatalogContext, id: string, dto: UpdateLocationDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_locations', id, 'location');
    if (dto.parent_id === id) throw new BadRequestException('A location cannot be its own parent');
    if (dto.parent_id) {
      await this.findVisible(conn, scope, 'inventory_locations', dto.parent_id, 'parent location');
      if (await this.wouldLoop(conn, id, dto.parent_id)) {
        throw new BadRequestException('That parent would put this location inside itself');
      }
    }
    const row = this.clean(dto);
    const cols = LOCATION_COLUMNS.filter((c) => row[c] !== undefined);
    if (!cols.length) return before;
    await conn
      .query(
        `UPDATE inventory_locations SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')},
                updated_by = $${cols.length + 1}, updated_at = now() WHERE id = $${cols.length + 2}`,
        [...cols.map((c) => row[c]), ctx.user?.sub ?? null, id],
      )
      .catch((e: unknown) => this.rethrow(e));
    const after = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_locations', id, 'location');
    await this.timeline.recordChanges(ctx.tenantId, {
      entityType: ENTITY.location, entityId: id, moduleKey: 'inventory', before, after,
      fields: { code: 'Code', name: 'Name', usage: 'Usage', barcode: 'Barcode', removal_strategy: 'Removal strategy', is_active: 'Active' },
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return after;
  }

  /** Archives a location. Stock held there blocks it, as does having active children. */
  async archiveLocation(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const loc = await this.findVisible<Record<string, unknown>>(conn, scope, 'inventory_locations', id, 'location');
    const [held] = await conn.query(`SELECT count(*)::int AS n FROM inventory_quants WHERE location_id = $1 AND quantity <> 0`, [id]);
    if (Number(held?.n ?? 0) > 0) throw new BadRequestException('This location still holds stock; move it out before archiving');
    const [kids] = await conn.query(`SELECT count(*)::int AS n FROM inventory_locations WHERE parent_id = $1 AND is_active`, [id]);
    if (Number(kids?.n ?? 0) > 0) throw new BadRequestException('Archive this location\'s sub-locations first');
    await conn.query(`UPDATE inventory_locations SET is_active = false, archived_at = now(), updated_at = now() WHERE id = $1`, [id]);
    await this.record(ctx, ENTITY.location, id, 'deleted', `Location "${loc.name}" archived`);
    return { id, archived: true };
  }

  /** Whether making `parentId` the parent of `id` would create a cycle. */
  private async wouldLoop(conn: Queryable, id: string, parentId: string): Promise<boolean> {
    const rows: { parent_id: string | null }[] = await conn.query(
      `WITH RECURSIVE up AS (
         SELECT id, parent_id FROM inventory_locations WHERE id = $1
         UNION ALL
         SELECT l.id, l.parent_id FROM inventory_locations l JOIN up ON l.id = up.parent_id
       ) SELECT parent_id FROM up WHERE id = $2`,
      [parentId, id],
    );
    return rows.length > 0;
  }
}