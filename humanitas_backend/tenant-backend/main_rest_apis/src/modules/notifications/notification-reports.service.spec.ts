import { Test } from '@nestjs/testing';
import { NotificationReportsService } from './notification-reports.service';
import { DatabaseService } from '../database/database.service';

describe('NotificationReportsService', () => {
  let service: NotificationReportsService;

  const mockQuery = jest.fn().mockImplementation((queryText: string) => {
    if (typeof queryText === 'string') {
      if (queryText.includes('user_notification_preferences') && queryText.includes('GROUP BY channel')) {
        return Promise.resolve([
          { channel: 'email', count: '5' },
          { channel: 'push', count: '3' },
          { channel: 'both', count: '10' },
          { channel: 'none', count: '2' },
        ]);
      }
      if (queryText.includes('FROM users WHERE is_active = true')) {
        return Promise.resolve([{ count: '20' }]);
      }
      if (queryText.includes('notification_delivery_logs') && queryText.includes('COUNT(*)::int AS sent')) {
        return Promise.resolve([
          { channel: 'email', sent: 12, delivered: 10, failed: 2 },
          { channel: 'push', sent: 15, delivered: 14, failed: 1 },
        ]);
      }
      if (queryText.includes('COUNT(*)::int') && queryText.includes('AS total_sent')) {
        return Promise.resolve([{ total_sent: 27, delivered: 24, failed: 3, bounced: 0 }]);
      }
      if (queryText.includes('GROUP BY channel')) {
        return Promise.resolve([
          { channel: 'email', count: 12, success: 10 },
          { channel: 'push', count: 15, success: 14 },
        ]);
      }
      if (queryText.includes('GROUP BY category')) {
        return Promise.resolve([
          { category: 'leave_status_updates', count: 15, failures: 1 },
          { category: 'payslip_ready', count: 12, failures: 2 },
        ]);
      }
    }
    return Promise.resolve([]);
  });

  const mockDbService = {
    getTenantConnectionById: jest.fn().mockResolvedValue({
      query: mockQuery,
    }),
    getTenantConnection: jest.fn().mockResolvedValue({
      query: mockQuery,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationReportsService,
        { provide: DatabaseService, useValue: mockDbService },
      ],
    }).compile();
    service = module.get(NotificationReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getDeliveryStats returns stats object', async () => {
    (service as any).ensuredTenants.add('t1');
    const stats = await service.getDeliveryStats('t1');
    expect(stats).toHaveProperty('total_sent');
    expect(stats).toHaveProperty('delivered');
    expect(stats).toHaveProperty('failed');
    expect(stats).toHaveProperty('delivery_rate');
    expect(stats).toHaveProperty('summary');
  });

  it('getDeliveryStats supports days parameter', async () => {
    (service as any).ensuredTenants.add('t1');
    const stats = await service.getDeliveryStats('t1', undefined, undefined, 7);
    expect(stats).toHaveProperty('total_sent');
    expect(stats.total_sent).toBe(27);
  });

  it('getPreferenceDistribution returns distribution object', async () => {
    (service as any).ensuredTenants.add('t1');
    const dist = await service.getPreferenceDistribution('t1');
    expect(dist).toHaveProperty('total_users');
    expect(dist.total_users).toBe(20);
    expect(dist.email_only).toBe(5);
    expect(dist.push_only).toBe(3);
    expect(dist.both).toBe(10);
    expect(dist.none).toBe(2);
  });

  it('getChannelSummary returns array', async () => {
    (service as any).ensuredTenants.add('t1');
    const summary = await service.getChannelSummary('t1', 30);
    expect(Array.isArray(summary)).toBe(true);
    expect(summary.length).toBe(2);
    expect(summary[0]).toHaveProperty('channel', 'email');
    expect(summary[0]).toHaveProperty('sent', 12);
  });

  it('logDelivery executes successfully without throwing', async () => {
    (service as any).ensuredTenants.add('t1');
    await expect(
      service.logDelivery('t1', {
        userId: 'u1',
        category: 'announcement',
        channel: 'email',
        status: 'delivered',
      }),
    ).resolves.not.toThrow();
  });

  it('recordEmailOpen updates log and returns boolean', async () => {
    (service as any).ensuredTenants.add('t1');
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const result = await service.recordEmailOpen('t1', 'msg-123');
    expect(result).toBe(true);
  });

  it('recordEmailBounce updates log with bounce status', async () => {
    (service as any).ensuredTenants.add('t1');
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    const result = await service.recordEmailBounce('t1', 'msg-123', 'Mailbox full');
    expect(result).toBe(true);
  });

  it('getEmailAnalytics computes open rate and bounce rate percentages', async () => {
    (service as any).ensuredTenants.add('t1');
    mockQuery.mockResolvedValueOnce([{
      total_emails_sent: 100,
      delivered_count: 95,
      opened_count: 65,
      bounced_count: 5,
    }]);

    const analytics = await service.getEmailAnalytics('t1', 30);
    expect(analytics.total_emails_sent).toBe(100);
    expect(analytics.opened_count).toBe(65);
    expect(analytics.open_rate_percent).toBe(65);
    expect(analytics.bounced_count).toBe(5);
    expect(analytics.bounce_rate_percent).toBe(5);
    expect(analytics.delivery_rate_percent).toBe(95);
  });

  it('getBouncedEmails returns list of bounced records', async () => {
    (service as any).ensuredTenants.add('t1');
    mockQuery.mockResolvedValueOnce([
      {
        id: 'b1',
        recipient_email: 'invalid@test.com',
        category: 'payroll_ready',
        error_message: 'User does not exist',
        sent_at: new Date().toISOString(),
      },
    ]);

    const result = await service.getBouncedEmails('t1', 10);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].recipient_email).toBe('invalid@test.com');
  });
});
