import { ForbiddenException } from '@nestjs/common';
import { assertCompanyAssignable, canSeeAllCompanies, companyFilter, isVisible, resolveCompanyScope } from './products.scope';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const conn = (company: string | null) => ({ query: jest.fn().mockResolvedValue([{ company_id: company }]) });
const user = (role: string, permissions?: string[]) => ({ sub: 'u1', email: '', tenantId: 't', tenantSlug: 't', role, permissions });

describe('company scope for catalog records', () => {
  it('org-wide users see everything, or one selected company', async () => {
    expect(canSeeAllCompanies(user('admin'))).toBe(true);
    expect(canSeeAllCompanies(user('staff', ['view_all_companies']))).toBe(true);
    expect((await resolveCompanyScope(conn(A), user('owner'))).companyIds).toBeNull();
    expect((await resolveCompanyScope(conn(A), user('owner'), B)).companyIds).toEqual([B]);
    expect((await resolveCompanyScope(conn(A), user('owner'), 'not-a-uuid')).companyIds).toBeNull();
  });

  it('other users see shared records plus their own company, whatever header they send', async () => {
    const s = await resolveCompanyScope(conn(A), user('staff', ['view_products']), B);
    expect(s).toEqual({ canSeeAll: false, ownCompanyId: A, companyIds: [A] });
    expect(isVisible(s, null)).toBe(true);
    expect(isVisible(s, A)).toBe(true);
    expect(isVisible(s, B)).toBe(false);
    // No company assigned in a single-company tenant: the user works in that company.
    expect((await resolveCompanyScope(conn(null), user('staff'))).companyIds).toBeNull();
  });

  it('builds a parameterized SQL filter', async () => {
    const s = await resolveCompanyScope(conn(A), user('staff'));
    expect(companyFilter(s, 'p', 3)).toEqual({ sql: '(p.company_id IS NULL OR p.company_id = ANY($3::uuid[]))', param: [A] });
    expect(companyFilter(await resolveCompanyScope(conn(A), user('admin')), 'p', 1)).toBeNull();
  });

  it('lets non-org-wide users assign records only to their own companies, never shared with all', async () => {
    const s = await resolveCompanyScope(conn(A), user('staff'));
    expect(() => assertCompanyAssignable(s, null)).toThrow(ForbiddenException);
    expect(() => assertCompanyAssignable(s, undefined)).not.toThrow();
    expect(() => assertCompanyAssignable(s, A)).not.toThrow();
    expect(() => assertCompanyAssignable(s, B)).toThrow(ForbiddenException);
  });
});
