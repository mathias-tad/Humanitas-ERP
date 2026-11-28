import 'reflect-metadata';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../../common/records/record-context';
import type { ValuationClient } from './valuation-client';
import { StocktakesService, countProblem, countTotals, lineVariance } from './stocktakes.service';
import { hideCountMoney } from './stocktakes.controller';

type Route = [RegExp, (params: unknown[]) => unknown];

function fakeConn(routes: Route[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of routes) if (re.test(sql)) return fn(params);
    return [];
  });
  const conn = { query, calls, transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(conn)) };
  return conn;
}

const scopeQueries: Route[] = [
  [/FROM users WHERE id = \$1/, () => [{ company_id: 'c1' }]],
  [/FROM user_company_access WHERE user_id = \$1/, () => [{ company_id: 'c1', is_default: true }]],
  [/FROM companies WHERE COALESCE\(is_active, true\) LIMIT 2/, () => [{ id: 'c1' }]],
];

const ctx: CatalogContext = {
  tenantId: 't1',
  user: { sub: 'u1', email: '', tenantId: 't1', tenantSlug: 't', role: 'admin', permissions: ['*'] },
  companyHeader: 'c1', branchHeader: undefined,
  client: { platform: 'web', device: 'desktop', info: {} },
};

function service(conn: ReturnType<typeof fakeConn>) {
  const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
  const timeline = { record: jest.fn(), recordChanges: jest.fn() } as unknown as ActivityTimelineService;
  const valuation = { notify: jest.fn().mockResolvedValue(true) } as unknown as ValuationClient;
  return { counts: new StocktakesService(db, timeline, valuation), valuation, timeline };
}

const COUNT = { id: 'k1', name: 'WH/CNT/00001', state: 'counting', warehouse_id: 'w1', location_id: null, is_blind: false, company_id: 'c1', branch_id: null };
const countRoutes = (count: Record<string, unknown>): Route[] => [
  [/LEFT JOIN product_categories pc/, () => [{ warehouse_name: 'Main', location_code: null, responsible_name: 'Sara', category_name: null }]],
  [/SELECT \* FROM inventory_counts WHERE id = \$1/, () => [count]],
];

describe('stocktake figures', () => {
  it('measures the difference and its value only for counted lines', () => {
    expect(lineVariance({ counted_qty: null, expected_qty: 5, unit_cost: 10 })).toEqual({ variance: 0, value: 0 });
    expect(lineVariance({ counted_qty: '3', expected_qty: '5', unit_cost: '12.5' })).toEqual({ variance: -2, value: -25 });
    const t = countTotals([
      { counted_qty: 5, expected_qty: 5, unit_cost: 10 },
      { counted_qty: 7, expected_qty: 5, unit_cost: 10 },
      { counted_qty: 1, expected_qty: 4, unit_cost: 2 },
      { counted_qty: null, expected_qty: 9, unit_cost: 1 },
    ]);
    expect(t).toMatchObject({ lines: 4, counted: 3, uncounted: 1, with_variance: 2, accuracy: 33.3, net_quantity: -1 });
    expect(t).toMatchObject({ variance_value_gain: 20, variance_value_loss: 6, variance_value: 14 });
    expect(countTotals([]).accuracy).toBeNull();
  });

  it('asks for the lot or serial of a tracked product and counts a serial as 0 or 1', () => {
    expect(countProblem('none', null, 12)).toBeNull();
    expect(countProblem('lot', null, 1)).toMatch(/tracked by lot/);
    expect(countProblem('serial', 'l1', 2)).toMatch(/0 or 1/);
    expect(countProblem('serial', 'l1', 1)).toBeNull();
  });

  it('hides cost and value from people without the valuation permission', () => {
    const req = { user: { sub: 'u', role: 'staff', permissions: ['view_stocktakes'] } } as never;
    const out = hideCountMoney(req, { totals: { variance_value: 5, counted: 2 }, data: [{ unit_cost: 3, variance_value: 1, counted_qty: 2 }] });
    expect(out).toEqual({ totals: { counted: 2 }, data: [{ counted_qty: 2 }] });
  });
});

describe('Stocktakes', () => {
  it('freezes the expected stock of the warehouse storage locations when counting starts', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      ...countRoutes({ ...COUNT, state: 'draft', product_ids: [], category_id: 'cat1' }),
      [/FROM inventory_locations WHERE warehouse_id = \$1 AND usage = 'internal'/, () => [{ id: 'loc1' }, { id: 'loc2' }]],
      [/SELECT counted_qty, expected_qty, unit_cost FROM inventory_count_lines/, () => []],
    ]);
    await service(conn).counts.start(ctx, 'k1');
    const snap = conn.calls.find((c) => /INSERT INTO inventory_count_lines/.test(c.sql));
    expect(snap?.sql).toMatch(/q.quantity <> 0/);
    expect(snap?.sql).toMatch(/p.category_id = \$5/);
    expect(snap?.params[1]).toEqual(['loc1', 'loc2']);
    expect(conn.calls.some((c) => /SET state = 'counting'/.test(c.sql))).toBe(true);
  });

  it('posts counted minus on hand now, skips lines that match and hands the moves to valuation', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      ...countRoutes(COUNT),
      [/WHERE x.count_id = \$1 AND x.counted_qty IS NOT NULL ORDER BY x.id/, () => [
        { id: 'x1', product_id: 'p1', location_id: 'loc1', lot_id: null, counted_qty: '8', expected_qty: '10', unit_cost: '4', cost_price: '4' },
        { id: 'x2', product_id: 'p2', location_id: 'loc1', lot_id: null, counted_qty: '3', expected_qty: '3', unit_cost: '9', cost_price: '9' },
      ]],
      // p1 had 2 more taken out while counting: on hand is now 9, so the adjustment is -1, not -2.
      [/SELECT quantity, unit_cost FROM inventory_quants[\s\S]*FOR UPDATE/, (p) => (p[0] === 'p1' ? [{ quantity: '9', unit_cost: '4' }] : [{ quantity: '3', unit_cost: '9' }])],
      [/INSERT INTO inventory_moves/, () => [{ id: 'm1' }]],
      [/SELECT id, quantity FROM inventory_quants/, () => [{ id: 'q1', quantity: '9' }]],
      [/SELECT counted_qty, expected_qty, unit_cost FROM inventory_count_lines/, () => []],
    ]);
    const { counts, valuation } = service(conn);
    await counts.post(ctx, 'k1');
    const moves = conn.calls.filter((c) => /INSERT INTO inventory_moves/.test(c.sql));
    expect(moves).toHaveLength(1);
    expect(moves[0].params[3]).toBe('loc1'); // from the location: a loss
    expect(moves[0].params[5]).toBe(1);
    expect(conn.calls.some((c) => /UPDATE inventory_quants SET quantity = \$1/.test(c.sql) && c.params[0] === 8)).toBe(true);
    expect(conn.transaction).toHaveBeenCalled();
    expect(conn.calls.some((c) => /SET state = 'posted'/.test(c.sql))).toBe(true);
    expect((valuation.notify as jest.Mock).mock.calls[0][1]).toEqual([expect.objectContaining({ move_id: 'm1', quantity: 1, from_location_id: 'loc1' })]);
  });

  it('refuses to post a count that has not started or is already posted', async () => {
    for (const state of ['draft', 'posted', 'cancelled']) {
      const conn = fakeConn([...scopeQueries, ...countRoutes({ ...COUNT, state })]);
      await expect(service(conn).counts.post(ctx, 'k1')).rejects.toThrow(/counted or in review/);
    }
  });

  it('hides what a blind count expects while counting, unless the person approves counts', async () => {
    const blind = { ...COUNT, is_blind: true };
    const routes: Route[] = [
      ...scopeQueries,
      ...countRoutes(blind),
      [/SELECT count\(\*\)::int AS total FROM inventory_count_lines x/, () => [{ total: 1 }]],
      [/SELECT x.\*, p.name AS product_name/, () => [{ id: 'x1', product_id: 'p1', expected_qty: '10', counted_qty: '8', variance: '0', unit_cost: '4' }]],
    ];
    const hidden = await service(fakeConn(routes)).counts.lines(ctx, 'k1', {});
    expect(hidden.expected_hidden).toBe(true);
    expect(hidden.data[0]).not.toHaveProperty('expected_qty');
    const shown = await service(fakeConn(routes)).counts.lines(ctx, 'k1', {}, { revealExpected: true });
    expect(shown.data[0]).toMatchObject({ expected_qty: '10', variance: -2, variance_value: -8 });
  });

  it('moves the counter to a scanned location, then counts a scanned product barcode one by one', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      ...countRoutes(COUNT),
      [/FROM inventory_locations WHERE warehouse_id = \$1 AND usage = 'internal'/, () => [{ id: 'loc1' }]],
      [/SELECT id, code, name FROM inventory_locations/, (p) => (p[1] === 'A-01' ? [{ id: 'loc1', code: 'A-01', name: 'Aisle 1' }] : [])],
      [/FROM inventory_lots WHERE lower\(name\)/, () => []],
      [/FROM product_barcodes b/, () => [{ id: 'p1' }]],
      [/SELECT id, name, sku, product_type/, () => [{ id: 'p1', name: 'Chair', product_type: 'storable', has_variants: false, is_active: true, cost_price: '100', company_id: null }]],
      [/SELECT \* FROM inventory_product_config/, () => [{ tracking: 'none' }]],
      [/SELECT \* FROM inventory_count_lines[\s\S]*FOR UPDATE/, () => [{ id: 'x1', counted_qty: '2' }]],
      [/SELECT x.\*, p.name AS product_name, p.sku, lot.name AS lot_name, loc.code AS location_code/, () => [{ id: 'x1', counted_qty: '3', expected_qty: '3' }]],
    ]);
    const { counts } = service(conn);
    const where = await counts.scan(ctx, 'k1', { code: 'A-01' });
    expect(where).toEqual({ kind: 'location', location: { id: 'loc1', code: 'A-01', name: 'Aisle 1' } });
    const line = await counts.scan(ctx, 'k1', { code: '6291041500213', location_id: 'loc1' });
    expect(line.kind).toBe('line');
    const update = conn.calls.find((c) => /UPDATE inventory_count_lines SET counted_qty = \$1/.test(c.sql));
    expect(update?.params[0]).toBe(3);
    await expect(counts.scan(ctx, 'k1', { code: '6291041500213' })).rejects.toThrow(/Scan the location first/);
  });
});
