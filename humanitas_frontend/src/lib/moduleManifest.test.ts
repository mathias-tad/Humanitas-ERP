import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { MODULE_FAMILIES, MODULE_MANIFEST, dependenciesOf } from './moduleManifest';

/** The server keeps the same map; both must agree on every module and its dependencies. */
describe('module map (rule 30)', () => {
  it('matches the server', () => {
    const server = readFileSync(join(process.cwd(), '../humanitas_backend/tenant-backend/main_rest_apis/src/common/modules/module-manifest.ts'), 'utf8');
    const entries = [...server.matchAll(/\{ key: '([a-z]+)', label: '[^']*', depends: \[([^\]]*)\] \}/g)]
      .map(([, key, deps]) => ({ key, depends: [...deps.matchAll(/'([a-z]+)'/g)].map((d) => d[1]) }));
    expect(entries.length).toBeGreaterThan(0);
    expect(MODULE_MANIFEST.map(({ key, depends }) => ({ key, depends }))).toEqual(entries);
  });

  it('brings a module\'s bases along', () => {
    expect(dependenciesOf('inventory')).toEqual(['products']);
    expect(MODULE_FAMILIES.products).toContain('inventory');
    expect(MODULE_FAMILIES.contacts).toEqual(expect.arrayContaining(['crm', 'sales', 'pos', 'accounting', 'purchasing', 'ecommerce', 'delivery']));
  });
});
