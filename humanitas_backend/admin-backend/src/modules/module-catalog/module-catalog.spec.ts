import { BadRequestException } from '@nestjs/common';
import {
  BRIDGES, MODULES, ModuleDependencyError, catalog, dependentsOf, resolveModules, resolveTenantFeatures,
} from './module-catalog';

describe('module catalog integrity', () => {
  const keys = new Set(MODULES.map((m) => m.key));

  it('has unique module and bridge keys that never clash', () => {
    expect(keys.size).toBe(MODULES.length);
    const bridgeKeys = BRIDGES.map((b) => b.key);
    expect(new Set(bridgeKeys).size).toBe(bridgeKeys.length);
    for (const b of bridgeKeys) expect(keys.has(b)).toBe(false);
  });

  it('only depends on / bridges known modules', () => {
    for (const m of MODULES) for (const d of m.depends) expect(keys.has(d)).toBe(true);
    for (const b of BRIDGES) {
      expect(b.requires.length).toBeGreaterThanOrEqual(2);
      for (const r of b.requires) expect(keys.has(r)).toBe(true);
    }
  });

  it('has no dependency cycles', () => {
    const byKey = new Map(MODULES.map((m) => [m.key, m]));
    const visit = (k: string, stack: string[]) => {
      expect(stack).not.toContain(k);
      for (const d of byKey.get(k)!.depends) visit(d, [...stack, k]);
    };
    for (const m of MODULES) visit(m.key, []);
  });

  it('exposes the catalog payload', () => {
    expect(catalog()).toEqual({ modules: MODULES, bridges: BRIDGES });
  });
});

describe('resolveModules', () => {
  it('adds hard dependencies transitively with a reason', () => {
    const r = resolveModules(['manufacturing']);
    expect(r.features).toEqual(['manufacturing', 'products', 'inventory']);
    expect(r.added.map((a) => a.key)).toEqual(['products', 'inventory']);
    expect(r.added[0].reason).toMatch(/required by Manufacturing/);
  });

  it('switches bridges on only when every required module is on', () => {
    expect(resolveModules(['sales']).bridges).toEqual([]);
    expect(resolveModules(['sales', 'inventory']).bridges).toEqual(['sales_inventory']);
    expect(resolveModules(['pos', 'sales', 'inventory', 'accounting']).bridges.sort()).toEqual(
      ['inventory_accounting', 'pos_accounting', 'pos_inventory', 'pos_sales', 'sales_accounting', 'sales_inventory'],
    );
  });

  it('ignores bridge keys sent by a client and re-derives them', () => {
    expect(resolveModules(['pos_sales', 'pos']).features).toEqual(['pos', 'products']);
  });

  it('keeps hrms and its legacy alias together', () => {
    expect(resolveModules(['hrms']).features).toEqual(['hrms', 'hr']);
    expect(resolveModules(['hr', 'attendance']).features).toEqual(['hr', 'attendance', 'hrms']);
  });

  it('keeps unknown keys (AI tiers, platform modules, legacy plan flags) unchanged', () => {
    expect(resolveModules(['ai.help', 'users', 'reports'])).toEqual({
      features: ['ai.help', 'users', 'reports'], added: [], bridges: [],
    });
  });

  it('normalizes case, spaces and duplicates', () => {
    expect(resolveModules([' PMS ', 'pms', '']).features).toEqual(['pms']);
  });

  it('refuses to remove a module that a remaining module needs', () => {
    expect(() => resolveModules(['inventory', 'sales'], ['products', 'inventory', 'sales'])).toThrow(ModuleDependencyError);
    try {
      resolveModules(['inventory'], ['products', 'inventory']);
    } catch (e) {
      expect((e as ModuleDependencyError).blocked).toEqual([{ key: 'products', requiredBy: ['inventory'] }]);
      expect((e as Error).message).toBe('Products & Catalog is required by Inventory & Warehouses. Disable those modules first.');
    }
  });

  it('allows removing a module together with everything that depends on it', () => {
    expect(resolveModules(['hrms'], ['hrms', 'products', 'inventory', 'manufacturing']).features).toEqual(['hrms', 'hr']);
  });

  it('adds a newly required dependency during an update instead of refusing', () => {
    expect(resolveModules(['hrms', 'inventory'], ['hrms']).features).toEqual(['hrms', 'inventory', 'products', 'hr']);
  });

  it('lists transitive dependents', () => {
    expect(dependentsOf('inventory')).toEqual(['manufacturing']);
    expect(dependentsOf('products').sort()).toEqual(['ecommerce', 'inventory', 'manufacturing', 'pos', 'purchasing', 'sales']);
    expect(dependentsOf('crm')).toEqual([]);
  });
});

describe('resolveTenantFeatures', () => {
  it('returns the resolved list', () => {
    expect(resolveTenantFeatures(['inventory'])).toEqual(['inventory', 'products']);
  });

  it('turns a dependency conflict into a 400 with the explanation', () => {
    expect(() => resolveTenantFeatures(['inventory'], ['products', 'inventory'])).toThrow(BadRequestException);
    expect(() => resolveTenantFeatures(['inventory'], ['products', 'inventory'])).toThrow(/required by Inventory/);
  });
});
