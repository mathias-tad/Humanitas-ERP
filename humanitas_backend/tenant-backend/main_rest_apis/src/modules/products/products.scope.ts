import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/authenticated-request';

/** Minimal query interface shared by DataSource and EntityManager. */
export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<any>;
}

/**
 * Which companies' catalog records a user may see (AGENTS.md rule 16).
 * Catalog rows with company_id NULL are shared by every company of the tenant.
 * - `companyIds === null`: no company filter (org-wide users, no company selected).
 * - otherwise: shared rows + rows of these companies.
 */
export interface CompanyScope {
  canSeeAll: boolean;
  ownCompanyId: string | null;
  companyIds: string[] | null;
  /** Users with every branch (view_all_branches) may share a record with all branches. */
  canSeeAllBranches?: boolean;
  /**
   * Branches the request works in (rule 16): the switcher's, already checked and filled in for
   * branch-limited users by CompanyScopeInterceptor. null = no branch filter.
   * Records with branch_id NULL are shared by every branch.
   */
  branchIds?: string[] | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function canSeeAllCompanies(user: Pick<AuthUser, 'role' | 'permissions'> | undefined): boolean {
  if (!user) return false;
  if (user.role === 'owner' || user.role === 'admin') return true;
  const perms = user.permissions ?? [];
  return perms.includes('*') || perms.includes('view_all_companies');
}

export function canSeeAllBranches(user: Pick<AuthUser, 'role' | 'permissions'> | undefined): boolean {
  if (!user) return false;
  if (user.role === 'owner' || user.role === 'admin') return true;
  const perms = user.permissions ?? [];
  return perms.includes('*') || perms.includes('view_all_branches') || perms.includes('manage_branches');
}

export async function resolveCompanyScope(
  conn: Queryable,
  user: AuthUser | undefined,
  headerCompanyId?: string,
  headerBranchId?: string,
): Promise<CompanyScope> {
  const userId = user?.sub;
  let ownCompanyId: string | null = null;
  let allowed: string[] = [];
  if (userId) {
    const rows: { company_id: string | null }[] = await conn.query(`SELECT company_id FROM users WHERE id = $1`, [userId]);
    ownCompanyId = rows[0]?.company_id ?? null;
    // Allowed companies (user_company_access, rule 16); the user's own company when none are listed.
    const access: { company_id: string | null; is_default?: boolean }[] = await conn
      .query(`SELECT company_id, is_default FROM user_company_access WHERE user_id = $1 ORDER BY is_default DESC`, [userId])
      .catch(() => []);
    allowed = [...new Set(access.map((r) => r.company_id).filter((c): c is string => !!c))];
    if (allowed.length) ownCompanyId = access.find((r) => r.is_default && r.company_id)?.company_id ?? allowed[0];
    else if (ownCompanyId) allowed = [ownCompanyId];
  }
  let canSeeAll = canSeeAllCompanies(user);
  if (!canSeeAll && !allowed.length) {
    // No company assigned: in a tenant with a single company the user works in it.
    const companies: unknown[] = await conn.query(`SELECT id FROM companies WHERE COALESCE(is_active, true) LIMIT 2`).catch(() => []);
    if (Array.isArray(companies) && companies.length <= 1) canSeeAll = true;
  }
  const selected = (headerCompanyId ?? '').split(',').map((s) => s.trim()).filter((s) => UUID.test(s));
  const branches = (headerBranchId ?? '').split(',').map((s) => s.trim()).filter((s) => UUID.test(s));
  const branch = { canSeeAllBranches: canSeeAllBranches(user), branchIds: branches.length ? branches : null };
  if (canSeeAll) return { canSeeAll, ownCompanyId, companyIds: selected.length ? selected : null, ...branch };
  const picked = selected.filter((s) => allowed.includes(s));
  return { canSeeAll, ownCompanyId, companyIds: picked.length ? picked : allowed, ...branch };
}

/** Company for a new record: the one picked in the switcher (if single and allowed), else the user's default company. */
export function defaultRecordCompany(scope: CompanyScope): string | null {
  if (scope.companyIds && scope.companyIds.length === 1) return scope.companyIds[0];
  return scope.ownCompanyId ?? (scope.canSeeAll ? null : scope.companyIds?.[0] ?? null);
}

/**
 * SQL fragment (and its one parameter) limiting `alias.company_id` and `alias.branch_id` to the
 * scope, or null for no filter. NULL company/branch = shared. The parameter holds the company ids
 * and the branch ids together: ids are UUIDs, so a company id never matches a branch.
 */
export function companyFilter(scope: CompanyScope, alias: string, paramIndex: number): { sql: string; param: string[] } | null {
  const branches = scope.branchIds ?? null;
  if (scope.companyIds === null && !branches) return null;
  const parts: string[] = [];
  if (scope.companyIds !== null) parts.push(`(${alias}.company_id IS NULL OR ${alias}.company_id = ANY($${paramIndex}::uuid[]))`);
  if (branches) parts.push(`(${alias}.branch_id IS NULL OR ${alias}.branch_id = ANY($${paramIndex}::uuid[]))`);
  return { sql: parts.length === 1 ? parts[0] : `(${parts.join(' AND ')})`, param: [...(scope.companyIds ?? []), ...(branches ?? [])] };
}

/** Whether a record with this company_id (and branch_id) is visible in the scope. */
export function isVisible(scope: CompanyScope, companyId: string | null | undefined, branchId?: string | null): boolean {
  if (branchId && scope.branchIds && !scope.branchIds.includes(branchId)) return false;
  if (!companyId) return true;
  return scope.companyIds === null || scope.companyIds.includes(companyId);
}

/** Branch for a new record: the one picked in the switcher if just one, else none (the database fills owned records). */
export function defaultRecordBranch(scope: CompanyScope): string | null {
  return scope.branchIds && scope.branchIds.length === 1 ? scope.branchIds[0] : null;
}

/** Users with every branch may share a record with all branches; others only use their branches. */
export function assertBranchAssignable(scope: CompanyScope, branchId: string | null | undefined): void {
  if (branchId === undefined || scope.canSeeAllBranches || !scope.branchIds) return;
  if (branchId === null) throw new ForbiddenException('Only users with access to every branch can share a record with all branches');
  if (!scope.branchIds.includes(branchId)) throw new ForbiddenException('You can only assign records to your own branches');
}

/** Puts a record in a branch (after its insert, or on an update); undefined = leave it. */
export async function setRecordBranch(conn: Queryable, table: string, id: string, branchId: string | null | undefined): Promise<void> {
  if (branchId === undefined || !/^[a-z_]+$/.test(table)) return;
  await conn.query(`UPDATE ${table} SET branch_id = $1 WHERE id = $2`, [branchId, id]);
}

/**
 * Org-wide users may put a record in any company or share it with all (company null);
 * others only in one of their allowed companies.
 */
export function assertCompanyAssignable(scope: CompanyScope, companyId: string | null | undefined): void {
  if (companyId === undefined || scope.canSeeAll) return;
  if (companyId === null) throw new ForbiddenException('Only users with access to every company can share a record with all companies');
  if ((scope.companyIds ?? []).includes(companyId) || companyId === scope.ownCompanyId) return;
  throw new ForbiddenException('You can only assign records to your own companies');
}
