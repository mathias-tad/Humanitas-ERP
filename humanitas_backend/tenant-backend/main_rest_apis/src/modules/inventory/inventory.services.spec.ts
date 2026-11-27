import 'reflect-metadata';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../../common/records/record-context';
import { WarehousesService } from './warehouses.service';
import { StockService } from './stock.service';
import { TransfersService } from './transfers.service';
import { ValuationClient } from './valuation-client';

/**
 * Inventory service behaviour: stock moves through the append-only ledger inside a transaction,
 * a transfer is all-or-nothing, adjustments respect negative-stock, and every read is filtered
 * through the company/branch scope (rules 8, 16, 24.4). The fake connection routes queries the
 * same way the CRM and Products specs do.
 */
type Route = [RegExp, (params: unknown[]) => unknown];

function fakeConn(routes: Route[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of routes) if (re.test(sql)) return fn(params);
    return [];
  });
  // A TypeORM DataSource.transaction runs the callback with an entity manager whose queries are
  // the same connection; the fake hands back `conn` itself so BEGIN/COMMIT is implicit.
  const conn = {
    query,
    calls,
    transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(conn)),
  };
  return conn;
}

const scopeQueries: Route[] = [
  [/FROM users WHERE id = \$1/, () => [{ company_id: 'c1' }]],
  [/FROM user_company_access WHERE user_id = \$1/, () => [{ company_id: 'c1', is_default: true }]],
  [/FROM companies WHERE COALESCE\(is_active, true\) LIMIT 2/, () => [{ id: 'c1' }]],
];

/** Org-wide admin: can see every company and branch. */
const adminCtx: CatalogContext = {
  tenantId: 't1',
  user: { sub: 'u1', email: '', tenantId: 't1', tenantSlug: 't', role: 'admin', permissions: ['*'] },
  companyHeader: 'c1', branchHeader: undefined,
  client: { platform: 'web', device: 'desktop', info: {} },
};

/** A branch-limited manager: only company c1 and branch b1 (real UUIDs — the switcher sends UUIDs). */
const BRANCH_B1 = 'bbbbbbbb-0000-0000-0000-00000000b001';
const BRANCH_B2 = 'bbbbbbbb-0000-0000-0000-00000000b002';
const branchCtx: CatalogContext = {
  tenantId: 't1',
  user: { sub: 'u2', email: '', tenantId: 't1', tenantSlug: 't', role: 'manager', permissions: [] },
  companyHeader: 'c1', branchHeader: BRANCH_B1,
  client: { platform: 'web', device: 'desktop', info: {} },
};

function services(conn: ReturnType<typeof fakeConn>, extra: { allowNegative?: boolean; valuation?: ValuationClient } = {}) {
  const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
  const timeline = { record: jest.fn(), recordChanges: jest.fn() } as unknown as ActivityTimelineService;
  const valuation = extra.valuation ?? { notify: jest.fn().mockResolvedValue(true) } as unknown as ValuationClient;
  const warehouses = new WarehousesService(db, timeline);
  const stock = new StockService(db, timeline);
  const transfers = new TransfersService(db, timeline, valuation);
  return { warehouses, stock, transfers, timeline, valuation };
}

describe('Warehouses', () => {
  it('creates a warehouse and its virtual locations, keeping code collisions out as conflicts', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      [/INSERT INTO inventory_warehouses/, () => [{ id: 'wh1' }]],
      [/INSERT INTO inventory_locations/, () => [{ id: 'loc1' }]],
      [/SELECT \* FROM inventory_warehouses WHERE id = \$1/, () => [{ id: 'wh1', name: 'Main', code: 'WH', is_active: true, company_id: null, branch_id: null }]],
    ]);
    const r = await services(conn).warehouses.create(adminCtx, { code: 'WH', name: 'Main' } as never);
    expect(r.id).toBe('wh1');
    // 5 virtual locations were created with the warehouse.
    expect(conn.calls.filter((c) => /INSERT INTO inventory_locations/.test(c.sql)).length).toBe(5);
  });

  it('refuses to archive a warehouse that still holds stock', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      [/SELECT \* FROM inventory_warehouses WHERE id = \$1/, () => [{ id: 'wh1', name: 'Main', is_active: true, company_id: null, branch_id: null }]],
      [/SELECT count\(\*\)::int AS n FROM inventory_quants/, () => [{ n: 3 }]],
    ]);
    await expect(services(conn).warehouses.archive(adminCtx, 'wh1')).rejects.toThrow(/still holds stock/);
  });

  it('archives an empty warehouse', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      [/SELECT \* FROM inventory_warehouses WHERE id = \$1/, () => [{ id: 'wh1', name: 'Main', is_active: true, company_id: null, branch_id: null }]],
      [/SELECT count\(\*\)::int AS n FROM inventory_quants/, () => [{ n: 0 }]],
    ]);
    const r = await services(conn).warehouses.archive(adminCtx, 'wh1');
    expect(r).toMatchObject({ id: 'wh1', archived: true });
  });
});

describe('Locations', () => {
  it('refuses a parent that would loop back into the location', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      [/SELECT \* FROM inventory_locations WHERE id = \$1/, () => [{ id: 'L1', usage: 'internal', is_active: true, company_id: null, branch_id: null }]],
      [/WITH RECURSIVE up AS/, () => [{ parent_id: 'L1' }]],
    ]);
    await expect(services(conn).warehouses.updateLocation(adminCtx, 'L1', { parent_id: 'L5' } as never)).rejects.toThrow(/inside itself/);
  });
});

describe('Stock adjustments', () => {
  const base: Route[] = [
    ...scopeQueries,
    [/SELECT \* FROM inventory_locations WHERE id = \$1/, () => [{ id: 'loc1', usage: 'internal', company_id: null, branch_id: null }]],
    [/FROM products WHERE id = \$1/, () => [{ id: 'p1', name: 'Widget', sku: 'W1', cost_price: '10.00', has_variants: false, company_id: null, branch_id: null }]],
    [/FROM inventory_product_config WHERE product_id = \$1/, () => [{ product_id: 'p1', tracking: 'none', allow_negative: false }]],
    [/FROM inventory_settings WHERE company_id/, () => []],
    [/INSERT INTO inventory_sequences/, () => [{ prefix: 'WH/SCR/', n: 1 }]],
    [/INSERT INTO inventory_moves/, () => [{ id: 'mv1' }]],
    [/UPDATE inventory_moves SET state = 'done'/, () => []],
  ];

  it('adds inbound stock and carries the given cost (else the product cost_price)', async () => {
    const conn = fakeConn([
      ...base,
      [/SELECT id, quantity FROM inventory_quants/, () => []],
      [/INSERT INTO inventory_quants/, () => []],
      [/FROM inventory_stock_on_hand/, () => []],
    ]);
    await services(conn).stock.adjust(adminCtx, { product_id: 'p1', location_id: 'loc1', quantity: 5, reason: 'initial' } as never);
    // Inbound without an explicit cost uses the product's cost_price as the cost basis.
    const move = conn.calls.find((c) => /INSERT INTO inventory_moves/.test(c.sql))!;
    expect(move.params[6]).toBe(10);
  });

  it('refuses an outbound adjustment that would go below zero when negative stock is off', async () => {
    const conn = fakeConn([
      ...base,
      [/SELECT id, quantity FROM inventory_quants/, () => [{ id: 'q1', quantity: 2 }]],
      [/FROM inventory_stock_on_hand/, () => []],
    ]);
    await expect(services(conn).stock.adjust(adminCtx, { product_id: 'p1', location_id: 'loc1', quantity: -5, reason: 'damage' } as never))
      .rejects.toThrow(/not enough stock/);
  });

  it('allows an outbound adjustment below zero when the product permits it', async () => {
    // The allow_negative config route must precede `base` (fakeConn matches in order).
    const conn = fakeConn([
      [/FROM inventory_product_config WHERE product_id = \$1/, () => [{ product_id: 'p1', tracking: 'none', allow_negative: true }]],
      ...base,
      [/SELECT id, quantity FROM inventory_quants/, () => [{ id: 'q1', quantity: 2 }]],
      [/UPDATE inventory_quants SET quantity/, () => []],
      [/FROM inventory_stock_on_hand/, () => []],
    ]);
    const out = await services(conn).stock.adjust(adminCtx, { product_id: 'p1', location_id: 'loc1', quantity: -3, reason: 'breakage' } as never);
    // An outbound move never changes a quant's cost: it only moves the quantity.
    const quant = conn.calls.find((c) => /UPDATE inventory_quants SET quantity/.test(c.sql))!;
    expect(quant.params).toEqual([-1, 'q1']);
    expect(out.totals.quantity).toBeLessThanOrEqual(0);
  });
});

describe('Transfers', () => {
  it('creates a numbered transfer with its move lines in one transaction', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      [/FROM inventory_warehouses WHERE id = \$1/, () => [{ id: 'wh1', company_id: null, branch_id: null }]],
      [/FROM products WHERE id = \$1/, () => [{ id: 'p1', has_variants: false, company_id: null, branch_id: null }]],
      [/SELECT \* FROM inventory_locations WHERE id = \$1/, () => [{ id: 'loc1', name: 'Stock', usage: 'internal', is_active: true, company_id: null, branch_id: null }]],
      [/INSERT INTO inventory_sequences/, () => [{ prefix: 'WH/IN/', n: 1 }]],
      [/INSERT INTO inventory_transfers/, () => [{ id: 'tf1' }]],
      [/INSERT INTO inventory_moves/, () => [{ id: 'mv1' }]],
      [/SELECT \* FROM inventory_transfers WHERE id = \$1/, () => [{ id: 'tf1', name: 'WH/IN/00001', state: 'draft', transfer_type: 'receipt', company_id: null, branch_id: null }]],
      [/FROM inventory_moves m\s+JOIN products/, () => []],
    ]);
    const r = await services(conn).transfers.create(adminCtx, {
      transfer_type: 'receipt', to_warehouse_id: 'wh1',
      moves: [{ product_id: 'p1', to_location_id: 'loc1', quantity: 10, unit_cost: 5 }],
    } as never);
    expect(r.name).toBe('WH/IN/00001');
  });

  it('validates a transfer all-or-nothing: a failing move rolls the whole transfer back', async () => {
    // The second move (product p2, no stock in its location) fails the negative-stock check inside
    // the transaction; because the ledger is atomic nothing is posted and the valuation engine is
    // never told about it.
    const valuation = { notify: jest.fn() } as unknown as ValuationClient;
    const conn = fakeConn([
      ...scopeQueries,
      [/FROM inventory_transfers WHERE id = \$1/, () => [{ id: 'tf1', state: 'in_progress', transfer_type: 'delivery', from_warehouse_id: 'wh1', to_warehouse_id: null, company_id: null, branch_id: null }]],
      [/FROM inventory_moves m\s+JOIN products/, () => [
        { id: 'm1', product_id: 'p1', lot_id: null, from_location_id: 'loc1', to_location_id: null, quantity: '2', unit_cost: '0', cost_price: '10' },
        { id: 'm2', product_id: 'p2', lot_id: null, from_location_id: 'loc2', to_location_id: null, quantity: '9', unit_cost: '0', cost_price: '10' },
      ]],
      // p1 has stock (5) in its location; p2 has none -> the p2 move would go negative.
      [/SELECT id, quantity FROM inventory_quants/, (params) => (params[0] === 'p1' ? [{ id: 'q', quantity: '5' }] : [])],
      [/UPDATE inventory_quants SET quantity/, () => []],
      [/UPDATE inventory_moves SET state = 'done'/, () => []],
      [/UPDATE inventory_transfers SET state = 'done'/, () => []],
    ]);
    await expect(services(conn, { valuation }).transfers.validate(adminCtx, 'tf1')).rejects.toThrow(/not enough stock/);
    // Nothing was marked done and the valuation engine was never told about the moves.
    expect(conn.calls.some((c) => /UPDATE inventory_transfers SET state = 'done'/.test(c.sql))).toBe(false);
    expect(valuation.notify).not.toHaveBeenCalled();
  });

  it('posts a transfer and hands the moves to the valuation engine on success', async () => {
    const valuation = { notify: jest.fn().mockResolvedValue(true) } as unknown as ValuationClient;
    const conn = fakeConn([
      ...scopeQueries,
      [/FROM inventory_transfers WHERE id = \$1/, () => [{ id: 'tf1', state: 'draft', transfer_type: 'receipt', from_warehouse_id: null, to_warehouse_id: 'wh1', company_id: null, branch_id: null }]],
      [/FROM inventory_moves m\s+JOIN products/, () => [
        { id: 'm1', product_id: 'p1', lot_id: null, from_location_id: null, to_location_id: 'loc1', quantity: '10', unit_cost: '5', cost_price: '10' },
      ]],
      [/SELECT id, quantity FROM inventory_quants/, () => []],
      [/INSERT INTO inventory_quants/, () => []],
      [/UPDATE inventory_moves SET state = 'done'/, () => []],
      [/UPDATE inventory_transfers SET state = 'done'/, () => []],
      [/SELECT \* FROM inventory_transfers WHERE id = \$1/, () => [{ id: 'tf1', name: 'WH/IN/00001', state: 'done' }]],
    ]);
    await services(conn, { valuation }).transfers.validate(adminCtx, 'tf1');
    // The move was posted (transfer done) and the engine got the inbound cost.
    expect(conn.calls.some((c) => /UPDATE inventory_transfers SET state = 'done'/.test(c.sql))).toBe(true);
    expect(valuation.notify).toHaveBeenCalledWith('t1', expect.arrayContaining([
      expect.objectContaining({ move_id: 'm1', product_id: 'p1', quantity: '10' }),
    ]));
  });

  it('lets a branch-limited user see only their own branch transfers', async () => {
    // The transfer belongs to another branch (b2), but the user works in b1 -> a clean 404.
    const conn = fakeConn([
      ...scopeQueries,
      [/FROM inventory_transfers WHERE id = \$1/, () => [{ id: 'tf1', name: 'X', state: 'draft', company_id: null, branch_id: BRANCH_B2 }]],
    ]);
    const s = services(conn).transfers;
    await expect(s.get(branchCtx, 'tf1')).rejects.toThrow(/not found/);
  });

  it('lets a branch-limited user move their own branch stock but not another branch', async () => {
    // The warehouse is in the user's branch (b1) so it is visible, but the product sits in another
    // branch (b2); create() must refuse to move it.
    const conn = fakeConn([
      ...scopeQueries,
      [/FROM inventory_warehouses WHERE id = \$1/, () => [{ id: 'wh1', company_id: null, branch_id: BRANCH_B1 }]],
      [/FROM products WHERE id = \$1/, () => [{ id: 'p1', has_variants: false, company_id: null, branch_id: BRANCH_B2 }]],
    ]);
    await expect(services(conn).transfers.create(branchCtx, {
      transfer_type: 'receipt', to_warehouse_id: 'wh1',
      moves: [{ product_id: 'p1', to_location_id: 'loc1', quantity: 1 }],
    } as never)).rejects.toThrow(/not in your company or branch/);
  });
});

describe('Transfers: where the stock goes', () => {
  const warehouse = (id: string, stock: string) => ({ id, name: id.toUpperCase(), stock_location_id: stock, company_id: null, branch_id: null });

  it('puts a receipt line without a location into the destination warehouse stock', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      [/FROM inventory_transfers WHERE id = \$1/, () => [{ id: 'tf1', name: 'WH/IN/1', state: 'in_progress', transfer_type: 'receipt', from_warehouse_id: null, to_warehouse_id: 'wh1', company_id: null, branch_id: null }]],
      [/FROM inventory_moves m\s+JOIN products/, () => [{ id: 'm1', product_id: 'p1', lot_id: null, from_location_id: null, to_location_id: null, quantity: '4', unit_cost: '0', cost_price: '7' }]],
      [/SELECT \* FROM inventory_warehouses WHERE id = \$1/, () => [warehouse('wh1', 'stock1')]],
      [/SELECT id, quantity FROM inventory_quants/, () => []],
    ]);
    await services(conn).transfers.validate(adminCtx, 'tf1');
    const quant = conn.calls.find((c) => /INSERT INTO inventory_quants/.test(c.sql))!;
    // product, location, lot, quantity, cost: the stock really arrived in the warehouse stock location at the product cost
    expect(quant.params.slice(0, 5)).toEqual(['p1', 'stock1', null, 4, 7]);
  });

  it('moves an internal transfer from one warehouse stock to the other', async () => {
    const conn = fakeConn([
      ...scopeQueries,
      [/FROM inventory_transfers WHERE id = \$1/, () => [{ id: 'tf2', name: 'WH/INT/1', state: 'in_progress', transfer_type: 'internal', from_warehouse_id: 'wh1', to_warehouse_id: 'wh2', company_id: null, branch_id: null }]],
      [/FROM inventory_moves m\s+JOIN products/, () => [{ id: 'm1', product_id: 'p1', lot_id: null, from_location_id: null, to_location_id: null, quantity: '2', unit_cost: '0', cost_price: '7' }]],
      [/SELECT \* FROM inventory_warehouses WHERE id = \$1/, (p) => [p[0] === 'wh1' ? warehouse('wh1', 'stock1') : warehouse('wh2', 'stock2')]],
      [/SELECT id, quantity FROM inventory_quants/, (p) => (p[1] === 'stock1' ? [{ id: 'q1', quantity: '5' }] : [])],
    ]);
    await services(conn).transfers.validate(adminCtx, 'tf2');
    expect(conn.calls.find((c) => /UPDATE inventory_quants SET quantity = \$1, updated_at/.test(c.sql))!.params).toEqual([3, 'q1']);
    expect(conn.calls.find((c) => /INSERT INTO inventory_quants/.test(c.sql))!.params.slice(0, 4)).toEqual(['p1', 'stock2', null, 2]);
  });

  it('refuses a service, a view location and a finished transfer', async () => {
    const service = fakeConn([...scopeQueries, [/FROM products WHERE id = \$1/, () => [{ id: 'p9', name: 'Delivery fee', product_type: 'service', has_variants: false, company_id: null, branch_id: null }]]]);
    await expect(services(service).stock.adjust(adminCtx, { product_id: 'p9', location_id: 'loc1', quantity: 1, reason: 'x' } as never))
      .rejects.toThrow(/not found|service/);
    const view = fakeConn([...scopeQueries, [/SELECT \* FROM inventory_locations WHERE id = \$1/, () => [{ id: 'v', name: 'WH View', usage: 'view', company_id: null, branch_id: null }]]]);
    await expect(services(view).stock.adjust(adminCtx, { product_id: 'p1', location_id: 'v', quantity: 1, reason: 'x' } as never))
      .rejects.toThrow(/only groups other locations/);
    const done = fakeConn([...scopeQueries, [/FROM inventory_transfers WHERE id = \$1/, () => [{ id: 'tf1', name: 'WH/IN/1', state: 'done', company_id: null, branch_id: null }]]]);
    await expect(services(done).transfers.addMove(adminCtx, 'tf1', { product_id: 'p1', quantity: 1 } as never)).rejects.toThrow(/is done/);
  });
});

describe('Inventory and the modules it builds on', () => {
  it('stops a product with stock from being archived (Products never imports Inventory)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ModuleHooksService } = require('../../common/modules/module-hooks.service');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerInventoryHooks } = require('./inventory.hooks');
    const hooks = new ModuleHooksService();
    registerInventoryHooks(hooks);
    const withStock = { query: jest.fn().mockResolvedValue([{ name: 'Teff', quantity: '12.0000' }]) };
    expect(await hooks.veto('product.archive', { tenantId: 't', conn: withStock, productIds: ['p1'] })).toMatch(/Still in stock: Teff \(12\)/);
    const empty = { query: jest.fn().mockResolvedValue([]) };
    expect(await hooks.veto('product.archive', { tenantId: 't', conn: empty, productIds: ['p1'] })).toBeNull();
  });

  it('hides cost and value from people without the valuation permission', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { hideMoney } = require('./inventory.controllers');
    const result = { data: [{ product_name: 'Teff', quantity: '3', unit_cost: '10', stock_value: '30' }], totals: { quantity: 3, value: 30 } };
    const picker = { user: { sub: 'u', role: 'staff', permissions: ['view_stock'] } };
    const manager = { user: { sub: 'u', role: 'staff', permissions: ['view_stock', 'view_stock_valuation'] } };
    expect(hideMoney(picker, result)).toEqual({ data: [{ product_name: 'Teff', quantity: '3' }], totals: { quantity: 3 } });
    expect(hideMoney(manager, result)).toEqual(result);
  });
});
