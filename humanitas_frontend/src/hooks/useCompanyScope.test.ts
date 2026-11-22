import { describe, expect, it } from 'vitest';
import { defaultBranchFor, defaultCompanyFor, pruneScope, type CompanyScope } from './useCompanyScope';
import { toggleCompanyAccess } from '@/components/users/UserCompanyAccessEditor';

const scope: CompanyScope = {
  all_companies: false, all_branches: false, default_company_id: 'A', default_branch_id: 'A1',
  companies: [
    { id: 'A', name: 'Addis', is_default: true, all_branches: false, branches: [{ id: 'A1', name: 'Bole', is_default: true }] },
    { id: 'B', name: 'Bahir Dar', is_default: false, all_branches: true, branches: [{ id: 'B1', name: 'Lake', is_default: true }, { id: 'B2', name: 'Port', is_default: false }] },
  ],
};

describe('company scope on the web', () => {
  it('drops switcher choices the user may no longer use', () => {
    expect(pruneScope(scope, ['A', 'X'], ['A1', 'B1'])).toEqual({ companies: ['A'], branches: ['A1'], changed: true });
    expect(pruneScope(scope, [], ['B2'])).toEqual({ companies: [], branches: ['B2'], changed: false });
  });

  it('starts new records in the switcher\'s company and branch, else the defaults', () => {
    expect(defaultCompanyFor(scope, ['B'])).toBe('B');
    expect(defaultCompanyFor(scope, ['A', 'B'])).toBe('A');
    expect(defaultCompanyFor(scope, ['X'])).toBe('A');
    expect(defaultBranchFor(scope, 'B', ['B2'])).toBe('B2');
    expect(defaultBranchFor(scope, 'B', [])).toBeNull();
    expect(defaultBranchFor(scope, 'A', [])).toBe('A1');
  });

  it('keeps exactly one default company when ticking companies', () => {
    let rows = toggleCompanyAccess([], 'A');
    rows = toggleCompanyAccess(rows, 'B');
    expect(rows.map((r) => [r.company_id, r.is_default])).toEqual([['A', true], ['B', false]]);
    expect(toggleCompanyAccess(rows, 'A')).toEqual([{ company_id: 'B', all_branches: true, branch_ids: [], is_default: true }]);
  });
});
