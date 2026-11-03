import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';

export const PERMISSIONS_KEY = 'permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private databaseService: DatabaseService,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Owner and admin roles have full access
    if (user.role === 'owner' || user.role === 'admin') {
      return true;
    }

    // Get tenant connection
    const tenant = await this.tenantRepository.findOne({
      where: { slug: user.tenantSlug },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    const connection = await this.databaseService.getTenantConnection(
      tenant.database_name,
    );

    const userId = user.sub || user.id;

    // Get user's role permissions
    const result = await connection.query(
      `SELECT r.permissions FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId],
    );

    if (!result || result.length === 0) {
      throw new ForbiddenException('User role not found');
    }

    const userPermissions: string[] = result[0].permissions || [];

    // Check if user has wildcard permission
    if (userPermissions.includes('*')) {
      return true;
    }

    // Check if user has any of the required permissions directly
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );

    if (hasPermission) {
      return true;
    }

    // Self-delegation exception: allow users to delegate their own authority without needing manage_delegations
    if (
      requiredPermissions.length === 1 &&
      requiredPermissions[0] === 'manage_delegations' &&
      request.method === 'POST'
    ) {
      const isSelfDelegating =
        !request.body?.delegator_id || request.body?.delegator_id === userId;
      if (isSelfDelegating) {
        return true;
      }
    }

    // Check user_delegations for active delegations where user is delegatee
    try {
      const activeDelegations = await connection.query(
        `SELECT d.id as delegation_id, d.delegator_id, d.scope, r.permissions
         FROM user_delegations d
         JOIN users u ON d.delegator_id = u.id
         JOIN roles r ON u.role_id = r.id
         WHERE d.delegatee_id = $1
           AND d.status = 'active'
           AND NOW() >= d.start_date
           AND NOW() <= d.end_date`,
        [userId],
      );

      for (const delegation of activeDelegations) {
        const delegatorPermissions: string[] = delegation.permissions || [];
        const scope = (delegation.scope || 'ALL').toUpperCase();

        const scopeAllows =
          scope === 'ALL' ||
          requiredPermissions.some((p) => p.toUpperCase().includes(scope));

        if (scopeAllows) {
          const delegatorHasPermission =
            delegatorPermissions.includes('*') ||
            requiredPermissions.some((permission) =>
              delegatorPermissions.includes(permission),
            );

          if (delegatorHasPermission) {
            request.on_behalf_of = delegation.delegator_id;
            request.delegation_id = delegation.delegation_id;
            return true;
          }
        }
      }
    } catch (_err: any) {
      // If table does not exist or query fails, fall through to ForbiddenException
    }

    throw new ForbiddenException(
      `Access denied. You do not have the required permissions to perform this action.`,
    );
  }
}
