import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleSubscriptionGuard } from './module-subscription.guard';
import { DatabaseService } from '../../database/database.service';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { JwtService } from '@nestjs/jwt';

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

  describe('token fallback when the guard runs before JwtAuthGuard', () => {
    const SECRET = 'test-secret-for-module-guard-0123456789';
    const OLD_SECRET = process.env.JWT_SECRET;
    const payload = { sub: 'u1', email: 'u@x.test', tenantId: 't1', tenantSlug: 'victim-co', role: 'owner' };

    const contextWithBearer = (token: string, request: any = {}) =>
      ({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => Object.assign(request, { headers: { authorization: `Bearer ${token}` } }),
        }),
      }) as unknown as ExecutionContext;

    beforeEach(() => {
      process.env.JWT_SECRET = SECRET;
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('notifications'); // core module: no DB needed
    });
    afterAll(() => {
      if (OLD_SECRET === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = OLD_SECRET;
    });

    it('accepts a correctly signed access token and sets req.user', async () => {
      const token = new JwtService({ secret: SECRET }).sign(payload);
      const request: any = {};
      await expect(guard.canActivate(contextWithBearer(token, request))).resolves.toBe(true);
      expect(request.user).toMatchObject({ sub: 'u1', tenantSlug: 'victim-co' });
    });

    it('rejects an unsigned/forged token', async () => {
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
      const request: any = {};
      await expect(guard.canActivate(contextWithBearer(forged, request))).rejects.toThrow(ForbiddenException);
      expect(request.user).toBeUndefined();
    });

    it('rejects a token signed with a different secret', async () => {
      const token = new JwtService({ secret: 'some-other-secret-0123456789abcdef' }).sign(payload);
      await expect(guard.canActivate(contextWithBearer(token))).rejects.toThrow(ForbiddenException);
    });

    it('rejects refresh tokens', async () => {
      const token = new JwtService({ secret: SECRET }).sign({ ...payload, token_use: 'refresh' });
      await expect(guard.canActivate(contextWithBearer(token))).rejects.toThrow(ForbiddenException);
    });

    it('fails closed when JWT_SECRET is not configured', async () => {
      const token = new JwtService({ secret: SECRET }).sign(payload);
      delete process.env.JWT_SECRET;
      await expect(guard.canActivate(contextWithBearer(token))).rejects.toThrow(ForbiddenException);
    });
  });
});
