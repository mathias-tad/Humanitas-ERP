import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PriceListsService, categoryPaths } from './price-lists.service';
import type { CatalogContext } from './products.service';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

const L1 = 'cccccccc-0000-0000-0000-000000000001';
const L2 = 'cccccccc-0000-0000-0000-000000000002';
const P1 = 'bbbbbbbb-0000-0000-0000-000000000001';
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
const list = (over: Record<string, unknown> = {}) => ({ id: L1, name: 'Wholesale', currency: 'ETB', is_default: false, is_active: true, company_id: null, rule_count: 1, ...over });
const product = { id: P1, name: 'Teff 1kg', sku: 'TEFF', item_code: 'P0000001', parent_id: null, category_id: 'grains', sales_price: '120.0000', cost_price: '80.0000', company_id: null, has_variants: false };

describe('PriceListsService', () => {
  const build = (conn: ReturnType<typeof fakeConn>) =>
    new PriceListsService(
      { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService,
      { record: jest.fn() } as unknown as ActivityTimelineService,
    );
  const base: Route[] = [
    [/FROM price_lists pl/, (p) => (p[0] === L2 ? [list({ id: L2, name: 'Retail', is_default: true })] : [list()])],
    [/FROM products p WHERE/, () => [product]],
    [/SELECT id, parent_id FROM product_categories/, () => [{ id: 'grains', parent_id: 'food' }, { id: 'food', parent_id: null }]],
    [/FROM price_list_items WHERE price_list_id = ANY/, () => [
      { id: 'r1', price_list_id: L1, applies_to: 'category', product_id: null, category_id: 'food', min_quantity: '0', compute: 'discount', fixed_price: null, percent: '10', date_start: null, date_end: null, sort_order: 0, is_active: true },
      { id: 'r2', price_list_id: L1, applies_to: 'product', product_id: P1, category_id: null, min_quantity: '10', compute: 'fixed', fixed_price: '100', percent: null, date_start: null, date_end: null, sort_order: 0, is_active: true },
    ]],
  ];

  it('prices a line from the list: the parent category rule, then the quantity break', async () => {
    const svc = build(fakeConn(base));
    await expect(svc.price(ctx, { product_id: P1, price_list_id: L1, quantity: 1 })).resolves.toMatchObject({ price: 108, rule_id: 'r1', currency: 'ETB' });
    await expect(svc.price(ctx, { product_id: P1, price_list_id: L1, quantity: 12 })).resolves.toMatchObject({ price: 100, rule_id: 'r2' });
  });

  it('refuses pricing a product with variants, and unknown products', async () => {
    await expect(build(fakeConn([...base.filter((r) => !/FROM products p/.test(r[0].source)), [/FROM products p WHERE/, () => [{ ...product, has_variants: true }]]]))
      .price(ctx, { product_id: P1, price_list_id: L1 })).rejects.toThrow(/variants/);
    await expect(build(fakeConn([...base.filter((r) => !/FROM products p/.test(r[0].source)), [/FROM products p WHERE/, () => []]]))
      .price(ctx, { product_id: P1, price_list_id: L1 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates rules before saving them', async () => {
    const svc = build(fakeConn(base));
    await expect(svc.addRule(ctx, L1, { applies_to: 'all', compute: 'discount', percent: 150 })).rejects.toThrow(/between 0 and 100/);
    await expect(svc.addRule(ctx, L1, { applies_to: 'product', compute: 'fixed', fixed_price: 5 })).rejects.toThrow(/product/);
    const usd = build(fakeConn([[/FROM price_lists pl/, () => [list({ currency: 'USD' })]]]));
    await expect(usd.addRule(ctx, L1, { applies_to: 'all', compute: 'markup', percent: 20 })).rejects.toThrow(/fixed prices/);
  });

  it('keeps one default list and never archives it', async () => {
    const conn = fakeConn([[/INSERT INTO price_lists/, () => [{ id: L1 }]], ...base]);
    await build(conn).create(ctx, { name: 'VIP', is_default: true });
    const clear = conn.calls.findIndex((c) => /SET is_default = false/.test(c.sql));
    const insert = conn.calls.findIndex((c) => /INSERT INTO price_lists/.test(c.sql));
    expect(clear).toBeGreaterThanOrEqual(0);
    expect(clear).toBeLessThan(insert);
    await expect(build(fakeConn(base)).update(ctx, L2, { is_active: false })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('compares products across lists', async () => {
    const r = await build(fakeConn(base)).compare(ctx, { quantity: 1 });
    expect(r.lists.map((l) => l.id)).toEqual([L1]);
    expect(r.rows[0]).toMatchObject({ product_id: P1, base_price: 120, prices: { [L1]: 108 } });
    const csv = await build(fakeConn(base)).compareCsv(ctx, {});
    expect(csv.split('\r\n')[0]).toBe('item_code,sku,name,sales_price,Wholesale (ETB)');
    expect(csv).toContain('P0000001,TEFF,Teff 1kg,120.00,108.00');
  });

  it('builds category paths to the root', () => {
    const m = categoryPaths([{ id: 'teff', parent_id: 'grains' }, { id: 'grains', parent_id: 'food' }, { id: 'food', parent_id: null }, { id: 'loop', parent_id: 'loop' }]);
    expect(m.get('teff')).toEqual(['teff', 'grains', 'food']);
    expect(m.get('loop')).toEqual(['loop']);
  });
});
