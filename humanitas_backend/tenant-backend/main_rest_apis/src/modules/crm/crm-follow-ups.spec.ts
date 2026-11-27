import { BadRequestException } from '@nestjs/common';
import { CrmFollowUpsService, followUpSummary, ordinal } from './crm-follow-ups.service';
import type { CatalogContext } from '../../common/records/record-context';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

const LEAD = 'aaaaaaaa-0000-0000-0000-0000000000a1';
const DEAL = 'aaaaaaaa-0000-0000-0000-0000000000b2';
const CUSTOMER = 'aaaaaaaa-0000-0000-0000-0000000000c3';
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
  const timeline = { record: jest.fn().mockResolvedValue({ id: 'ev1' }), list: jest.fn() };
  const svc = new CrmFollowUpsService({ getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService, timeline as unknown as ActivityTimelineService);
  return { svc, timeline };
};
const base: Route[] = [
  [/SELECT company_id FROM users/, () => [{ company_id: null }]],
  [/FROM crm_leads WHERE id = \$1/, () => [{ id: LEAD, company_id: null, owner_id: 'u1', created_by: 'u1', is_active: true, contact_count: 1, status: 'contacted', name: 'Chairs' }]],
  [/FROM crm_opportunities WHERE id = \$1/, () => [{ id: DEAL, company_id: null, owner_id: 'u1', created_by: 'u1', is_active: true, contact_count: 0, status: 'open', name: 'Chairs', contact_id: CUSTOMER }]],
  [/INSERT INTO crm_activities/, () => [{ id: 'next1' }]],
];

describe('CRM follow-ups', () => {
  it('numbers contacts and words them plainly', () => {
    expect([1, 2, 3, 4, 11, 12, 21, 22, 23].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '21st', '22nd', '23rd']);
    expect(followUpSummary({ channel: 'telegram', direction: 'inbound', duration_minutes: 5, with_whom: 'Sara', outcome: 'Wants a quote by Friday' }, 2))
      .toBe('2nd contact · Telegram from them (5 min) with Sara: Wants a quote by Friday');
    expect(followUpSummary({ channel: 'note', outcome: 'Prefers mornings' }, null)).toBe('Note: Prefers mornings');
  });

  it('logs the 2nd contact on a lead, keeps the last contact and plans the next step', async () => {
    const conn = fakeConn(base);
    const { svc, timeline } = build(conn);
    const res = await svc.log(ctx, 'lead', LEAD, {
      channel: 'call', direction: 'outbound', outcome: 'Will decide Monday',
      next: { activity_type: 'call', subject: 'Call back for the decision', due_at: '2099-01-05T09:00:00Z' },
    });
    expect(res.sequence).toBe(2);
    const upd = conn.calls.find((c) => /SET contact_count = contact_count \+ 1/.test(c.sql))!;
    expect(upd.params[1]).toBe('call');
    expect(conn.calls.some((c) => /INSERT INTO crm_activities/.test(c.sql))).toBe(true);
    expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({
      entityType: 'crm_lead', entityId: LEAD, eventType: 'interaction', summary: '2nd contact · Call by us: Will decide Monday',
      payload: expect.objectContaining({ channel: 'call', sequence: 2 }),
    }));
  });

  it('puts a deal follow-up on the customer history too, and a note is not counted as a contact', async () => {
    const conn = fakeConn(base);
    const { svc, timeline } = build(conn);
    await svc.log(ctx, 'opportunity', DEAL, { channel: 'note', outcome: 'Prefers mornings' });
    expect(conn.calls.some((c) => /contact_count = contact_count \+ 1/.test(c.sql))).toBe(false);
    expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({ entityType: 'contact', entityId: CUSTOMER, eventType: 'note' }));
  });

  it('refuses a follow-up in the future', async () => {
    const { svc } = build(fakeConn(base));
    await expect(svc.log(ctx, 'lead', LEAD, { channel: 'call', outcome: 'x', occurred_at: '2099-01-01T00:00:00Z' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
