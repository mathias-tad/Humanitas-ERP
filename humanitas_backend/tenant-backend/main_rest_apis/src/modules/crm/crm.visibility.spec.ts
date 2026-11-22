import { CrmLeadsService } from './crm-leads.service';
import { CrmOpportunitiesService } from './crm-opportunities.service';
import { CrmActivitiesService } from './crm-activities.service';
import { CrmSetupService } from './crm-setup.service';
import { seesAllCrm, ownsCrmRow } from './crm.base';
import { VIEW_ALL_CRM_RECORDS } from './crm.permissions';
import type { ContactsService } from '../contacts/contacts.service';
import type { CatalogContext } from '../products/products.service';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';

const ME = 'aaaaaaaa-0000-0000-0000-0000000000a1';
const OTHER = 'aaaaaaaa-0000-0000-0000-0000000000b2';
const LEAD = 'aaaaaaaa-0000-0000-0000-0000000000c3';
type Route = [RegExp, (params: unknown[]) => unknown];

function fakeConn(routes: Route[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of routes) if (re.test(sql)) return fn(params);
    return [];
  });
  return { query, transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn({ query })), calls };
}
const ctxFor = (role: string, permissions: string[] = []): CatalogContext => ({
  tenantId: 't1', user: { sub: ME, email: '', tenantId: 't1', tenantSlug: 't', role, permissions },
});
function services(conn: ReturnType<typeof fakeConn>) {
  const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
  const timeline = { record: jest.fn(), recordChanges: jest.fn(), list: jest.fn() } as unknown as ActivityTimelineService;
  const setup = new CrmSetupService(db, timeline);
  const deals = new CrmOpportunitiesService(db, timeline, setup);
  return { leads: new CrmLeadsService(db, timeline, deals, {} as ContactsService), deals, activities: new CrmActivitiesService(db, timeline) };
}
const base: Route[] = [[/SELECT company_id FROM users/, () => [{ company_id: null }]], [/FROM companies/, () => [{ id: 'c1' }]]];

describe('CRM record visibility (own records unless view_all_crm_records)', () => {
  it('owners, admins and holders of the permission see everyone\'s records', () => {
    expect(seesAllCrm({ role: 'admin', permissions: [] })).toBe(true);
    expect(seesAllCrm({ role: 'owner', permissions: [] })).toBe(true);
    expect(seesAllCrm({ role: 'staff', permissions: [VIEW_ALL_CRM_RECORDS] })).toBe(true);
    expect(seesAllCrm({ role: 'staff', permissions: ['view_crm_leads'] })).toBe(false);
    expect(ownsCrmRow({ mine: ME }, { owner_id: OTHER, created_by: ME })).toBe(true);
    expect(ownsCrmRow({ mine: ME }, { owner_id: OTHER, created_by: OTHER })).toBe(false);
    expect(ownsCrmRow({ mine: null }, { owner_id: OTHER, created_by: OTHER })).toBe(true);
  });

  it('limits a salesperson\'s lead list to leads they own or created', async () => {
    const conn = fakeConn([...base, [/count\(\*\)::int AS total/, () => [{ total: 0 }]]]);
    await services(conn).leads.list(ctxFor('staff', ['view_crm_leads']), {});
    const list = conn.calls.find((c) => /AS total FROM crm_leads/.test(c.sql))!;
    expect(list.sql).toMatch(/\(l\.owner_id = \$\d+ OR l\.created_by = \$\d+\)/);
    expect(list.params).toContain(ME);
  });

  it('does not limit a manager with view_all_crm_records', async () => {
    const conn = fakeConn([...base, [/count\(\*\)::int AS total/, () => [{ total: 0 }]]]);
    await services(conn).deals.list(ctxFor('staff', ['view_crm_opportunities', VIEW_ALL_CRM_RECORDS]), {});
    const list = conn.calls.find((c) => /AS total FROM crm_opportunities/.test(c.sql))!;
    expect(list.sql).not.toMatch(/o\.owner_id = \$\d+ OR o\.created_by/);
  });

  it('hides a colleague\'s lead from a salesperson as not found', async () => {
    const conn = fakeConn([...base, [/FROM crm_leads l[\s\S]*WHERE l\.id/, () => [{ id: LEAD, company_id: null, owner_id: OTHER, created_by: OTHER, status: 'new' }]]]);
    await expect(services(conn).leads.get(ctxFor('staff', ['view_crm_leads']), LEAD)).rejects.toThrow('Lead not found');
    await expect(services(conn).leads.get(ctxFor('staff', ['view_crm_leads', VIEW_ALL_CRM_RECORDS]), LEAD)).resolves.toMatchObject({ id: LEAD });
  });

  it('shows activities assigned to me, created by me or on my own leads and deals', async () => {
    const conn = fakeConn([...base, [/count\(\*\)::int AS total/, () => [{ total: 0 }]]]);
    await services(conn).activities.list(ctxFor('staff', ['view_crm_activities']), { assigned_to: 'all' });
    const list = conn.calls.find((c) => /AS total FROM crm_activities/.test(c.sql))!;
    expect(list.sql).toMatch(/a\.assigned_to = \$\d+ OR a\.created_by = \$\d+/);
    expect(list.sql).toMatch(/FROM crm_leads x WHERE x\.id = a\.related_id/);
  });

  it('moves a deal with each SQL parameter used as one type only (PostgreSQL refuses mixed types)', async () => {
    const DEAL = 'aaaaaaaa-0000-0000-0000-0000000000d4';
    const STAGE = 'aaaaaaaa-0000-0000-0000-0000000000e5';
    const conn = fakeConn([
      ...base,
      [/FROM crm_opportunities o[\s\S]*WHERE o\.id/, () => [{ id: DEAL, name: 'Chairs', status: 'open', stage_id: 'old', stage_name: 'New', pipeline_id: 'p', company_id: null,
        owner_id: ME, created_by: ME, expected_revenue: '100', stage_probability: 10, stage_changed_at: new Date().toISOString(), rotting_days: null }]],
      [/FROM crm_stages WHERE pipeline_id = \$1 AND is_active/, () => [{ id: STAGE, name: 'Proposal', probability: 50, is_won: false, is_lost: false }]],
    ]);
    await services(conn).deals.moveStage(ctxFor('staff', ['edit_crm_opportunities']), DEAL, STAGE);
    const upd = conn.calls.find((c) => /UPDATE crm_opportunities SET stage_id/.test(c.sql))!;
    expect(upd.sql).not.toMatch(/WHEN \$2/);
    expect(upd.params[1]).toBe('open');
    expect(upd.params[6]).toBe(true);
  });
});
