import { Test } from '@nestjs/testing';
import { NotificationEmailService } from './notification-email.service';
import { EmailTemplatesService } from './email-templates.service';
import { DatabaseService } from '../database/database.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tenant } from '../auth/entities/tenant.entity';

// ── Mock nodemailer so no real SMTP connection is ever attempted ──────────────
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
    verify: jest.fn().mockResolvedValue(true),
    close: jest.fn(),
  }),
}));

describe('NotificationEmailService', () => {
  let service: NotificationEmailService;

  const mockTenantRepo = { findOne: jest.fn() };
  const mockDbService = {
    getTenantConnection: jest.fn(),
    getTenantConnectionById: jest.fn(),
  };
  const mockEmailTemplatesService = {
    getTemplate: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationEmailService,
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
        { provide: DatabaseService, useValue: mockDbService },
        { provide: EmailTemplatesService, useValue: mockEmailTemplatesService },
      ],
    }).compile();
    service = module.get(NotificationEmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not throw when SMTP is not configured (graceful skip)', async () => {
    mockTenantRepo.findOne.mockResolvedValue(null);
    await expect(
      service.sendLeaveApproved(
        'test-tenant',
        'test@example.com',
        {
          employeeName: 'John',
          leaveType: 'Annual',
          startDate: '2026-01-01',
          endDate: '2026-01-05',
          approvedBy: 'Manager',
        },
        'https://app.test',
      ),
    ).resolves.not.toThrow();
  });

  it('getTenantEmailSettings falls back to env when tenant not found', async () => {
    mockTenantRepo.findOne.mockResolvedValue(null);
    const settings = await (service as any).getTenantEmailSettings('test');
    expect(settings).toHaveProperty('host');
    expect(settings).toHaveProperty('companyName');
    expect(settings).toHaveProperty('appUrl');
  });

  it('should not throw when sendLeaveRejected is called without SMTP config', async () => {
    mockTenantRepo.findOne.mockResolvedValue(null);
    await expect(
      service.sendLeaveRejected(
        'test-tenant',
        'test@example.com',
        {
          employeeName: 'Jane',
          leaveType: 'Sick',
          startDate: '2026-02-01',
          endDate: '2026-02-03',
          reason: 'Staff shortage',
        },
        'https://app.test',
      ),
    ).resolves.not.toThrow();
  });

  it('should not throw when sendPayrollReady is called without SMTP config', async () => {
    mockTenantRepo.findOne.mockResolvedValue(null);
    await expect(
      service.sendPayrollReady(
        'test-tenant',
        'test@example.com',
        {
          employeeName: 'John',
          payPeriod: 'October 2026',
          netPay: '$3,500',
          payDate: '2026-10-31',
        },
        'https://app.test',
      ),
    ).resolves.not.toThrow();
  });

  it('should not throw when sendDocumentExpiry is called without SMTP config', async () => {
    mockTenantRepo.findOne.mockResolvedValue(null);
    await expect(
      service.sendDocumentExpiry(
        'test-tenant',
        'test@example.com',
        {
          employeeName: 'John',
          documentName: 'Passport',
          expiryDate: '2026-12-31',
          daysRemaining: 67,
        },
        'https://app.test',
      ),
    ).resolves.not.toThrow();
  });

  it('should not throw when sendTaskAssigned is called without SMTP config', async () => {
    mockTenantRepo.findOne.mockResolvedValue(null);
    await expect(
      service.sendTaskAssigned(
        'test-tenant',
        'test@example.com',
        {
          employeeName: 'John',
          taskTitle: 'Fix bug #123',
          projectName: 'Alpha',
          dueDate: '2026-11-01',
          assignedBy: 'PM',
        },
        'task-uuid-123',
        'https://app.test',
      ),
    ).resolves.not.toThrow();
  });

  it('should use custom DB template when available', async () => {
    mockTenantRepo.findOne.mockResolvedValue(null);
    mockEmailTemplatesService.getTemplate.mockResolvedValueOnce({
      subject: 'Custom: Your Leave is Approved!',
      html_body: '<p>Hi {{employeeName}}, your leave is approved.</p>',
      plain_text_body: 'Hi {{employeeName}}, your leave is approved.',
    });
    await expect(
      service.sendLeaveApproved(
        'test-tenant',
        'test@example.com',
        {
          employeeName: 'Alice',
          leaveType: 'Annual',
          startDate: '2026-03-01',
          endDate: '2026-03-05',
          approvedBy: 'Bob',
        },
        'https://app.test',
      ),
    ).resolves.not.toThrow();
  });
});
