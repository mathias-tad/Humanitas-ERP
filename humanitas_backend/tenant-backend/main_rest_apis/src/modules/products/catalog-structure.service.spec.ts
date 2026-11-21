import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductCategoriesService } from './product-categories.service';
import { UomsService } from './uoms.service';
import type { CatalogContext } from './products.service';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

type Route = [RegExp, (params: unknown[]) => unknown];
function fakeConn(routes: Route[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const conn = {
    calls,
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      for (const [re, fn] of routes) if (re.test(sql)) return fn(params);
      return [];
    }),
    transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(conn)),
  };
  return conn;
}
const ctx: CatalogContext = { tenantId: 't1', user: { sub: 'u1', email: '', tenantId: 't1', tenantSlug: 't', role: 'admin' } };
const timeline = () => ({ record: jest.fn(), recordChanges: jest.fn() });
const db = (conn: unknown) => ({ getTenantConnectionById: jest.fn().mockResolvedValue(conn) }) as unknown as DatabaseService;
const C1 = 'cccccccc-0000-0000-0000-000000000001';
const C2 = 'cccccccc-0000-0000-0000-000000000002';

describe('ProductCategoriesService', () => {
  const svc = (conn: ReturnType<typeof fakeConn>, t = timeline()) =>
    new ProductCategoriesService(db(conn), t as unknown as ActivityTimelineService);
  const users: Route = [/SELECT company_id FROM users/, () => [{ company_id: null }]];

  it('creates a subcategory under a visible parent and logs it', async () => {
    const t = timeline();
    const conn = fakeConn([users, [/SELECT \* FROM product_categories WHERE id/, () => [{ id: C1, company_id: null }]],
      [/INSERT INTO product_categories/, (p) => [{ id: C2, name: p[0], parent_id: p[1] }]]]);
    const row = await svc(conn, t).create(ctx, { name: ' Grains ', parent_id: C1 });
    expect(row).toMatchObject({ id: C2, name: 'Grains', parent_id: C1 });
    expect(t.record).toHaveBeenCalledWith('t1', expect.objectContaining({ entityType: 'product_category', eventType: 'created' }));
  });

  it('rejects a missing parent', async () => {
    await expect(svc(fakeConn([users])).create(ctx, { name: 'x', parent_id: C1 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to move a category under itself or its own subcategory', async () => {
    const own = fakeConn([users, [/SELECT \* FROM product_categories WHERE id/, () => [{ id: C1, company_id: null }]]]);
    await expect(svc(own).update(ctx, C1, { parent_id: C1 })).rejects.toBeInstanceOf(BadRequestException);
    const loop = fakeConn([users, [/SELECT \* FROM product_categories WHERE id/, () => [{ id: C1, company_id: null }]],
      [/WITH RECURSIVE up/, () => [{ '?column?': 1 }]]]);
    await expect(svc(loop).update(ctx, C1, { parent_id: C2 })).rejects.toThrow(/own subcategories/);
  });

  it('refuses to archive a category with active subcategories', async () => {
    const conn = fakeConn([users, [/SELECT \* FROM product_categories WHERE id/, () => [{ id: C1, company_id: null }]],
      [/WHERE parent_id = \$1 AND is_active/, () => [{ '?column?': 1 }]]]);
    await expect(svc(conn).archive(ctx, C1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a duplicate sibling name to 409', async () => {
    const conn = fakeConn([users, [/INSERT INTO product_categories/, () => {
      throw Object.assign(new Error('dup'), { code: '23505', constraint: 'uq_product_categories_sibling_name' });
    }]]);
    await expect(svc(conn).create(ctx, { name: 'Food' })).rejects.toThrow('A category with this name already exists at this level');
  });
});

describe('UomsService', () => {
  const U = 'aaaaaaaa-0000-0000-0000-000000000009';
  const svc = (conn: ReturnType<typeof fakeConn>) => new UomsService(db(conn), timeline() as unknown as ActivityTimelineService);

  it('creates a unit category together with its reference unit', async () => {
    const conn = fakeConn([[/INSERT INTO uom_categories/, () => [{ id: 'cat', name: 'Packaging' }]],
      [/INSERT INTO uoms/, (p) => [{ id: 'ref', name: p[1], ratio: 1, is_reference: true }]]]);
    const res = await svc(conn).createCategory(ctx, { name: 'Packaging', reference_unit: 'Sack' });
    expect(res.units[0]).toMatchObject({ name: 'Sack', is_reference: true });
    expect(conn.transaction).toHaveBeenCalled();
  });

  it('protects the reference unit', async () => {
    const conn = fakeConn([[/SELECT \* FROM uoms WHERE id/, () => [{ id: U, is_reference: true, ratio: '1' }]]]);
    await expect(svc(conn).update(ctx, U, { ratio: 2 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc(conn).archive(ctx, U)).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to change the ratio of a unit that products use', async () => {
    const conn = fakeConn([[/SELECT \* FROM uoms WHERE id/, () => [{ id: U, is_reference: false, ratio: '100' }]],
      [/FROM products WHERE is_active AND/, () => [{ '?column?': 1 }]],
      [/^UPDATE uoms SET/, (p) => [{ id: U, name: p[0] }]]]);
    await expect(svc(conn).update(ctx, U, { ratio: 50 })).rejects.toThrow(/create a new unit/);
    await expect(svc(conn).update(ctx, U, { name: 'Quintal (100 kg)' })).resolves.toEqual({ id: U, name: 'Quintal (100 kg)' });
  });

  it('rejects a unit in an unknown category', async () => {
    await expect(svc(fakeConn([])).create(ctx, { category_id: U, name: 'x', ratio: 1 })).rejects.toThrow('Unit category not found');
  });

  describe('MoR unit codes (rule 28)', () => {
    const codes: Route = [/FROM eims_codes WHERE list_name = 'unit' AND code = \$1/, (p) => (['PCS', 'KLG', 'ROL'].includes(p[0] as string) ? [{ '?column?': 1 }] : [])];

    it('stores an upper-cased MoR code on a new unit and refuses unknown codes', async () => {
      const conn = fakeConn([[/FROM uom_categories WHERE id/, () => [{ id: 'cat' }]], codes,
        [/INSERT INTO uoms/, (p) => [{ id: U, name: p[1], mor_code: p[6] }]]]);
      await expect(svc(conn).create(ctx, { category_id: 'cat', name: 'Roll', ratio: 1, mor_code: ' rol ' })).resolves.toMatchObject({ mor_code: 'ROL' });
      await expect(svc(conn).create(ctx, { category_id: 'cat', name: 'Box', ratio: 1, mor_code: 'BOX' })).rejects.toThrow('BOX is not a MoR unit code');
    });

    it('sets and clears the MoR code on update', async () => {
      const conn = fakeConn([[/SELECT \* FROM uoms WHERE id/, () => [{ id: U, is_reference: false, ratio: '1' }]], codes,
        [/^UPDATE uoms SET/, (p) => [{ id: U, sql: p }]]]);
      await svc(conn).update(ctx, U, { mor_code: 'pcs' });
      expect(conn.calls.at(-1)!.sql).toContain('mor_code = $1');
      expect(conn.calls.at(-1)!.params).toEqual(['PCS', U]);
      await svc(conn).update(ctx, U, { mor_code: null });
      expect(conn.calls.at(-1)!.params).toEqual([null, U]);
    });

    it('gives the reference unit of a new category its MoR code', async () => {
      const conn = fakeConn([codes, [/INSERT INTO uom_categories/, () => [{ id: 'cat', name: 'Weight 2' }]],
        [/INSERT INTO uoms/, (p) => [{ id: 'ref', name: p[1], mor_code: p[4] }]]]);
      const res = await svc(conn).createCategory(ctx, { name: 'Weight 2', reference_unit: 'kilo', reference_mor_code: 'KLG' });
      expect(res.units[0].mor_code).toBe('KLG');
    });
  });
});
