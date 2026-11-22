import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import type { CatalogContext } from '../products/products.service';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

const C1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const P1 = 'aaaaaaaa-0000-0000-0000-000000000002';
const K1 = 'aaaaaaaa-0000-0000-0000-0000000000c1';
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
  tenantId: 't1', user: { sub: 'u1', email: '', tenantId: 't1', tenantSlug: 't', role: 'admin', permissions: [] },
  client: { platform: 'web', device: 'desktop', info: {} },
};
const company = (over: Record<string, unknown> = {}) => ({ id: C1, code: 'C000001', name: 'Abebe Trading', contact_type: 'company', parent_id: null, tin: null, company_id: null, is_active: true, ...over });
const DETAIL = /FROM contacts c\s+LEFT JOIN contacts par[\s\S]*WHERE c.id = \$1/;

function build(conn: ReturnType<typeof fakeConn>) {
  const timeline = { record: jest.fn(), recordChanges: jest.fn(), list: jest.fn() };
  const svc = new ContactsService(
    { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService,
    timeline as unknown as ActivityTimelineService,
  );
  return { svc, timeline };
}

describe('ContactsService', () => {
  it('creates a customer company with its people, the first one as primary contact', async () => {
    let n = 0;
    const conn = fakeConn([[/INSERT INTO contacts/, () => [{ id: n++ === 0 ? C1 : `p${n}` }]], [DETAIL, () => [company({ is_customer: true })]]]);
    const { svc, timeline } = build(conn);
    await svc.create(ctx, { name: ' Abebe Trading ', is_customer: true, tin: '0012-345-678', email: 'Info@Abebe.ET', people: [{ name: 'Abebe' }, { name: 'Sara' }] });
    const inserts = conn.calls.filter((c) => /INSERT INTO contacts/.test(c.sql));
    expect(inserts).toHaveLength(3);
    expect(inserts[0].params).toEqual(expect.arrayContaining(['Abebe Trading', '0012345678', 'info@abebe.et', true, 'company']));
    const people = inserts.slice(1).map((c) => {
      const cols = c.sql.slice(c.sql.indexOf('(') + 1, c.sql.indexOf(')')).split(', ');
      return Object.fromEntries(cols.map((col, i) => [col, c.params[i]]));
    });
    expect(people.map((p) => [p.name, p.contact_type, p.parent_id, p.is_primary_contact])).toEqual([['Abebe', 'person', C1, true], ['Sara', 'person', C1, false]]);
    expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({ entityType: 'contact', eventType: 'created' }));
  });

  it('adds a person to a company and records it on the company too', async () => {
    const conn = fakeConn([
      [/SELECT id, name, contact_type, company_id, is_active FROM contacts WHERE id/, () => [{ id: C1, name: 'Abebe Trading', contact_type: 'company', company_id: null, is_active: true }]],
      [/SELECT count\(\*\)::int AS n FROM contacts WHERE parent_id/, () => [{ n: 0 }]],
      [/INSERT INTO contacts/, () => [{ id: P1 }]],
      [DETAIL, () => [company({ id: P1, contact_type: 'person', parent_id: C1, name: 'Sara' })]],
    ]);
    const { svc, timeline } = build(conn);
    await svc.create(ctx, { name: 'Sara', parent_id: C1, job_title: 'Buyer' });
    const insert = conn.calls.find((c) => /INSERT INTO contacts/.test(c.sql))!;
    expect(insert.params).toEqual(expect.arrayContaining(['person', C1, true, 'Buyer']));
    expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({ entityId: C1, summary: 'Sara added to the people at Abebe Trading' }));
  });

  it('keeps people under companies only', async () => {
    const person = fakeConn([[/SELECT id, name, contact_type, company_id, is_active FROM contacts WHERE id/, () => [{ id: P1, name: 'Sara', contact_type: 'person', company_id: null, is_active: true }]]]);
    await expect(build(person).svc.create(ctx, { name: 'Abel', parent_id: P1 })).rejects.toThrow(/Sara is a person/);
    await expect(build(fakeConn([])).svc.create(ctx, { name: 'X', contact_type: 'company', parent_id: C1 })).rejects.toThrow('Only a person belongs to a company');
  });

  it('refuses a wrong TIN and a TIN another contact already has (unless told to save anyway)', async () => {
    const conn = fakeConn([
      [/FROM contacts WHERE tin = \$1/, () => [{ id: 'other', code: 'C000009', name: 'Abebe PLC', company_id: null }]],
      [/INSERT INTO contacts/, () => [{ id: C1 }]],
      [DETAIL, () => [company()]],
    ]);
    const { svc } = build(conn);
    await expect(svc.create(ctx, { name: 'X', tin: '123' })).rejects.toThrow('A TIN is 10 digits');
    await expect(svc.create(ctx, { name: 'X', tin: '0012345678' })).rejects.toBeInstanceOf(ConflictException);
    await expect(svc.create(ctx, { name: 'X', tin: '0012345678', allow_duplicate: true })).resolves.toMatchObject({ id: C1 });
  });

  it('finds look-alike contacts by phone in any format', async () => {
    const conn = fakeConn([[/FROM contacts c\s+WHERE c.is_active AND/, () => [
      { id: 'c2', code: 'C000002', name: 'Sara Shop', tin: null, phone: '+251 911 234 567', mobile: null, email: null },
    ]]]);
    const { svc } = build(conn);
    expect(await svc.duplicates(ctx, { phone: '0911234567' })).toEqual([expect.objectContaining({ id: 'c2', reason: 'same phone' })]);
    expect(await svc.duplicates(ctx, {})).toEqual([]);
  });

  it('logs a call with one of the company people on both histories, but nothing in the future', async () => {
    const conn = fakeConn([
      [DETAIL, () => [company()]],
      [/SELECT id, name FROM contacts WHERE id = \$1 AND parent_id/, () => [{ id: P1, name: 'Sara' }]],
    ]);
    const { svc, timeline } = build(conn);
    await svc.addInteraction(ctx, C1, { kind: 'call', summary: 'Asked for a quote', direction: 'inbound', person_id: P1 });
    expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({ entityId: C1, eventType: 'interaction', summary: 'Call with Sara: Asked for a quote' }));
    expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({ entityId: P1, summary: 'Call (Abebe Trading): Asked for a quote' }));
    await expect(svc.addInteraction(ctx, C1, { kind: 'call', summary: 'x', occurred_at: '2999-01-01T00:00:00Z' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('will not turn a company with people into a person, nor archive a used category', async () => {
    const conn = fakeConn([[DETAIL, () => [company()]], [/SELECT count\(\*\)::int AS n FROM contacts WHERE parent_id/, () => [{ n: 2 }]]]);
    await expect(build(conn).svc.update(ctx, C1, { contact_type: 'person' })).rejects.toThrow(/has 2 people/);
    const cats = fakeConn([
      [/FROM contact_categories WHERE id/, () => [{ id: K1, name: 'Retail', company_id: null, is_active: true }]],
      [/FROM contacts WHERE category_id/, () => [{ n: 3 }]],
    ]);
    await expect(build(cats).svc.archiveCategory(ctx, K1)).rejects.toThrow(/3 active contacts/);
  });

  it('reports a missing contact', async () => {
    await expect(build(fakeConn([])).svc.get(ctx, C1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
