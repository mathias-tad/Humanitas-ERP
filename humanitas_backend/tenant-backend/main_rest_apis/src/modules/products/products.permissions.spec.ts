import {
  ALL_PRODUCTS_PERMISSIONS,
  PRODUCTS_ADMIN_ONLY_PERMISSIONS,
  PRODUCTS_EMPLOYEE_PERMISSIONS,
  PRODUCTS_MANAGER_PERMISSIONS,
} from './products.permissions';

describe('Products permissions (rule 27)', () => {
  it('has unique, snake_case <action>_<resource> names and no bundled manage_ permission', () => {
    expect(new Set(ALL_PRODUCTS_PERMISSIONS).size).toBe(ALL_PRODUCTS_PERMISSIONS.length);
    for (const p of ALL_PRODUCTS_PERMISSIONS) {
      expect(p).toMatch(/^(view|create|edit|delete|restore|export)_[a-z_]+$/);
      expect(p.startsWith('manage_')).toBe(false);
    }
  });

  it('defines separate view/create/edit/delete for every resource', () => {
    for (const r of ['products', 'product_categories', 'uoms', 'product_attributes', 'price_lists', 'label_templates']) {
      for (const a of ['view', 'create', 'edit', 'delete']) expect(ALL_PRODUCTS_PERMISSIONS).toContain(`${a}_${r}`);
    }
  });

  it('splits role defaults sensibly', () => {
    expect(PRODUCTS_MANAGER_PERMISSIONS.some((p) => PRODUCTS_ADMIN_ONLY_PERMISSIONS.includes(p))).toBe(false);
    expect(PRODUCTS_EMPLOYEE_PERMISSIONS.every((p) => p.startsWith('view_'))).toBe(true);
    expect([...PRODUCTS_MANAGER_PERMISSIONS, ...PRODUCTS_ADMIN_ONLY_PERMISSIONS].sort()).toEqual([...ALL_PRODUCTS_PERMISSIONS].sort());
  });
});
