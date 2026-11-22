import { DEAL_FIELDS, LEAD_FIELDS, leadStatusOf, normalizeHeader, parseAmount, parseCsv, parseDate, phoneKey, suggestMapping } from './crm-import';
import { CrmImportService, readSheet } from './crm-import.service';
import { CrmSetupService } from './crm-setup.service';
import type { ContactsService } from '../contacts/contacts.service';
import type { CatalogContext } from '../products/products.service';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

describe('CRM import helpers', () => {
  it('reads CSV with quotes, line breaks, semicolons and a BOM', () => {
    expect(parseCsv('﻿Name,Note\r\n"Abebe, Trading","said ""yes""\nthen left"\r\n\r\n')).toEqual([['Name', 'Note'], ['Abebe, Trading', 'said "yes"\nthen left']]);
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('matches columns to fields by name and common aliases', () => {
    expect(normalizeHeader(' Owner E-mail ')).toBe('owneremail');
    const m = suggestMapping(['Company', 'Contact Name', 'Phone', 'E-mail', 'Lead Source', 'Salesperson'], LEAD_FIELDS);
    expect(m).toMatchObject({ company_name: 0, person_name: 1, phone: 2, email: 3, source: 4, owner_email: 5 });
    expect(suggestMapping(['Deal', 'Client', 'Amount', 'Close Date'], DEAL_FIELDS)).toMatchObject({ name: 0, customer: 1, expected_revenue: 2, expected_close_date: 3 });
  });

  it('reads amounts, dates, phones and statuses the way people type them', () => {
    expect(parseAmount('ETB 1,250.50')).toBe(1250.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNaN();
    expect(parseDate('31/12/2026')).toBe('2026-12-31');
    expect(parseDate('2026-02-30')).toBe('invalid');
    expect(parseDate('46387')).toBe('2026-12-31');
    expect(parseDate('')).toBeNull();
    expect(phoneKey('+251 911 234 567')).toBe(phoneKey('0911234567'));
    expect(leadStatusOf('Qualified ')).toBe('qualified');
    expect(leadStatusOf('')).toBe('new');
    expect(leadStatusOf('won')).toBeNull();
  });
});

describe('CRM import', () => {
  type Route = [RegExp, (p: unknown[]) => unknown];
  const fakeConn = (routes: Route[]) => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      for (const [re, fn] of routes) if (re.test(sql)) return fn(params);
      return [];
    });
    return { query, transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn({ query })), calls };
  };
  const ctx: CatalogContext = { tenantId: 't1', user: { sub: 'u1', email: '', tenantId: 't1', tenantSlug: 't', role: 'admin', permissions: [] } };
  const build = (conn: ReturnType<typeof fakeConn>) => {
    const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
    const timeline = { record: jest.fn() } as unknown as ActivityTimelineService;
    return new CrmImportService(db, timeline, new CrmSetupService(db, timeline), {} as ContactsService);
  };
  const csv = (text: string) => ({ data: Buffer.from(text), filename: 'leads.csv' });
  const routes: Route[] = [
    [/SELECT company_id FROM users/, () => [{ company_id: null }]],
    [/FROM crm_lead_sources WHERE is_active/, () => [{ id: 's-web', name: 'Website' }]],
    [/FROM users WHERE lower\(email\)/, () => [{ id: 'u-sara', email: 'sara@shop.et' }]],
    [/FROM crm_leads WHERE is_active/, () => [{ email: 'old@x.et', phone: '0911000000', mobile: null }]],
    [/INSERT INTO crm_leads/, () => [{ id: 'new-lead' }]],
  ];

  it('previews the columns it found', async () => {
    const res = await build(fakeConn(routes)).run(ctx, 'leads', csv('Company,Phone\nAbebe Trading,0911\n'), 'preview');
    expect(res).toMatchObject({ headers: ['Company', 'Phone'], total: 1, mapping: { company_name: 0, phone: 1 } });
  });

  it('checks every row: bad email, unknown source and owner, duplicates in the file and in the CRM', async () => {
    const file = csv([
      'Title,Person,Email,Phone,Source,Owner,Status',
      'Chairs,Sara,sara@a.et,0911111111,Website,sara@shop.et,Contacted',
      'Desks,Abel,not-an-email,,Website,,',
      'Tables,Lia,,,Fair,,',
      'Again,Sam,,+251 911 111 111,,,',
      'Old,Tom,old@x.et,,,,',
      'Boss,Kal,,,,nobody@shop.et,Won',
    ].join('\n'));
    const res = await build(fakeConn(routes)).run(ctx, 'leads', file, 'check') as unknown as { ready: number; duplicates: number; problems: { row: number; messages: string[] }[] };
    expect(res.ready).toBe(1);
    expect(res.duplicates).toBe(2);
    const byRow = Object.fromEntries(res.problems.map((p) => [p.row, p.messages.join(' | ')]));
    expect(byRow[3]).toMatch(/not an email/);
    expect(byRow[4]).toMatch(/Source "Fair" is not in CRM Set-up/);
    expect(byRow[5]).toMatch(/already exists/);
    expect(byRow[6]).toMatch(/already exists/);
    expect(byRow[7]).toMatch(/No active user signs in with nobody@shop.et/);
    expect(byRow[7]).toMatch(/must be New, Contacted or Qualified/);
  });

  it('imports the good rows, creating missing sources when asked', async () => {
    const conn = fakeConn([...routes, [/INSERT INTO crm_lead_sources/, () => [{ id: 's-fair' }]]]);
    const res = await build(conn).run(ctx, 'leads', csv('Company,Source\nAbebe Trading,Fair\n'), 'import', undefined, { create_missing_sources: true }) as unknown as { imported: number };
    expect(res.imported).toBe(1);
    const insert = conn.calls.find((c) => /INSERT INTO crm_leads/.test(c.sql))!;
    expect(insert.params.slice(0, 3)).toEqual(['Lead: Abebe Trading', null, 'Abebe Trading']);
    expect(insert.params[8]).toBe('s-fair');
    expect(insert.params[9]).toBe('u1');
  });

  it('refuses files that are not Excel or CSV', async () => {
    await expect(readSheet({ data: Buffer.from('x'), filename: 'a.pdf' })).rejects.toThrow(/Excel \(.xlsx\) or CSV/);
    await expect(readSheet(csv('Only,Header\n'))).rejects.toThrow(/at least one row/);
  });
});
