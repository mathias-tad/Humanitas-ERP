import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';

describe('TenantService soft delete / restore / purge', () => {
  const DAY = 24 * 60 * 60 * 1000;
  let tenant: any;
  let repo: any;
  let dataSource: any;
  let service: TenantService;

  beforeEach(() => {
    tenant = { id: 't1', slug: 'acme', company_name: 'Acme', database_name: 'tenant_acme', is_active: true, deleted_at: null, purge_after: null };
    repo = {
      findOne: jest.fn(async () => (tenant ? { ...tenant } : null)),
      save: jest.fn(async (t: any) => { tenant = { ...t }; return { ...t }; }),
    };
    dataSource = { query: jest.fn(async () => [{ database_name: 'tenant_acme', company_name: 'Acme' }]) };
    service = new TenantService(repo, {} as any, dataSource, { get: jest.fn() } as any, {} as any);
  });

  const dropCalls = () => dataSource.query.mock.calls.filter(([sql]: [string]) => /DROP\s+(SCHEMA|DATABASE)|DELETE FROM tenants/i.test(sql));

  it('requires the slug as confirmation', async () => {
    await expect(service.softDelete('t1', '')).rejects.toThrow(BadRequestException);
    await expect(service.softDelete('t1', 'wrong')).rejects.toThrow(BadRequestException);
    expect(tenant.deleted_at).toBeNull();
  });

  it('deactivates and keeps data for the retention period, without dropping anything', async () => {
    const res = await service.softDelete('t1', 'acme');
    expect(tenant.is_active).toBe(false);
    expect(tenant.deleted_at).toBeInstanceOf(Date);
    const kept = tenant.purge_after.getTime() - tenant.deleted_at.getTime();
    expect(Math.round(kept / DAY)).toBe(TenantService.RETENTION_DAYS);
    expect(res.purge_after).toEqual(tenant.purge_after);
    expect(dropCalls()).toHaveLength(0);
  });

  it('restores a deleted tenant', async () => {
    await service.softDelete('t1', 'acme');
    await service.restore('t1');
    expect(tenant).toMatchObject({ is_active: true, deleted_at: null, purge_after: null });
  });

  it('refuses to purge a live tenant or before the retention period ends', async () => {
    await expect(service.purge('t1', 'acme')).rejects.toThrow(BadRequestException);
    await service.softDelete('t1', 'acme');
    await expect(service.purge('t1', 'acme')).rejects.toThrow(BadRequestException);
    expect(dropCalls()).toHaveLength(0);
  });

  it('purges after the retention period with the slug confirmed', async () => {
    tenant.deleted_at = new Date(Date.now() - 31 * DAY);
    tenant.purge_after = new Date(Date.now() - DAY);
    tenant.is_active = false;
    await expect(service.purge('t1', 'wrong')).rejects.toThrow(BadRequestException);
    await service.purge('t1', 'acme');
    expect(dropCalls().length).toBeGreaterThan(0);
  });

  it('404s for unknown tenants', async () => {
    tenant = null;
    await expect(service.softDelete('x', 'acme')).rejects.toThrow(NotFoundException);
  });
});
