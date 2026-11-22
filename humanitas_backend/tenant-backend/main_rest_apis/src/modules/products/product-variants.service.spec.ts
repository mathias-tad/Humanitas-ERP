import { BadRequestException } from '@nestjs/common';
import { ProductVariantsService } from './product-variants.service';
import { ProductAttributesService } from './product-attributes.service';
import { ProductsService, type CatalogContext } from './products.service';
import { MAX_VARIANTS, variantKey } from './product-variants';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

const PARENT = 'cccccccc-0000-0000-0000-000000000001';
const SIZE = 'dddddddd-0000-0000-0000-000000000001';
const COLOR = 'dddddddd-0000-0000-0000-000000000002';
const M = 'eeeeeeee-0000-0000-0000-000000000001';
const L = 'eeeeeeee-0000-0000-0000-000000000002';
const RED = 'eeeeeeee-0000-0000-0000-000000000003';

type Route = [RegExp, (params: unknown[]) => unknown];
function fakeConn(routes: Route[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  let n = 0;
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of routes) if (re.test(sql)) return fn(params);
    if (/INSERT INTO products/.test(sql)) return [{ id: `variant-${++n}` }];
    return [];
  });
  const conn = { query, transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(conn)), calls };
  return conn;
}

const ctx: CatalogContext = {
  tenantId: 't1',
  user: { sub: 'u1', email: '', tenantId: 't1', tenantSlug: 't', role: 'admin', permissions: [] },
  client: { platform: 'web', device: 'desktop', info: {} },
};

const parent = (over: Record<string, unknown> = {}) => ({
  id: PARENT, name: 'T-shirt', sku: 'TSHIRT', parent_id: null, has_variants: false, is_active: true, barcodes: [], ...over,
});

const catalogRoutes: Route[] = [
  [/FROM product_attributes WHERE id = ANY/, () => [{ id: SIZE, name: 'Size', is_active: true }, { id: COLOR, name: 'Color', is_active: true }]],
  [/FROM product_attribute_values WHERE id = ANY/, () => [
    { id: M, attribute_id: SIZE, name: 'M', code: null, sort_order: 1, is_active: true },
    { id: L, attribute_id: SIZE, name: 'L', code: null, sort_order: 2, is_active: true },
    { id: RED, attribute_id: COLOR, name: 'Red', code: 'RED', sort_order: 1, is_active: true },
  ]],
];

describe('ProductVariantsService', () => {
  const build = (conn: ReturnType<typeof fakeConn>, product = parent()) => {
    const timeline = { record: jest.fn() };
    const products = { get: jest.fn().mockResolvedValue(product), variantsOf: jest.fn().mockResolvedValue([]) };
    const svc = new ProductVariantsService(
      { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService,
      products as unknown as ProductsService,
      timeline as unknown as ActivityTimelineService,
    );
    return { svc, timeline, products };
  };

  it('creates one variant per combination with SKUs from the parent and value codes', async () => {
    const conn = fakeConn([...catalogRoutes, [/SELECT id, variant_key, is_active, auto_archived FROM products/, () => []]]);
    const { svc, timeline } = build(conn);
    const res = await svc.save(ctx, PARENT, { attributes: [{ attribute_id: SIZE, value_ids: [M, L] }, { attribute_id: COLOR, value_ids: [RED] }] });
    expect(res.summary).toEqual({ created: 2, archived: 0, restored: 0 });
    const inserts = conn.calls.filter((c) => /INSERT INTO products/.test(c.sql));
    expect(inserts.map((c) => c.params[1])).toEqual(['TSHIRT-M-RED', 'TSHIRT-L-RED']);
    expect(inserts.map((c) => c.params[2])).toEqual(['T-shirt (M, Red)', 'T-shirt (L, Red)']);
    expect(inserts[0].params[4]).toBe(variantKey([M, RED]));
    expect(conn.calls.some((c) => /UPDATE products SET has_variants = \$2/.test(c.sql) && c.params[1] === true)).toBe(true);
    expect(conn.calls.filter((c) => /INSERT INTO product_variant_values/.test(c.sql))).toHaveLength(4);
    expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({ entityId: PARENT, summary: 'Variants: 2 created' }));
  });

  it('archives variants whose value was removed and leaves a taken SKU empty', async () => {
    const conn = fakeConn([
      ...catalogRoutes,
      [/SELECT id, variant_key, is_active, auto_archived FROM products/, () => [
        { id: 'v-m', variant_key: variantKey([M]), is_active: true, auto_archived: null },
        { id: 'v-l', variant_key: variantKey([L]), is_active: true, auto_archived: null },
      ]],
    ]);
    const { svc } = build(conn, parent({ has_variants: true }));
    const res = await svc.save(ctx, PARENT, { attributes: [{ attribute_id: SIZE, value_ids: [M] }] });
    expect(res.summary).toEqual({ created: 0, archived: 1, restored: 0 });
    const archive = conn.calls.find((c) => /auto_archived = 'config'/.test(c.sql))!;
    expect(archive.params[0]).toEqual(['v-l']);
  });

  it('removing every attribute archives the variants and turns the product back into a simple one', async () => {
    const conn = fakeConn([[/SELECT id, variant_key, is_active, auto_archived FROM products/, () => [
      { id: 'v-m', variant_key: variantKey([M]), is_active: true, auto_archived: null },
    ]]]);
    const { svc } = build(conn, parent({ has_variants: true }));
    const res = await svc.save(ctx, PARENT, { attributes: [] });
    expect(res.summary.archived).toBe(1);
    expect(conn.calls.some((c) => /UPDATE products SET has_variants = \$2/.test(c.sql) && c.params[1] === false)).toBe(true);
  });

  it('refuses a variant, an archived product, barcodes on the parent and too many combinations', async () => {
    const conn = fakeConn([...catalogRoutes, [/SELECT id, variant_key/, () => []]]);
    const line = { attributes: [{ attribute_id: SIZE, value_ids: [M] }] };
    await expect(build(conn, parent({ parent_id: 'x', parent_name: 'T-shirt' })).svc.save(ctx, PARENT, line)).rejects.toThrow(/variant of "T-shirt"/);
    await expect(build(conn, parent({ is_active: false })).svc.save(ctx, PARENT, line)).rejects.toThrow(/Restore/);
    await expect(build(conn, parent({ barcodes: [{ barcode: '1' }] })).svc.save(ctx, PARENT, line)).rejects.toThrow(/own barcode/);
    await expect(
      build(conn).svc.save(ctx, PARENT, { attributes: [{ attribute_id: SIZE, value_ids: [M] }, { attribute_id: SIZE, value_ids: [L] }] }),
    ).rejects.toThrow(/once/);
    await expect(
      build(conn).svc.save(ctx, PARENT, { attributes: [{ attribute_id: COLOR, value_ids: [M] }] }),
    ).rejects.toThrow(/does not belong/);
    expect(MAX_VARIANTS).toBeGreaterThan(50);
  });
});

describe('ProductsService variant rules', () => {
  const KG = 'aaaaaaaa-0000-0000-0000-000000000002';
  const V1 = 'bbbbbbbb-0000-0000-0000-000000000001';
  const variant = (over: Record<string, unknown> = {}) => ({
    id: V1, name: 'T-shirt (M)', sku: 'TSHIRT-M', parent_id: PARENT, parent_name: 'T-shirt', parent_sales_price: '300.0000',
    parent_is_active: true, parent_has_variants: true, has_variants: false, sales_price: '300.0000', price_extra: '0.0000',
    product_type: 'consumable', uom_id: KG, purchase_uom_id: KG, tax_code: 'VAT15', company_id: null, is_active: true, barcodes: [], ...over,
  });
  const build = (row: Record<string, unknown>) => {
    const conn = fakeConn([[/SELECT company_id FROM users/, () => [{ company_id: null }]], [/FROM products p/, () => [row]]]);
    const svc = new ProductsService(
      { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService,
      { record: jest.fn(), recordChanges: jest.fn() } as unknown as ActivityTimelineService,
    );
    return { svc, conn };
  };

  it('turns a variant sales price into its price extra', async () => {
    const { svc, conn } = build(variant());
    await svc.update(ctx, V1, { sales_price: 350, tax_code: 'VAT15', name: 'T-shirt (M)' });
    const upd = conn.calls.find((c) => /^\s*UPDATE products SET/.test(c.sql))!;
    expect(upd.sql).toContain('price_extra = $');
    expect(upd.params).toEqual(expect.arrayContaining([50, 350]));
  });

  it('refuses changing a shared detail on a variant', async () => {
    const { svc } = build(variant());
    await expect(svc.update(ctx, V1, { tax_code: 'VAT0' })).rejects.toThrow(/set on "T-shirt"/);
    await expect(svc.update(ctx, V1, { name: 'Other' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passes a parent change on to its variants and keeps barcodes off the parent', async () => {
    const { svc, conn } = build(variant({ id: PARENT, parent_id: null, has_variants: true }));
    await svc.update(ctx, PARENT, { sales_price: 320 });
    expect(conn.calls.some((c) => /UPDATE products v\s+SET description = par.description/.test(c.sql))).toBe(true);
    await expect(svc.update(ctx, PARENT, { barcodes: [{ barcode: '123' }] })).rejects.toThrow(/variants/);
    await expect(svc.update(ctx, PARENT, { price_extra: 5 })).rejects.toThrow(/Only a variant/);
  });

  it('archives a parent with its variants and refuses restoring a variant of an archived parent', async () => {
    const { svc, conn } = build(variant({ id: PARENT, parent_id: null, has_variants: true }));
    await svc.archive(ctx, PARENT);
    expect(conn.calls.some((c) => /auto_archived = 'parent'/.test(c.sql))).toBe(true);
    const archivedVariant = build(variant({ is_active: false, parent_is_active: false }));
    await expect(archivedVariant.svc.restore(ctx, V1)).rejects.toThrow(/Restore "T-shirt" first/);
  });

  it('lists the catalog without variants and never looks up a parent', async () => {
    const { svc, conn } = build(variant());
    await svc.list(ctx, {});
    expect(conn.calls.find((c) => /OFFSET/.test(c.sql))!.sql).toContain('p.parent_id IS NULL');
    await svc.lookup(ctx, 'TSHIRT-M');
    expect(conn.calls.find((c) => /lower\(p.sku\) = lower\(\$1\)/.test(c.sql))!.sql).toContain('NOT p.has_variants');
  });
});

describe('ProductAttributesService', () => {
  const build = (routes: Route[]) => {
    const conn = fakeConn(routes);
    return { svc: new ProductAttributesService({ getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService), conn };
  };

  it('refuses archiving an attribute that products use', async () => {
    const { svc } = build([[/FROM product_attributes a/, () => [{ id: SIZE, name: 'Size', product_count: 3, is_active: true }]]]);
    await expect(svc.archive(ctx, SIZE)).rejects.toThrow(/used by 3 products/);
  });

  it('refuses archiving a value that active variants use, and renames variants when a value is renamed', async () => {
    const value = [/FROM product_attribute_values\s+WHERE id = \$1 AND attribute_id = \$2/, () => [{ id: M, attribute_id: SIZE, name: 'M', is_active: true }]] as Route;
    const used = build([value, [/AS variants/, () => [{ variants: 2, products: 1 }]]]);
    await expect(used.svc.archiveValue(ctx, SIZE, M)).rejects.toThrow(/used by 1 product \(2 active variants\)/);

    const rename = build([value, [/SELECT product_id FROM product_variant_values/, () => [{ product_id: 'v1' }]]]);
    await rename.svc.updateValue(ctx, SIZE, M, { name: 'Medium' });
    expect(rename.conn.calls.some((c) => /SET variant_label = s.label/.test(c.sql))).toBe(true);
  });

  it('rejects a value listed twice when creating an attribute', async () => {
    const { svc } = build([]);
    await expect(svc.create(ctx, { name: 'Size', values: [{ name: 'M' }, { name: ' m ' }] })).rejects.toThrow(/listed twice/);
  });
});
