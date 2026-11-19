import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard, SUPER_ADMIN_ONLY_KEY, SUPPORT_ACCESS_KEY, SupportAccessLevel } from './admin.guard';

function ctx(user: any, method = 'GET'): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user, method }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let reflector: Reflector;
  let guard: AdminGuard;
  let meta: { support?: SupportAccessLevel; superOnly?: boolean };

  beforeEach(() => {
    meta = {};
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) =>
      key === SUPPORT_ACCESS_KEY ? meta.support : key === SUPER_ADMIN_ONLY_KEY ? meta.superOnly : undefined,
    );
    guard = new AdminGuard(reflector);
  });

  const admin = { type: 'admin', role: 'admin' };
  const support = { type: 'admin', role: 'support' };
  const superAdmin = { type: 'admin', role: 'super_admin' };

  it('rejects missing and non-admin users', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx({ type: 'tenant_user', role: 'owner' }))).toThrow(ForbiddenException);
  });

  it('lets admins read and write by default', () => {
    expect(guard.canActivate(ctx(admin, 'GET'))).toBe(true);
    expect(guard.canActivate(ctx(admin, 'DELETE'))).toBe(true);
  });

  it('support is read-only by default', () => {
    expect(guard.canActivate(ctx(support, 'GET'))).toBe(true);
    expect(() => guard.canActivate(ctx(support, 'POST'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx(support, 'PATCH'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx(support, 'DELETE'))).toThrow(ForbiddenException);
  });

  it("support can write where marked 'write'", () => {
    meta.support = 'write';
    expect(guard.canActivate(ctx(support, 'POST'))).toBe(true);
  });

  it("support has no access where marked 'none'", () => {
    meta.support = 'none';
    expect(() => guard.canActivate(ctx(support, 'GET'))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx(admin, 'GET'))).toBe(true);
  });

  it('super-admin-only routes reject admin and support', () => {
    meta.superOnly = true;
    expect(() => guard.canActivate(ctx(admin, 'DELETE'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx(support, 'DELETE'))).toThrow(ForbiddenException);
    expect(guard.canActivate(ctx(superAdmin, 'DELETE'))).toBe(true);
  });
});
