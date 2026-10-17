import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Tenant, SubscriptionStatus, SubscriptionPlan } from './entities/tenant.entity';
import { EmailService } from '../email/email.service';
import { TenantMigrationService } from './tenant-migration.service';

describe('TenantService', () => {
  let service: TenantService;
  let tenantRepo: jest.Mocked<Repository<Tenant>>;
  let emailService: jest.Mocked<EmailService>;
  let configService: jest.Mocked<ConfigService>;

  const mockTenantRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEmailService = {
    sendTenantWelcomeEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendUserSetupEmail: jest.fn(),
    testConnection: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'TENANT_FRONTEND_URL') return 'https://humanitas-erp.ziontech.tech';
      return defaultValue;
    }),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockTenantMigrationService = {
    getTenantMigrationStatus: jest.fn(),
    forceRunMigrations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: TenantMigrationService, useValue: mockTenantMigrationService },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    tenantRepo = module.get(getRepositoryToken(Tenant));
    emailService = module.get(EmailService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resendSetupEmail', () => {
    it('throws NotFoundException when tenant is not found', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);

      await expect(service.resendSetupEmail('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTenantRepo.findOne).toHaveBeenCalledWith({ where: { id: 'invalid-id' } });
    });

    it('throws BadRequestException when tenant has no contact email', async () => {
      const tenantWithoutEmail = {
        id: 't-123',
        company_name: 'Acme Corp',
        contact_email: '',
      } as Tenant;
      mockTenantRepo.findOne.mockResolvedValue(tenantWithoutEmail);

      await expect(service.resendSetupEmail('t-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('generates a new setup token, saves tenant, sends email, and returns success', async () => {
      const mockTenant = {
        id: 't-123',
        company_name: 'Acme Corp',
        contact_email: 'admin@acme.com',
        is_setup_complete: false,
      } as Tenant;

      mockTenantRepo.findOne.mockResolvedValue(mockTenant);
      mockTenantRepo.save.mockImplementation(async (entity) => entity as Tenant);
      mockEmailService.sendTenantWelcomeEmail.mockResolvedValue(true);

      const result = await service.resendSetupEmail('t-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Setup email sent successfully to admin@acme.com');
      expect(result.setup_link).toContain('https://humanitas-erp.ziontech.tech/setup?token=');
      expect(mockTenant.setup_token).toBeDefined();
      expect(mockTenant.setup_token_expires_at).toBeDefined();
      expect(mockTenantRepo.save).toHaveBeenCalledWith(mockTenant);
      expect(mockEmailService.sendTenantWelcomeEmail).toHaveBeenCalledWith(
        'admin@acme.com',
        'Acme Corp',
        mockTenant.setup_token,
      );
    });

    it('returns failure status when email service fails to deliver email', async () => {
      const mockTenant = {
        id: 't-456',
        company_name: 'Beta LLC',
        contact_email: 'admin@beta.com',
        is_setup_complete: false,
      } as Tenant;

      mockTenantRepo.findOne.mockResolvedValue(mockTenant);
      mockTenantRepo.save.mockImplementation(async (entity) => entity as Tenant);
      mockEmailService.sendTenantWelcomeEmail.mockResolvedValue(false);

      const result = await service.resendSetupEmail('t-456');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Setup link generated, but email delivery failed');
      expect(result.setup_link).toContain('https://humanitas-erp.ziontech.tech/setup?token=');
      expect(mockTenantRepo.save).toHaveBeenCalled();
    });
  });

  describe('suspend and reactivate', () => {
    it('suspends an active tenant', async () => {
      const mockTenant = {
        id: 't-1',
        subscription_status: SubscriptionStatus.ACTIVE,
        is_active: true,
      } as Tenant;

      mockTenantRepo.findOne.mockResolvedValue(mockTenant);
      mockTenantRepo.save.mockImplementation(async (entity) => entity as Tenant);

      const suspended = await service.suspend('t-1');
      expect(suspended.subscription_status).toBe(SubscriptionStatus.SUSPENDED);
      expect(suspended.is_active).toBe(false);
    });

    it('throws BadRequestException if tenant is already suspended', async () => {
      const mockTenant = {
        id: 't-1',
        subscription_status: SubscriptionStatus.SUSPENDED,
        is_active: false,
      } as Tenant;

      mockTenantRepo.findOne.mockResolvedValue(mockTenant);

      await expect(service.suspend('t-1')).rejects.toThrow(BadRequestException);
    });

    it('reactivates a suspended tenant', async () => {
      const mockTenant = {
        id: 't-1',
        subscription_status: SubscriptionStatus.SUSPENDED,
        is_active: false,
      } as Tenant;

      mockTenantRepo.findOne.mockResolvedValue(mockTenant);
      mockTenantRepo.save.mockImplementation(async (entity) => entity as Tenant);

      const reactivated = await service.reactivate('t-1');
      expect(reactivated.subscription_status).toBe(SubscriptionStatus.ACTIVE);
      expect(reactivated.is_active).toBe(true);
    });
  });
});
