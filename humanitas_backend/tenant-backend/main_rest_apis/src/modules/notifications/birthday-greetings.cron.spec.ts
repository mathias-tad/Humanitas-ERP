import { Test, TestingModule } from '@nestjs/testing';
import { BirthdayGreetingsCron } from './birthday-greetings.cron';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from './notifications.service';
import { NotificationEmailService } from './notification-email.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tenant } from '../auth/entities/tenant.entity';

describe('BirthdayGreetingsCron', () => {
  let cron: BirthdayGreetingsCron;

  const mockDatabaseService = {
    getTenantConnectionById: jest.fn(),
  };

  const mockNotificationsService = {
    getBirthdayGreetingSettings: jest.fn(),
    getEffectiveChannel: jest.fn(),
    createNotification: jest.fn(),
  };

  const mockNotificationEmailService = {
    sendBirthdayGreeting: jest.fn(),
  };

  const mockTenantRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BirthdayGreetingsCron,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: NotificationEmailService, useValue: mockNotificationEmailService },
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
      ],
    }).compile();

    cron = module.get<BirthdayGreetingsCron>(BirthdayGreetingsCron);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(cron).toBeDefined();
  });

  it('should skip processing if tenant has deactivated birthday greetings', async () => {
    const testTenant = { id: 'tenant-1', slug: 'acme', name: 'Acme Corp', is_active: true } as unknown as Tenant;
    mockNotificationsService.getBirthdayGreetingSettings.mockResolvedValue({
      enabled: false,
      notifyColleagues: true,
      greetingMessage: 'Happy birthday!',
    });

    const result = await cron.processTenantBirthdays(testTenant);
    expect(result.celebrantsCount).toBe(0);
    expect(mockDatabaseService.getTenantConnectionById).not.toHaveBeenCalled();
  });

  it('should send greeting to celebrant and alerts to colleagues when enabled (default)', async () => {
    const testTenant = { id: 'tenant-1', slug: 'acme', name: 'Acme Corp', is_active: true } as unknown as Tenant;
    mockNotificationsService.getBirthdayGreetingSettings.mockResolvedValue({
      enabled: true,
      notifyColleagues: true,
      greetingMessage: 'Happy Birthday to our great teammate!',
    });

    const mockConn = {
      query: jest.fn(),
    };
    mockDatabaseService.getTenantConnectionById.mockResolvedValue(mockConn);

    // 1st query: celebrants
    mockConn.query
      .mockResolvedValueOnce([
        { id: 'user-celebrant-1', full_name: 'Alice Smith', email: 'alice@example.com', company_id: 'comp-1' },
      ])
      // 2nd query: colleagues
      .mockResolvedValueOnce([
        { id: 'user-colleague-2' },
        { id: 'user-colleague-3' },
      ]);

    // Celebrant wants both email and in-app
    mockNotificationsService.getEffectiveChannel.mockImplementation((tenantId, userId, category) => {
      if (category === 'birthday_greeting') return Promise.resolve('both');
      if (category === 'colleague_birthday_alert') return Promise.resolve('both');
      return Promise.resolve('both');
    });

    mockNotificationsService.createNotification.mockResolvedValue({ id: 'notif-1' });
    mockNotificationEmailService.sendBirthdayGreeting.mockResolvedValue(undefined);

    const result = await cron.processTenantBirthdays(testTenant);

    expect(result.celebrantsCount).toBe(1);

    // Direct greeting to celebrant
    expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
      'tenant-1',
      'user-celebrant-1',
      expect.objectContaining({
        type: 'birthday_greeting',
        title: expect.stringContaining('Alice Smith'),
      }),
    );
    expect(mockNotificationEmailService.sendBirthdayGreeting).toHaveBeenCalledWith(
      'acme',
      'alice@example.com',
      expect.objectContaining({ employeeName: 'Alice Smith' }),
      expect.any(String),
      'tenant-1',
    );

    // Colleague notifications sent to both colleagues
    expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
      'tenant-1',
      'user-colleague-2',
      expect.objectContaining({
        type: 'colleague_birthday_alert',
        title: expect.stringContaining('Alice Smith'),
      }),
    );
    expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
      'tenant-1',
      'user-colleague-3',
      expect.objectContaining({
        type: 'colleague_birthday_alert',
        title: expect.stringContaining('Alice Smith'),
      }),
    );
  });

  it('should not notify colleagues when notifyColleagues is set to false', async () => {
    const testTenant = { id: 'tenant-1', slug: 'acme', name: 'Acme Corp', is_active: true } as unknown as Tenant;
    mockNotificationsService.getBirthdayGreetingSettings.mockResolvedValue({
      enabled: true,
      notifyColleagues: false,
      greetingMessage: 'Happy Birthday!',
    });

    const mockConn = {
      query: jest.fn().mockResolvedValueOnce([
        { id: 'user-celebrant-1', full_name: 'Bob Jones', email: 'bob@example.com' },
      ]),
    };
    mockDatabaseService.getTenantConnectionById.mockResolvedValue(mockConn);
    mockNotificationsService.getEffectiveChannel.mockResolvedValue('both');
    mockNotificationsService.createNotification.mockResolvedValue({ id: 'notif-1' });
    mockNotificationEmailService.sendBirthdayGreeting.mockResolvedValue(undefined);

    const result = await cron.processTenantBirthdays(testTenant);

    expect(result.celebrantsCount).toBe(1);
    // Only 1 notification created (for Bob)
    expect(mockNotificationsService.createNotification).toHaveBeenCalledTimes(1);
  });
});
