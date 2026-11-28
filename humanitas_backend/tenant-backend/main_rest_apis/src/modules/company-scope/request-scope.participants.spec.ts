import { NotFoundException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { CompanyScopeInterceptor } from './company-scope.interceptor';
import type { CompanyScopeService } from './company-scope.service';
import type { UserScope } from './company-scope';
import type { DatabaseService } from '../database/database.service';
import { ScopedQueryRecord, ScopedRecord, scopeChecksOf } from './request-scope';

const A = '11111111-1111-1111-1111-111111111111';
const A1 = 'aaaaaaaa-1111-1111-1111-111111111111';
const A2 = 'aaaaaaaa-2222-2222-2222-222222222222';
const ME = '99999999-9999-9999-9999-999999999999';
const OTHER = '88888888-8888-8888-8888-888888888888';
const P_MANAGED = 'dddddddd-0000-0000-0000-000000000001';
const P_MEMBER = 'dddddddd-0000-0000-0000-000000000002';
const P_STRANGER = 'dddddddd-0000-0000-0000-000000000003';
const T_IN_MEMBER_PROJECT = 'eeeeeeee-0000-0000-0000-000000000001';

const PROJECT = { people: ['manager_id', 'created_by'], members: { table: 'pms_project_members', fk: 'project_id' } };
const TASK = { people: ['assignee_id'], members: { table: 'pms_project_members', fk: 'project_id', column: 'project_id' } };

describe('record checks for people who take part (rule 16)', () => {
  // The user works in branch A1 only; every record below sits in branch A2.
  const limited: UserScope = {
    allCompanies: false, allBranches: false, defaultCompanyId: A, defaultBranchId: A1,
    companies: [{ companyId: A, branchIds: [A1], isDefault: true }],
  };
  const rows: Record<string, Record<string, string | null>> = {
    [P_MANAGED]: { company_id: A, branch_id: A2, manager_id: ME, created_by: OTHER },
    [P_MEMBER]: { company_id: A, branch_id: A2, manager_id: OTHER, created_by: OTHER },
    [P_STRANGER]: { company_id: A, branch_id: A2, manager_id: OTHER, created_by: OTHER },
    [T_IN_MEMBER_PROJECT]: { company_id: A, branch_id: A2, assignee_id: OTHER, project_id: P_MEMBER },
  };
  const members = new Set([`${P_MEMBER}:${ME}`]);

  class Handlers {
    @ScopedRecord('pms_projects', 'id', PROJECT)
    project() { return 'ok'; }
    @ScopedRecord('pms_tasks', 'id', TASK)
    task() { return 'ok'; }
    @ScopedQueryRecord('pms_projects', 'projectId', PROJECT)
    sprints() { return 'ok'; }
  }

  const build = () => {
    const scopes = { forUser: jest.fn().mockResolvedValue(limited) } as unknown as CompanyScopeService;
    const conn = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (/FROM branches/.test(sql)) return (params[0] as string[]).map((id) => ({ id, company_id: A }));
        if (/FROM pms_project_members/.test(sql)) return members.has(`${params[0]}:${params[1]}`) ? [{ '?column?': 1 }] : [];
        const ids = params[0] as string[];
        return ids.filter((id) => rows[id]).map((id) => ({ id, ...rows[id] }));
      }),
    };
    const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
    return { interceptor: new CompanyScopeInterceptor(scopes, db), conn };
  };
  const ctx = (req: Record<string, unknown>, handler: () => unknown) =>
    ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler }) as never;
  const next = { handle: () => of('ok') };
  const req = (over: Record<string, unknown>) => ({ method: 'GET', user: { sub: ME, tenantId: 't1', role: 'staff' }, headers: {}, query: {}, ...over });

  it('lets the manager and the members open a project of another branch', async () => {
    const { interceptor } = build();
    await expect(lastValueFrom(await interceptor.intercept(ctx(req({ params: { id: P_MANAGED } }), Handlers.prototype.project), next))).resolves.toBe('ok');
    await expect(lastValueFrom(await interceptor.intercept(ctx(req({ params: { id: P_MEMBER } }), Handlers.prototype.project), next))).resolves.toBe('ok');
  });

  it('answers 404 to someone who takes no part', async () => {
    const { interceptor } = build();
    await expect(interceptor.intercept(ctx(req({ params: { id: P_STRANGER } }), Handlers.prototype.project), next)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('opens a task to the members of its project', async () => {
    const { interceptor, conn } = build();
    await expect(lastValueFrom(await interceptor.intercept(ctx(req({ params: { id: T_IN_MEMBER_PROJECT } }), Handlers.prototype.task), next))).resolves.toBe('ok');
    const select = conn.query.mock.calls.map((c) => c[0] as string).find((s) => s.includes('FROM pms_tasks'));
    expect(select).toContain('assignee_id::text AS assignee_id');
    expect(select).toContain('project_id::text AS project_id');
  });

  it('checks a record named in the query string', async () => {
    const { interceptor } = build();
    await expect(interceptor.intercept(ctx(req({ query: { projectId: P_STRANGER } }), Handlers.prototype.sprints), next)).rejects.toBeInstanceOf(NotFoundException);
    await expect(lastValueFrom(await interceptor.intercept(ctx(req({ query: { projectId: P_MEMBER } }), Handlers.prototype.sprints), next))).resolves.toBe('ok');
    expect(scopeChecksOf(Handlers.prototype.sprints)).toEqual([{ table: 'pms_projects', queryField: 'projectId', ...PROJECT }]);
  });

  it('refuses unsafe column names', () => {
    expect(() => ScopedRecord('pms_projects', 'id', { people: ['manager_id; drop'] })).toThrow(/invalid/);
    expect(() => ScopedRecord('pms_projects', 'id', { members: { table: 'x y', fk: 'project_id' } })).toThrow(/invalid/);
  });
});
