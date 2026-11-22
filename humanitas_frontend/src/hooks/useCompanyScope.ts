import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** The companies and branches the signed-in user may use (GET /me/company-scope, AGENTS.md rule 16). */
export interface ScopeBranch { id: string; name: string; is_default: boolean }
export interface ScopeCompany { id: string; name: string; is_default: boolean; all_branches: boolean; branches: ScopeBranch[] }
export interface CompanyScope {
  all_companies: boolean;
  all_branches: boolean;
  default_company_id: string | null;
  default_branch_id: string | null;
  companies: ScopeCompany[];
}

export const companyScopeKey = ['me', 'company-scope'] as const;

export function useCompanyScope(enabled = true) {
  return useQuery({
    queryKey: companyScopeKey,
    queryFn: () => api.get<CompanyScope>('/me/company-scope'),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/** Drops switcher choices the user may no longer use (their access changed, or another user signed in here). */
export function pruneScope(scope: CompanyScope, companyIds: string[], branchIds: string[]) {
  const companies = companyIds.filter((id) => scope.companies.some((c) => c.id === id));
  const pool = scope.companies.filter((c) => !companies.length || companies.includes(c.id));
  const branches = branchIds.filter((id) => pool.some((c) => c.branches.some((b) => b.id === id)));
  return { companies, branches, changed: companies.length !== companyIds.length || branches.length !== branchIds.length };
}

/** Company a new record starts in: the one picked in the switcher (if one), else the user's default. */
export function defaultCompanyFor(scope: CompanyScope | undefined, activeCompanyIds: string[]): string | null {
  if (!scope) return null;
  if (activeCompanyIds.length === 1 && scope.companies.some((c) => c.id === activeCompanyIds[0])) return activeCompanyIds[0];
  return scope.default_company_id ?? scope.companies[0]?.id ?? null;
}

/** Branch a new record starts in for a company: the switcher's (if one, in that company), else the default branch. */
export function defaultBranchFor(scope: CompanyScope | undefined, companyId: string | null, activeBranchIds: string[]): string | null {
  const company = scope?.companies.find((c) => c.id === companyId);
  if (!company) return null;
  if (activeBranchIds.length === 1 && company.branches.some((b) => b.id === activeBranchIds[0])) return activeBranchIds[0];
  if (scope?.default_branch_id && company.branches.some((b) => b.id === scope.default_branch_id)) return scope.default_branch_id;
  return company.all_branches ? null : company.branches[0]?.id ?? null;
}
