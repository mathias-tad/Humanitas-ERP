import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleSubscriptionGuard } from './module-subscription.guard';
import { DatabaseService } from '../../database/database.service';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';

describe('ModuleSubscriptionGuard', () => {
  let guard: ModuleSubscriptionGuard;
  let reflector: Reflector;
  let databaseService: DatabaseService;
  let tenantRepository: Repository<Tenant>;

  beforeEach(() => {
    reflector = new Reflector();
    databaseService = {
      getTenantConnection: jest.fn(),
    } as unknown as DatabaseService;
    tenantRepository = {
      findOne: jest.fn(),
    } as unknown as Repository<Tenant>;

    guard = new ModuleSubscriptionGuard(reflector, databaseService, tenantRepository);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no module is required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const context = createMockContext({ tenantSlug: 'test-tenant' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if user is not authenticated', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('payroll');
    const context = createMockContext(null);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow core modules without DB lookup', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('notifications');
    const context = createMockContext({ tenantSlug: 'test-tenant' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(tenantRepository.findOne).not.toHaveBeenCalled();
  });

  it('should allow common collaboration modules (messaging, announcements) as core modules', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('messaging');
    const context = createMockContext({ tenantSlug: 'test-tenant' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(tenantRepository.findOne).not.toHaveBeenCalled();
  });

  it('should allow all modules if tenant has wildcard * feature', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('accounting');
    (tenantRepository.findOne as jest.Mock).mockResolvedValue({
      database_name: 'test_tenant_db',
      enabled_features: ['*'],
    });

    const context = createMockContext({ tenantSlug: 'test-tenant' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  describe('AI Feature Sub-Gating', () => {
    it('should throw when tenant has no AI in subscription', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ai');
      (tenantRepository.findOne as jest.Mock).mockResolvedValue({
        database_name: 'test_tenant_db',
        enabled_features: ['hrms', 'payroll'],
      });

      const context = createMockContext({ tenantSlug: 'test-tenant' });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should allow ai.help when tenant has ai.help', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ai.help');
      (tenantRepository.findOne as jest.Mock).mockResolvedValue({
        database_name: 'test_tenant_db',
        enabled_features: ['ai.help'],
      });

      const context = createMockContext({ tenantSlug: 'test-tenant' });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject ai.actions when tenant only has ai.help', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ai.actions');
      (tenantRepository.findOne as jest.Mock).mockResolvedValue({
        database_name: 'test_tenant_db',
        enabled_features: ['ai.help'],
      });

      const context = createMockContext({ tenantSlug: 'test-tenant' });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should reject ai.documents when tenant only has ai.help', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ai.documents');
      (tenantRepository.findOne as jest.Mock).mockResolvedValue({
        database_name: 'test_tenant_db',
        enabled_features: ['ai.help'],
      });

      const context = createMockContext({ tenantSlug: 'test-tenant' });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should allow ai.documents when tenant has ai.documents', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ai.documents');
      (tenantRepository.findOne as jest.Mock).mockResolvedValue({
        database_name: 'test_tenant_db',
        enabled_features: ['ai.documents'],
      });

      const context = createMockContext({ tenantSlug: 'test-tenant' });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow all AI features when tenant has ai.full', async () => {
      (tenantRepository.findOne as jest.Mock).mockResolvedValue({
        database_name: 'test_tenant_db',
        enabled_features: ['ai.full'],
      });

      const context = createMockContext({ tenantSlug: 'test-tenant' });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ai');
      expect(await guard.canActivate(context)).toBe(true);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ai.help');
      expect(await guard.canActivate(context)).toBe(true);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ai.actions');
      expect(await guard.canActivate(context)).toBe(true);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('ai.documents');
      expect(await guard.canActivate(context)).toBe(true);
    });
  });

  describe('Database fallback (tenant_modules table)', () => {
    it('should allow access when module is active in tenant_modules table', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('payroll');

      (tenantRepository.findOne as jest.Mock).mockResolvedValue({
        database_name: 'test_tenant_db',
        enabled_features: [],
      });

      const mockConnection = {
        query: jest.fn().mockImplementation((query: string) => {
          if (query.includes('CREATE TABLE')) return [];
          if (query.includes('SELECT is_active FROM tenant_modules')) {
            return [{ is_active: true }];
          }
          return [];
        }),
      };
      (databaseService.getTenantConnection as jest.Mock).mockResolvedValue(mockConnection);

      const context = createMockContext({ tenantSlug: 'test-tenant' });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject access when module is disabled or not in subscription', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('custom_erp_module');

      (tenantRepository.findOne as jest.Mock).mockResolvedValue({
        database_name: 'test_tenant_db',
        enabled_features: ['hrms'],
      });

      const context = createMockContext({ tenantSlug: 'test-tenant' });
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
