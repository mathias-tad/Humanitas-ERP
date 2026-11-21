import { BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { PublicSignupService } from './public-signup.service';

function setup(settings: Record<string, unknown> | null = { self_signup_enabled: true, default_trial_days: 21, max_tenants: 100, platform_name: 'Humanitas' }) {
  const settingsRepository = { findOne: jest.fn(async () => settings) };
  const tenantRepository = { findOne: jest.fn(async () => null), count: jest.fn(async () => 5) };
  const tenantService = {
    create: jest.fn(async (dto: any) => ({ ...dto, trial_ends_at: new Date('2026-12-12T00:00:00Z') })),
  };
  const service = new PublicSignupService(settingsRepository as any, tenantRepository as any, tenantService as any);
  return { service, settingsRepository, tenantRepository, tenantService };
}

const dto = {
  company_name: ' Abebe Trading ',
  slug: 'abebe-trading',
  contact_email: 'Owner@Abebe.ET',
  modules: ['hrms', 'products'],
};

describe('PublicSignupService', () => {
  it('lists every module with its status, and the trial length set by the admin', async () => {
    const { service } = setup();
    const o = await service.options();
    expect(o.enabled).toBe(true);
    expect(o.trial_days).toBe(21);
    expect(o.modules.find((m) => m.key === 'products')?.status).toBe('available');
    expect(o.modules.find((m) => m.key === 'pos')?.status).toBe('coming_soon');
  });

  it('creates the tenant with the chosen modules', async () => {
    const { service, tenantService } = setup();
    const r = await service.signup({ ...dto }, '1.1.1.1');
    expect(tenantService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'Abebe Trading',
        slug: 'abebe-trading',
        contact_email: 'owner@abebe.et',
        enabled_features: ['hrms', 'products'],
      }),
    );
    expect(r).toEqual(expect.objectContaining({ slug: 'abebe-trading', contact_email: 'owner@abebe.et' }));
    expect(r).not.toHaveProperty('setup_token');
  });

  it('refuses when the admin has turned sign-up off', async () => {
    const { service, tenantService } = setup({ self_signup_enabled: false });
    await expect(service.signup({ ...dto }, '1.1.1.1')).rejects.toThrow(ForbiddenException);
    expect(tenantService.create).not.toHaveBeenCalled();
  });

  it('refuses modules that are not available yet, and reserved organization IDs', async () => {
    const { service } = setup();
    await expect(service.signup({ ...dto, modules: ['pos'] }, '1.1.1.1')).rejects.toThrow(/cannot be chosen yet: pos/);
    await expect(service.signup({ ...dto, slug: 'admin' }, '1.1.1.1')).rejects.toThrow(BadRequestException);
  });

  it('rejects bots that fill the hidden field', async () => {
    const { service, tenantService } = setup();
    await expect(service.signup({ ...dto, website: 'http://spam' }, '1.1.1.1')).rejects.toThrow(BadRequestException);
    expect(tenantService.create).not.toHaveBeenCalled();
  });

  it('limits sign-ups per visitor', async () => {
    const { service } = setup();
    for (let i = 0; i < 3; i++) await service.signup({ ...dto, slug: `shop-${i}`, contact_email: `o${i}@x.et` }, '2.2.2.2');
    await expect(service.signup({ ...dto, slug: 'shop-9' }, '2.2.2.2')).rejects.toThrow(HttpException);
    await expect(service.signup({ ...dto, slug: 'shop-8' }, '3.3.3.3')).resolves.toBeDefined();
  });

  it('refuses a taken organization ID and a full platform', async () => {
    const taken = setup();
    taken.tenantRepository.findOne.mockResolvedValue({ id: 't1' } as any);
    await expect(taken.service.signup({ ...dto }, '1.1.1.1')).rejects.toThrow(ConflictException);
    await expect(taken.service.slugAvailable('abebe-trading')).resolves.toEqual({ available: false, reason: expect.stringMatching(/taken/) });

    const full = setup({ self_signup_enabled: true, max_tenants: 5 });
    await expect(full.service.signup({ ...dto }, '1.1.1.1')).rejects.toThrow(ForbiddenException);
  });

  it('says why a organization ID cannot be used', async () => {
    const { service } = setup();
    await expect(service.slugAvailable('AB')).resolves.toEqual({ available: false, reason: expect.any(String) });
    await expect(service.slugAvailable('good-shop')).resolves.toEqual({ available: true });
  });
});
