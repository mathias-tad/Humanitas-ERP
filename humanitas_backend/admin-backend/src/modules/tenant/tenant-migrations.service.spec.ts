import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TenantMigrationsService } from './tenant-migrations.service';
import { TenantMigrationService } from './tenant-migration.service';
import { Tenant } from './entities/tenant.entity';

describe('TenantMigrationsService', () => {
  let service: TenantMigrationsService;
  let migrationService: jest.Mocked<TenantMigrationService>;

  const mockTenantRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(null),
  };

  const mockMigrationService = {
    getTenantMigrationStatus: jest.fn(),
    forceRunMigrations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMigrationsService,
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepository },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TenantMigrationService, useValue: mockMigrationService },
      ],
    }).compile();

    service = module.get<TenantMigrationsService>(TenantMigrationsService);
    migrationService = module.get(TenantMigrationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getMigrationStatus filters by tenantSlug when provided', async () => {
    const mockTenant = { slug: 'acme', database_name: 'tenant_acme', is_active: true } as Tenant;
    mockTenantRepository.findOne.mockResolvedValue(mockTenant);
    mockMigrationService.getTenantMigrationStatus.mockResolvedValue({
      database: 'tenant_acme',
      totalFiles: 3,
      appliedCount: 3,
      pendingCount: 0,
      applied: ['001.sql', '002.sql', '003.sql'],
      pending: [],
    });

    // Mock getTenantDataSource to avoid real DB connection
    jest.spyOn(service as any, 'getTenantDataSource').mockResolvedValue({
      isInitialized: true,
      destroy: jest.fn(),
    });

    const result = await service.getMigrationStatus('acme');
    expect(result).toHaveLength(1);
    expect(result[0].database).toBe('tenant_acme');
    expect(mockTenantRepository.findOne).toHaveBeenCalledWith({ where: { slug: 'acme' } });
  });

  it('runMigrations returns migrated and errors arrays', async () => {
    const mockTenants = [
      { slug: 'acme', database_name: 'tenant_acme', is_active: true },
      { slug: 'beta', database_name: 'tenant_beta', is_active: true },
    ] as Tenant[];
    mockTenantRepository.find.mockResolvedValue(mockTenants);
    mockMigrationService.forceRunMigrations.mockResolvedValueOnce(['003.sql']).mockRejectedValueOnce(new Error('DB down'));

    jest.spyOn(service as any, 'getTenantDataSource').mockResolvedValue({
      isInitialized: true,
      destroy: jest.fn(),
    });

    const result = await service.runMigrations();
    expect(result.migrated).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].tenant).toBe('beta');
  });
});
