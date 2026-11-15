import type { FastifyRequest } from 'fastify';
// Pull in the request augmentations (req.cookies, req.file()) these plugins add.
import type {} from '@fastify/cookie';
import type {} from '@fastify/multipart';

/**
 * The user attached to the request by JwtStrategy.validate().
 * These are the only fields a verified token carries; read anything else
 * (company, branch, permissions) from the database or request headers.
 */
export interface AuthUser {
  sub: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  role: string;
  type?: string;
  /**
   * The role's permissions, attached by PermissionsGuard on routes that use
   * @RequirePermissions or @AttachPermissions. Undefined for owner/admin
   * (they bypass the lookup) and on other routes.
   */
  permissions?: string[];
}

/** A Fastify request that has passed JwtAuthGuard. */
export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthUser;
}

/** A header value as a single string (first value if the header was repeated). */
export function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
