import { Test, TestingModule } from '@nestjs/testing';
import { DeveloperApiService } from './developer-api.service';
import { DatabaseService } from '../database/database.service';
import * as crypto from 'crypto';

describe('DeveloperApiService', () => {
  let service: DeveloperApiService;
  let mockConnection: any;

  beforeEach(async () => {
    mockConnection = {
      query: jest.fn(),
    };

    const mockDatabaseService = {
      getTenantConnectionById: jest.fn().mockResolvedValue(mockConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeveloperApiService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<DeveloperApiService>(DeveloperApiService);
    (service as any).ensuredTenants.add('tenant-1');
  });

  describe('API Key Management', () => {
    it('generates a secure API key with hk_live_ prefix and SHA-256 hash', async () => {
      mockConnection.query.mockResolvedValueOnce([
        {
          id: 'key-123',
          name: 'Zapier Integration',
          key_prefix: 'hk_live_abcd',
          scopes: ['read:employees', 'write:tasks'],
          rate_limit_per_minute: 120,
          expires_at: null,
          created_at: new Date().toISOString(),
        },
      ]);

      const result = await service.createApiKey('tenant-1', 'user-1', {
        name: 'Zapier Integration',
        scopes: ['read:employees', 'write:tasks'],
        rate_limit_per_minute: 120,
      });

      expect(result.id).toBe('key-123');
      expect(result.raw_key).toMatch(/^hk_live_[a-f0-9]{48}$/);
      expect(result.key_prefix).toBe(result.raw_key.substring(0, 12));
      expect(result.scopes).toEqual(['read:employees', 'write:tasks']);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO developer_api_keys'),
        expect.any(Array),
      );
    });

    it('verifies a valid API key against its SHA-256 hash', async () => {
      const rawKey = 'hk_live_1234567890abcdef1234567890abcdef1234567890abcdef';
      const expectedHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockConnection.query.mockResolvedValueOnce([
        {
          id: 'key-123',
          name: 'CI Integration',
          scopes: ['read:all'],
          rate_limit_per_minute: 60,
          is_active: true,
          expires_at: null,
          request_count: 5,
        },
      ]);

      const verified = await service.verifyApiKey('tenant-1', rawKey);
      expect(verified).not.toBeNull();
      expect(verified?.id).toBe('key-123');
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE key_hash = $1'),
        [expectedHash],
      );
    });

    it('rejects an inactive or revoked API key', async () => {
      const rawKey = 'hk_live_revokedkey';
      mockConnection.query.mockResolvedValueOnce([
        {
          id: 'key-revoked',
          is_active: false,
        },
      ]);

      const verified = await service.verifyApiKey('tenant-1', rawKey);
      expect(verified).toBeNull();
    });

    it('rejects an expired API key', async () => {
      const rawKey = 'hk_live_expiredkey';
      mockConnection.query.mockResolvedValueOnce([
        {
          id: 'key-expired',
          is_active: true,
          expires_at: new Date(Date.now() - 3600000).toISOString(), // expired 1 hour ago
        },
      ]);

      const verified = await service.verifyApiKey('tenant-1', rawKey);
      expect(verified).toBeNull();
    });
  });

  describe('HMAC Signature Calculation', () => {
    it('computes sha256 HMAC signature accurately', () => {
      const secret = 'whsec_my_test_secret';
      const payload = JSON.stringify({ event: 'employee.hired', id: 'emp-1' });

      const sig = service.computeHmacSignature(payload, secret);
      const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;

      expect(sig).toBe(expected);
      expect(sig.startsWith('sha256=')).toBe(true);
    });
  });

  describe('Webhook Management & Dispatch', () => {
    it('creates a webhook subscription with auto-generated secret key if omitted', async () => {
      mockConnection.query.mockResolvedValueOnce([
        {
          id: 'wh-1',
          name: 'Payroll Alerts',
          target_url: 'https://example.com/webhooks',
          secret_key: 'whsec_auto',
          events: ['payroll.run_completed'],
          is_active: true,
        },
      ]);

      const created = await service.createWebhook('tenant-1', 'user-1', {
        name: 'Payroll Alerts',
        target_url: 'https://example.com/webhooks',
        events: ['payroll.run_completed'],
      });

      expect(created.id).toBe('wh-1');
      expect(created.events).toEqual(['payroll.run_completed']);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webhook_subscriptions'),
        expect.arrayContaining(['Payroll Alerts', 'https://example.com/webhooks']),
      );
    });

    it('filters matching webhooks during dispatch', async () => {
      mockConnection.query.mockResolvedValueOnce([
        {
          id: 'wh-1',
          name: 'Employee Listener',
          target_url: 'https://example.com/emp',
          secret_key: 'sec1',
          events: ['employee.hired'],
        },
        {
          id: 'wh-2',
          name: 'Invoice Listener',
          target_url: 'https://example.com/inv',
          secret_key: 'sec2',
          events: ['invoice.created'],
        },
      ]);

      // Mock delivery insert
      mockConnection.query.mockResolvedValueOnce([{ id: 'del-1' }]);
      // Mock delivery update
      mockConnection.query.mockResolvedValueOnce([]);

      // Mock global fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('OK'),
      } as any);

      const results = await service.dispatchWebhookEvent('tenant-1', 'employee.hired', {
        employee_id: 'emp-101',
      });

      expect(results).toHaveLength(1);
      expect(results[0].webhook_id).toBe('wh-1');
      expect(results[0].status).toBe('success');

      global.fetch = originalFetch;
    });
  });
});
