import { readFileSync } from 'fs';
import { join } from 'path';
import { ALL_PRODUCTS_PERMISSIONS } from './products.permissions';

/**
 * AGENTS.md rules 20 and 27: every Products page and permission is known to the AI assistant,
 * with web and mobile instructions. Adding a page or permission without a knowledge entry fails here.
 */
describe('Products AI knowledge entries', () => {
  const sql = readFileSync(join(__dirname, '../../migrations/tenant/20261121000003_ai_knowledge_products.sql'), 'utf8');
  const variantsSql = readFileSync(join(__dirname, '../../migrations/tenant/20261122000002_ai_knowledge_product_variants.sql'), 'utf8');
  const priceListsSql = readFileSync(join(__dirname, '../../migrations/tenant/20261122000006_ai_knowledge_price_lists.sql'), 'utf8');
  const labelsSql = readFileSync(join(__dirname, '../../migrations/tenant/20261122000009_ai_knowledge_labels.sql'), 'utf8');
  const allSql = sql + variantsSql + priceListsSql + labelsSql;

  it.each(['/products', '/products/categories', '/products/uoms'])('describes the %s page', (route) => {
    expect(sql).toContain(`'${route}'`);
  });

  it.each(ALL_PRODUCTS_PERMISSIONS)('mentions the %s permission', (permission) => {
    expect(allSql).toContain(`"${permission}"`);
  });

  it('describes label printing, and says on mobile that it is done on the web (rules 20, 24.27)', () => {
    expect(labelsSql).toContain(`'/products/labels'`);
    expect(labelsSql).toContain(`'Barcode and Price Labels'`);
    expect(labelsSql).toMatch(/"mobile": \[".*web app/);
  });

  it('describes price lists and product prices on web and mobile (rule 20)', () => {
    expect(priceListsSql).toContain(`'/products/pricelists'`);
    for (const f of ['Price Lists', 'Product Prices']) expect(priceListsSql).toContain(`'${f}'`);
    expect(priceListsSql.match(/"mobile": \[/g)).toHaveLength(2);
  });

  it('describes attributes and variants on web and mobile (rule 20)', () => {
    expect(variantsSql).toContain(`'/products/attributes'`);
    for (const f of ['Product Attributes', 'Product Variants']) expect(variantsSql).toContain(`'${f}'`);
    const entries = variantsSql.split('\n(\n').length - 1;
    expect(entries).toBe(2);
    expect(variantsSql.match(/\{"web": \[/g)).toHaveLength(entries);
    expect(variantsSql.match(/"mobile": \[/g)).toHaveLength(entries);
    expect(variantsSql).toMatch(/ON CONFLICT \(module_key, feature_name\) DO UPDATE SET/);
  });

  it('gives every entry web and mobile instructions and updates entries on re-run', () => {
    const entries = sql.split('\n(\n').length - 1;
    expect(entries).toBeGreaterThanOrEqual(5);
    expect(sql.match(/\{"web": \[/g)).toHaveLength(entries);
    expect(sql.match(/"mobile": \[/g)).toHaveLength(entries);
    expect(sql).toMatch(/ON CONFLICT \(module_key, feature_name\) DO UPDATE SET/);
  });

  it('gives every Products entry its mobile screen and navigation path (rule 20)', () => {
    const mobile = readFileSync(join(__dirname, '../../migrations/tenant/20261121000004_ai_knowledge_products_mobile.sql'), 'utf8');
    for (const screen of ['ProductsScreen', 'ProductCategoriesScreen', 'UnitsScreen', 'ProductDetailScreen', 'ProductFormScreen']) {
      expect(mobile).toContain(`'${screen}'`);
    }
    for (const feature of ['All Products', 'Product Categories', 'Units of Measure', 'E-invoicing (MoR) fields on products']) {
      expect(mobile).toContain(`feature_name = '${feature}'`);
    }
    expect(mobile).toContain('Home -> Quick Actions -> Products');
    expect(mobile).not.toMatch(/not in the mobile app yet/i);
  });

  it('covers the MoR e-invoicing fields (rule 28)', () => {
    for (const term of ['item code', 'VAT15', 'VATEX', 'TOT2', 'HS code', 'excise', 'MoR unit code']) expect(sql).toContain(term);
  });
});
