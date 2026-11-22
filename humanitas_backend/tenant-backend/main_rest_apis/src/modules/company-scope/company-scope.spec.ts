import { ForbiddenException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { CompanyScopeInterceptor } from './company-scope.interceptor';
import { CompanyScopeService } from './company-scope.service';
import { CompanyScopeController } from './company-scope.controller';
import { ScopeViolation, checkRecordScope, effectiveScope, idList, type UserScope } from './company-scope';
import type { DatabaseService } from '../database/database.service';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';
const A1 = 'aaaaaaaa-1111-1111-1111-111111111111';
const A2 = 'aaaaaaaa-2222-2222-2222-222222222222';
const B1 = 'bbbbbbbb-1111-1111-1111-111111111111';
const U = '99999999-9999-9999-9999-999999999999';

const limited: UserScope = {
  allCompanies: false, allBranches: false, defaultCompanyId: A, defaultBranchId: A1,
  companies: [{ companyId: A, branchIds: [A1], isDefault: true }, { companyId: B, branchIds: null, isDefault: false }],
};
const everything: UserScope = { allCompanies: true, allBranches: true, companies: null, defaultCompanyId: null, defaultBranchId: null };
const owners = new Map<string, string | null>([[A1, A], [A2, A], [B1, B]]);

describe('company scope rules', () => {
  it('fills in the default company and branch for a limited user who picked nothing', () => {
    expect(effectiveScope(limited, { companyIds: [], branchIds: [] }, owners)).toEqual({ companyIds: [A], branchIds: [A1] });
    expect(effectiveScope(limited, { companyIds: [B], branchIds: [] }, owners)).toEqual({ companyIds: [B], branchIds: [] });
    expect(effectiveScope(limited, { companyIds: [], branchIds: [B1] }, owners)).toEqual({ companyIds: [B], branchIds: [B1] });
    expect(effectiveScope(everything, { companyIds: [], branchIds: [] }, owners)).toEqual({ companyIds: [], branchIds: [] });
  });

  it('refuses companies and branches outside the user\'s access', () => {
    expect(() => effectiveScope(limited, { companyIds: [C], branchIds: [] }, owners)).toThrow(ScopeViolation);
    expect(() => effectiveScope(limited, { companyIds: [A], branchIds: [A2] }, owners)).toThrow(/branch/);
    expect(() => effectiveScope(limited, { companyIds: [A], branchIds: [B1] }, owners)).toThrow(/another company/);
    expect(() => effectiveScope(limited, { companyIds: ['nope'], branchIds: [] }, owners)).toThrow(/not a company id/);
    expect(() => effectiveScope(limited, { companyIds: [], branchIds: [C] }, owners)).toThrow(/not found/);
  });

  it('checks a record\'s company and branch; only org-wide users may share with all companies', () => {
    expect(() => checkRecordScope(limited, A, A1, A)).not.toThrow();
    expect(() => checkRecordScope(limited, B, B1, B)).not.toThrow();
    expect(() => checkRecordScope(limited, null, null, null)).toThrow(/every company/);
    expect(() => checkRecordScope(limited, C, null, null)).toThrow(ScopeViolation);
    expect(() => checkRecordScope(limited, A, A2, A)).toThrow(/branch/);
    expect(() => checkRecordScope(everything, null, null, null)).not.toThrow();
    expect(idList(' a, b ,a')).toEqual(['a', 'b']);
  });
});

function ctxFor(req: Record<string, unknown>) {
  return { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) } as never;
}

describe('CompanyScopeInterceptor', () => {
  const build = (scope: UserScope) => {
    const scopes = { forUser: jest.fn().mockResolvedValue(scope) } as unknown as CompanyScopeService;
    const conn = { query: jest.fn(async (_sql: string, params: unknown[]) => (params[0] as string[]).map((id) => ({ id, company_id: owners.get(id) ?? null }))) };
    const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
    return new CompanyScopeInterceptor(scopes, db);
  };
  const handler = { handle: () => of('ok') };
  const req = (over: Record<string, unknown> = {}) => ({ method: 'GET', user: { sub: U, tenantId: 't1', role: 'staff' }, headers: {}, query: {}, ...over });

  it('puts a limited user in their default company and branch when none is picked', async () => {
    const r = req();
    await lastValueFrom(await build(limited).intercept(ctxFor(r), handler));
    expect(r.headers).toEqual({ 'x-company-id': A, 'x-branch-id': A1 });
  });

  it('drops a company header the user may not use (back to their default) and refuses it in the query', async () => {
    const spoofed = req({ headers: { 'x-company-id': `${C},${B}`, 'x-branch-id': A2 } });
    await lastValueFrom(await build(limited).intercept(ctxFor(spoofed), handler));
    expect(spoofed.headers).toEqual({ 'x-company-id': B });
    const other = req({ headers: { 'x-company-id': C } });
    await lastValueFrom(await build(limited).intercept(ctxFor(other), handler));
    expect(other.headers).toEqual({ 'x-company-id': A, 'x-branch-id': A1 });
    await expect(build(limited).intercept(ctxFor(req({ query: { company_id: C } })), handler)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses creating a record in another company, or shared with all', async () => {
    await expect(build(limited).intercept(ctxFor(req({ method: 'POST', body: { name: 'x', company_id: C } })), handler)).rejects.toThrow(ForbiddenException);
    await expect(build(limited).intercept(ctxFor(req({ method: 'POST', body: { company_id: null } })), handler)).rejects.toThrow(/every company/);
    await expect(build(limited).intercept(ctxFor(req({ method: 'POST', body: { company_id: B, branch_id: B1 } })), handler)).resolves.toBeDefined();
  });

  it('leaves org-wide users and public requests alone', async () => {
    const r = req({ headers: { 'x-company-id': C } });
    await lastValueFrom(await build(everything).intercept(ctxFor(r), handler));
    expect(r.headers).toEqual({ 'x-company-id': C });
    const anon = { method: 'GET', headers: {} };
    await lastValueFrom(await build(limited).intercept(ctxFor(anon), handler));
    expect(anon.headers).toEqual({});
  });
});

describe('CompanyScopeService.load', () => {
  const conn = (routes: [RegExp, unknown[]][]) => ({
    query: jest.fn(async (sql: string) => routes.find(([re]) => re.test(sql))?.[1] ?? []),
  });

  it('reads allowed companies, keeps existing users on their own company, and defaults single-company tenants', async () => {
    const listed = await CompanyScopeService.load(conn([
      [/FROM users u/, [{ company_id: A, branch_id: A1, permissions: ['view_users'] }]],
      [/FROM user_company_access/, [{ company_id: B, all_branches: true, branch_ids: [], is_default: true }, { company_id: A, all_branches: false, branch_ids: [A1], is_default: false }]],
    ]), U, 'staff');
    expect(listed).toMatchObject({ allCompanies: false, allBranches: false, defaultCompanyId: B, defaultBranchId: A1 });
    expect(listed.companies).toEqual([{ companyId: B, branchIds: null, isDefault: true }, { companyId: A, branchIds: [A1], isDefault: false }]);

    const legacy = await CompanyScopeService.load(conn([[/FROM users u/, [{ company_id: A, branch_id: null, permissions: [] }]]]), U, 'staff');
    expect(legacy.companies).toEqual([{ companyId: A, branchIds: null, isDefault: true }]);

    const single = await CompanyScopeService.load(conn([[/FROM users u/, [{ company_id: null, branch_id: null, permissions: [] }]], [/FROM companies/, [{ id: A }]]]), U, 'staff');
    expect(single.allCompanies).toBe(true);

    const admin = await CompanyScopeService.load(conn([[/FROM users u/, [{ company_id: null, branch_id: null, permissions: null }]]]), U, 'admin');
    expect(admin).toMatchObject({ allCompanies: true, allBranches: true });
  });
});

describe('CompanyScopeController.describe', () => {
  it('lists only the companies and branches the user may use', () => {
    const out = CompanyScopeController.describe(
      limited,
      [{ id: A, name: 'Addis', is_default: true }, { id: B, name: 'Bahir Dar', is_default: false }, { id: C, name: 'Hidden', is_default: false }],
      [{ id: A1, name: 'Bole', company_id: A, is_default: true }, { id: A2, name: 'Piassa', company_id: A, is_default: false }, { id: B1, name: 'Lake', company_id: B, is_default: true }],
    );
    expect(out.companies.map((c) => c.name)).toEqual(['Addis', 'Bahir Dar']);
    expect(out.companies[0]).toMatchObject({ is_default: true, all_branches: false, branches: [{ id: A1, name: 'Bole', is_default: true }] });
    expect(out.companies[1]).toMatchObject({ all_branches: true, branches: [{ id: B1 }] });
    expect(out.default_company_id).toBe(A);
  });
});
