import { firstHeader, type AuthenticatedRequest } from '../../common/types/authenticated-request';
import { clientFromRequest } from '../activity-timeline/activity-client';
import type { CatalogContext } from './products.service';

/** Build the per-request context (tenant, user, selected company, client) for catalog services. */
export function catalogContext(req: AuthenticatedRequest): CatalogContext {
  return {
    tenantId: req.user?.tenantId || firstHeader(req.headers['x-tenant-id']) || 'default',
    user: req.user,
    companyHeader: firstHeader(req.headers['x-company-id']),
    client: clientFromRequest(req),
  };
}
