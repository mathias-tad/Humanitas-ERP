import { firstHeader, type AuthenticatedRequest, type AuthUser } from '../types/authenticated-request';
import { clientFromRequest, type ActivityClient } from '../../modules/activity-timeline/activity-client';

/**
 * The request context every business-record service needs (tenant, person, the company and branch
 * picked in the switcher, the client app). Shared by every module, so no module has to import
 * another one for it (rule 30).
 */
export interface CatalogContext {
  tenantId: string;
  user?: AuthUser;
  companyHeader?: string;
  /** x-branch-id, checked by CompanyScopeInterceptor. */
  branchHeader?: string;
  client?: ActivityClient;
}

/** Build the per-request context (tenant, user, selected company and branch, client). */
export function catalogContext(req: AuthenticatedRequest): CatalogContext {
  return {
    tenantId: req.user?.tenantId || firstHeader(req.headers['x-tenant-id']) || 'default',
    user: req.user,
    companyHeader: firstHeader(req.headers['x-company-id']),
    branchHeader: firstHeader(req.headers['x-branch-id']),
    client: clientFromRequest(req),
  };
}
