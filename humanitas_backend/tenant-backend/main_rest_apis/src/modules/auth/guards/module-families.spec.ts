import { ForbiddenException } from '@nestjs/common';
import { MODULE_FAMILIES, ModuleSubscriptionGuard } from './module-subscription.guard';

/** Shared bases (contacts) open when the tenant has any module that uses them. */
function guardFor(required: string, tenant: Record<string, unknown>, tenantModules: { module_key: string; is_active: boolean }[] = []) {
  const reflector = { getAllAndOverride: () => required };
  const conn = {
    query: async (sql: string, params: unknown[] = []) => {
      if (/COUNT\(\*\) as count FROM tenant_modules/i.test(sql)) return [{ count: String(tenantModules.length) }];
      if (/SELECT is_active FROM tenant_modules WHERE module_key = \$1/.test(sql)) {
        const row = tenantModules.find((m) => m.module_key === params[0]);
        return row ? [{ is_active: row.is_active }] : [];
      }
      if (/FROM tenant_modules WHERE module_key = ANY/.test(sql)) {
        const keys = params[0] as string[];
        const rows = tenantModules.filter((m) => keys.includes(m.module_key));
        return rows.length ? [{ is_active: rows.some((r) => r.is_active) }] : [];
      }
      return [];
    },
  };
  const guard = new ModuleSubscriptionGuard(
    reflector as never,
    { getTenantConnection: async () => conn } as never,
    { findOne: async () => ({ slug: 't', database_name: 'db', ...tenant }) } as never,
  );
  const context = { getHandler: () => null, getClass: () => null, switchToHttp: () => ({ getRequest: () => ({ user: { tenantSlug: 't' } }) }) };
  return () => guard.canActivate(context as never);
}

describe('module families', () => {
  it('opens contacts for every module that deals with customers or vendors', async () => {
    expect(MODULE_FAMILIES.contacts).toEqual(expect.arrayContaining(['crm', 'sales', 'pos', 'accounting', 'purchasing', 'ecommerce', 'delivery']));
    for (const m of MODULE_FAMILIES.contacts) await expect(guardFor('contacts', { enabled_features: [m] })()).resolves.toBe(true);
  });

  it('keeps contacts closed for a tenant with only HR or Products', async () => {
    await expect(guardFor('contacts', { enabled_features: ['hrms', 'products'] })()).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reads module rows in the tenant database too', async () => {
    await expect(guardFor('contacts', { enabled_features: [] }, [{ module_key: 'pos', is_active: true }, { module_key: 'hrms', is_active: true }])()).resolves.toBe(true);
    await expect(guardFor('contacts', { enabled_features: [] }, [{ module_key: 'hrms', is_active: true }])()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guardFor('products', { enabled_features: [] }, [{ module_key: 'products', is_active: true }])()).resolves.toBe(true);
  });
});
