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
   * @deprecated NOT populated: JwtStrategy never sets these, so they are
   * always undefined at runtime. Typed only so existing reads compile without
   * a behaviour change; each read site is marked with a FIXME.
   */
  permissions?: string[];
  /** @deprecated NOT populated; always undefined. See permissions. */
  enabledFeatures?: string[];
  /** @deprecated NOT populated; always undefined. See permissions. */
  companyName?: string;
}

/** A Fastify request that has passed JwtAuthGuard. */
export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthUser;
}

/** A header value as a single string (first value if the header was repeated). */
export function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
