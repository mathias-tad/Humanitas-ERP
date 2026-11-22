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
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function canSeeAllCompanies(user: Pick<AuthUser, 'role' | 'permissions'> | undefined): boolean {
  if (!user) return false;
  if (user.role === 'owner' || user.role === 'admin') return true;
  const perms = user.permissions ?? [];
  return perms.includes('*') || perms.includes('view_all_companies');
}

export async function resolveCompanyScope(
  conn: Queryable,
  user: AuthUser | undefined,
  headerCompanyId?: string,
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
  if (canSeeAll) return { canSeeAll, ownCompanyId, companyIds: selected.length ? selected : null };
  const picked = selected.filter((s) => allowed.includes(s));
  return { canSeeAll, ownCompanyId, companyIds: picked.length ? picked : allowed };
}

/** Company for a new record: the one picked in the switcher (if single and allowed), else the user's default company. */
export function defaultRecordCompany(scope: CompanyScope): string | null {
  if (scope.companyIds && scope.companyIds.length === 1) return scope.companyIds[0];
  return scope.ownCompanyId ?? (scope.canSeeAll ? null : scope.companyIds?.[0] ?? null);
}

/** SQL fragment (and its parameter) limiting `alias.company_id` to the scope, or null for no filter. */
export function companyFilter(scope: CompanyScope, alias: string, paramIndex: number): { sql: string; param: string[] } | null {
  if (scope.companyIds === null) return null;
  return { sql: `(${alias}.company_id IS NULL OR ${alias}.company_id = ANY($${paramIndex}::uuid[]))`, param: scope.companyIds };
}

/** Whether a record with this company_id is visible in the scope. */
export function isVisible(scope: CompanyScope, companyId: string | null | undefined): boolean {
  if (!companyId) return true;
  return scope.companyIds === null || scope.companyIds.includes(companyId);
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
