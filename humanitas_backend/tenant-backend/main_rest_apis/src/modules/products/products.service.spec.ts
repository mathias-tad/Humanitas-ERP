import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductsService, csvCell, normalizeBarcodes, type CatalogContext } from './products.service';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

const CO_A = '11111111-1111-1111-1111-111111111111';
const CO_B = '22222222-2222-2222-2222-222222222222';
const UNITS = 'aaaaaaaa-0000-0000-0000-000000000001';
const KG = 'aaaaaaaa-0000-0000-0000-000000000002';
const P1 = 'bbbbbbbb-0000-0000-0000-000000000001';

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

const product = (over: Record<string, unknown> = {}) => ({
  id: P1, name: 'Teff flour 1kg', sku: 'TEFF-1', product_type: 'consumable', uom_id: KG, purchase_uom_id: KG,
  sales_price: '120.0000', cost_price: '90.0000', tax_rate: '15.00', company_id: null, is_active: true,
  barcodes: [{ barcode: '6290000000017', is_primary: true }], ...over,
});

describe('ProductsService', () => {
  let timeline: { record: jest.Mock; recordChanges: jest.Mock; list: jest.Mock };
  const ctx = (role = 'staff', permissions: string[] = ['view_products']): CatalogContext => ({
    tenantId: 't1', user: { sub: 'u1', email: '', tenantId: 't1', tenantSlug: 't', role, permissions },
    client: { platform: 'web', device: 'desktop', info: {} },
  });
  const build = (conn: ReturnType<typeof fakeConn>) =>
    new ProductsService(
      { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService,
      timeline as unknown as ActivityTimelineService,
    );
  const userCompany = (c: string | null): Route => [/SELECT company_id FROM users/, () => [{ company_id: c }]];
  const uomRows: Route = [/FROM uoms WHERE id = ANY/, (p) =>
    ((p[0] as string[]).map((id) => ({ id, category_id: id === KG ? 'weight' : 'unit', is_active: true })))];

  beforeEach(() => {
    timeline = { record: jest.fn(), recordChanges: jest.fn(), list: jest.fn().mockResolvedValue({ events: [], nextCursor: null }) };
  });

  describe('helpers', () => {
    it('normalizes barcodes: trims, makes the first primary, rejects duplicates and two primaries', () => {
      expect(normalizeBarcodes([{ barcode: ' 123 ' }, { barcode: '456' }])).toEqual([
        { barcode: '123', is_primary: true }, { barcode: '456' },
      ]);
      expect(() => normalizeBarcodes([{ barcode: '1' }, { barcode: '1' }])).toThrow(BadRequestException);
      expect(() => normalizeBarcodes([{ barcode: '1', is_primary: true }, { barcode: '2', is_primary: true }])).toThrow(BadRequestException);
      expect(normalizeBarcodes(undefined)).toEqual([]);
    });

    it('escapes CSV cells and neutralises formulas', () => {
      expect(csvCell('plain')).toBe('plain');
      expect(csvCell('a,b')).toBe('"a,b"');
      expect(csvCell('say "hi"')).toBe('"say ""hi"""');
      expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
      expect(csvCell(null)).toBe('');
    });
  });

  describe('list()', () => {
    it('limits a non-org-wide user to shared + own-company products and paginates', async () => {
      const conn = fakeConn([userCompany(CO_A), [/count\(\*\)::int AS total/, () => [{ total: 1 }]], [/FROM products p/, () => [product()]]]);
      const res = await build(conn).list(ctx(), { q: 'teff', page: 2, limit: 10 });
      expect(res.meta).toEqual({ page: 2, limit: 10, total: 1 });
      const data = conn.calls.find((c) => /LIMIT \$\d+ OFFSET/.test(c.sql))!;
      expect(data.sql).toContain('p.is_active');
      expect(data.sql).toContain('p.company_id = ANY($2::uuid[])');
      expect(data.params).toEqual(['%teff%', [CO_A], 10, 10]);
    });

    it('escapes LIKE wildcards in the search text', async () => {
      const conn = fakeConn([userCompany(CO_A), [/count\(\*\)/, () => [{ total: 0 }]]]);
      await build(conn).list(ctx('admin'), { q: '50%_off' });
      expect(conn.calls.find((c) => /count/.test(c.sql))!.params[0]).toBe('%50\\%\\_off%');
    });

    it('has no company filter for admins without a selected company', async () => {
      const conn = fakeConn([userCompany(CO_A), [/count\(\*\)/, () => [{ total: 0 }]]]);
      await build(conn).list(ctx('admin'), { status: 'all' });
      expect(conn.calls.find((c) => /count/.test(c.sql))!.sql).not.toContain('company_id');
    });
  });

  describe('get() / lookup()', () => {
    it("hides another company's product as not found", async () => {
      const conn = fakeConn([userCompany(CO_A), [/WHERE p.id = \$1/, () => [product({ company_id: CO_B })]]]);
      await expect(build(conn).get(ctx(), P1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('looks up active products by barcode or SKU', async () => {
      const conn = fakeConn([userCompany(CO_A), [/lower\(p.sku\) = lower\(\$1\)/, () => [product()]]]);
      expect((await build(conn).lookup(ctx(), ' 6290000000017 ')).id).toBe(P1);
      expect(conn.calls.at(-1)!.params[0]).toBe('6290000000017');
      const none = fakeConn([userCompany(CO_A)]);
      await expect(build(none).lookup(ctx(), 'nope')).rejects.toBeInstanceOf(NotFoundException);
      await expect(build(none).lookup(ctx(), '  ')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create()', () => {
    const createRoutes = (extra: Route[] = []): Route[] => [
      userCompany(CO_A),
      [/WHERE lower\(c.name\) = 'unit' AND u.is_reference/, () => [{ id: UNITS }]],
      uomRows,
      [/INSERT INTO products/, () => [{ id: P1 }]],
      [/WHERE p.id = \$1/, () => [product({ name: 'Buna', sku: null, uom_id: UNITS, purchase_uom_id: UNITS })]],
      ...extra,
    ];

    it('quick-creates from a name only: Units, consumable, in the current company, logged on the timeline', async () => {
      const conn = fakeConn(createRoutes());
      const res = await build(conn).create(ctx(), { name: '  Buna  ' });
      expect(res.name).toBe('Buna');
      const insert = conn.calls.find((c) => /INSERT INTO products/.test(c.sql))!;
      expect(insert.params.slice(0, 7)).toEqual([null, 'Buna', null, 'consumable', null, UNITS, UNITS]);
      // Rule 16: a new product goes to the user's current company (CO_A), not shared with all.
      expect(insert.params[13]).toBe(CO_A);
      expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({
        entityType: 'product', entityId: P1, eventType: 'created', moduleKey: 'products',
        client: { platform: 'web', device: 'desktop', info: {} },
      }));
    });

    it('inserts barcodes inside the same transaction', async () => {
      const conn = fakeConn(createRoutes());
      await build(conn).create(ctx(), { name: 'Buna', barcodes: [{ barcode: '111' }, { barcode: '222' }] });
      const codes = conn.calls.filter((c) => /INSERT INTO product_barcodes/.test(c.sql)).map((c) => [c.params[1], c.params[5]]);
      expect(codes).toEqual([['111', true], ['222', false]]);
      expect(conn.transaction).toHaveBeenCalledTimes(1);
    });

    it('refuses a purchase unit from another unit category', async () => {
      const conn = fakeConn(createRoutes());
      await expect(build(conn).create(ctx(), { name: 'x', uom_id: KG, purchase_uom_id: UNITS })).rejects.toThrow(/same unit category/);
    });

    it("refuses assigning a product to another company", async () => {
      const conn = fakeConn(createRoutes());
      await expect(build(conn).create(ctx(), { name: 'x', company_id: CO_B })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('turns duplicate SKU / barcode errors into 409 with a clear message', async () => {
      const dup = Object.assign(new Error('dup'), { code: '23505', constraint: 'uq_products_sku' });
      const conn = fakeConn(createRoutes([]));
      conn.transaction.mockRejectedValueOnce(dup);
      await expect(build(conn).create(ctx(), { name: 'x', sku: 'TEFF-1' })).rejects.toThrow(ConflictException);
      conn.transaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { driverError: { code: '23505', constraint: 'uq_product_barcodes_barcode' } }));
      await expect(build(conn).create(ctx(), { name: 'x' })).rejects.toThrow('This barcode is already used by another product');
    });

    it('refuses an archived category', async () => {
      const conn = fakeConn(createRoutes([[/FROM product_categories WHERE id = \$1/, () => [{ id: 'c', is_active: false, company_id: null }]]]));
      await expect(build(conn).create(ctx(), { name: 'x', category_id: 'cccccccc-0000-0000-0000-000000000001' })).rejects.toThrow('Category is archived');
    });
  });

  describe('update()', () => {
    it('updates only the given fields and records the diff (including barcodes)', async () => {
      let n = 0;
      const conn = fakeConn([
        userCompany(CO_A),
        [/WHERE p.id = \$1/, () => [n++ === 0 ? product() : product({ sales_price: '130.0000', barcodes: [{ barcode: '999', is_primary: true }] })]],
      ]);
      await build(conn).update(ctx(), P1, { sales_price: 130, barcodes: [{ barcode: '999' }] });
      const upd = conn.calls.find((c) => /^\s*UPDATE products SET/.test(c.sql))!;
      expect(upd.sql).toContain('sales_price = $1');
      expect(upd.sql).not.toContain('name =');
      expect(upd.params).toEqual([130, 'u1', P1]);
      expect(conn.calls.some((c) => /DELETE FROM product_barcodes/.test(c.sql))).toBe(true);
      const arg = timeline.recordChanges.mock.calls[0][1];
      expect(arg.before.barcodes).toEqual(['6290000000017']);
      expect(arg.after.barcodes).toEqual(['999']);
    });
  });

  describe('archive() / restore()', () => {
    it('archives once and logs a deleted event; a second archive is a no-op', async () => {
      const conn = fakeConn([userCompany(null), [/WHERE p.id = \$1/, () => [product()]]]);
      await build(conn).archive(ctx(), P1);
      expect(conn.calls.some((c) => /SET is_active = \$1, archived_at = now\(\)/.test(c.sql))).toBe(true);
      expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({ eventType: 'deleted' }));

      const archived = fakeConn([userCompany(null), [/WHERE p.id = \$1/, () => [product({ is_active: false })]]]);
      timeline.record.mockClear();
      await build(archived).archive(ctx(), P1);
      expect(timeline.record).not.toHaveBeenCalled();
      await build(archived).restore(ctx(), P1);
      expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({ eventType: 'restored' }));
    });
  });

  describe('MoR e-invoicing fields (rule 28)', () => {
    const createRoutes: Route[] = [
      userCompany(CO_A),
      [/WHERE lower\(c.name\) = 'unit' AND u.is_reference/, () => [{ id: UNITS }]],
      uomRows,
      [/INSERT INTO products/, () => [{ id: P1 }]],
      [/WHERE p.id = \$1/, () => [product({ item_code: 'P0000001', tax_code: 'VAT15', uom_mor_code: 'PCS' })]],
    ];

    it('quick-create defaults to VAT15 and leaves the item code to the database generator', async () => {
      const conn = fakeConn(createRoutes);
      const res = await build(conn).create(ctx(), { name: 'Buna' });
      const insert = conn.calls.find((c) => /INSERT INTO products/.test(c.sql))!;
      expect(insert.params[9]).toBe('VAT15');
      expect(insert.params.slice(15, 19)).toEqual([null, null, null, null]);
      // Sold in the base unit, no minimum order, any quantity.
      expect(insert.params.slice(19)).toEqual([UNITS, 0, null]);
      expect(res).toMatchObject({ eims_ready: true, eims_issues: [] });
    });

    it('stores the given item code, HS code, excise rate and invoice description', async () => {
      const conn = fakeConn(createRoutes);
      await build(conn).create(ctx(), {
        name: 'Beer 330ml', tax_code: 'VAT15', item_code: ' BR-330 ', harmonization_code: '22030000', excise_rate: 25,
        invoice_description: ' Beer 330 ml bottle ',
      });
      const insert = conn.calls.find((c) => /INSERT INTO products/.test(c.sql))!;
      expect(insert.params.slice(15, 19)).toEqual(['BR-330', '22030000', 25, 'Beer 330 ml bottle']);
    });

    it('reports products that MoR would reject', async () => {
      const conn = fakeConn([userCompany(null),
        [/WHERE p.id = \$1/, () => [product({ item_code: 'X1', tax_code: 'VAT15', uom_mor_code: null, name: 'n'.repeat(120) })]]]);
      const res = await build(conn).get(ctx('admin'), P1);
      expect(res.eims_ready).toBe(false);
      expect(res.eims_issues).toEqual(['description', 'unit']);
    });

    it('updates the tax code and clears an empty HS code', async () => {
      const conn = fakeConn([userCompany(CO_A), [/WHERE p.id = \$1/, () => [product()]]]);
      await build(conn).update(ctx(), P1, { tax_code: 'VATEX', harmonization_code: '  ' as string });
      const upd = conn.calls.find((c) => /^\s*UPDATE products SET/.test(c.sql))!;
      expect(upd.sql).toContain('tax_code = $1');
      expect(upd.sql).toContain('harmonization_code = $2');
      expect(upd.params.slice(0, 2)).toEqual(['VATEX', null]);
    });

    it('filters by readiness, searches and looks up by item code', async () => {
      const conn = fakeConn([userCompany(null), [/count\(\*\)/, () => [{ total: 0 }]], [/lower\(p.item_code\) = lower\(\$1\)/, () => [product()]]]);
      await build(conn).list(ctx('admin'), { eims: 'not_ready', q: 'br-3' });
      const count = conn.calls.find((c) => /count/.test(c.sql))!;
      expect(count.sql).toContain('JOIN uoms u ON u.id = p.uom_id');
      expect(count.sql).toContain('NOT (u.mor_code IS NOT NULL');
      expect(count.sql).toContain('lower(p.item_code) LIKE');
      await expect(build(conn).lookup(ctx('admin'), 'BR-330')).resolves.toMatchObject({ id: P1 });
    });

    it('lists MoR codes and rejects a malformed list name', async () => {
      const conn = fakeConn([[/FROM eims_codes/, () => [{ list_name: 'tax_code', code: 'VAT15' }]]]);
      await expect(build(conn).eimsCodes(ctx(), 'tax_code')).resolves.toHaveLength(1);
      expect(conn.calls.at(-1)!.params).toEqual(['tax_code']);
      await expect(build(conn).eimsCodes(ctx(), "x'; drop")).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps a duplicate item code to 409', async () => {
      const conn = fakeConn(createRoutes);
      conn.transaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505', constraint: 'uq_products_item_code' }));
      await expect(build(conn).create(ctx(), { name: 'x', item_code: 'A1' })).rejects.toThrow('A product with this item code already exists');
    });
  });

  describe('exportCsv() / timelineFor()', () => {
    it('exports a header row and one escaped row per product', async () => {
      const conn = fakeConn([userCompany(null), [/LIMIT 50000/, () => [product({ name: 'Sugar, white' })]]]);
      const csv = await build(conn).exportCsv(ctx(), {});
      const [head, row] = csv.trim().split('\r\n');
      expect(head.split(',')).toContain('barcodes');
      expect(row).toContain('"Sugar, white"');
      expect(row.endsWith('6290000000017')).toBe(true);
    });

    it('checks visibility before returning the timeline', async () => {
      const conn = fakeConn([userCompany(CO_A), [/WHERE p.id = \$1/, () => [product({ company_id: CO_B })]]]);
      await expect(build(conn).timelineFor(ctx(), P1, {})).rejects.toBeInstanceOf(NotFoundException);
      expect(timeline.list).not.toHaveBeenCalled();
    });
  });
});
