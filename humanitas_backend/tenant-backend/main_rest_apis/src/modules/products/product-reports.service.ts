import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CatalogContext } from './products.service';
import { csvCell } from './products.service';
import { companyFilter, resolveCompanyScope } from './products.scope';
import type { ReportQueryDto } from './dto/product-extras.dto';
import { CATALOG_ISSUES, ISSUE_LABELS, ISSUE_SQL, MARGIN_BANDS, type CatalogIssue } from './product-structure';

/**
 * Product Reports (featureslist §1): what the catalog holds, its margins and its gaps.
 * Counts are over the products the user can see (rule 16). Stock and sales figures come with
 * Inventory and Sales.
 */
@Injectable()
export class ProductReportsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async summary(ctx: CatalogContext, q: ReportQueryDto = {}) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader, ctx.branchHeader);
    const params: unknown[] = [];
    const where: string[] = [];
    const f = companyFilter(scope, 'p', 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    if (q.category_id) {
      params.push(q.category_id);
      where.push(`p.category_id = $${params.length}`);
    }
    const base = where.length ? `AND ${where.join(' AND ')}` : '';
    const sellable = `p.is_active AND NOT p.has_variants ${base}`;

    const [totals] = await conn.query(
      `SELECT count(*) FILTER (WHERE p.is_active AND p.parent_id IS NULL)::int AS products,
              count(*) FILTER (WHERE p.is_active AND p.parent_id IS NOT NULL)::int AS variants,
              count(*) FILTER (WHERE p.is_active AND NOT p.has_variants)::int AS sellable,
              count(*) FILTER (WHERE NOT p.is_active)::int AS archived,
              count(*) FILTER (WHERE p.is_active AND p.created_at >= now() - interval '30 days')::int AS added_30d,
              count(*) FILTER (WHERE p.is_active AND p.updated_at >= now() - interval '30 days')::int AS changed_30d,
              count(*) FILTER (WHERE p.is_active AND p.composition = 'kit')::int AS kits,
              count(*) FILTER (WHERE p.is_active AND p.composition = 'combo')::int AS combos
         FROM products p WHERE true ${base}`,
      params,
    );
    const byType = await conn.query(
      `SELECT p.product_type AS key, count(*)::int AS count FROM products p WHERE ${sellable} GROUP BY 1 ORDER BY 2 DESC`, params,
    );
    const byCategory = await conn.query(
      `SELECT p.category_id AS id, COALESCE(c.name, 'No category') AS name, count(*)::int AS count,
              round(avg(p.sales_price) FILTER (WHERE p.sales_price > 0), 2) AS avg_price
         FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE ${sellable} GROUP BY 1, 2 ORDER BY 3 DESC, 2 LIMIT 15`,
      params,
    );
    const issueCols = CATALOG_ISSUES.map((k) => `count(*) FILTER (WHERE ${ISSUE_SQL[k]})::int AS ${k}`).join(', ');
    const [issues] = await conn.query(
      `SELECT ${issueCols} FROM products p JOIN uoms u ON u.id = p.uom_id WHERE ${sellable}`, params,
    );
    const marginCase = MARGIN_BANDS.map((b, i) =>
      b.max === Infinity ? `ELSE '${b.key}'` : `WHEN m < ${b.max} THEN '${b.key}'${i === 0 ? '' : ''}`).join(' ');
    const margins = await conn.query(
      `WITH x AS (SELECT (p.sales_price - p.cost_price) / p.sales_price * 100 AS m FROM products p
                   WHERE ${sellable} AND p.sales_price > 0 AND p.cost_price > 0)
       SELECT CASE ${marginCase} END AS key, count(*)::int AS count FROM x GROUP BY 1`,
      params,
    );
    const [marginStats] = await conn.query(
      `SELECT round(avg((p.sales_price - p.cost_price) / p.sales_price * 100), 1) AS avg_margin,
              round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ((p.sales_price - p.cost_price) / p.sales_price * 100))::numeric, 1) AS median_margin,
              count(*)::int AS priced_and_costed
         FROM products p WHERE ${sellable} AND p.sales_price > 0 AND p.cost_price > 0`,
      params,
    );
    const lowest = await conn.query(
      `SELECT p.id, p.name, p.sku, p.sales_price, p.cost_price,
              round((p.sales_price - p.cost_price) / p.sales_price * 100, 1) AS margin
         FROM products p WHERE ${sellable} AND p.sales_price > 0 AND p.cost_price > 0
        ORDER BY (p.sales_price - p.cost_price) / p.sales_price, lower(p.name) LIMIT 10`,
      params,
    );
    const [pricing] = await conn.query(
      `SELECT (SELECT count(*)::int FROM price_lists WHERE is_active) AS price_lists,
              (SELECT count(*)::int FROM price_list_items i JOIN price_lists l ON l.id = i.price_list_id WHERE i.is_active AND l.is_active) AS price_rules,
              (SELECT count(*)::int FROM price_list_customers c JOIN price_lists l ON l.id = c.price_list_id WHERE l.is_active) AS customers_on_lists,
              (SELECT count(*)::int FROM product_media m JOIN products p ON p.id = m.product_id WHERE m.is_active AND m.kind = 'image' ${base}) AS pictures,
              (SELECT count(*)::int FROM product_media m JOIN products p ON p.id = m.product_id WHERE m.is_active AND m.kind = 'attachment' ${base}) AS attachments,
              (SELECT count(*)::int FROM product_packagings k JOIN products p ON p.id = k.product_id WHERE k.is_active ${base}) AS packagings`,
      params,
    );
    const sellableCount = Number(totals?.sellable ?? 0);
    return {
      totals,
      by_type: byType,
      by_category: byCategory,
      issues: CATALOG_ISSUES.map((k) => ({ key: k, label: ISSUE_LABELS[k], count: Number(issues?.[k] ?? 0) })),
      // Share of sellable products with none of the issues above that apply to them.
      completeness: sellableCount ? await this.completeness(conn, sellable, params, sellableCount) : 100,
      margins: {
        ...marginStats,
        bands: MARGIN_BANDS.map((b) => ({ key: b.key, label: b.label, count: Number(margins.find((m: { key: string }) => m.key === b.key)?.count ?? 0) })),
        lowest,
      },
      pricing,
    };
  }

  /** The products with one catalog gap, as CSV (the Products list shows the same with ?issue=). */
  async exportCsv(ctx: CatalogContext, q: ReportQueryDto): Promise<string> {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader, ctx.branchHeader);
    const params: unknown[] = [];
    const where = ['p.is_active', 'NOT p.has_variants'];
    const issues: CatalogIssue[] = q.issue ? [q.issue] : CATALOG_ISSUES;
    where.push(`(${issues.map((k) => ISSUE_SQL[k]).join(' OR ')})`);
    const f = companyFilter(scope, 'p', 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    if (q.category_id) {
      params.push(q.category_id);
      where.push(`p.category_id = $${params.length}`);
    }
    const flags = CATALOG_ISSUES.map((k) => `(${ISSUE_SQL[k]}) AS ${k}`).join(', ');
    const rows = await conn.query(
      `SELECT p.item_code, p.sku, p.name, c.name AS category_name, p.product_type, p.sales_price, p.cost_price, ${flags}
         FROM products p JOIN uoms u ON u.id = p.uom_id LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE ${where.join(' AND ')} ORDER BY lower(p.name), p.id LIMIT 50000`,
      params,
    );
    const cols = ['item_code', 'sku', 'name', 'category_name', 'product_type', 'sales_price', 'cost_price'];
    const lines = [[...cols, 'issues'].join(',')];
    for (const r of rows) {
      const found = CATALOG_ISSUES.filter((k) => r[k]).map((k) => ISSUE_LABELS[k]).join('; ');
      lines.push([...cols.map((c) => csvCell(r[c])), csvCell(found)].join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  private async completeness(conn: { query: (s: string, p?: unknown[]) => Promise<any> }, sellable: string, params: unknown[], total: number) {
    const [row] = await conn.query(
      `SELECT count(*)::int AS ok FROM products p JOIN uoms u ON u.id = p.uom_id
        WHERE ${sellable} AND NOT (${CATALOG_ISSUES.map((k) => ISSUE_SQL[k]).join(' OR ')})`,
      params,
    );
    return Math.round((Number(row?.ok ?? 0) / total) * 1000) / 10;
  }
}
