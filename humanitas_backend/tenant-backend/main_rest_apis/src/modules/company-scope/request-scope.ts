import 'reflect-metadata';
import { UUID_RE, idList } from './company-scope';

/**
 * Company and branch filters for module queries (AGENTS.md rule 16).
 *
 * CompanyScopeInterceptor runs before every handler. For a limited user it rewrites the
 * x-company-id / x-branch-id headers to an allowed scope (their defaults when they picked
 * nothing); for an org-wide user the headers are the switcher's choice, or absent for "all".
 * So a module only reads the headers and filters: no module decides access itself.
 *
 * Records with company_id / branch_id NULL are shared by every company / branch.
 */
export interface RequestScope {
  /** null = no company filter */
  companyIds: string[] | null;
  /** null = no branch filter */
  branchIds: string[] | null;
}


const ALIAS = /^[a-z_][a-z0-9_]*$/i;
const TABLE = /^[a-z_][a-z0-9_]*$/;

/** The company and branch the request works in, from the headers the interceptor normalised. */
export function requestScope(req: unknown): RequestScope {
  const headers = (req as { headers?: Record<string, unknown> } | null | undefined)?.headers ?? {};
  const read = (name: string) => {
    const raw = headers[name];
    const ids = idList(Array.isArray(raw) ? raw.join(',') : raw).filter((id) => UUID_RE.test(id));
    return ids.length ? ids : null;
  };
  return { companyIds: read('x-company-id'), branchIds: read('x-branch-id') };
}

/**
 * " AND (...)" limiting `alias.company_id` / `alias.branch_id` to the scope ('' when there is no
 * filter). The ids are pushed onto `params`, so the placeholders follow whatever is already there:
 * a caller keeping its own counter continues from `params.length + 1`.
 */
export function scopeWhere(scope: RequestScope | undefined, alias: string, params: unknown[]): string {
  if (!scope || (!scope.companyIds && !scope.branchIds)) return '';
  if (!ALIAS.test(alias)) throw new Error(`invalid alias ${alias}`);
  const parts: string[] = [];
  if (scope.companyIds) {
    params.push(scope.companyIds);
    parts.push(`(${alias}.company_id IS NULL OR ${alias}.company_id = ANY($${params.length}::uuid[]))`);
  }
  if (scope.branchIds) {
    params.push(scope.branchIds);
    parts.push(`(${alias}.branch_id IS NULL OR ${alias}.branch_id = ANY($${params.length}::uuid[]))`);
  }
  return ` AND ${parts.join(' AND ')}`;
}

/** Whether a row with this company and branch is inside the scope. */
export function inScope(scope: RequestScope | undefined, row: { company_id?: string | null; branch_id?: string | null }): boolean {
  if (!scope) return true;
  if (scope.companyIds && row.company_id && !scope.companyIds.includes(row.company_id)) return false;
  if (scope.branchIds && row.branch_id && !scope.branchIds.includes(row.branch_id)) return false;
  return true;
}

/**
 * Company and branch for a new set-up row (holiday, event, announcement, shift, pattern): the one
 * company / branch the request works in, else NULL = shared by all. A branch-limited user always
 * works in their branch, so their rows stay in it; an org-wide user on "all" shares with everyone.
 */
export function newRecordScope(scope: RequestScope | undefined): { company_id: string | null; branch_id: string | null } {
  return {
    company_id: scope?.companyIds?.length === 1 ? scope.companyIds[0] : null,
    branch_id: scope?.branchIds?.length === 1 ? scope.branchIds[0] : null,
  };
}

interface Queryable {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

/**
 * Ids of `table` rows inside the scope, for lists loaded through the ORM: null = no filter (and no
 * query: pass a function to open the connection only when there is a filter).
 * Filter the loaded rows with it (`rows.filter((r) => ids.has(r.id))`).
 */
export async function scopedIds(
  conn: Queryable | (() => Promise<Queryable>),
  table: string,
  scope: RequestScope | undefined,
): Promise<Set<string> | null> {
  if (!scope || (!scope.companyIds && !scope.branchIds)) return null;
  if (!TABLE.test(table)) throw new Error(`invalid table ${table}`);
  const db = typeof conn === 'function' ? await conn() : conn;
  const params: unknown[] = [];
  const rows = (await db.query(`SELECT t.id::text AS id FROM ${table} t WHERE true${scopeWhere(scope, 't', params)}`, params)) as { id: string }[];
  return new Set(rows.map((r) => String(r.id)));
}

// ── Record checks ───────────────────────────────────────────────────────────
// A detail or action endpoint names the record it works on; the interceptor then refuses a
// record outside the user's companies and branches before the handler runs, the same way for
// every module. Only limited users are checked (org-wide users may touch any record).

export const SCOPE_CHECKS = 'company_scope:checks';

export interface ScopeCheck {
  /** Table holding company_id / branch_id ('users' for a person). */
  table: string;
  /** Route parameter with the record's id. */
  param?: string;
  /** Body field with an id or a list of ids (assignments, bulk actions). */
  bodyField?: string;
}

function addCheck(check: ScopeCheck): MethodDecorator {
  if (!TABLE.test(check.table)) throw new Error(`invalid table ${check.table}`);
  return (_target, _key, descriptor: PropertyDescriptor) => {
    const fn = descriptor.value as object;
    const list = (Reflect.getMetadata(SCOPE_CHECKS, fn) as ScopeCheck[] | undefined) ?? [];
    Reflect.defineMetadata(SCOPE_CHECKS, [...list, check], fn);
    return descriptor;
  };
}

/** The record in route parameter `param` (default `id`) of `table` must be in the user's scope. */
export const ScopedRecord = (table: string, param = 'id') => addCheck({ table, param });

/** The person in route parameter `param` (default `userId`) must be in the user's scope. */
export const ScopedUser = (param = 'userId') => addCheck({ table: 'users', param });

/** Every id in body field `bodyField` (default `ids`) of `table` must be in the user's scope. */
export const ScopedRecords = (table: string, bodyField = 'ids') => addCheck({ table, bodyField });

export function scopeChecksOf(handler: unknown): ScopeCheck[] {
  if (!handler || (typeof handler !== 'function' && typeof handler !== 'object')) return [];
  return (Reflect.getMetadata(SCOPE_CHECKS, handler as object) as ScopeCheck[] | undefined) ?? [];
}
