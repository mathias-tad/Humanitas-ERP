/**
 * Company and branch access (AGENTS.md rule 16): which companies and branches a user may work
 * in, and what a request may ask for. Pure rules; loading and enforcement live in the service and
 * the global interceptor, so every module gets the same answer.
 */

export interface CompanyAccess {
  companyId: string;
  /** null = every branch of this company */
  branchIds: string[] | null;
  isDefault: boolean;
}

export interface UserScope {
  allCompanies: boolean;
  allBranches: boolean;
  /** null when allCompanies */
  companies: CompanyAccess[] | null;
  defaultCompanyId: string | null;
  defaultBranchId: string | null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function hasAllCompanies(role: string | undefined, permissions: string[]): boolean {
  return role === 'owner' || role === 'admin' || permissions.includes('*')
    || permissions.includes('view_all_companies') || permissions.includes('manage_companies');
}

export function hasAllBranches(role: string | undefined, permissions: string[]): boolean {
  return role === 'owner' || role === 'admin' || permissions.includes('*')
    || permissions.includes('view_all_branches') || permissions.includes('manage_branches');
}

/** "a, b" / ["a","b"] -> ['a','b'] (trimmed, de-duplicated). */
export function idList(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  return [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];
}

export function allowedCompanyIds(scope: UserScope): string[] | null {
  return scope.allCompanies ? null : (scope.companies ?? []).map((c) => c.companyId);
}

export function canUseCompany(scope: UserScope, companyId: string): boolean {
  return scope.allCompanies || (scope.companies ?? []).some((c) => c.companyId === companyId);
}

/** Whether the user may use this branch (which belongs to `branchCompanyId`). */
export function canUseBranch(scope: UserScope, branchId: string, branchCompanyId: string | null): boolean {
  if (scope.allCompanies && scope.allBranches) return true;
  if (!branchCompanyId) return scope.allBranches;
  if (!canUseCompany(scope, branchCompanyId)) return false;
  if (scope.allBranches) return true;
  const access = (scope.companies ?? []).find((c) => c.companyId === branchCompanyId);
  // A user with every company but not every branch keeps their assigned branch only.
  if (!access) return scope.defaultBranchId === branchId;
  return access.branchIds === null || access.branchIds.includes(branchId);
}

/** Branch the user lands in for a company when they did not pick one (null = all branches allowed). */
export function defaultBranchFor(scope: UserScope, companyId: string | null): string | null {
  if (scope.allBranches || !companyId) return null;
  const access = (scope.companies ?? []).find((c) => c.companyId === companyId);
  if (!access) return scope.defaultBranchId;
  if (access.branchIds === null) return null;
  if (scope.defaultBranchId && access.branchIds.includes(scope.defaultBranchId)) return scope.defaultBranchId;
  return access.branchIds[0] ?? null;
}

export class ScopeViolation extends Error {}

export interface RequestedScope {
  companyIds: string[];
  branchIds: string[];
}

/**
 * Checks what a request asks for and fills in the defaults:
 * - a company or branch outside the user's access is refused;
 * - a limited user who picked no company works in their default company (never "everything");
 * - a branch-limited user who picked no branch works in their default branch.
 * `branchCompany` maps each requested branch id to its company.
 */
export function effectiveScope(
  scope: UserScope,
  requested: RequestedScope,
  branchCompany: Map<string, string | null>,
): { companyIds: string[]; branchIds: string[] } {
  for (const id of requested.companyIds) {
    if (!UUID_RE.test(id)) throw new ScopeViolation(`"${id}" is not a company id`);
    if (!canUseCompany(scope, id)) throw new ScopeViolation('You do not have access to this company');
  }
  for (const id of requested.branchIds) {
    if (!UUID_RE.test(id)) throw new ScopeViolation(`"${id}" is not a branch id`);
    if (!branchCompany.has(id)) throw new ScopeViolation('Branch not found');
    const owner = branchCompany.get(id) ?? null;
    if (!canUseBranch(scope, id, owner)) throw new ScopeViolation('You do not have access to this branch');
    if (requested.companyIds.length && owner && !requested.companyIds.includes(owner)) {
      throw new ScopeViolation('This branch belongs to another company');
    }
  }
  let companyIds = requested.companyIds;
  let branchIds = requested.branchIds;
  if (!companyIds.length && !scope.allCompanies) {
    // A branch picked on its own means its company; otherwise the user's default company.
    const owners = [...new Set(branchIds.map((b) => branchCompany.get(b) ?? null))];
    companyIds = owners.length && owners.every((o): o is string => !!o) ? owners : scope.defaultCompanyId ? [scope.defaultCompanyId] : [];
  }
  if (!branchIds.length && !scope.allBranches) {
    const b = companyIds.length === 1 ? defaultBranchFor(scope, companyIds[0]) : companyIds.length ? null : scope.defaultBranchId;
    if (b) branchIds = [b];
  }
  return { companyIds, branchIds };
}

/**
 * A record's company and branch on create/update: the given ones must be allowed; "shared by
 * all companies" (company null) only for users with every company.
 */
export function checkRecordScope(
  scope: UserScope,
  companyId: string | null | undefined,
  branchId: string | null | undefined,
  branchCompanyId: string | null | undefined,
): void {
  if (companyId === null && !scope.allCompanies) {
    throw new ScopeViolation('Only users with access to every company can share a record with all companies');
  }
  if (companyId && !canUseCompany(scope, companyId)) throw new ScopeViolation('You do not have access to this company');
  if (branchId) {
    if (!canUseBranch(scope, branchId, branchCompanyId ?? null)) throw new ScopeViolation('You do not have access to this branch');
    if (companyId && branchCompanyId && companyId !== branchCompanyId) throw new ScopeViolation('This branch belongs to another company');
  }
}
