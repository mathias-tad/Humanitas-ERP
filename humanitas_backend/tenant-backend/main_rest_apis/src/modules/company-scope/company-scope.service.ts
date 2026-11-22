import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { hasAllBranches, hasAllCompanies, type CompanyAccess, type UserScope } from './company-scope';

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<any>;
}

/** Cached for a short time: this runs on every signed-in request. */
const CACHE_MS = 30_000;

/** Loads a user's allowed companies and branches (rule 16). */
@Injectable()
export class CompanyScopeService {
  private readonly cache = new Map<string, { at: number; scope: UserScope }>();

  constructor(private readonly databaseService: DatabaseService) {}

  async forUser(tenantId: string, userId: string, role: string | undefined): Promise<UserScope> {
    const key = `${tenantId}:${userId}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.scope;
    const conn = await this.databaseService.getTenantConnectionById(tenantId);
    const scope = await CompanyScopeService.load(conn, userId, role);
    this.cache.set(key, { at: Date.now(), scope });
    if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value as string);
    return scope;
  }

  invalidate(tenantId: string, userId?: string): void {
    if (!userId) {
      for (const k of this.cache.keys()) if (k.startsWith(`${tenantId}:`)) this.cache.delete(k);
      return;
    }
    this.cache.delete(`${tenantId}:${userId}`);
  }

  static async load(conn: Queryable, userId: string, role: string | undefined): Promise<UserScope> {
    const [u]: { company_id: string | null; branch_id: string | null; permissions: unknown }[] = await conn.query(
      `SELECT u.company_id, u.branch_id, r.permissions FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userId],
    );
    const raw = typeof u?.permissions === 'string' ? safeJson(u.permissions) : u?.permissions;
    const permissions = role === 'owner' || role === 'admin' ? ['*'] : Array.isArray(raw) ? raw.map(String) : [];
    let allCompanies = hasAllCompanies(role, permissions);
    const allBranches = hasAllBranches(role, permissions);

    const rows: { company_id: string; all_branches: boolean; branch_ids: string[] | null; is_default: boolean }[] = await conn
      .query(
        `SELECT company_id, all_branches, branch_ids, is_default FROM user_company_access
          WHERE user_id = $1 ORDER BY is_default DESC, created_at`,
        [userId],
      )
      .catch(() => []);
    let access: CompanyAccess[] = rows.map((r) => ({
      companyId: r.company_id,
      branchIds: r.all_branches ? null : (r.branch_ids ?? []),
      isDefault: !!r.is_default,
    }));
    if (!access.length && u?.company_id) {
      access = [{ companyId: u.company_id, branchIds: u.branch_id ? [u.branch_id] : null, isDefault: true }];
    }
    if (!access.length && !allCompanies) {
      // No company assigned: in a tenant with a single company the user simply works in it;
      // with several, in the default company only.
      const companies: { id: string }[] = await conn
        .query(`SELECT id FROM companies WHERE COALESCE(is_active, true) ORDER BY is_default DESC NULLS LAST, created_at LIMIT 2`)
        .catch(() => []);
      if (companies.length <= 1) allCompanies = true;
      else access = [{ companyId: companies[0].id, branchIds: null, isDefault: true }];
    }
    const def = access.find((a) => a.isDefault) ?? access[0];
    const defaultCompanyId = allCompanies ? (u?.company_id ?? def?.companyId ?? null) : (def?.companyId ?? null);
    const defaultBranchId = u?.branch_id ?? def?.branchIds?.[0] ?? null;
    return { allCompanies, allBranches, companies: allCompanies ? null : access, defaultCompanyId, defaultBranchId };
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}
