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

    // Core identity & infrastructure modules are always accessible to authenticated users
    const CORE_MODULES = [
      'users',
      'notifications',
      'auth',
      'settings',
      'roles',
      'presence',
      'messaging',
      'announcements',
      'scheduling',
      'wfm',
    ];
    const req = requiredModule.toLowerCase().trim();
    if (CORE_MODULES.includes(req)) {
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
      const feats = tenant.enabled_features.map((f: string) => f.toLowerCase().trim());
      if (feats.includes('*')) {
        return true;
      }

      // AI Capability Sub-Gating (ai.help, ai.actions, ai.documents, ai.full)
      if (req.startsWith('ai')) {
        const isSubscribedToAi =
          feats.includes('ai') ||
          feats.includes('ai.full') ||
          feats.includes('ai.help') ||
          feats.includes('ai.actions') ||
          feats.includes('ai.documents');

        if (!isSubscribedToAi) {
          throw new ForbiddenException(
            `Module "ai" is not subscribed in your tenant package.`,
          );
        }

        if (req === 'ai' || req === 'ai.help') {
          return true;
        }

        if (req === 'ai.actions') {
          if (feats.includes('ai') || feats.includes('ai.full') || feats.includes('ai.actions')) {
            return true;
          }
          throw new ForbiddenException(
            `AI Actions capability ("ai.actions") is not included in your subscription package.`,
          );
        }

        if (req === 'ai.documents') {
          if (feats.includes('ai') || feats.includes('ai.full') || feats.includes('ai.documents')) {
            return true;
          }
          throw new ForbiddenException(
            `AI Document Generation capability ("ai.documents") is not included in your subscription package.`,
          );
        }

        if (req === 'ai.full') {
          if (feats.includes('ai') || feats.includes('ai.full')) {
            return true;
          }
          throw new ForbiddenException(
            `Full AI suite ("ai.full") is not included in your subscription package.`,
          );
        }
      }

      if (
        feats.includes(req) ||
        (req === 'hrms' && (feats.includes('hr') || feats.includes('hrms') || feats.includes('attendance') || feats.includes('leave') || feats.includes('payroll'))) ||
        (req === 'hr' && (feats.includes('hr') || feats.includes('hrms'))) ||
        (feats.includes('hrms') && ['attendance', 'leave', 'scheduling', 'messaging', 'wfm'].includes(req))
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

    // Check AI module keys in tenant_modules if applicable
    if (req.startsWith('ai')) {
      const aiRows = await connection.query(
        `SELECT module_key, is_active FROM tenant_modules WHERE module_key LIKE 'ai%' AND is_active = true`,
      );
      if (aiRows && aiRows.length > 0) {
        const activeAiKeys = aiRows.map((r: any) => r.module_key.toLowerCase().trim());
        if (req === 'ai' || req === 'ai.help') {
          return true;
        }
        if (req === 'ai.actions' && (activeAiKeys.includes('ai') || activeAiKeys.includes('ai.full') || activeAiKeys.includes('ai.actions'))) {
          return true;
        }
        if (req === 'ai.documents' && (activeAiKeys.includes('ai') || activeAiKeys.includes('ai.full') || activeAiKeys.includes('ai.documents'))) {
          return true;
        }
      }
    }

    const result = await connection.query(
      `SELECT is_active FROM tenant_modules WHERE module_key = $1 LIMIT 1`,
      [req],
    );

    if (result && result.length > 0) {
      if (!result[0].is_active) {
        throw new ForbiddenException(
          `Module "${requiredModule}" is currently disabled for this tenant.`,
        );
      }
      return true;
    }

    // Check if tenant has hrms subscribed which covers scheduling & wfm
    if (['scheduling', 'wfm'].includes(req)) {
      const hrmsSub = await connection.query(
        `SELECT is_active FROM tenant_modules WHERE module_key IN ('hrms', 'hr', 'scheduling', 'wfm') AND is_active = true LIMIT 1`,
      );
      if (hrmsSub && hrmsSub.length > 0) {
        return true;
      }
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

    // Default active core HRMS modules only for empty configuration
    const defaultCoreModules = [
      'users',
      'notifications',
      'auth',
      'settings',
      'roles',
      'presence',
      'hrms',
      'attendance',
      'leave',
      'scheduling',
      'wfm',
    ];

    if (defaultCoreModules.includes(req)) {
      return true;
    }

    throw new ForbiddenException(
      `Module "${requiredModule}" is not subscribed or enabled for this tenant.`,
    );
  }
}
