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
  if (userId) {
    const rows: { company_id: string | null }[] = await conn.query(`SELECT company_id FROM users WHERE id = $1`, [userId]);
    ownCompanyId = rows[0]?.company_id ?? null;
  }
  const canSeeAll = canSeeAllCompanies(user);
  const selected = headerCompanyId && UUID.test(headerCompanyId) ? headerCompanyId : undefined;
  if (canSeeAll) return { canSeeAll, ownCompanyId, companyIds: selected ? [selected] : null };
  return { canSeeAll, ownCompanyId, companyIds: ownCompanyId ? [ownCompanyId] : [] };
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

/** A user may assign a record to "shared" or to their own company; org-wide users to any company. */
export function assertCompanyAssignable(scope: CompanyScope, companyId: string | null | undefined): void {
  if (!companyId || scope.canSeeAll || companyId === scope.ownCompanyId) return;
  throw new ForbiddenException('You can only assign records to your own company');
}
