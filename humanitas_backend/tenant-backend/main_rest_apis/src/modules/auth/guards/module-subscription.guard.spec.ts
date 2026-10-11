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
      enabled_features: ['hrms'], // explicit subscription excluding custom_erp_module
    });

    const context = createMockContext({ tenantSlug: 'test-tenant' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
