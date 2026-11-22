import { PriceListsService } from './price-lists.service';
import type { CatalogContext } from './products.service';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

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
const build = (conn: ReturnType<typeof fakeConn>) =>
  new PriceListsService(
    { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService,
    { record: jest.fn() } as unknown as ActivityTimelineService,
  );
const lists: Route = [/FROM price_lists pl/, () => [{ id: L1, name: 'Wholesale', currency: 'ETB', is_default: false, is_active: true, company_id: null, rule_count: 0 }]];

describe('PriceListsService: one discount for several products', () => {
  it('adds one rule per product in one transaction', async () => {
    const conn = fakeConn([lists, [/FROM products WHERE id = ANY/, () => [
      { id: P1, company_id: null, is_active: true }, { id: P2, company_id: null, is_active: true },
    ]]]);
    const r = await build(conn).addRules(ctx, L1, { product_ids: [P1, P2, P1], compute: 'discount', percent: 10, min_quantity: 0 });
    expect(r).toEqual({ added: 2 });
    const inserts = conn.calls.filter((c) => /INSERT INTO price_list_items/.test(c.sql));
    expect(inserts.map((c) => c.params[2])).toEqual([P1, P2]);
    expect(inserts.every((c) => c.params[1] === 'product' && c.params[5] === 'discount' && c.params[7] === 10)).toBe(true);
    expect(conn.transaction).toHaveBeenCalledTimes(1);
  });

  it('adds nothing when a product is archived or missing, or the rule is wrong', async () => {
    const conn = fakeConn([lists, [/FROM products WHERE id = ANY/, () => [{ id: P1, company_id: null, is_active: false }]]]);
    await expect(build(conn).addRules(ctx, L1, { product_ids: [P1, P2], compute: 'discount', percent: 10 })).rejects.toThrow(/2 of the chosen products/);
    await expect(build(conn).addRules(ctx, L1, { product_ids: [P1], compute: 'discount', percent: 150 })).rejects.toThrow(/between 0 and 100/);
    expect(conn.calls.some((c) => /INSERT INTO price_list_items/.test(c.sql))).toBe(false);
  });
});
