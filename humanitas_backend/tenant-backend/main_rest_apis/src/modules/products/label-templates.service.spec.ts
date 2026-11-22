import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LabelTemplatesService, TEMPLATE_DEFAULTS } from './label-templates.service';
import { PriceListsService } from './price-lists.service';
import type { CatalogContext } from './products.service';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

const T1 = 'dddddddd-0000-0000-0000-000000000001';
const L1 = 'cccccccc-0000-0000-0000-000000000001';
const P1 = 'bbbbbbbb-0000-0000-0000-000000000001';
const P2 = 'bbbbbbbb-0000-0000-0000-000000000002';
type Route = [RegExp, (params: unknown[]) => unknown];

function fakeConn(routes: Route[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of routes) if (re.test(sql)) return fn(params);
    return [];
  });
  const conn = { query, transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(conn)), calls };
  return conn;
}

const ctx: CatalogContext = {
  tenantId: 't1', user: { sub: 'u1', email: '', tenantId: 't1', tenantSlug: 't', role: 'admin', permissions: [] },
  client: { platform: 'web', device: 'desktop', info: {} },
};
const template = (over: Record<string, unknown> = {}) => ({ id: T1, name: 'Shelf label', ...TEMPLATE_DEFAULTS, company_id: null, is_active: true, ...over });

function build(conn: ReturnType<typeof fakeConn>) {
  const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
  const timeline = { record: jest.fn() } as unknown as ActivityTimelineService;
  return new LabelTemplatesService(db, timeline, new PriceListsService(db, timeline));
}

describe('LabelTemplatesService', () => {
  it('creates a template with the defaults and the given size', async () => {
    const conn = fakeConn([[/INSERT INTO label_templates/, () => [{ id: T1 }]], [/FROM label_templates WHERE id/, () => [template()]]]);
    await build(conn).create(ctx, { name: ' Jar label ', label_width_mm: 60, label_height_mm: 40 });
    const insert = conn.calls.find((c) => /INSERT INTO label_templates/.test(c.sql))!;
    expect(insert.sql).toMatch(/label_width_mm/);
    expect(insert.params).toEqual(expect.arrayContaining(['Jar label', 60, 40, 'auto', 'roll']));
  });

  it('refuses a sheet whose labels do not fit on the page', async () => {
    const conn = fakeConn([[/INSERT INTO label_templates/, () => [{ id: T1 }]]]);
    await expect(build(conn).create(ctx, { name: 'Too wide', layout: 'sheet', label_width_mm: 70, columns: 4 }))
      .rejects.toThrow(/need 280 mm; the page is 210 mm wide/);
    expect(conn.calls.some((c) => /INSERT/.test(c.sql))).toBe(false);
  });

  it('checks the whole template when one field changes', async () => {
    const conn = fakeConn([[/FROM label_templates WHERE id/, () => [template({ layout: 'sheet', label_width_mm: '70.00', columns: 3 })]]]);
    await expect(build(conn).update(ctx, T1, { columns: 4 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an archived price list', async () => {
    const conn = fakeConn([[/FROM price_lists WHERE id/, () => [{ id: L1, company_id: null, is_active: false }]]]);
    await expect(build(conn).create(ctx, { name: 'VIP tag', price_list_id: L1 })).rejects.toThrow(/archived/);
  });

  it('archives instead of deleting', async () => {
    const conn = fakeConn([[/FROM label_templates WHERE id/, () => [template()]]]);
    await build(conn).archive(ctx, T1);
    const update = conn.calls.find((c) => /UPDATE label_templates SET/.test(c.sql))!;
    expect(update.sql).toMatch(/is_active = \$1/);
    expect(update.params[0]).toBe(false);
  });

  it('reports a missing template', async () => {
    await expect(build(fakeConn([])).get(ctx, T1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prices the labels from one list, leaving out products with variants', async () => {
    const product = { id: P1, name: 'Teff 1kg', sku: null, item_code: 'P1', parent_id: null, category_id: null, sales_price: '120.0000', cost_price: '80', company_id: null, has_variants: false };
    const conn = fakeConn([
      [/FROM price_lists pl/, () => [{ id: L1, name: 'Wholesale', currency: 'ETB', is_default: false, is_active: true, company_id: null, rule_count: 1 }]],
      [/FROM products p WHERE/, () => [product, { ...product, id: P2, has_variants: true }]],
      [/FROM price_list_items WHERE price_list_id = ANY/, () => [
        { id: 'r1', price_list_id: L1, applies_to: 'all', product_id: null, category_id: null, min_quantity: '0', compute: 'discount', fixed_price: null, percent: '10', date_start: null, date_end: null, sort_order: 0, is_active: true },
      ]],
    ]);
    const r = await build(conn).prices(ctx, { product_ids: [P1, P2, P1], price_list_id: L1 });
    expect(r).toMatchObject({ price_list_id: L1, currency: 'ETB', prices: { [P1]: 108 } });
    expect(r.prices[P2]).toBeUndefined();
  });
});
