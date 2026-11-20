import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * What the `support` admin role may do on a route or controller:
 * - 'read'  (default): GET/HEAD only
 * - 'write': full access (the service enforces any finer rules)
 * - 'none' : no access at all (secrets, platform configuration, logs)
 * `admin` and `super_admin` are unaffected.
 */
export type SupportAccessLevel = 'none' | 'read' | 'write';
export const SUPPORT_ACCESS_KEY = 'adminSupportAccess';
export const SupportAccess = (level: SupportAccessLevel) => SetMetadata(SUPPORT_ACCESS_KEY, level);

/** Restricts a route or controller to the `super_admin` role. */
export const SUPER_ADMIN_ONLY_KEY = 'adminSuperAdminOnly';
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY_KEY, true);

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.type !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_ONLY_KEY, targets) && user.role !== 'super_admin') {
      throw new ForbiddenException('Super admin access required');
    }

    if (user.role === 'support') {
      const level = this.reflector.getAllAndOverride<SupportAccessLevel>(SUPPORT_ACCESS_KEY, targets) ?? 'read';
      if (level === 'none') {
        throw new ForbiddenException('Not available to support accounts');
      }
      if (level === 'read' && !READ_METHODS.has(String(request.method || '').toUpperCase())) {
        throw new ForbiddenException('Support accounts have read-only access here');
      }
    }

    return true;
  }
}
