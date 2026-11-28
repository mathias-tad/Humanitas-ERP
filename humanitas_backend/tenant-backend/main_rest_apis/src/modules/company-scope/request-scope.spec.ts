import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { CompanyScopeInterceptor } from './company-scope.interceptor';
import type { CompanyScopeService } from './company-scope.service';
import type { UserScope } from './company-scope';
import type { DatabaseService } from '../database/database.service';
import {
  ScopedRecord, ScopedRecords, ScopedUser, newRecordScope, requestScope, scopeChecksOf, scopeWhere, scopedIds, inScope,
} from './request-scope';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';
const A1 = 'aaaaaaaa-1111-1111-1111-111111111111';
const A2 = 'aaaaaaaa-2222-2222-2222-222222222222';
const B1 = 'bbbbbbbb-1111-1111-1111-111111111111';
const U = '99999999-9999-9999-9999-999999999999';
const R1 = 'cccccccc-0000-0000-0000-000000000001';
const R2 = 'cccccccc-0000-0000-0000-000000000002';
const R3 = 'cccccccc-0000-0000-0000-000000000003';

describe('request scope (rule 16)', () => {
  it('reads the company and branch the interceptor left in the headers', () => {
    expect(requestScope({ headers: { 'x-company-id': `${A}, ${B}`, 'x-branch-id': A1 } })).toEqual({ companyIds: [A, B], branchIds: [A1] });
    expect(requestScope({ headers: { 'x-company-id': 'junk' } })).toEqual({ companyIds: null, branchIds: null });
    expect(requestScope({ headers: {} })).toEqual({ companyIds: null, branchIds: null });
    expect(requestScope(undefined)).toEqual({ companyIds: null, branchIds: null });
  });

  it('filters on company and branch, keeps shared rows, and numbers after existing params', () => {
    const params: unknown[] = ['pending'];
    expect(scopeWhere({ companyIds: [A], branchIds: [A1] }, 'lr', params)).toBe(
      ' AND (lr.company_id IS NULL OR lr.company_id = ANY($2::uuid[])) AND (lr.branch_id IS NULL OR lr.branch_id = ANY($3::uuid[]))',
    );
    expect(params).toEqual(['pending', [A], [A1]]);
    const only: unknown[] = [];
    expect(scopeWhere({ companyIds: [B], branchIds: null }, 'e', only)).toBe(' AND (e.company_id IS NULL OR e.company_id = ANY($1::uuid[]))');
    const none: unknown[] = [];
    expect(scopeWhere({ companyIds: null, branchIds: null }, 'e', none)).toBe('');
    expect(scopeWhere(undefined, 'e', none)).toBe('');
    expect(none).toEqual([]);
    expect(() => scopeWhere({ companyIds: [A], branchIds: null }, 'e; drop', [])).toThrow(/alias/);
  });

  it('puts a new set-up row in the one company/branch picked, else shares it', () => {
    expect(newRecordScope({ companyIds: [A], branchIds: [A1] })).toEqual({ company_id: A, branch_id: A1 });
    expect(newRecordScope({ companyIds: [A], branchIds: null })).toEqual({ company_id: A, branch_id: null });
    expect(newRecordScope({ companyIds: [A, B], branchIds: null })).toEqual({ company_id: null, branch_id: null });
    expect(newRecordScope(undefined)).toEqual({ company_id: null, branch_id: null });
    expect(inScope({ companyIds: [A], branchIds: [A1] }, { company_id: A, branch_id: A2 })).toBe(false);
    expect(inScope({ companyIds: [A], branchIds: [A1] }, { company_id: null, branch_id: null })).toBe(true);
  });

  it('lists the ids in scope for ORM lists, or null for no filter', async () => {
    const conn = { query: jest.fn().mockResolvedValue([{ id: R1 }]) };
    expect(await scopedIds(conn, 'pms_projects', { companyIds: null, branchIds: null })).toBeNull();
    expect(conn.query).not.toHaveBeenCalled();
    expect(await scopedIds(conn, 'pms_projects', { companyIds: [A], branchIds: null })).toEqual(new Set([R1]));
    expect(conn.query.mock.calls[0][0]).toContain('FROM pms_projects t WHERE true AND (t.company_id IS NULL');
    expect(conn.query.mock.calls[0][1]).toEqual([[A]]);
    const open = jest.fn().mockResolvedValue(conn);
    expect(await scopedIds(open, 'pms_tasks', undefined)).toBeNull();
    expect(open).not.toHaveBeenCalled();
    expect(await scopedIds(open, 'pms_tasks', { companyIds: null, branchIds: [A1] })).toEqual(new Set([R1]));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('records the checks a handler asks for', () => {
    class C1 {
      @ScopedRecord('leave_requests')
      @ScopedUser()
      one() { return 1; }
      @ScopedRecords('overtime_entries')
      many() { return 2; }
      plain() { return 3; }
    }
    expect(scopeChecksOf(C1.prototype.one)).toEqual([{ table: 'users', param: 'userId' }, { table: 'leave_requests', param: 'id' }]);
    expect(scopeChecksOf(C1.prototype.many)).toEqual([{ table: 'overtime_entries', bodyField: 'ids' }]);
    expect(scopeChecksOf(C1.prototype.plain)).toEqual([]);
    expect(() => ScopedRecord('x; drop table')).toThrow(/table/);
  });
});

describe('CompanyScopeInterceptor record checks', () => {
  const limited: UserScope = {
    allCompanies: false, allBranches: false, defaultCompanyId: A, defaultBranchId: A1,
    companies: [{ companyId: A, branchIds: [A1], isDefault: true }, { companyId: B, branchIds: null, isDefault: false }],
  };
  const everything: UserScope = { allCompanies: true, allBranches: true, companies: null, defaultCompanyId: null, defaultBranchId: null };
  const owners = new Map<string, string>([[A1, A], [A2, A], [B1, B]]);
  // R1: company A branch A1 (allowed); R2: company A branch A2 (not allowed); R3: company C.
  const records: Record<string, { company_id: string | null; branch_id: string | null }> = {
    [R1]: { company_id: A, branch_id: A1 }, [R2]: { company_id: A, branch_id: A2 }, [R3]: { company_id: C, branch_id: null },
    'tc-001': { company_id: null, branch_id: null },
  };

  class Handlers {
    @ScopedRecord('leave_requests')
    approve() { return 'ok'; }
    @ScopedRecords('overtime_entries')
    bulk() { return 'ok'; }
    @ScopedRecord('training_courses')
    course() { return 'ok'; }
  }

  const build = (scope: UserScope) => {
    const scopes = { forUser: jest.fn().mockResolvedValue(scope) } as unknown as CompanyScopeService;
    const conn = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        const ids = params[0] as string[];
        if (/FROM branches/.test(sql)) return ids.map((id) => ({ id, company_id: owners.get(id) ?? null }));
        return ids.filter((id) => records[id]).map((id) => ({ id, ...records[id] }));
      }),
    };
    const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
    return { interceptor: new CompanyScopeInterceptor(scopes, db), conn };
  };
  const ctx = (req: Record<string, unknown>, handler: () => unknown) =>
    ({ getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler }) as never;
  const next = { handle: () => of('ok') };
  const req = (over: Record<string, unknown>) => ({ method: 'POST', user: { sub: U, tenantId: 't1', role: 'staff' }, headers: {}, query: {}, ...over });

  it('lets a limited user act on a record of their branch', async () => {
    const { interceptor } = build(limited);
    await expect(lastValueFrom(await interceptor.intercept(ctx(req({ params: { id: R1 } }), Handlers.prototype.approve), next))).resolves.toBe('ok');
  });

  it('answers 404 for a record of another branch or company', async () => {
    const { interceptor } = build(limited);
    await expect(interceptor.intercept(ctx(req({ params: { id: R2 } }), Handlers.prototype.approve), next)).rejects.toBeInstanceOf(NotFoundException);
    await expect(interceptor.intercept(ctx(req({ params: { id: R3 } }), Handlers.prototype.approve), next)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('leaves a missing record to the handler and matches text ids', async () => {
    const { interceptor } = build(limited);
    const missing = 'cccccccc-0000-0000-0000-00000000dead';
    await expect(lastValueFrom(await interceptor.intercept(ctx(req({ params: { id: missing } }), Handlers.prototype.approve), next))).resolves.toBe('ok');
    await expect(lastValueFrom(await interceptor.intercept(ctx(req({ method: 'GET', params: { id: 'tc-001' } }), Handlers.prototype.course), next))).resolves.toBe('ok');
  });

  it('refuses a bulk action when any record is outside the scope', async () => {
    const { interceptor } = build(limited);
    await expect(lastValueFrom(await interceptor.intercept(ctx(req({ body: { ids: [R1] } }), Handlers.prototype.bulk), next))).resolves.toBe('ok');
    await expect(interceptor.intercept(ctx(req({ body: { ids: [R1, R2] } }), Handlers.prototype.bulk), next)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not check org-wide users', async () => {
    const { interceptor, conn } = build(everything);
    await expect(lastValueFrom(await interceptor.intercept(ctx(req({ params: { id: R3 } }), Handlers.prototype.approve), next))).resolves.toBe('ok');
    expect(conn.query).not.toHaveBeenCalled();
  });
});
