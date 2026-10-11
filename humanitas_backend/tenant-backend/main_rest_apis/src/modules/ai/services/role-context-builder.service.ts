import { Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../auth/entities/tenant.entity';

@Injectable()
export class RoleContextBuilderService {
  constructor(
    private databaseService: DatabaseService,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  /**
   * Retrieves the user's role and permissions from the database.
   */
  async buildContext(tenantSlug: string, userId: string, userRoleName: string): Promise<string> {
    // If owner or admin, they have all permissions
    if (userRoleName === 'owner' || userRoleName === 'admin') {
      return `User has full 'admin' access with all permissions.`;
    }

    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    const connection = await this.databaseService.getTenantConnection(tenant.database_name);

    const result = await connection.query(
      `SELECT r.permissions, r.name as role_name FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId],
    );

    if (!result || result.length === 0) {
      throw new ForbiddenException('User role not found');
    }

    const permissions: string[] = result[0].permissions || [];
    const roleName = result[0].role_name || userRoleName;

    // Check for explicit AI permission (or wildcard)
    if (!permissions.includes('use_ai') && !permissions.includes('*') && !permissions.includes('all')) {
      throw new ForbiddenException('User does not have permission to use AI features.');
    }

    return `User Role: ${roleName}\nUser Permissions: ${permissions.join(', ')}\nIMPORTANT: You must only perform actions or return data that the user has permission for based on the permissions list above.`;
  }

  /**
   * Returns the user's RBAC permission array for programmatic enforcement.
   * Owners and admins receive ['*'] (wildcard = all permissions).
   */
  async getPermissions(tenantSlug: string, userId: string, userRoleName: string): Promise<string[]> {
    if (userRoleName === 'owner' || userRoleName === 'admin') {
      return ['*'];
    }

    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });

    if (!tenant) return [];

    const connection = await this.databaseService.getTenantConnection(tenant.database_name);

    const result = await connection.query(
      `SELECT r.permissions FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId],
    );

    return result?.[0]?.permissions ?? [];
  }
}
