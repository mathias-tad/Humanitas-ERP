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
  ) { }

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

    // Get user's role permissions
    const result = await connection.query(
      `SELECT r.permissions FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [user.sub],
    );

    if (!result || result.length === 0) {
      throw new ForbiddenException('User role not found');
    }

    const userPermissions: string[] = result[0].permissions || [];
    console.log(`[PermissionsGuard] User ${user.sub} (Role ${user.role}) has permissions:`, userPermissions);

    // Check if user has wildcard permission
    if (userPermissions.includes('*')) {
      return true;
    }

    // Check if user has any of the required permissions
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied. Required permissions: ${requiredPermissions.join(', ')}. Your permissions: ${userPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
