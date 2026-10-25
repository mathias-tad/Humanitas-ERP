import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateApiKeyDto, UpdateApiKeyDto, CreateWebhookDto, UpdateWebhookDto, TestWebhookDto } from './dto/developer-api.dto';
import * as crypto from 'crypto';

export interface GeneratedApiKeyResponse {
  id: string;
  name: string;
  key_prefix: string;
  raw_key: string; // ONLY returned upon creation!
  scopes: string[];
  rate_limit_per_minute: number;
  expires_at: string | null;
  created_at: string;
}

@Injectable()
export class DeveloperApiService {
  private readonly logger = new Logger(DeveloperApiService.name);
  private readonly ensuredTenants = new Set<string>();

  constructor(private readonly databaseService: DatabaseService) {}

  async ensureDeveloperApiTables(connection: any): Promise<void> {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS developer_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        key_prefix VARCHAR(15) NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        rate_limit_per_minute INT NOT NULL DEFAULT 60,
        is_active BOOLEAN NOT NULL DEFAULT true,
        expires_at TIMESTAMP NULL,
        last_used_at TIMESTAMP NULL,
        request_count INT NOT NULL DEFAULT 0,
        created_by UUID NULL,
        company_id UUID NULL,
        branch_id UUID NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_dev_keys_hash ON developer_api_keys(key_hash);
      CREATE INDEX IF NOT EXISTS idx_dev_keys_company ON developer_api_keys(company_id);

      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        target_url TEXT NOT NULL,
        secret_key VARCHAR(100) NOT NULL,
        events JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        company_id UUID NULL,
        branch_id UUID NULL,
        created_by UUID NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_webhooks_company ON webhook_subscriptions(company_id);

      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
        event VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        response_status INT NULL,
        response_body TEXT NULL,
        attempts INT NOT NULL DEFAULT 1,
        status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'success' | 'failed' | 'retrying'
        duration_ms INT NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_wh ON webhook_deliveries(webhook_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

      CREATE TABLE IF NOT EXISTS api_key_activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        status_code INT NOT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        duration_ms INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_key_activity_logs(api_key_id);
    `);
  }

  private async getConnection(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    if (!this.ensuredTenants.has(tenantId)) {
      await this.ensureDeveloperApiTables(connection);
      this.ensuredTenants.add(tenantId);
    }
    return connection;
  }

  // ── API Key Management ─────────────────────────────────────────────────────

  async createApiKey(tenantId: string, userId: string, dto: CreateApiKeyDto): Promise<GeneratedApiKeyResponse> {
    const connection = await this.getConnection(tenantId);

    // Generate random secret token: 'hk_live_' + 48 hex chars
    const randomHex = crypto.randomBytes(24).toString('hex');
    const rawKey = `hk_live_${randomHex}`;
    const keyPrefix = rawKey.substring(0, 12); // 'hk_live_xxxx'
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const result = await connection.query(
      `INSERT INTO developer_api_keys (
        name, key_prefix, key_hash, scopes, rate_limit_per_minute,
        expires_at, created_by, company_id, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, created_at`,
      [
        dto.name,
        keyPrefix,
        keyHash,
        JSON.stringify(dto.scopes || []),
        dto.rate_limit_per_minute || 60,
        dto.expires_at ? new Date(dto.expires_at) : null,
        userId,
        dto.company_id || null,
        dto.branch_id || null,
      ],
    );

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      key_prefix: keyPrefix,
      raw_key: rawKey,
      scopes: Array.isArray(row.scopes) ? row.scopes : JSON.parse(row.scopes || '[]'),
      rate_limit_per_minute: row.rate_limit_per_minute,
      expires_at: row.expires_at,
      created_at: row.created_at,
    };
  }

  async getApiKeys(tenantId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT id, name, key_prefix, scopes, rate_limit_per_minute,
             is_active, expires_at, last_used_at, request_count,
             company_id, branch_id, created_at
      FROM developer_api_keys
      WHERE 1=1
    `;
    const params: any[] = [];

    if (companyId) {
      params.push(companyId);
      query += ` AND (company_id = $${params.length} OR company_id IS NULL)`;
    }
    if (branchId) {
      params.push(branchId);
      query += ` AND (branch_id = $${params.length} OR branch_id IS NULL)`;
    }

    query += ` ORDER BY created_at DESC`;
    const rows = await connection.query(query, params);
    return rows.map((r: any) => ({
      ...r,
      scopes: Array.isArray(r.scopes) ? r.scopes : JSON.parse(r.scopes || '[]'),
    }));
  }

  async revokeApiKey(tenantId: string, keyId: string) {
    const connection = await this.getConnection(tenantId);
    const result = await connection.query(
      `UPDATE developer_api_keys SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [keyId],
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('API Key not found');
    }
    return { message: 'API Key revoked successfully', id: keyId };
  }

  async deleteApiKey(tenantId: string, keyId: string) {
    const connection = await this.getConnection(tenantId);
    const result = await connection.query(
      `DELETE FROM developer_api_keys WHERE id = $1 RETURNING id`,
      [keyId],
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('API Key not found');
    }
    return { message: 'API Key deleted successfully', id: keyId };
  }

  async verifyApiKey(tenantId: string, rawKey: string) {
    const connection = await this.getConnection(tenantId);
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const result = await connection.query(
      `SELECT id, name, scopes, rate_limit_per_minute, is_active, expires_at, request_count
       FROM developer_api_keys
       WHERE key_hash = $1`,
      [hash],
    );

    if (!result || result.length === 0) return null;
    const key = result[0];

    if (!key.is_active) return null;
    if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) return null;

    // Update usage stats asynchronously
    try {
      await connection.query(
        `UPDATE developer_api_keys
         SET last_used_at = NOW(), request_count = request_count + 1
         WHERE id = $1`,
        [key.id],
      );
    } catch (_) {}

    return {
      id: key.id,
      name: key.name,
      scopes: Array.isArray(key.scopes) ? key.scopes : JSON.parse(key.scopes || '[]'),
      rate_limit_per_minute: key.rate_limit_per_minute,
    };
  }

  async logApiKeyActivity(
    tenantId: string,
    keyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    ipAddress?: string,
    userAgent?: string,
    durationMs: number = 0,
  ) {
    const connection = await this.getConnection(tenantId);
    await connection.query(
      `INSERT INTO api_key_activity_logs (
        api_key_id, endpoint, method, status_code, ip_address, user_agent, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [keyId, endpoint, method, statusCode, ipAddress || null, userAgent || null, durationMs],
    );
  }

  async getApiKeyLogs(tenantId: string, keyId: string, limit: number = 50) {
    const connection = await this.getConnection(tenantId);
    return connection.query(
      `SELECT * FROM api_key_activity_logs WHERE api_key_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [keyId, limit],
    );
  }

  // ── Webhook Subscriptions ──────────────────────────────────────────────────

  async createWebhook(tenantId: string, userId: string, dto: CreateWebhookDto) {
    const connection = await this.getConnection(tenantId);

    // Auto-generate secure secret if not provided
    const secret = dto.secret_key || `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const result = await connection.query(
      `INSERT INTO webhook_subscriptions (
        name, target_url, secret_key, events, company_id, branch_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        dto.name,
        dto.target_url,
        secret,
        JSON.stringify(dto.events || []),
        dto.company_id || null,
        dto.branch_id || null,
        userId,
      ],
    );

    const row = result[0];
    return {
      ...row,
      events: Array.isArray(row.events) ? row.events : JSON.parse(row.events || '[]'),
    };
  }

  async getWebhooks(tenantId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT w.*,
             (SELECT COUNT(*) FROM webhook_deliveries d WHERE d.webhook_id = w.id AND d.status = 'success') as success_count,
             (SELECT COUNT(*) FROM webhook_deliveries d WHERE d.webhook_id = w.id AND d.status = 'failed') as failure_count
      FROM webhook_subscriptions w
      WHERE 1=1
    `;
    const params: any[] = [];

    if (companyId) {
      params.push(companyId);
      query += ` AND (w.company_id = $${params.length} OR w.company_id IS NULL)`;
    }
    if (branchId) {
      params.push(branchId);
      query += ` AND (w.branch_id = $${params.length} OR w.branch_id IS NULL)`;
    }

    query += ` ORDER BY w.created_at DESC`;
    const rows = await connection.query(query, params);
    return rows.map((r: any) => ({
      ...r,
      events: Array.isArray(r.events) ? r.events : JSON.parse(r.events || '[]'),
    }));
  }

  async updateWebhook(tenantId: string, id: string, dto: UpdateWebhookDto) {
    const connection = await this.getConnection(tenantId);
    const existing = await connection.query(`SELECT * FROM webhook_subscriptions WHERE id = $1`, [id]);
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Webhook subscription not found');
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];

    if (dto.name !== undefined) {
      params.push(dto.name);
      updates.push(`name = $${params.length}`);
    }
    if (dto.target_url !== undefined) {
      params.push(dto.target_url);
      updates.push(`target_url = $${params.length}`);
    }
    if (dto.secret_key !== undefined) {
      params.push(dto.secret_key);
      updates.push(`secret_key = $${params.length}`);
    }
    if (dto.events !== undefined) {
      params.push(JSON.stringify(dto.events));
      updates.push(`events = $${params.length}`);
    }
    if (dto.is_active !== undefined) {
      params.push(dto.is_active);
      updates.push(`is_active = $${params.length}`);
    }

    const result = await connection.query(
      `UPDATE webhook_subscriptions SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params,
    );
    const row = result[0];
    return {
      ...row,
      events: Array.isArray(row.events) ? row.events : JSON.parse(row.events || '[]'),
    };
  }

  async deleteWebhook(tenantId: string, id: string) {
    const connection = await this.getConnection(tenantId);
    const result = await connection.query(
      `DELETE FROM webhook_subscriptions WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Webhook not found');
    }
    return { message: 'Webhook deleted successfully', id };
  }

  // ── Webhook Dispatch & HMAC Signature Engine ───────────────────────────────

  computeHmacSignature(payload: string, secretKey: string): string {
    return `sha256=${crypto.createHmac('sha256', secretKey).update(payload).digest('hex')}`;
  }

  async dispatchWebhookEvent(tenantId: string, eventName: string, eventPayload: any) {
    const connection = await this.getConnection(tenantId);

    // Find all active webhooks subscribed to eventName or '*' (wildcard)
    const webhooks = await connection.query(
      `SELECT id, name, target_url, secret_key, events
       FROM webhook_subscriptions
       WHERE is_active = true`,
    );

    const matching = webhooks.filter((wh: any) => {
      const evs = Array.isArray(wh.events) ? wh.events : JSON.parse(wh.events || '[]');
      return evs.includes(eventName) || evs.includes('*');
    });

    const results = [];
    for (const wh of matching) {
      const delivery = await this.sendWebhookRequest(connection, wh, eventName, eventPayload);
      results.push(delivery);
    }

    return results;
  }

  private async sendWebhookRequest(
    connection: any,
    webhook: { id: string; target_url: string; secret_key: string },
    event: string,
    payload: any,
  ) {
    const bodyStr = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const signature = this.computeHmacSignature(bodyStr, webhook.secret_key);
    const startTime = Date.now();

    // Create delivery record in pending status
    const insertRes = await connection.query(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [webhook.id, event, JSON.stringify(payload)],
    );
    const deliveryId = insertRes[0].id;

    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let status = 'failed';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(webhook.target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-humanitas-signature': signature,
          'x-humanitas-event': event,
          'x-humanitas-delivery': deliveryId,
          'x-humanitas-timestamp': new Date().toISOString(),
        },
        body: bodyStr,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      responseStatus = res.status;
      responseBody = await res.text().catch(() => null);
      status = res.ok ? 'success' : 'failed';
    } catch (err: any) {
      responseBody = err.message || 'Connection failed';
      status = 'failed';
    }

    const durationMs = Date.now() - startTime;

    await connection.query(
      `UPDATE webhook_deliveries
       SET response_status = $1, response_body = $2, status = $3, duration_ms = $4, last_attempt_at = NOW()
       WHERE id = $5`,
      [responseStatus, responseBody?.substring(0, 2000), status, durationMs, deliveryId],
    );

    return {
      delivery_id: deliveryId,
      webhook_id: webhook.id,
      event,
      status,
      response_status: responseStatus,
      duration_ms: durationMs,
    };
  }

  async retryWebhookDelivery(tenantId: string, deliveryId: string) {
    const connection = await this.getConnection(tenantId);
    const result = await connection.query(
      `SELECT d.*, w.target_url, w.secret_key
       FROM webhook_deliveries d
       INNER JOIN webhook_subscriptions w ON w.id = d.webhook_id
       WHERE d.id = $1`,
      [deliveryId],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Delivery record not found');
    }

    const item = result[0];
    const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;

    const bodyStr = JSON.stringify({
      event: item.event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const signature = this.computeHmacSignature(bodyStr, item.secret_key);
    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let status = 'failed';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(item.target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-humanitas-signature': signature,
          'x-humanitas-event': item.event,
          'x-humanitas-delivery': deliveryId,
          'x-humanitas-timestamp': new Date().toISOString(),
        },
        body: bodyStr,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      responseStatus = res.status;
      responseBody = await res.text().catch(() => null);
      status = res.ok ? 'success' : 'failed';
    } catch (err: any) {
      responseBody = err.message || 'Retry failed';
      status = 'failed';
    }

    const durationMs = Date.now() - startTime;

    await connection.query(
      `UPDATE webhook_deliveries
       SET response_status = $1, response_body = $2, status = $3, attempts = attempts + 1, duration_ms = $4, last_attempt_at = NOW()
       WHERE id = $5`,
      [responseStatus, responseBody?.substring(0, 2000), status, durationMs, deliveryId],
    );

    return {
      delivery_id: deliveryId,
      status,
      response_status: responseStatus,
      duration_ms: durationMs,
    };
  }

  async getWebhookDeliveries(tenantId: string, webhookId?: string, limit: number = 50, offset: number = 0) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT d.*, w.name as webhook_name, w.target_url
      FROM webhook_deliveries d
      INNER JOIN webhook_subscriptions w ON w.id = d.webhook_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (webhookId) {
      params.push(webhookId);
      query += ` AND d.webhook_id = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY d.created_at DESC LIMIT $${params.length}`;

    params.push(offset);
    query += ` OFFSET $${params.length}`;

    return connection.query(query, params);
  }

  async testWebhook(tenantId: string, dto: TestWebhookDto) {
    const testSecret = dto.secret_key || 'whsec_test_secret_key';
    const testEvent = dto.event || 'test.ping';
    const testPayload = {
      message: 'Humanitas Webhook Verification Ping',
      ping_time: new Date().toISOString(),
      tenant_id: tenantId,
    };

    const bodyStr = JSON.stringify({
      event: testEvent,
      timestamp: new Date().toISOString(),
      data: testPayload,
    });

    const signature = this.computeHmacSignature(bodyStr, testSecret);
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(dto.target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-humanitas-signature': signature,
          'x-humanitas-event': testEvent,
          'x-humanitas-test': 'true',
        },
        body: bodyStr,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const text = await res.text().catch(() => '');
      return {
        success: res.ok,
        status_code: res.status,
        duration_ms: Date.now() - startTime,
        response_body: text.substring(0, 500),
      };
    } catch (err: any) {
      return {
        success: false,
        status_code: 0,
        duration_ms: Date.now() - startTime,
        error: err.message || 'Connection error',
      };
    }
  }
}
