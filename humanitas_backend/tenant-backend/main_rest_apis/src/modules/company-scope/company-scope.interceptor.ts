import { ForbiddenException, Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { CompanyScopeService } from './company-scope.service';
import { ScopeViolation, canUseBranch, canUseCompany, checkRecordScope, effectiveScope, idList, UUID_RE, type UserScope } from './company-scope';

type Req = {
  method?: string;
  user?: { sub?: string; tenantId?: string; role?: string };
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  body?: unknown;
  companyScope?: UserScope;
};

const WRITE = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Enforces company and branch access on every signed-in request, for every module (rule 16):
 * - company_id / branch_id query values must be within the user's access, otherwise 403;
 *   switcher headers (x-company-id / x-branch-id) outside it are dropped;
 * - a limited user who picked nothing gets their default company (and branch), so no module ever
 *   shows them every company's data;
 * - company_id / branch_id in a create or update body must be allowed ("shared by all
 *   companies" only with access to every company).
 * Runs after the guards, so the user is known; public routes pass untouched.
 */
@Injectable()
export class CompanyScopeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CompanyScopeInterceptor.name);

  constructor(
    private readonly scopes: CompanyScopeService,
    private readonly databaseService: DatabaseService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Req>();
    const user = req?.user;
    if (!user?.sub || !user.tenantId || !UUID_RE.test(user.sub)) return next.handle();
    let scope: UserScope;
    try {
      scope = await this.scopes.forUser(user.tenantId, user.sub, user.role);
    } catch (err) {
      // Tenant not ready (setup, migrations): leave the request as it was.
      this.logger.warn(`company scope unavailable: ${(err as Error).message}`);
      return next.handle();
    }
    req.companyScope = scope;
    if (scope.allCompanies && scope.allBranches) return next.handle();

    try {
      await this.apply(req, user.tenantId, scope);
    } catch (err) {
      if (err instanceof ScopeViolation) throw new ForbiddenException(err.message);
      throw err;
    }
    return next.handle();
  }

  private async apply(req: Req, tenantId: string, scope: UserScope) {
    const header = (n: string) => {
      const v = req.headers[n];
      return Array.isArray(v) ? v.join(',') : v;
    };
    const q = req.query ?? {};
    const fromHeaders = { companyIds: idList(header('x-company-id')), branchIds: idList(header('x-branch-id')) };
    const fromQuery = {
      companyIds: idList([...idList(q.company_id), ...idList(q.companyId)]),
      branchIds: idList([...idList(q.branch_id), ...idList(q.branchId)]),
    };
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) && WRITE.has(String(req.method).toUpperCase())
      ? (req.body as Record<string, unknown>)
      : null;
    const bodyBranch = body && typeof body.branch_id === 'string' ? body.branch_id : null;
    const branchCompany = await this.branchCompanies(tenantId, [
      ...fromHeaders.branchIds, ...fromQuery.branchIds, ...(bodyBranch ? [bodyBranch] : []),
    ]);

    // The switcher's choice (headers) may be stale, e.g. access changed or another user used this
    // browser: disallowed ids are dropped and the user's defaults apply. Explicit company/branch
    // values in the query or body are refused instead.
    const headerCompanies = fromHeaders.companyIds.filter((id) => UUID_RE.test(id) && canUseCompany(scope, id));
    const headerBranches = fromHeaders.branchIds.filter((id) => {
      if (!UUID_RE.test(id) || !branchCompany.has(id)) return false;
      const owner = branchCompany.get(id) ?? null;
      return canUseBranch(scope, id, owner) && (!headerCompanies.length || !owner || headerCompanies.includes(owner));
    });
    const requested = {
      companyIds: idList([...headerCompanies, ...fromQuery.companyIds]),
      branchIds: idList([...headerBranches, ...fromQuery.branchIds]),
    };
    const eff = effectiveScope(scope, requested, branchCompany);
    // Modules read these headers; a limited user's request always carries an allowed scope.
    if (eff.companyIds.length) req.headers['x-company-id'] = eff.companyIds.join(',');
    else delete req.headers['x-company-id'];
    if (eff.branchIds.length) req.headers['x-branch-id'] = eff.branchIds.join(',');
    else delete req.headers['x-branch-id'];

    if (body && ('company_id' in body || 'branch_id' in body)) {
      const companyId = 'company_id' in body ? (body.company_id as string | null | undefined) : undefined;
      if (companyId !== undefined && companyId !== null && typeof companyId !== 'string') throw new ScopeViolation('company_id must be an id');
      checkRecordScope(scope, companyId, bodyBranch, bodyBranch ? branchCompany.get(bodyBranch) : undefined);
    }
  }

  private async branchCompanies(tenantId: string, ids: string[]): Promise<Map<string, string | null>> {
    const valid = ids.filter((id) => UUID_RE.test(id));
    if (!valid.length) return new Map();
    const conn = await this.databaseService.getTenantConnectionById(tenantId);
    const rows: { id: string; company_id: string | null }[] = await conn.query(
      `SELECT id, company_id FROM branches WHERE id = ANY($1::uuid[])`,
      [valid],
    );
    return new Map(rows.map((r) => [r.id, r.company_id]));
  }
}
