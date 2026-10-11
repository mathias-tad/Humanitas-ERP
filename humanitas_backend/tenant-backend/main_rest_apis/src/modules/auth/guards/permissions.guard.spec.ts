import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { DatabaseService } from '../../database/database.service';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
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

    guard = new PermissionsGuard(reflector, databaseService, tenantRepository);
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

  it('should allow access if no permissions are required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const context = createMockContext({ role: 'employee' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow owner or admin unconditionally', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['manage_payroll']);
    const context = createMockContext({ role: 'owner' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny unauthorized user without leaking sensitive internal permissions in the exception', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['manage_payroll']);

    (tenantRepository.findOne as jest.Mock).mockResolvedValue({
      database_name: 'test_db',
    });

    const mockConnection = {
      query: jest.fn().mockResolvedValue([{ permissions: ['view_attendance', 'view_leave'] }]),
    };
    (databaseService.getTenantConnection as jest.Mock).mockResolvedValue(mockConnection);

    const context = createMockContext({
      sub: 'user-123',
      role: 'employee',
      tenantSlug: 'test-tenant',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);

    try {
      await guard.canActivate(context);
    } catch (err: any) {
      // Ensure the error message DOES NOT leak user permissions!
      expect(err.message).not.toContain('Your permissions:');
      expect(err.message).not.toContain('view_attendance');
      expect(err.message).toContain('Access denied');
    }
  });
});
