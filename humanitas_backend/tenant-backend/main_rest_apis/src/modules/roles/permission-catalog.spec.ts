import * as fs from 'fs';
import * as path from 'path';
import { PERMISSION_CATALOG, PERMISSION_IDS, unknownPermissions } from './permission-catalog';
import { ALL_PRODUCTS_PERMISSIONS } from '../products/products.permissions';

const SRC = path.join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : sourceFiles(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

/** Permission ids written as text in @RequirePermissions(...) and @Permissions(...), with the first file using each. */
function checkedPermissions(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/@(?:RequirePermissions|Permissions)\(([^)]*)\)/g)) {
      for (const id of m[1].matchAll(/['"]([a-z][a-z0-9_]+)['"]/g)) {
        if (!found.has(id[1])) found.set(id[1], path.relative(SRC, file));
      }
    }
  }
  return found;
}

describe('permission catalog (Access Control)', () => {
  it('lists every permission the code checks, so each one can be granted to a role', () => {
    const missing = [...checkedPermissions()]
      .filter(([id]) => !PERMISSION_IDS.has(id))
      .map(([id, file]) => `${id} (${file})`);
    expect(missing).toEqual([]);
  });

  it('really finds the permissions in the code', () => {
    expect(checkedPermissions().size).toBeGreaterThan(100);
  });

  it('has one entry per permission, each with a label, a group and a module', () => {
    expect(PERMISSION_IDS.size).toBe(PERMISSION_CATALOG.length);
    for (const p of PERMISSION_CATALOG) {
      expect(p.label.trim()).not.toBe('');
      expect(p.group.trim()).not.toBe('');
      expect(p.module).toMatch(/^[a-z][a-z.]*$/);
    }
  });

  it('keeps users, roles and companies in core so every subscription can manage them', () => {
    const moduleOf = (id: string) => PERMISSION_CATALOG.find((p) => p.id === id)?.module;
    for (const id of ['view_users', 'create_users', 'edit_users', 'view_roles', 'edit_roles', 'view_companies']) {
      expect(moduleOf(id)).toBe('core');
    }
  });

  it('reports unknown permissions but keeps ones a role already holds', () => {
    expect(unknownPermissions(['view_users', 'made_up_permission'])).toEqual(['made_up_permission']);
    expect(unknownPermissions(['view_users', 'old_permission'], ['old_permission'])).toEqual([]);
    expect(unknownPermissions(undefined)).toEqual([]);
  });

  it('lists every Products permission (written as constants in the controllers)', () => {
    expect(ALL_PRODUCTS_PERMISSIONS.filter((p) => !PERMISSION_IDS.has(p))).toEqual([]);
    expect(PERMISSION_CATALOG.filter((p) => ALL_PRODUCTS_PERMISSIONS.includes(p.id)).every((p) => p.module === 'products')).toBe(true);
  });
});
