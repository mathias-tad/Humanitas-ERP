import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admins can access any tenant (for admin panel)
    if (user.type === 'admin') {
      return true;
    }

    // Regular users must have a tenant
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    // Check X-Tenant-ID header matches user's tenant
    const headerTenantId = request.headers['x-tenant-id'];
    if (headerTenantId && headerTenantId !== user.tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return true;
  }
}
