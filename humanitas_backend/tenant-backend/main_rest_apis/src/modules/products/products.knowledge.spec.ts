import { readFileSync } from 'fs';
import { join } from 'path';
import { ALL_PRODUCTS_PERMISSIONS } from './products.permissions';

/**
 * AGENTS.md rules 20 and 27: every Products page and permission is known to the AI assistant,
 * with web and mobile instructions. Adding a page or permission without a knowledge entry fails here.
 */
describe('Products AI knowledge entries', () => {
  const sql = readFileSync(join(__dirname, '../../migrations/tenant/20261121000003_ai_knowledge_products.sql'), 'utf8');

  it.each(['/products', '/products/categories', '/products/uoms'])('describes the %s page', (route) => {
    expect(sql).toContain(`'${route}'`);
  });

  it.each(ALL_PRODUCTS_PERMISSIONS)('mentions the %s permission', (permission) => {
    expect(sql).toContain(`"${permission}"`);
  });

  it('gives every entry web and mobile instructions and updates entries on re-run', () => {
    const entries = sql.split('\n(\n').length - 1;
    expect(entries).toBeGreaterThanOrEqual(5);
    expect(sql.match(/\{"web": \[/g)).toHaveLength(entries);
    expect(sql.match(/"mobile": \[/g)).toHaveLength(entries);
    expect(sql).toMatch(/ON CONFLICT \(module_key, feature_name\) DO UPDATE SET/);
  });

  it('covers the MoR e-invoicing fields (rule 28)', () => {
    for (const term of ['item code', 'VAT15', 'VATEX', 'TOT2', 'HS code', 'excise', 'MoR unit code']) expect(sql).toContain(term);
  });
});
