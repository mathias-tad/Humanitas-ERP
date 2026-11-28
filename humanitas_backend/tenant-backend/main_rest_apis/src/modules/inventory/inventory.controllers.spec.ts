import 'reflect-metadata';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MODULE_KEY } from '../auth/guards/module-subscription.guard';
import {
  InventoryLocationsController,
  InventoryStockController,
  InventoryTransfersController,
  InventoryWarehousesController,
} from './inventory.controllers';
import { InventoryStocktakesController } from './stocktakes.controller';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ALL_INVENTORY_PERMISSIONS } from './inventory.permissions';

/**
 * AGENTS.md rules 4, 27 and 25: every inventory controller is gated by the subscription, each
 * endpoint carries exactly one registered permission, and that permission is one of the
 * module's granular set (one per action, never a bundled `manage_*`).
 */
const controllers = [
  InventoryWarehousesController, InventoryLocationsController, InventoryStockController, InventoryTransfersController, InventoryStocktakesController,
];

function handlers(cls: new (...args: never[]) => object) {
  return Object.getOwnPropertyNames(cls.prototype)
    .filter((n) => n !== 'constructor')
    .map((n) => ({ name: `${cls.name}.${n}`, fn: (cls.prototype as Record<string, unknown>)[n] as object }));
}

describe('Inventory controllers', () => {
  it.each(controllers.map((c) => [c.name, c]))('%s requires the inventory module', (_n, cls) => {
    expect(Reflect.getMetadata(MODULE_KEY, cls)).toBe('inventory');
  });

  const all = controllers.flatMap((c) => handlers(c as never));
  expect(all.length).toBeGreaterThan(0);

  it.each(all.map((h) => [h.name, h.fn]))('%s requires exactly one registered inventory permission', (_n, fn) => {
    const perms: string[] = Reflect.getMetadata(PERMISSIONS_KEY, fn);
    expect(perms).toHaveLength(1);
    expect(ALL_INVENTORY_PERMISSIONS).toContain(perms[0]);
    expect(perms[0]).toMatch(/^(view|create|edit|delete|restore|export|adjust|validate|cancel|count|approve)_/);
  });

  it('no endpoint uses a bundled manage_* permission (rule 27)', () => {
    for (const h of all) {
      const perms: string[] = Reflect.getMetadata(PERMISSIONS_KEY, h.fn);
      expect(perms[0]).not.toMatch(/^manage_/);
    }
  });
});

describe('Inventory AI knowledge (rules 20, 24.27)', () => {
  // Each Inventory feature adds its own knowledge migration; together they cover every permission.
  const dir = join(__dirname, '../../migrations/tenant');
  const base = readFileSync(join(dir, '20261127000002_ai_knowledge_inventory.sql'), 'utf8');
  const sql = [base, readFileSync(join(dir, '20261128000004_ai_knowledge_stocktakes.sql'), 'utf8')].join('\n');
  it.each(ALL_INVENTORY_PERMISSIONS)('mentions the %s permission', (p) => expect(sql).toContain(`"${p}"`));
  it('describes every Inventory page with web and mobile steps', () => {
    for (const r of ['/inventory', '/inventory/warehouses', '/inventory/locations', '/inventory/transfers', '/inventory/movements']) {
      expect(sql).toContain(`'${r}'`);
    }
    expect(sql).toContain("'/inventory/stocktakes'");
    expect(base.match(/"mobile": \[/g)).toHaveLength(6);
    expect(sql.match(/"mobile": \[/g)).toHaveLength(7);
  });

  it('uses every permission it grants on some endpoint', () => {
    const used = new Set(controllers.flatMap((c) => handlers(c as never)).map((h) => (Reflect.getMetadata(PERMISSIONS_KEY, h.fn) as string[])[0]));
    // view_stock_valuation is checked inside the stock and transfer endpoints (money columns).
    expect(ALL_INVENTORY_PERMISSIONS.filter((p) => !used.has(p) && p !== 'view_stock_valuation')).toEqual([]);
  });
});
