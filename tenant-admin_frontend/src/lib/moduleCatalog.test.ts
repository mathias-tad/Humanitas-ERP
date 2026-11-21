import { describe, expect, it } from 'vitest';
import { requiredBy, toggleModule, type ModuleCatalog } from './moduleCatalog';

const catalog: ModuleCatalog = {
  modules: [
    { key: 'hrms', name: 'HRMS', category: 'people', description: '', depends: [], aliases: ['hr'], status: 'available' },
    { key: 'products', name: 'Products', category: 'operations', description: '', depends: [], status: 'coming_soon' },
    { key: 'inventory', name: 'Inventory', category: 'operations', description: '', depends: ['products'], status: 'coming_soon' },
    { key: 'manufacturing', name: 'Manufacturing', category: 'operations', description: '', depends: ['products', 'inventory'], status: 'coming_soon' },
    { key: 'sales', name: 'Sales', category: 'commercial', description: '', depends: ['products'], status: 'coming_soon' },
  ],
  bridges: [{ key: 'sales_inventory', requires: ['sales', 'inventory'], description: '' }],
};

describe('toggleModule', () => {
  it('enabling a module adds what it requires', () => {
    expect(toggleModule([], 'manufacturing', true, catalog).features.sort()).toEqual(['inventory', 'manufacturing', 'products']);
  });

  it('enabling HRMS also adds its legacy alias', () => {
    expect(toggleModule(['users'], 'hrms', true, catalog).features).toEqual(['users', 'hrms', 'hr']);
  });

  it('refuses to disable a module that an enabled module needs', () => {
    const res = toggleModule(['products', 'inventory', 'sales'], 'products', false, catalog);
    expect(res.features).toEqual(['products', 'inventory', 'sales']);
    expect(res.error).toBe('Products is required by Inventory, Sales. Turn those off first.');
  });

  it('disabling a module that nothing needs removes it', () => {
    expect(toggleModule(['products', 'inventory'], 'inventory', false, catalog).features).toEqual(['products']);
  });

  it('disabling HRMS removes the legacy HR flags too', () => {
    expect(toggleModule(['hrms', 'hr', 'leave', 'payroll', 'pms'], 'hrms', false, catalog).features).toEqual(['pms']);
  });

  it('still works (plain add/remove) before the catalog has loaded', () => {
    expect(toggleModule([], 'inventory', true, null).features).toEqual(['inventory']);
    expect(toggleModule(['inventory'], 'inventory', false, null).features).toEqual([]);
  });
});

describe('requiredBy', () => {
  it('lists enabled modules that need the given one, transitively', () => {
    expect(requiredBy(['products', 'inventory', 'manufacturing'], 'products', catalog)).toEqual(['Inventory', 'Manufacturing']);
    expect(requiredBy(['products'], 'products', catalog)).toEqual([]);
  });
});
