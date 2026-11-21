import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { ActivityClient } from '../activity-timeline/activity-client';
import type { AuthUser } from '../../common/types/authenticated-request';
import type { CreateProductDto, ListProductsQueryDto, ProductBarcodeDto, UpdateProductDto } from './dto/products.dto';
import {
  assertCompanyAssignable,
  companyFilter,
  isVisible,
  resolveCompanyScope,
  type CompanyScope,
  type Queryable,
} from './products.scope';
import { rethrowCatalogConflict } from './products.errors';
import { EIMS_READY_SQL, withEimsStatus } from './products.eims';

/** Request context every Products call needs. */
export interface CatalogContext {
  tenantId: string;
  user?: AuthUser;
  companyHeader?: string;
  client?: ActivityClient;
}

/** Fields shown on the product timeline (featureslist §30). */
export const PRODUCT_TRACKED_FIELDS: Record<string, string> = {
  name: 'Name',
  sku: 'SKU',
  description: 'Description',
  product_type: 'Type',
  category_id: 'Category',
  uom_id: 'Unit',
  purchase_uom_id: 'Purchase unit',
  sales_price: 'Sales price',
  cost_price: 'Cost',
  item_code: 'Item code',
  tax_code: 'Tax code',
  harmonization_code: 'HS code',
  excise_rate: 'Excise rate',
  invoice_description: 'Invoice description',
  can_be_sold: 'Can be sold',
  can_be_purchased: 'Can be purchased',
  image_url: 'Image',
  company_id: 'Company',
  barcodes: 'Barcodes',
};

const UPDATABLE = [
  'name', 'sku', 'description', 'product_type', 'category_id', 'uom_id', 'purchase_uom_id',
  'sales_price', 'cost_price', 'tax_code', 'item_code', 'harmonization_code', 'excise_rate', 'invoice_description',
  'can_be_sold', 'can_be_purchased', 'image_url', 'company_id',
] as const;

const SORTS: Record<string, string> = {
  name: 'lower(p.name)', sku: 'lower(p.sku)', item_code: 'lower(p.item_code)', sales_price: 'p.sales_price', created_at: 'p.created_at', updated_at: 'p.updated_at',
};

const SELECT_PRODUCT = `
  SELECT p.*, c.name AS category_name, u.name AS uom_name, u.symbol AS uom_symbol, u.mor_code AS uom_mor_code,
         c.excise_rate AS category_excise_rate, COALESCE(p.excise_rate, c.excise_rate, 0) AS effective_excise_rate,
         pu.name AS purchase_uom_name,
         COALESCE((SELECT json_agg(json_build_object(
             'id', b.id, 'barcode', b.barcode, 'barcode_type', b.barcode_type, 'packaging', b.packaging,
             'quantity', b.quantity, 'is_primary', b.is_primary) ORDER BY b.is_primary DESC, b.created_at)
           FROM product_barcodes b WHERE b.product_id = p.id), '[]'::json) AS barcodes
    FROM products p
    LEFT JOIN product_categories c ON c.id = p.category_id
    JOIN uoms u ON u.id = p.uom_id
    JOIN uoms pu ON pu.id = p.purchase_uom_id`;

/** Escape a CSV cell, and neutralise spreadsheet formulas (CSV injection). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Validate and normalise a barcode list: unique values, exactly one primary when any exist. */
export function normalizeBarcodes(input: ProductBarcodeDto[] | undefined): ProductBarcodeDto[] {
  const list = (input ?? []).map((b) => ({ ...b, barcode: b.barcode.trim() }));
  const seen = new Set<string>();
  for (const b of list) {
    if (seen.has(b.barcode)) throw new BadRequestException(`Barcode ${b.barcode} is listed twice`);
    seen.add(b.barcode);
  }
  const primaries = list.filter((b) => b.is_primary).length;
  if (primaries > 1) throw new BadRequestException('Only one barcode can be primary');
  if (list.length && primaries === 0) list[0] = { ...list[0], is_primary: true };
  return list;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  private async open(ctx: CatalogContext) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader);
    return { conn, scope };
  }

  async list(ctx: CatalogContext, query: ListProductsQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(scope, query);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 25));
    const sort = SORTS[query.sort ?? 'name'] ?? SORTS.name;
    const order = query.order === 'desc' ? 'DESC' : 'ASC';
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [{ total }] = await conn.query(
      `SELECT count(*)::int AS total FROM products p JOIN uoms u ON u.id = p.uom_id ${whereSql}`, params,
    );
    const rows = await conn.query(
      `${SELECT_PRODUCT} ${whereSql} ORDER BY ${sort} ${order}, p.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return { data: rows.map(withEimsStatus), meta: { page, limit, total } };
  }

  async get(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    return this.findVisible(conn, scope, id);
  }

  /** Barcode or SKU lookup for scanners (POS, inventory, mobile). Active products only. */
  async lookup(ctx: CatalogContext, code: string) {
    const value = (code ?? '').trim();
    if (!value) throw new BadRequestException('code is required');
    const { conn, scope } = await this.open(ctx);
    const params: unknown[] = [value];
    const f = companyFilter(scope, 'p', 2);
    if (f) params.push(f.param);
    const rows = await conn.query(
      `${SELECT_PRODUCT}
        WHERE p.is_active
          AND (EXISTS (SELECT 1 FROM product_barcodes b2 WHERE b2.product_id = p.id AND b2.barcode = $1)
               OR lower(p.sku) = lower($1) OR lower(p.item_code) = lower($1))
          ${f ? `AND ${f.sql}` : ''}
        LIMIT 1`,
      params,
    );
    if (!rows.length) throw new NotFoundException('No product with this barcode or SKU');
    return withEimsStatus(rows[0]);
  }

  async create(ctx: CatalogContext, dto: CreateProductDto) {
    const { conn, scope } = await this.open(ctx);
    assertCompanyAssignable(scope, dto.company_id);
    const barcodes = normalizeBarcodes(dto.barcodes);
    const uomId = dto.uom_id ?? (await this.defaultUomId(conn));
    const purchaseUomId = dto.purchase_uom_id ?? uomId;
    await this.checkUoms(conn, uomId, purchaseUomId);
    if (dto.category_id) await this.checkCategory(conn, scope, dto.category_id);

    const id = await conn.transaction(async (m: Queryable) => {
        const [row] = await m.query(
          `INSERT INTO products (sku, name, description, product_type, category_id, uom_id, purchase_uom_id,
                                 sales_price, cost_price, tax_code, can_be_sold, can_be_purchased, image_url,
                                 company_id, created_by, updated_by, item_code, harmonization_code, excise_rate,
                                 invoice_description)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,$16,$17,$18,$19)
           RETURNING id`,
          [
            dto.sku?.trim() || null, dto.name.trim(), dto.description ?? null, dto.product_type ?? 'consumable',
            dto.category_id ?? null, uomId, purchaseUomId, dto.sales_price ?? 0, dto.cost_price ?? 0,
            dto.tax_code ?? 'VAT15', dto.can_be_sold ?? true, dto.can_be_purchased ?? true, dto.image_url ?? null,
            dto.company_id ?? null, ctx.user?.sub ?? null, dto.item_code?.trim() || null,
            dto.harmonization_code?.trim() || null, dto.excise_rate ?? null, dto.invoice_description?.trim() || null,
          ],
        );
        await this.insertBarcodes(m, row.id, barcodes, ctx.user?.sub);
        return row.id as string;
      }).catch(rethrowCatalogConflict);

    const product = await this.findVisible(conn, scope, id);
    await this.timeline.record(ctx.tenantId, {
      entityType: 'product', entityId: id, eventType: 'created', moduleKey: 'products',
      summary: `Product "${product.name}" created`,
      changes: ActivityTimelineService.diff(null, this.trackable(product), PRODUCT_TRACKED_FIELDS),
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return product;
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateProductDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible(conn, scope, id);
    if (dto.company_id !== undefined) assertCompanyAssignable(scope, dto.company_id);
    const uomId = dto.uom_id ?? before.uom_id;
    const purchaseUomId = dto.purchase_uom_id ?? before.purchase_uom_id;
    if (dto.uom_id !== undefined || dto.purchase_uom_id !== undefined) await this.checkUoms(conn, uomId, purchaseUomId);
    if (dto.category_id) await this.checkCategory(conn, scope, dto.category_id);
    const barcodes = dto.barcodes ? normalizeBarcodes(dto.barcodes) : undefined;

    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of UPDATABLE) {
      if (dto[key] === undefined) continue;
      let value: unknown = dto[key];
      if (key === 'name' && typeof value === 'string') value = value.trim();
      if (key === 'sku' || key === 'harmonization_code' || key === 'invoice_description') {
        value = typeof value === 'string' && value.trim() ? value.trim() : null;
      }
      if (key === 'item_code' && typeof value === 'string') value = value.trim();
      params.push(value);
      sets.push(`${key} = $${params.length}`);
    }
    try {
      await conn.transaction(async (m: Queryable) => {
        params.push(ctx.user?.sub ?? null, id);
        await m.query(
          `UPDATE products SET ${[...sets, `updated_by = $${params.length - 1}`, 'updated_at = now()'].join(', ')}
            WHERE id = $${params.length}`,
          params,
        );
        if (barcodes) {
          await m.query(`DELETE FROM product_barcodes WHERE product_id = $1`, [id]);
          await this.insertBarcodes(m, id, barcodes, ctx.user?.sub);
        }
      });
    } catch (err) {
      rethrowCatalogConflict(err);
    }

    const after = await this.findVisible(conn, scope, id);
    await this.timeline.recordChanges(ctx.tenantId, {
      entityType: 'product', entityId: id, moduleKey: 'products',
      before: this.trackable(before), after: this.trackable(after), fields: PRODUCT_TRACKED_FIELDS,
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return after;
  }

  /** Delete = archive (rule 24): hidden from lists and scanners, history and links kept. */
  async archive(ctx: CatalogContext, id: string) {
    return this.setActive(ctx, id, false);
  }

  async restore(ctx: CatalogContext, id: string) {
    return this.setActive(ctx, id, true);
  }

  async exportCsv(ctx: CatalogContext, query: ListProductsQueryDto): Promise<string> {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(scope, query);
    const rows = await conn.query(
      `${SELECT_PRODUCT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY lower(p.name), p.id LIMIT 50000`,
      params,
    );
    const cols = ['item_code', 'sku', 'name', 'product_type', 'nature_of_supply', 'category_name', 'uom_name', 'uom_mor_code',
      'sales_price', 'cost_price', 'tax_code', 'tax_rate', 'effective_excise_rate', 'harmonization_code', 'invoice_description',
      'can_be_sold', 'can_be_purchased', 'is_active'];
    const lines = [[...cols, 'barcodes'].join(',')];
    for (const r of rows) {
      const codes = (r.barcodes ?? []).map((b: { barcode: string }) => b.barcode).join(' ');
      lines.push([...cols.map((c) => csvCell(r[c])), csvCell(codes)].join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  /** MoR master-data codes (tax codes, units, transaction types…) for forms; one list or all. */
  async eimsCodes(ctx: CatalogContext, list?: string) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const name = list?.trim();
    if (name && !/^[a-z_]{1,40}$/.test(name)) throw new BadRequestException('Unknown code list');
    return conn.query(
      `SELECT list_name, code, name, rate FROM eims_codes
        WHERE is_active ${name ? 'AND list_name = $1' : ''}
        ORDER BY list_name, sort_order, code`,
      name ? [name] : [],
    );
  }

  async timelineFor(ctx: CatalogContext, id: string, opts: { limit?: number; before?: string }) {
    const { conn, scope } = await this.open(ctx);
    await this.findVisible(conn, scope, id);
    return this.timeline.list(ctx.tenantId, 'product', id, opts);
  }

  // ── helpers ──────────────────────────────────────────────────────────────────────
  private filters(scope: CompanyScope, query: ListProductsQueryDto) {
    const where: string[] = [];
    const params: unknown[] = [];
    const status = query.status ?? 'active';
    if (status === 'active') where.push('p.is_active');
    if (status === 'archived') where.push('NOT p.is_active');
    if (query.q?.trim()) {
      params.push(`%${query.q.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      const p = `$${params.length}`;
      where.push(`(lower(p.name) LIKE ${p} OR lower(p.sku) LIKE ${p} OR lower(p.item_code) LIKE ${p}
               OR EXISTS (SELECT 1 FROM product_barcodes b3 WHERE b3.product_id = p.id AND lower(b3.barcode) LIKE ${p}))`);
    }
    if (query.eims === 'ready') where.push(EIMS_READY_SQL);
    if (query.eims === 'not_ready') where.push(`NOT ${EIMS_READY_SQL}`);
    if (query.category_id) {
      params.push(query.category_id);
      where.push(`p.category_id = $${params.length}`);
    }
    if (query.product_type) {
      params.push(query.product_type);
      where.push(`p.product_type = $${params.length}`);
    }
    const f = companyFilter(scope, 'p', params.length + 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    return { where, params };
  }

  private async findVisible(conn: Queryable, scope: CompanyScope, id: string) {
    const rows = await conn.query(`${SELECT_PRODUCT} WHERE p.id = $1`, [id]);
    const product = rows[0];
    if (!product || !isVisible(scope, product.company_id)) throw new NotFoundException('Product not found');
    return withEimsStatus(product);
  }

  private async setActive(ctx: CatalogContext, id: string, active: boolean) {
    const { conn, scope } = await this.open(ctx);
    const product = await this.findVisible(conn, scope, id);
    if (product.is_active === active) return product;
    await conn.query(
      `UPDATE products SET is_active = $1, archived_at = ${active ? 'NULL' : 'now()'}, updated_by = $2, updated_at = now()
        WHERE id = $3`,
      [active, ctx.user?.sub ?? null, id],
    );
    await this.timeline.record(ctx.tenantId, {
      entityType: 'product', entityId: id, eventType: active ? 'restored' : 'deleted', moduleKey: 'products',
      summary: active ? `Product "${product.name}" restored` : `Product "${product.name}" archived`,
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return this.findVisible(conn, scope, id);
  }

  private trackable(p: Record<string, unknown>) {
    const codes = Array.isArray(p.barcodes) ? (p.barcodes as { barcode: string }[]).map((b) => b.barcode).sort() : [];
    return { ...p, barcodes: codes };
  }

  private async insertBarcodes(m: Queryable, productId: string, barcodes: ProductBarcodeDto[], actorId?: string) {
    for (const b of barcodes) {
      await m.query(
        `INSERT INTO product_barcodes (product_id, barcode, barcode_type, packaging, quantity, is_primary, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [productId, b.barcode, b.barcode_type ?? 'other', b.packaging ?? null, b.quantity ?? 1, !!b.is_primary, actorId ?? null],
      );
    }
  }

  private async defaultUomId(conn: Queryable): Promise<string> {
    const rows = await conn.query(
      `SELECT u.id FROM uoms u JOIN uom_categories c ON c.id = u.category_id
        WHERE lower(c.name) = 'unit' AND u.is_reference AND u.is_active LIMIT 1`,
    );
    if (!rows.length) throw new BadRequestException('No default unit configured; choose a unit of measure');
    return rows[0].id;
  }

  private async checkUoms(conn: Queryable, uomId: string, purchaseUomId: string) {
    const rows: { id: string; category_id: string; is_active: boolean }[] = await conn.query(
      `SELECT id, category_id, is_active FROM uoms WHERE id = ANY($1::uuid[])`,
      [[uomId, purchaseUomId]],
    );
    const uom = rows.find((r) => r.id === uomId);
    const pu = rows.find((r) => r.id === purchaseUomId);
    if (!uom || !uom.is_active) throw new BadRequestException('Unit of measure not found');
    if (!pu || !pu.is_active) throw new BadRequestException('Purchase unit of measure not found');
    if (uom.category_id !== pu.category_id) {
      throw new BadRequestException('Purchase unit must be in the same unit category as the sales unit (e.g. both weights)');
    }
  }

  private async checkCategory(conn: Queryable, scope: CompanyScope, categoryId: string) {
    const rows = await conn.query(`SELECT id, is_active, company_id FROM product_categories WHERE id = $1`, [categoryId]);
    const c = rows[0];
    if (!c || !isVisible(scope, c.company_id)) throw new BadRequestException('Category not found');
    if (!c.is_active) throw new BadRequestException('Category is archived');
  }
}
