import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from './products.service';
import { csvCell } from './products.service';
import {
  assertCompanyAssignable,
  companyFilter,
  defaultRecordCompany,
  isVisible,
  resolveCompanyScope,
  type CompanyScope,
  type Queryable,
} from './products.scope';
import { rethrowCatalogConflict } from './products.errors';
import { priceFor, ruleProblem, type PriceRule, type PricedProduct, type PriceResult } from './price-lists.pricing';
import type { BulkPriceRulesDto, CompareQueryDto, CreatePriceListDto, PriceQueryDto, PriceRuleDto, UpdatePriceListDto, UpdatePriceRuleDto } from './dto/price-lists.dto';

/** The currency product prices are kept in. */
export const BASE_CURRENCY = 'ETB';

const LIST_SQL = `
  SELECT pl.*, (SELECT count(*)::int FROM price_list_items i WHERE i.price_list_id = pl.id AND i.is_active) AS rule_count
    FROM price_lists pl`;

const ITEMS_SQL = `
  SELECT i.*, to_char(i.date_start, 'YYYY-MM-DD') AS date_start, to_char(i.date_end, 'YYYY-MM-DD') AS date_end,
         p.name AS product_name, p.sku AS product_sku, p.has_variants AS product_has_variants, c.name AS category_name
    FROM price_list_items i
    LEFT JOIN products p ON p.id = i.product_id
    LEFT JOIN product_categories c ON c.id = i.category_id
   WHERE i.price_list_id = $1 AND (i.is_active OR $2)
   ORDER BY CASE i.applies_to WHEN 'product' THEN 0 WHEN 'category' THEN 1 ELSE 2 END,
            lower(COALESCE(p.name, c.name, '')), i.min_quantity, i.sort_order, i.created_at`;

type ProductRow = { id: string; name: string; sku: string | null; item_code: string | null; parent_id: string | null; category_id: string | null; sales_price: string; cost_price: string; company_id: string | null; has_variants: boolean };

/** Category id -> its path to the root (itself first). */
export function categoryPaths(rows: { id: string; parent_id: string | null }[]): Map<string, string[]> {
  const parent = new Map(rows.map((r) => [r.id, r.parent_id]));
  const out = new Map<string, string[]>();
  for (const r of rows) {
    const path: string[] = [];
    let cur: string | null | undefined = r.id;
    while (cur && !path.includes(cur) && path.length < 50) {
      path.push(cur);
      cur = parent.get(cur) ?? null;
    }
    out.set(r.id, path);
  }
  return out;
}

/** Price lists and the price of a product on them (featureslist §1). */
@Injectable()
export class PriceListsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  private async open(ctx: CatalogContext) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader);
    return { conn, scope };
  }

  async list(ctx: CatalogContext, includeArchived = false) {
    const { conn, scope } = await this.open(ctx);
    const params: unknown[] = [];
    const where: string[] = [];
    if (!includeArchived) where.push('pl.is_active');
    const f = companyFilter(scope, 'pl', 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    return conn.query(
      `${LIST_SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY pl.is_default DESC, pl.sort_order, lower(pl.name)`,
      params,
    );
  }

  async get(ctx: CatalogContext, id: string, includeArchivedRules = false) {
    const { conn, scope } = await this.open(ctx);
    const list = await this.findVisible(conn, scope, id);
    const items = await conn.query(ITEMS_SQL, [id, includeArchivedRules]);
    return { ...list, items };
  }

  /** The default list of the current company (or the shared one): what Sales and POS start with. */
  async getDefault(ctx: CatalogContext) {
    const lists: { id: string; company_id: string | null; is_default: boolean }[] = await this.list(ctx);
    const scope = (await this.open(ctx)).scope;
    const company = defaultRecordCompany(scope);
    const pick = lists.find((l) => l.is_default && l.company_id === company) ?? lists.find((l) => l.is_default && !l.company_id) ?? lists[0];
    if (!pick) throw new NotFoundException('No price list yet');
    return this.get(ctx, pick.id);
  }

  async create(ctx: CatalogContext, dto: CreatePriceListDto) {
    const { conn, scope } = await this.open(ctx);
    const companyId = dto.company_id !== undefined ? dto.company_id : defaultRecordCompany(scope);
    assertCompanyAssignable(scope, companyId);
    const id = await conn
      .transaction(async (m: Queryable) => {
        if (dto.is_default) await this.clearDefault(m, companyId ?? null);
        const [row] = await m.query(
          `INSERT INTO price_lists (name, code, currency, description, is_default, sort_order, company_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6, (SELECT COALESCE(max(sort_order), 0) + 1 FROM price_lists)), $7, $8, $8)
           RETURNING id`,
          [dto.name.trim(), dto.code?.trim() || null, dto.currency ?? BASE_CURRENCY, dto.description ?? null, !!dto.is_default,
            dto.sort_order ?? null, companyId ?? null, ctx.user?.sub ?? null],
        );
        return row.id as string;
      })
      .catch(rethrowCatalogConflict);
    await this.record(ctx, id, 'created', `Price list "${dto.name.trim()}" created`);
    return this.get(ctx, id);
  }

  async update(ctx: CatalogContext, id: string, dto: UpdatePriceListDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible(conn, scope, id);
    if (dto.company_id !== undefined) assertCompanyAssignable(scope, dto.company_id);
    if (dto.is_active === false && before.is_default) throw new BadRequestException('Make another price list the default before archiving this one');
    if (dto.is_default === false && before.is_default) throw new BadRequestException('Make another price list the default instead');
    if (dto.currency && dto.currency !== before.currency && dto.currency !== BASE_CURRENCY) {
      const [{ n }] = await conn.query(
        `SELECT count(*)::int AS n FROM price_list_items WHERE price_list_id = $1 AND is_active AND compute <> 'fixed'`, [id],
      );
      if (n > 0) throw new BadRequestException(`This list has ${n} percentage rule${n === 1 ? '' : 's'}; in another currency only fixed prices work. Change them first.`);
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    const put = (col: string, v: unknown) => {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    };
    if (dto.name !== undefined) put('name', dto.name.trim());
    if (dto.code !== undefined) put('code', dto.code?.trim() || null);
    if (dto.currency !== undefined) put('currency', dto.currency);
    if (dto.description !== undefined) put('description', dto.description);
    if (dto.sort_order !== undefined) put('sort_order', dto.sort_order);
    if (dto.company_id !== undefined) put('company_id', dto.company_id);
    if (dto.is_active !== undefined) put('is_active', dto.is_active);
    if (dto.is_default) put('is_default', true);
    await conn
      .transaction(async (m: Queryable) => {
        if (dto.is_default && !before.is_default) {
          await this.clearDefault(m, dto.company_id !== undefined ? dto.company_id : before.company_id);
        }
        if (sets.length) {
          params.push(ctx.user?.sub ?? null, id);
          await m.query(
            `UPDATE price_lists SET ${[...sets, `updated_by = $${params.length - 1}`, 'updated_at = now()'].join(', ')} WHERE id = $${params.length}`,
            params,
          );
        }
      })
      .catch(rethrowCatalogConflict);
    const after = await this.get(ctx, id);
    const what = dto.is_active === false ? 'archived' : dto.is_active === true && !before.is_active ? 'restored' : 'updated';
    await this.record(ctx, id, what === 'archived' ? 'deleted' : what === 'restored' ? 'restored' : 'updated', `Price list "${after.name}" ${what}`);
    return after;
  }

  async archive(ctx: CatalogContext, id: string) {
    return this.update(ctx, id, { is_active: false });
  }

  async addRule(ctx: CatalogContext, listId: string, dto: PriceRuleDto) {
    const { conn, scope } = await this.open(ctx);
    const list = await this.findVisible(conn, scope, listId);
    const rule = this.normalizeRule(dto);
    await this.checkRule(conn, scope, rule, list.currency);
    const [row] = await conn.query(
      `INSERT INTO price_list_items (price_list_id, applies_to, product_id, category_id, min_quantity, compute, fixed_price, percent,
                                     date_start, date_end, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12) RETURNING id`,
      [listId, rule.applies_to, rule.product_id, rule.category_id, rule.min_quantity, rule.compute, rule.fixed_price, rule.percent,
        rule.date_start, rule.date_end, rule.sort_order, ctx.user?.sub ?? null],
    );
    await this.record(ctx, listId, 'updated', `Rule added to "${list.name}"`);
    return this.findRule(conn, listId, row.id);
  }

  /** The same rule for several products at once: one rule per product, all or nothing. */
  async addRules(ctx: CatalogContext, listId: string, dto: BulkPriceRulesDto) {
    const { conn, scope } = await this.open(ctx);
    const list = await this.findVisible(conn, scope, listId);
    const ids = [...new Set(dto.product_ids)];
    const { product_ids: _ids, ...ruleFields } = dto;
    void _ids;
    const rule = this.normalizeRule({ ...ruleFields, applies_to: 'product', product_id: ids[0] } as PriceRuleDto);
    const problem = ruleProblem(rule, list.currency, BASE_CURRENCY);
    if (problem) throw new BadRequestException(problem);
    const found: { id: string; company_id: string | null; is_active: boolean }[] = await conn.query(
      `SELECT id, company_id, is_active FROM products WHERE id = ANY($1::uuid[])`, [ids],
    );
    const byId = new Map(found.map((p) => [p.id, p]));
    const bad = ids.filter((id) => {
      const p = byId.get(id);
      return !p || !isVisible(scope, p.company_id) || !p.is_active;
    });
    if (bad.length) {
      throw new BadRequestException(`${bad.length} of the chosen products ${bad.length === 1 ? 'is' : 'are'} archived or not found; nothing was added`);
    }
    await conn.transaction(async (m: Queryable) => {
      for (const id of ids) {
        await m.query(
          `INSERT INTO price_list_items (price_list_id, applies_to, product_id, category_id, min_quantity, compute, fixed_price, percent,
                                         date_start, date_end, sort_order, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
          [listId, 'product', id, null, rule.min_quantity, rule.compute, rule.fixed_price, rule.percent,
            rule.date_start, rule.date_end, rule.sort_order, ctx.user?.sub ?? null],
        );
      }
    });
    await this.record(ctx, listId, 'updated', `${ids.length} product rule${ids.length === 1 ? '' : 's'} added to "${list.name}"`);
    return { added: ids.length };
  }

  async updateRule(ctx: CatalogContext, listId: string, ruleId: string, dto: UpdatePriceRuleDto) {
    const { conn, scope } = await this.open(ctx);
    const list = await this.findVisible(conn, scope, listId);
    const before = await this.findRule(conn, listId, ruleId);
    const merged = this.normalizeRule({ ...before, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) } as PriceRuleDto);
    if (dto.is_active !== false) await this.checkRule(conn, scope, merged, list.currency);
    await conn.query(
      `UPDATE price_list_items SET applies_to = $3, product_id = $4, category_id = $5, min_quantity = $6, compute = $7, fixed_price = $8,
              percent = $9, date_start = $10, date_end = $11, sort_order = $12, is_active = $13, updated_by = $14, updated_at = now()
        WHERE id = $1 AND price_list_id = $2`,
      [ruleId, listId, merged.applies_to, merged.product_id, merged.category_id, merged.min_quantity, merged.compute, merged.fixed_price,
        merged.percent, merged.date_start, merged.date_end, merged.sort_order, dto.is_active ?? before.is_active, ctx.user?.sub ?? null],
    );
    await this.record(ctx, listId, 'updated', dto.is_active === false ? `Rule removed from "${list.name}"` : `Rule changed in "${list.name}"`);
    return this.findRule(conn, listId, ruleId);
  }

  /** Rules are archived, not deleted (rule 24): the list's history keeps them. */
  async archiveRule(ctx: CatalogContext, listId: string, ruleId: string) {
    return this.updateRule(ctx, listId, ruleId, { is_active: false });
  }

  /** The price of one product on a list (the default list when none is given). */
  async price(ctx: CatalogContext, q: PriceQueryDto): Promise<PriceResult & { price_list_id: string; currency: string; quantity: number }> {
    const { conn, scope } = await this.open(ctx);
    const listId = q.price_list_id ?? (await this.getDefault(ctx)).id;
    const list = await this.findVisible(conn, scope, listId);
    if (!list.is_active) throw new BadRequestException('This price list is archived');
    const [product] = await this.products(conn, scope, { ids: [q.product_id] });
    if (!product) throw new NotFoundException('Product not found');
    if (product.has_variants) throw new BadRequestException('Choose one of the product\'s variants; the product itself is not sold');
    const paths = await this.paths(conn);
    const rules = await this.rulesFor(conn, [listId]);
    const quantity = q.quantity ?? 1;
    const res = priceFor(rules.get(listId) ?? [], this.priced(product, paths), quantity, q.date?.slice(0, 10) ?? today());
    return { ...res, price_list_id: listId, currency: list.currency, quantity };
  }

  /** Prices of many products on one list (labels and price tags). Products with variants are left out: their variants carry the prices. */
  async prices(ctx: CatalogContext, q: { product_ids: string[]; price_list_id?: string; quantity?: number }) {
    const { conn, scope } = await this.open(ctx);
    const listId = q.price_list_id ?? (await this.getDefault(ctx)).id;
    const list = await this.findVisible(conn, scope, listId);
    if (!list.is_active) throw new BadRequestException('This price list is archived');
    const products = await this.products(conn, scope, { ids: [...new Set(q.product_ids)] });
    const paths = await this.paths(conn);
    const rules = (await this.rulesFor(conn, [listId])).get(listId) ?? [];
    const quantity = q.quantity ?? 1;
    const day = today();
    const prices: Record<string, number> = {};
    for (const p of products) if (!p.has_variants) prices[p.id] = priceFor(rules, this.priced(p, paths), quantity, day).price;
    return { price_list_id: listId, price_list_name: list.name as string, currency: list.currency as string, quantity, prices };
  }

  /** A product's price on every active list (the product's Prices tab). */
  async pricesForProduct(ctx: CatalogContext, productId: string, quantity = 1) {
    const { conn, scope } = await this.open(ctx);
    const [product] = await this.products(conn, scope, { ids: [productId] });
    if (!product) throw new NotFoundException('Product not found');
    const lists: { id: string; name: string; currency: string; is_default: boolean }[] = await this.list(ctx);
    const paths = await this.paths(conn);
    const rules = await this.rulesFor(conn, lists.map((l) => l.id));
    const targets = product.has_variants ? await this.products(conn, scope, { parentId: product.id }) : [product];
    return {
      product_id: product.id,
      quantity,
      lists: lists.map((l) => ({ id: l.id, name: l.name, currency: l.currency, is_default: l.is_default })),
      rows: targets.map((t) => ({
        product_id: t.id,
        name: t.name,
        base_price: Number(t.sales_price),
        prices: Object.fromEntries(lists.map((l) => [l.id, priceFor(rules.get(l.id) ?? [], this.priced(t, paths), quantity, today())])),
      })),
    };
  }

  /** Price list comparison report: sellable products against the chosen lists. */
  async compare(ctx: CatalogContext, q: CompareQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const all: { id: string; name: string; currency: string; is_default: boolean }[] = await this.list(ctx);
    const wanted = (q.price_list_ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const lists = wanted.length ? all.filter((l) => wanted.includes(l.id)) : all;
    const products = await this.products(conn, scope, { q: q.q, categoryId: q.category_id, limit: q.limit ?? 200 });
    const paths = await this.paths(conn);
    const rules = await this.rulesFor(conn, lists.map((l) => l.id));
    const quantity = q.quantity ?? 1;
    return {
      quantity,
      lists: lists.map((l) => ({ id: l.id, name: l.name, currency: l.currency, is_default: l.is_default })),
      rows: products.map((p) => ({
        product_id: p.id,
        name: p.name,
        sku: p.sku,
        item_code: p.item_code,
        base_price: Number(p.sales_price),
        prices: Object.fromEntries(lists.map((l) => [l.id, priceFor(rules.get(l.id) ?? [], this.priced(p, paths), quantity, today()).price])),
      })),
    };
  }

  async compareCsv(ctx: CatalogContext, q: CompareQueryDto): Promise<string> {
    const r = await this.compare(ctx, { ...q, limit: q.limit ?? 500 });
    const head = ['item_code', 'sku', 'name', 'sales_price', ...r.lists.map((l) => `${l.name} (${l.currency})`)];
    const lines = [head.map(csvCell).join(',')];
    for (const row of r.rows) {
      lines.push([row.item_code, row.sku, row.name, row.base_price.toFixed(2), ...r.lists.map((l) => Number(row.prices[l.id]).toFixed(2))].map(csvCell).join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  // ── helpers ──────────────────────────────────────────────────────────────────────
  private async findVisible(conn: Queryable, scope: CompanyScope, id: string) {
    const rows = await conn.query(`${LIST_SQL} WHERE pl.id = $1`, [id]);
    const list = rows[0];
    if (!list || !isVisible(scope, list.company_id)) throw new NotFoundException('Price list not found');
    return list;
  }

  private async findRule(conn: Queryable, listId: string, ruleId: string) {
    const rows = await conn.query(`${ITEMS_SQL.replace('ORDER BY', 'AND i.id = $3 ORDER BY')}`, [listId, true, ruleId]);
    if (!rows.length) throw new NotFoundException('Rule not found');
    return rows[0];
  }

  private async clearDefault(m: Queryable, companyId: string | null) {
    await m.query(
      `UPDATE price_lists SET is_default = false, updated_at = now()
        WHERE is_default AND COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
      [companyId],
    );
  }

  private normalizeRule(dto: PriceRuleDto): Required<Omit<PriceRuleDto, 'product_id' | 'category_id' | 'fixed_price' | 'percent' | 'date_start' | 'date_end'>> & {
    product_id: string | null; category_id: string | null; fixed_price: number | null; percent: number | null; date_start: string | null; date_end: string | null;
  } {
    const fixed = dto.compute === 'fixed';
    return {
      applies_to: dto.applies_to,
      product_id: dto.applies_to === 'product' ? (dto.product_id ?? null) : null,
      category_id: dto.applies_to === 'category' ? (dto.category_id ?? null) : null,
      min_quantity: Number(dto.min_quantity ?? 0),
      compute: dto.compute,
      fixed_price: fixed ? (dto.fixed_price === undefined || dto.fixed_price === null ? null : Number(dto.fixed_price)) : null,
      percent: fixed ? null : (dto.percent === undefined || dto.percent === null ? null : Number(dto.percent)),
      date_start: dto.date_start ? String(dto.date_start).slice(0, 10) : null,
      date_end: dto.date_end ? String(dto.date_end).slice(0, 10) : null,
      sort_order: Number(dto.sort_order ?? 0),
    };
  }

  private async checkRule(conn: Queryable, scope: CompanyScope, rule: ReturnType<PriceListsService['normalizeRule']>, currency: string) {
    const problem = ruleProblem(rule, currency, BASE_CURRENCY);
    if (problem) throw new BadRequestException(problem);
    if (rule.product_id) {
      const [p] = await conn.query(`SELECT id, company_id, is_active FROM products WHERE id = $1`, [rule.product_id]);
      if (!p || !isVisible(scope, p.company_id)) throw new BadRequestException('Product not found');
      if (!p.is_active) throw new BadRequestException('That product is archived');
    }
    if (rule.category_id) {
      const [c] = await conn.query(`SELECT id, company_id, is_active FROM product_categories WHERE id = $1`, [rule.category_id]);
      if (!c || !isVisible(scope, c.company_id)) throw new BadRequestException('Category not found');
    }
  }

  private async products(
    conn: Queryable,
    scope: CompanyScope,
    opts: { ids?: string[]; parentId?: string; q?: string; categoryId?: string; limit?: number },
  ): Promise<ProductRow[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (opts.ids) {
      params.push(opts.ids);
      where.push(`p.id = ANY($${params.length}::uuid[])`);
    } else {
      where.push('p.is_active');
      if (opts.parentId) {
        params.push(opts.parentId);
        where.push(`p.parent_id = $${params.length}`);
      } else {
        where.push('NOT p.has_variants');
      }
      if (opts.q?.trim()) {
        params.push(`%${opts.q.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
        where.push(`(lower(p.name) LIKE $${params.length} OR lower(p.sku) LIKE $${params.length} OR lower(p.item_code) LIKE $${params.length})`);
      }
      if (opts.categoryId) {
        params.push(opts.categoryId);
        where.push(`p.category_id = $${params.length}`);
      }
    }
    const f = companyFilter(scope, 'p', params.length + 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    params.push(Math.min(opts.limit ?? 500, 500));
    return conn.query(
      `SELECT p.id, p.name, p.sku, p.item_code, p.parent_id, p.category_id, p.sales_price, p.cost_price, p.company_id, p.has_variants
         FROM products p WHERE ${where.join(' AND ')} ORDER BY lower(p.name), p.id LIMIT $${params.length}`,
      params,
    );
  }

  private async paths(conn: Queryable) {
    return categoryPaths(await conn.query(`SELECT id, parent_id FROM product_categories`));
  }

  private async rulesFor(conn: Queryable, listIds: string[]): Promise<Map<string, PriceRule[]>> {
    const out = new Map<string, PriceRule[]>();
    if (!listIds.length) return out;
    const rows: (PriceRule & { price_list_id: string })[] = await conn.query(
      `SELECT id, price_list_id, applies_to, product_id, category_id, min_quantity, compute, fixed_price, percent,
              to_char(date_start, 'YYYY-MM-DD') AS date_start, to_char(date_end, 'YYYY-MM-DD') AS date_end, sort_order, is_active
         FROM price_list_items WHERE price_list_id = ANY($1::uuid[]) AND is_active`,
      [listIds],
    );
    for (const r of rows) {
      if (!out.has(r.price_list_id)) out.set(r.price_list_id, []);
      out.get(r.price_list_id)!.push(r);
    }
    return out;
  }

  private priced(p: ProductRow, paths: Map<string, string[]>): PricedProduct {
    return {
      id: p.id,
      parent_id: p.parent_id,
      category_path: p.category_id ? (paths.get(p.category_id) ?? [p.category_id]) : [],
      sales_price: p.sales_price,
      cost_price: p.cost_price,
    };
  }

  private async record(ctx: CatalogContext, id: string, eventType: 'created' | 'updated' | 'deleted' | 'restored', summary: string) {
    await this.timeline.record(ctx.tenantId, {
      entityType: 'price_list', entityId: id, eventType, moduleKey: 'products', summary, actorId: ctx.user?.sub, client: ctx.client,
    });
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
