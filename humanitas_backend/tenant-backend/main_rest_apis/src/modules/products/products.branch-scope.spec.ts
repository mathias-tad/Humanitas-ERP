import { ForbiddenException } from '@nestjs/common';
import { assertBranchAssignable, companyFilter, defaultRecordBranch, isVisible, resolveCompanyScope, setRecordBranch } from './products.scope';

const A = '11111111-1111-1111-1111-111111111111';
const B1 = 'b1111111-1111-1111-1111-111111111111';
const B2 = 'b2222222-2222-2222-2222-222222222222';
const conn = (company: string | null) => ({ query: jest.fn().mockResolvedValue([{ company_id: company }]) });
const user = (role: string, permissions?: string[]) => ({ sub: 'u1', email: '', tenantId: 't', tenantSlug: 't', role, permissions });

describe('branch scope for catalog, contact and CRM records (rule 16)', () => {
  it('works in the branches the request carries; none means no branch filter', async () => {
    const s = await resolveCompanyScope(conn(A), user('staff'), undefined, `${B1}, not-a-uuid`);
    expect(s.branchIds).toEqual([B1]);
    expect(s.canSeeAllBranches).toBe(false);
    expect((await resolveCompanyScope(conn(A), user('staff'))).branchIds).toBeNull();
    expect((await resolveCompanyScope(conn(A), user('staff', ['view_all_branches']), undefined, B1)).canSeeAllBranches).toBe(true);
  });

  it('filters by company and branch with one parameter; shared rows (NULL) stay visible', async () => {
    const s = await resolveCompanyScope(conn(A), user('staff'), undefined, B1);
    expect(companyFilter(s, 'l', 2)).toEqual({
      sql: '((l.company_id IS NULL OR l.company_id = ANY($2::uuid[])) AND (l.branch_id IS NULL OR l.branch_id = ANY($2::uuid[])))',
      param: [A, B1],
    });
    const admin = await resolveCompanyScope(conn(A), user('admin'), undefined, B2);
    expect(companyFilter(admin, 'p', 1)).toEqual({ sql: '(p.branch_id IS NULL OR p.branch_id = ANY($1::uuid[]))', param: [B2] });
    expect(isVisible(s, A, B1)).toBe(true);
    expect(isVisible(s, A, null)).toBe(true);
    expect(isVisible(s, A, B2)).toBe(false);
    expect(isVisible(s, null, B2)).toBe(false);
  });

  it('puts new records in the one picked branch and keeps branch-limited users in their branches', async () => {
    const s = await resolveCompanyScope(conn(A), user('staff'), undefined, B1);
    expect(defaultRecordBranch(s)).toBe(B1);
    expect(defaultRecordBranch(await resolveCompanyScope(conn(A), user('staff'), undefined, `${B1},${B2}`))).toBeNull();
    expect(() => assertBranchAssignable(s, B1)).not.toThrow();
    expect(() => assertBranchAssignable(s, undefined)).not.toThrow();
    expect(() => assertBranchAssignable(s, B2)).toThrow(ForbiddenException);
    expect(() => assertBranchAssignable(s, null)).toThrow(ForbiddenException);
    const admin = await resolveCompanyScope(conn(A), user('admin'), undefined, B1);
    expect(() => assertBranchAssignable(admin, null)).not.toThrow();
  });

  it('sets a record\'s branch only when there is one to set', async () => {
    const c = { query: jest.fn().mockResolvedValue([]) };
    await setRecordBranch(c, 'crm_leads', 'id1', undefined);
    expect(c.query).not.toHaveBeenCalled();
    await setRecordBranch(c, 'crm_leads', 'id1', B1);
    expect(c.query).toHaveBeenCalledWith('UPDATE crm_leads SET branch_id = $1 WHERE id = $2', [B1, 'id1']);
    await setRecordBranch(c, 'crm_leads; DROP', 'id1', B1);
    expect(c.query).toHaveBeenCalledTimes(1);
  });
});
