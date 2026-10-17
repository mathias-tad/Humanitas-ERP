import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../../database/database.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';

export const MODULE_KEY = 'requiredModule';

/**
 * Decorator to require a specific module subscription for a controller or endpoint.
 * Example: @RequireModule('payroll')
 */
export const RequireModule = (moduleName: string) =>
  SetMetadata(MODULE_KEY, moduleName);

@Injectable()
export class ModuleSubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private databaseService: DatabaseService,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no module is required, allow access
    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    let user = request.user;

    // Fallback: If running globally before controller-level JwtAuthGuard, extract user from Bearer token OR Cookie
    if (!user) {
      let rawToken: string | undefined;
      if (request.headers?.authorization) {
        const [type, token] = request.headers.authorization.split(' ');
        if (type === 'Bearer') rawToken = token;
      } else if (request.cookies?.access_token) {
        rawToken = request.cookies.access_token;
      }

      if (rawToken) {
        try {
          const base64Payload = rawToken.split('.')[1];
          if (base64Payload) {
            const normalized = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
            user = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
            request.user = user;
          }
        } catch {
          // ignore parsing error, will fail on user validation below
        }
      }
    }

    if (!user || !user.tenantSlug) {
      throw new ForbiddenException('User not authenticated');
    }

    // Core HRMS & identity modules are always accessible to authenticated users
    const CORE_MODULES = [
      'users',
      'hrms',
      'hr',
      'notifications',
      'auth',
      'settings',
      'roles',
      'presence',
      'messaging',
    ];
    const req = requiredModule.toLowerCase();
    if (CORE_MODULES.includes(req)) {
      return true;
    }

    // Tenant owners and administrators have full module access within their subscription
    if (user.role === 'owner' || user.role === 'admin') {
      return true;
    }

    // Look up the tenant in master DB
    const tenant = await this.tenantRepository.findOne({
      where: { slug: user.tenantSlug },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    // 1. Check if tenant in master DB has explicit enabled_features
    if (tenant.enabled_features && tenant.enabled_features.length > 0) {
      const feats = tenant.enabled_features.map((f: string) => f.toLowerCase());
      if (
        feats.includes('*') ||
        feats.includes(req) ||
        (req === 'hrms' && (feats.includes('hr') || feats.includes('attendance') || feats.includes('leave') || feats.includes('pms') || feats.includes('payroll'))) ||
        (req === 'hr' && (feats.includes('hrms') || feats.includes('attendance') || feats.includes('leave'))) ||
        ((feats.includes('hrms') || feats.includes('hr') || feats.includes('attendance')) &&
          ['payroll', 'attendance', 'leave', 'scheduling', 'recruitment', 'messaging', 'notifications'].includes(req))
      ) {
        return true;
      }
      throw new ForbiddenException(
        `Module "${requiredModule}" is not subscribed in your tenant package.`,
      );
    }

    // 2. Check tenant's database for tenant_modules table
    const connection = await this.databaseService.getTenantConnection(
      tenant.database_name,
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tenant_modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module_key VARCHAR(50) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await connection.query(
      `SELECT is_active FROM tenant_modules WHERE module_key = $1 LIMIT 1`,
      [requiredModule],
    );

    if (result && result.length > 0) {
      if (!result[0].is_active) {
        throw new ForbiddenException(
          `Module "${requiredModule}" is currently disabled for this tenant.`,
        );
      }
      return true;
    }

    // If tenant_modules has records configured, but not this module, reject
    const countResult = await connection.query(
      `SELECT COUNT(*) as count FROM tenant_modules`,
    );
    const count = parseInt(countResult?.[0]?.count || '0', 10);
    if (count > 0) {
      throw new ForbiddenException(
        `Module "${requiredModule}" is not subscribed for this tenant.`,
      );
    }

    // Default active core HRMS modules for standard/trial installations
    const defaultCoreModules = [
      'hrms',
      'attendance',
      'leave',
      'payroll',
      'scheduling',
      'pms',
      'messaging',
      'notifications',
      'ai',
    ];

    if (defaultCoreModules.includes(requiredModule)) {
      return true;
    }

    throw new ForbiddenException(
      `Module "${requiredModule}" is not subscribed or enabled for this tenant.`,
    );
  }
}
