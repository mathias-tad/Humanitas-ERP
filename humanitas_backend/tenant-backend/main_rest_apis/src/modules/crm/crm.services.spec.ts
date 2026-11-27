import { BadRequestException } from '@nestjs/common';
import { CrmSetupService } from './crm-setup.service';
import { CrmOpportunitiesService } from './crm-opportunities.service';
import { CrmLeadsService } from './crm-leads.service';
import { CrmActivitiesService } from './crm-activities.service';
import type { ContactsService } from '../contacts/contacts.service';
import type { CatalogContext } from '../../common/records/record-context';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

const PIPE = 'aaaaaaaa-0000-0000-0000-00000000aa01';
const S_NEW = 'aaaaaaaa-0000-0000-0000-00000000bb01';
const S_PROP = 'aaaaaaaa-0000-0000-0000-00000000bb02';
const S_WON = 'aaaaaaaa-0000-0000-0000-00000000bb03';
const S_LOST = 'aaaaaaaa-0000-0000-0000-00000000bb04';
const DEAL = 'aaaaaaaa-0000-0000-0000-00000000cc01';
const LEAD = 'aaaaaaaa-0000-0000-0000-00000000dd01';
const REASON = 'aaaaaaaa-0000-0000-0000-00000000ee01';
const CONTACT = 'aaaaaaaa-0000-0000-0000-00000000ff01';
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
const stages = [
  { id: S_NEW, pipeline_id: PIPE, name: 'New', probability: 10, rotting_days: 7, is_won: false, is_lost: false, sort_order: 1, is_active: true },
  { id: S_PROP, pipeline_id: PIPE, name: 'Proposal', probability: 50, rotting_days: 14, is_won: false, is_lost: false, sort_order: 2, is_active: true },
  { id: S_WON, pipeline_id: PIPE, name: 'Won', probability: 100, rotting_days: null, is_won: true, is_lost: false, sort_order: 3, is_active: true },
  { id: S_LOST, pipeline_id: PIPE, name: 'Lost', probability: 0, rotting_days: null, is_won: false, is_lost: true, sort_order: 4, is_active: true },
];
const deal = (over: Record<string, unknown> = {}) => ({
  id: DEAL, name: 'Office chairs', status: 'open', pipeline_id: PIPE, stage_id: S_NEW, stage_name: 'New', stage_probability: 10, rotting_days: 7,
  probability: null, expected_revenue: '20000.00', stage_changed_at: new Date(Date.now() - 3 * 86_400_000).toISOString(), company_id: null,
  contact_id: CONTACT, is_active: true, ...over,
});
const base: Route[] = [
  [/FROM crm_pipelines p WHERE p.is_active/, () => [{ id: PIPE, name: 'Sales pipeline', is_default: true, company_id: null, is_active: true }]],
  [/SELECT \* FROM crm_pipelines WHERE id/, () => [{ id: PIPE, name: 'Sales pipeline', is_default: true, company_id: null, is_active: true }]],
  [/FROM crm_stages WHERE pipeline_id = \$1 AND is_active/, () => stages],
  [/FROM crm_lost_reasons WHERE id/, () => [{ id: REASON, is_active: true }]],
  [/FROM contacts WHERE id = \$1/, () => [{ id: CONTACT, company_id: null, is_active: true, contact_type: 'company', parent_id: null }]],
  [/FROM users WHERE id/, () => [{ id: 'u1' }]],
];

function services(conn: ReturnType<typeof fakeConn>, contacts?: Partial<ContactsService>) {
  const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
  const timeline = { record: jest.fn(), recordChanges: jest.fn(), list: jest.fn() } as unknown as ActivityTimelineService;
  const setup = new CrmSetupService(db, timeline);
  const deals = new CrmOpportunitiesService(db, timeline, setup);
  const leads = new CrmLeadsService(db, timeline, deals, (contacts ?? {}) as ContactsService);
  const activities = new CrmActivitiesService(db, timeline);
  return { setup, deals, leads, activities, timeline: timeline as unknown as { record: jest.Mock } };
}

describe('CRM opportunities', () => {
  it('creates a deal in the first open stage of the default pipeline', async () => {
    const conn = fakeConn([...base, [/INSERT INTO crm_opportunities/, () => [{ id: DEAL }]], [/FROM crm_opportunities o\s+JOIN crm_stages s[\s\S]*WHERE o.id/, () => [deal()]]]);
    const r = await services(conn).deals.create(ctx, { name: 'Office chairs', contact_id: CONTACT, expected_revenue: 20000 });
    const insert = conn.calls.find((c) => /INSERT INTO crm_opportunities/.test(c.sql))!;
    expect(insert.params[3]).toBe(PIPE);
    expect(insert.params[4]).toBe(S_NEW);
    expect(insert.params[10]).toBe('open');
    expect(r).toMatchObject({ effective_probability: 10, weighted_revenue: 2000, days_in_stage: 3, is_stuck: false });
  });

  it('wins on a won stage, asks for the reason on a lost one, and keeps the time in each stage', async () => {
    const conn = fakeConn([...base, [/FROM crm_opportunities o\s+JOIN crm_stages s[\s\S]*WHERE o.id/, () => [deal()]]]);
    const { deals, timeline } = services(conn);
    await deals.moveStage(ctx, DEAL, S_WON);
    const upd = conn.calls.find((c) => /UPDATE crm_opportunities SET stage_id/.test(c.sql))!;
    expect(upd.params.slice(0, 2)).toEqual([S_WON, 'won']);
    expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({ eventType: 'stage_changed', summary: 'Won (after 3 days in New)' }));
    await expect(deals.moveStage(ctx, DEAL, S_LOST)).rejects.toThrow(/reason/);
    await deals.markLost(ctx, DEAL, { lost_reason_id: REASON, note: 'Too expensive' });
    const lost = conn.calls.filter((c) => /UPDATE crm_opportunities SET stage_id/.test(c.sql)).pop()!;
    expect(lost.params.slice(0, 4)).toEqual([S_LOST, 'lost', REASON, 'Too expensive']);
  });

  it('shows a deal as stuck once it stays longer than its stage allows', () => {
    const d = CrmOpportunitiesService.decorate(deal({ stage_changed_at: new Date(Date.now() - 10 * 86_400_000).toISOString(), probability: 40 }) as never);
    expect(d).toMatchObject({ is_stuck: true, effective_probability: 40, weighted_revenue: 8000 });
  });
});

describe('CRM leads', () => {
  const lead = (over: Record<string, unknown> = {}) => ({
    id: LEAD, code: 'L000001', title: 'Chairs for new office', status: 'qualified', company_id: null, person_name: 'Sara', company_name: 'Abebe Trading',
    job_title: 'Buyer', email: 'sara@abebe.et', phone: '0911234567', mobile: null, city: 'Addis Ababa', owner_id: 'u1', source_id: null,
    expected_revenue: '20000.00', converted_contact_name: 'Abebe Trading', converted_opportunity_name: 'Chairs for new office', ...over,
  });

  it('refuses moves that need their own action', async () => {
    const conn = fakeConn([[/FROM crm_leads l[\s\S]*WHERE l.id/, () => [lead({ status: 'new' })]]]);
    await expect(services(conn).leads.update(ctx, LEAD, { status: 'converted' } as never)).rejects.toThrow(/Convert/);
  });

  it('converts into a customer company with the person and a deal, moving open activities to the deal', async () => {
    const conn = fakeConn([
      ...base,
      [/FROM crm_leads l[\s\S]*WHERE l.id/, () => [lead()]],
      [/INSERT INTO crm_opportunities/, () => [{ id: DEAL }]],
      [/FROM crm_opportunities o\s+JOIN crm_stages s[\s\S]*WHERE o.id/, () => [deal()]],
    ]);
    const create = jest.fn().mockResolvedValue({ id: CONTACT, people: [{ id: 'person-1' }] });
    const { leads } = services(conn, { create } as never);
    await leads.convert(ctx, LEAD, {});
    expect(create).toHaveBeenCalledWith(ctx, expect.objectContaining({
      name: 'Abebe Trading', contact_type: 'company', is_customer: true, people: [expect.objectContaining({ name: 'Sara', job_title: 'Buyer' })],
    }));
    const insert = conn.calls.find((c) => /INSERT INTO crm_opportunities/.test(c.sql))!;
    expect(insert.params.slice(0, 3)).toEqual(['Chairs for new office', CONTACT, 'person-1']);
    const converted = conn.calls.find((c) => /SET status = 'converted'/.test(c.sql))!;
    expect(converted.params.slice(0, 2)).toEqual([CONTACT, DEAL]);
    const moved = conn.calls.find((c) => /UPDATE crm_activities SET related_type/.test(c.sql))!;
    expect(moved.params).toEqual(['opportunity', DEAL, LEAD]);
  });
});

describe('CRM activities and set-up', () => {
  it('logs a done call on the deal history', async () => {
    const act = { id: 'a1', activity_type: 'call', subject: 'Follow up the quote', related_type: 'opportunity', related_id: DEAL, done_at: null, company_id: null, is_active: true };
    const conn = fakeConn([[/FROM crm_activities a[\s\S]*WHERE a.id/, () => [act]]]);
    const { activities, timeline } = services(conn);
    await activities.complete(ctx, 'a1', { outcome: 'They will sign Monday' });
    expect(timeline.record).toHaveBeenCalledWith('t1', expect.objectContaining({
      entityType: 'crm_opportunity', entityId: DEAL, eventType: 'interaction', summary: 'Call done: Follow up the quote — They will sign Monday',
    }));
  });

  it('needs both what the activity is about and which one', async () => {
    await expect(services(fakeConn([[/FROM users WHERE id/, () => [{ id: 'u1' }]]])).activities.create(ctx, {
      activity_type: 'call', subject: 'x', due_at: '2026-11-23T09:00:00Z', related_type: 'lead',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps a won and a lost stage, and stages with open deals', async () => {
    const withDeals = fakeConn([
      [/SELECT s.\*, p.company_id, p.branch_id FROM crm_stages s/, () => [stages[1]]],
      [/FROM crm_opportunities WHERE stage_id = \$1/, () => [{ n: 2 }]],
    ]);
    await expect(services(withDeals).setup.archiveStage(ctx, S_PROP)).rejects.toThrow(/2 open deals are in Proposal/);
    const onlyWon = fakeConn([
      [/SELECT s.\*, p.company_id, p.branch_id FROM crm_stages s/, () => [stages[2]]],
      [/FROM crm_opportunities WHERE stage_id = \$1/, () => [{ n: 0 }]],
      [/FROM crm_stages WHERE pipeline_id = \$1 AND is_active/, () => stages],
    ]);
    await expect(services(onlyWon).setup.archiveStage(ctx, S_WON)).rejects.toThrow('A pipeline needs a won stage');
  });
});
