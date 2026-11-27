import * as fs from 'fs';
import * as path from 'path';
import { MODULE_FAMILIES, MODULE_MANIFEST, dependenciesOf, dependentsOf, withDependencies } from './module-manifest';
import { ModuleHooksService } from './module-hooks.service';

/** Non-test .ts files under a folder, as paths relative to it. */
function tsFiles(root: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...tsFiles(root, p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

describe('module map (rule 30)', () => {
  it('brings a module\'s bases along with it', () => {
    expect(dependenciesOf('inventory')).toEqual(['products']);
    expect([...withDependencies(['inventory'])].sort()).toEqual(['inventory', 'products']);
    expect([...withDependencies(['sales'])].sort()).toEqual(['contacts', 'products', 'sales']);
    expect(dependentsOf('products')).toEqual(expect.arrayContaining(['inventory', 'sales', 'purchasing', 'pos']));
    expect(MODULE_FAMILIES.contacts).toEqual(expect.arrayContaining(['crm', 'sales', 'pos', 'accounting', 'purchasing', 'ecommerce', 'delivery']));
    expect(MODULE_FAMILIES.products).toContain('inventory');
  });

  it('only depends on modules it knows, without cycles', () => {
    const keys = new Set(MODULE_MANIFEST.map((m) => m.key));
    for (const m of MODULE_MANIFEST) {
      for (const d of m.depends) expect(keys.has(d)).toBe(true);
      expect(dependenciesOf(m.key)).not.toContain(m.key);
    }
  });

  it('keeps each module\'s code inside the modules it depends on', () => {
    // A base module never imports a module built on it (Products never imports Inventory).
    const modulesDir = path.join(__dirname, '..', '..', 'modules');
    const folder: Record<string, string> = { products: 'products', contacts: 'contacts', crm: 'crm', inventory: 'inventory' };
    // Shared record plumbing (context, company/branch scope, CSV) lives in common/records.
    const offenders: string[] = [];
    for (const [key, dir] of Object.entries(folder)) {
      const root = path.join(modulesDir, dir);
      if (!fs.existsSync(root)) continue;
      const allowed = new Set([key, ...dependenciesOf(key)].map((k) => folder[k]).filter(Boolean));
      for (const f of tsFiles(root)) {
        const src = fs.readFileSync(path.join(root, f), 'utf8');
        for (const m of src.matchAll(/(?:from |import\()'\.\.\/([a-z-]+)\//g)) {
          const target = m[1];
          const targetKey = Object.entries(folder).find(([, d]) => d === target)?.[0];
          if (targetKey && !allowed.has(target)) offenders.push(`${dir}/${f} imports ${target}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('module hooks', () => {
  it('lets a dependent module refuse a base module\'s action', async () => {
    const hooks = new ModuleHooksService();
    const conn = { query: jest.fn() };
    hooks.onVeto('product.archive', 'inventory', async ({ productIds }) => (productIds.includes('p1') ? 'p1 holds stock' : null));
    expect(await hooks.veto('product.archive', { tenantId: 't', conn, productIds: ['p2'] })).toBeNull();
    expect(await hooks.veto('product.archive', { tenantId: 't', conn, productIds: ['p1'] })).toBe('p1 holds stock');
    expect(hooks.handlers('product.archive')).toEqual(['inventory']);
  });

  it('never lets a failing listener break the action', async () => {
    const hooks = new ModuleHooksService();
    hooks.on('product.archive', 'x', async () => { throw new Error('boom'); });
    await expect(hooks.notify('product.archive', { tenantId: 't', conn: { query: jest.fn() }, productIds: [] })).resolves.toBeUndefined();
  });
});
