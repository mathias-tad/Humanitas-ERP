import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { ProductSettingsService } from './product-settings.service';
import { ProductStructureService } from './product-structure.service';
import { ProductMediaService, storageErrorMessage } from './product-media.service';
import { PriceListCustomersService, customerListId } from './price-list-customers.service';
import { ProductReportsService } from './product-reports.service';
import type { ProductsService, CatalogContext } from './products.service';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

const P1 = 'bbbbbbbb-0000-0000-0000-000000000001';
const C1 = 'bbbbbbbb-0000-0000-0000-000000000002';
const C2 = 'bbbbbbbb-0000-0000-0000-000000000003';
const LIST = 'cccccccc-0000-0000-0000-000000000001';
type Route = [RegExp, (params: unknown[]) => unknown];

function fakeConn(routes: Route[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of routes) if (re.test(sql)) return fn(params);
    return [];
  });
  const conn = { query, transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(conn)), calls };
  return conn;
}
const ctx: CatalogContext = {
  tenantId: 'tenant-1', user: { sub: 'u1', email: '', tenantId: 'tenant-1', tenantSlug: 't', role: 'admin', permissions: [] },
  client: { platform: 'web', device: 'desktop', info: {} },
};
const dbFor = (conn: unknown) => ({ getTenantConnectionById: jest.fn().mockResolvedValue(conn) }) as unknown as DatabaseService;
const timelineMock = () => ({ record: jest.fn(), recordChanges: jest.fn(), list: jest.fn() });

describe('Product Settings', () => {
  it('fills a new product with the next free SKU and an in-store EAN-13', async () => {
    let skuNext = 7;
    let codeNext = 1;
    const conn = fakeConn([
      [/SELECT \* FROM product_settings/, () => [{ sku_mode: 'auto', sku_prefix: 'TF', sku_padding: 4, sku_next: skuNext, barcode_mode: 'ean13', barcode_prefix: '21', barcode_next: codeNext }]],
      [/SET sku_next = sku_next \+ 1/, () => [{ n: skuNext++ }]],
      [/SET barcode_next = barcode_next \+ 1/, () => [{ n: codeNext++ }]],
      // TF0007 was typed by hand on another product.
      [/FROM products WHERE lower\(sku\) = lower\(\$1\)/, (p) => (p[0] === 'TF0007' ? [{ '?column?': 1 }] : [])],
    ]);
    const out = await new ProductSettingsService(dbFor(conn), timelineMock() as never).fillCodes(conn, P1, { hasSku: false, hasBarcode: false, productType: 'storable' }, 'u1');
    expect(out).toEqual({ sku: 'TF0008', barcode: '2100000000012' });
    const insert = conn.calls.find((c) => /INSERT INTO product_barcodes/.test(c.sql))!;
    expect(insert.params).toEqual([P1, '2100000000012', 'u1']);
  });

  it('applies defaults and requires a category when set', async () => {
    const conn = fakeConn([[/SELECT \* FROM product_settings/, () => [{ default_product_type: 'storable', default_tax_code: 'TOT2', require_category: true }]]]);
    const svc = new ProductSettingsService(dbFor(conn), timelineMock() as never);
    await expect(svc.applyDefaults(conn, { name: 'Teff' })).rejects.toThrow(/category/);
    await expect(svc.applyDefaults(conn, { name: 'Teff', category_id: C1 })).resolves.toMatchObject({ product_type: 'storable', tax_code: 'TOT2' });
  });

  it('refuses a barcode prefix outside the in-store range unless it is a full GS1 company prefix', async () => {
    const conn = fakeConn([[/SELECT \* FROM product_settings/, () => [{}]]]);
    const svc = new ProductSettingsService(dbFor(conn), timelineMock() as never);
    await expect(svc.update(ctx, { barcode_mode: 'ean13', barcode_prefix: '62' })).rejects.toThrow(/20 to 29/);
  });
});

describe('Product packaging and contents', () => {
  const products = (p: Record<string, unknown>) => ({ get: jest.fn().mockResolvedValue({ id: P1, name: 'Gift basket', composition: 'single', sales_price: '500', ...p }) }) as unknown as ProductsService;

  it('refuses a GTIN another product uses', async () => {
    const conn = fakeConn([[/FROM product_barcodes b JOIN products p/, () => [{ code: '16291041500210', name: 'Teff 1kg' }]]]);
    const svc = new ProductStructureService(dbFor(conn), products({}), timelineMock() as never);
    await expect(svc.savePackagings(ctx, P1, { packagings: [{ name: 'Case', quantity: 12, gtin: '16291041500210' }] })).rejects.toThrow('16291041500210 is already used by "Teff 1kg"');
  });

  it('refuses a component with variants or that is itself a kit', async () => {
    const conn = fakeConn([
      [/SELECT company_id FROM users/, () => [{ company_id: null }]],
      [/SELECT id, name, is_active, has_variants, composition, company_id, branch_id FROM products/, () => [
        { id: C1, name: 'T-shirt', is_active: true, has_variants: true, composition: 'single', company_id: null },
        { id: C2, name: 'Coffee', is_active: true, has_variants: false, composition: 'kit', company_id: null },
      ]],
    ]);
    const svc = new ProductStructureService(dbFor(conn), products({}), timelineMock() as never);
    await expect(svc.saveComposition(ctx, P1, { composition: 'kit', components: [{ component_id: C1, quantity: 1 }] })).rejects.toThrow(/has variants/);
    await expect(svc.saveComposition(ctx, P1, { composition: 'kit', components: [{ component_id: C2, quantity: 1 }] })).rejects.toThrow(/itself a kit/);
  });

  it('saves a kit and shows the components total against the kit price', async () => {
    const conn = fakeConn([
      [/SELECT company_id FROM users/, () => [{ company_id: null }]],
      [/SELECT id, name, is_active, has_variants, composition, company_id, branch_id FROM products/, () => [
        { id: C1, name: 'Coffee 500g', is_active: true, has_variants: false, composition: 'single', company_id: null },
        { id: C2, name: 'Mug', is_active: true, has_variants: false, composition: 'single', company_id: null },
      ]],
      [/FROM product_components c JOIN products p ON p.id = c.component_id JOIN uoms/, () => [
        { component_id: C1, quantity: '2', name: 'Coffee 500g', sales_price: '180', cost_price: '120' },
        { component_id: C2, quantity: '1', name: 'Mug', sales_price: '150', cost_price: '80' },
      ]],
    ]);
    const svc = new ProductStructureService(dbFor(conn), products({ composition: 'kit' }), timelineMock() as never);
    const res = await svc.saveComposition(ctx, P1, { composition: 'kit', components: [{ component_id: C1, quantity: 2 }, { component_id: C2, quantity: 1 }] });
    expect(res).toMatchObject({ components_price: 510, components_cost: 320, sales_price: 500 });
    const inserts = conn.calls.filter((c) => /INSERT INTO product_components/.test(c.sql)).map((c) => c.params);
    expect(inserts).toEqual([[P1, C1, 2, 0], [P1, C2, 1, 1]]);
  });

  it('cannot make a variant a kit', async () => {
    const svc = new ProductStructureService(dbFor(fakeConn([])), products({ parent_id: 'x' }), timelineMock() as never);
    await expect(svc.saveComposition(ctx, P1, { composition: 'kit', components: [{ component_id: C1, quantity: 1 }] })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Product pictures', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const conn = () => fakeConn([
    [/SELECT company_id FROM users/, () => [{ company_id: null }]],
    [/SELECT id, name, company_id, branch_id, image_url FROM products/, () => [{ id: P1, name: 'Teff', company_id: null }]],
    [/count\(\*\)::int AS n FROM product_media/, () => [{ n: 0 }]],
    [/AS has_primary/, () => [{ has_primary: false }]],
    [/INSERT INTO product_media/, () => [{ id: 'm1' }]],
    [/FROM product_media WHERE id = \$1$/, () => [{ id: 'm1' }]],
  ]);

  it('stores the first picture as the main one and makes it the product image', async () => {
    const c = conn();
    const svc = new ProductMediaService(dbFor(c), timelineMock() as never);
    svc.uploadsRoot = () => dir;
    await svc.upload(ctx, P1, { data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), filename: 'teff.png' }, {});
    const insert = c.calls.find((x) => /INSERT INTO product_media/.test(x.sql))!;
    expect(insert.params[1]).toBe('image');
    expect(insert.params[4]).toBe('image/png');
    expect(insert.params[7]).toBe(true);
    expect(String(insert.params[2])).toMatch(/^\/uploads\/products\/tenant-1\/img_\d+_[0-9a-f]{32}\.png$/);
    expect(fs.readdirSync(path.join(dir, 'products', 'tenant-1'))).toHaveLength(1);
    expect(c.calls.some((x) => /UPDATE products SET image_url = \$1/.test(x.sql) && x.params[0] === insert.params[2])).toBe(true);
  });

  it('says plainly when the server cannot write the file', async () => {
    const svc = new ProductMediaService(dbFor(conn()), timelineMock() as never);
    const blocked = path.join(dir, 'blocked');
    fs.writeFileSync(blocked, 'a file where a folder should be');
    svc.uploadsRoot = () => blocked;
    await expect(svc.upload(ctx, P1, { data: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), filename: 'teff.jpg' }, {}))
      .rejects.toThrow(/could not save the file|cannot save files/);
    expect(storageErrorMessage({ code: 'EACCES' })).toMatch(/uploads folder is not writable \(EACCES\)/);
    expect(storageErrorMessage({ code: 'ENOSPC' })).toMatch(/disk is full/);
  });

  it('refuses a file that only pretends to be a picture', async () => {
    const svc = new ProductMediaService(dbFor(conn()), timelineMock() as never);
    svc.uploadsRoot = () => dir;
    await expect(svc.upload(ctx, P1, { data: Buffer.from('<svg onload=alert(1)>'), filename: 'x.png' }, {})).rejects.toThrow(/not a JPEG/);
    await expect(svc.upload(ctx, P1, { data: Buffer.from('<svg>'), filename: 'x.svg' }, {})).rejects.toThrow(/not allowed/);
  });
});

describe('Customer price lists', () => {
  it("uses the company's list for a person at the company", async () => {
    const conn = fakeConn([[/JOIN price_list_customers plc ON plc.contact_id = COALESCE\(c.parent_id, c.id\)/, () => [{ price_list_id: LIST }]]]);
    expect(await customerListId(conn, C1)).toBe(LIST);
  });

  it('refuses a person and moves a customer from another list', async () => {
    const conn = fakeConn([
      [/SELECT company_id FROM users/, () => [{ company_id: null }]],
      [/FROM price_lists WHERE id = \$1/, () => [{ id: LIST, name: 'Wholesale', is_active: true, company_id: null }]],
      [/SELECT id, name, is_active, company_id, branch_id, parent_id FROM contacts/, (p) => (p[0] as string[]).map((id) => ({ id, name: id === C2 ? 'Sara' : 'Abebe Trading', is_active: true, company_id: null, parent_id: id === C2 ? C1 : null }))],
      [/c.name, l.name AS list_name/, () => [{ name: 'Abebe Trading', list_name: 'Retail' }]],
    ]);
    const timeline = timelineMock();
    const svc = new PriceListCustomersService(dbFor(conn), timeline as never);
    await expect(svc.setCustomers(ctx, LIST, [C2])).rejects.toThrow(/put the company on the list/);
    await svc.setCustomers(ctx, LIST, [C1]);
    expect(conn.calls.some((c) => /ON CONFLICT \(contact_id\) DO UPDATE SET price_list_id/.test(c.sql))).toBe(true);
    expect(timeline.record).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      summary: 'Customers on "Wholesale": 1 added, 0 removed (Abebe Trading moved from Retail)',
    }));
  });
});

describe('Product Reports', () => {
  it('reports gaps, completeness and margin bands for the visible catalog', async () => {
    const conn = fakeConn([
      [/SELECT company_id FROM users/, () => [{ company_id: 'co-a' }]],
      [/AS products,/, () => [{ products: 10, variants: 4, sellable: 12, archived: 1 }]],
      [/count\(\*\) FILTER \(WHERE \(p.product_type <> 'service' AND NOT EXISTS/, () => [{ no_barcode: 3, no_price: 1, below_cost: 2 }]],
      [/count\(\*\)::int AS ok FROM products/, () => [{ ok: 9 }]],
      [/WITH x AS/, () => [{ key: 'negative', count: 2 }, { key: 'good', count: 6 }]],
    ]);
    const staff: CatalogContext = { ...ctx, user: { ...ctx.user!, role: 'staff' } };
    const res = await new ProductReportsService(dbFor(conn)).summary(staff);
    expect(res.completeness).toBe(75);
    expect(res.issues.find((i) => i.key === 'no_barcode')).toEqual({ key: 'no_barcode', label: 'No barcode', count: 3 });
    expect(res.margins.bands.map((b) => b.count)).toEqual([2, 0, 0, 6, 0]);
    const totals = conn.calls.find((c) => /AS products,/.test(c.sql))!;
    expect(totals.sql).toContain('p.company_id = ANY($1::uuid[])');
  });
});
