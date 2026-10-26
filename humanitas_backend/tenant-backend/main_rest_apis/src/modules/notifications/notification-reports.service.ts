import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotificationReportsService {
  private ensuredTenants = new Set<string>();

  constructor(private databaseService: DatabaseService) {}

  private async getConnection(tenantId: string) {
    const conn = await this.databaseService.getTenantConnectionById(tenantId);
    if (!this.ensuredTenants.has(tenantId)) {
      await this.ensureTables(conn);
      this.ensuredTenants.add(tenantId);
    }
    return conn;
  }

  private async ensureTables(conn: any) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notification_delivery_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(36),
        user_id VARCHAR(36),
        category VARCHAR(100),
        channel VARCHAR(10) NOT NULL,
        status VARCHAR(20) DEFAULT 'sent',
        template_name VARCHAR(100),
        recipient_email VARCHAR(255),
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add index if not exists
    await conn.query(`
      CREATE INDEX IF NOT EXISTS idx_ndl_tenant_sent ON notification_delivery_logs(tenant_id, sent_at);
      ALTER TABLE notification_delivery_logs ADD COLUMN IF NOT EXISTS message_id VARCHAR(100);
      ALTER TABLE notification_delivery_logs ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_ndl_msg_id ON notification_delivery_logs(message_id);
    `).catch(() => {/* index may already exist */});
  }

  async logDelivery(
    tenantId: string,
    data: {
      userId?: string;
      category: string;
      channel: 'email' | 'push' | 'in_app';
      status: 'sent' | 'delivered' | 'failed' | 'bounced';
      templateName?: string;
      recipientEmail?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    try {
      const conn = await this.getConnection(tenantId);
      await conn.query(
        `INSERT INTO notification_delivery_logs
           (tenant_id, user_id, category, channel, status, template_name, recipient_email, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tenantId,
          data.userId || null,
          data.category,
          data.channel,
          data.status,
          data.templateName || null,
          data.recipientEmail || null,
          data.errorMessage || null,
        ],
      );
    } catch {
      // Logging failure should never break main flow
    }
  }

  async getDeliveryStats(tenantId: string, startDate?: string, endDate?: string, days?: number) {
    const conn = await this.getConnection(tenantId);

    let dateFilter = `AND sent_at >= NOW() - INTERVAL '30 days'`;
    let params: any[] = [tenantId];

    if (startDate && endDate) {
      dateFilter = `AND sent_at BETWEEN $2 AND $3`;
      params = [tenantId, startDate, endDate];
    } else if (days) {
      dateFilter = `AND sent_at >= NOW() - ($2::int * INTERVAL '1 day')`;
      params = [tenantId, Number(days)];
    }

    const [summary, byChannel, byCategory] = await Promise.all([
      conn.query(
        `SELECT
           COUNT(*)::int                                                     AS total_sent,
           SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)::int       AS delivered,
           SUM(CASE WHEN status = 'failed'    THEN 1 ELSE 0 END)::int       AS failed,
           SUM(CASE WHEN status = 'bounced'   THEN 1 ELSE 0 END)::int       AS bounced
         FROM notification_delivery_logs
         WHERE tenant_id = $1 ${dateFilter}`,
        params,
      ).catch(() => [{ total_sent: 0, delivered: 0, failed: 0, bounced: 0 }]),
      conn.query(
        `SELECT
           channel,
           COUNT(*)::int AS count,
           SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END)::int AS success
         FROM notification_delivery_logs
         WHERE tenant_id = $1 ${dateFilter}
         GROUP BY channel`,
        params,
      ).catch(() => []),
      conn.query(
        `SELECT
           category,
           COUNT(*)::int AS count,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int AS failures
         FROM notification_delivery_logs
         WHERE tenant_id = $1 ${dateFilter}
         GROUP BY category
         ORDER BY count DESC
         LIMIT 10`,
        params,
      ).catch(() => []),
    ]);

    const s = (summary && summary[0]) || { total_sent: 0, delivered: 0, failed: 0, bounced: 0 };
    const total_sent = parseInt(s.total_sent || '0', 10);
    const total_delivered = parseInt(s.delivered || '0', 10);
    const total_failed = parseInt(s.failed || '0', 10);
    const total_bounced = parseInt(s.bounced || '0', 10);
    const delivery_rate = total_sent > 0 ? Math.round((total_delivered * 100) / total_sent) : 0;

    return {
      total_sent,
      total_delivered,
      delivered: total_delivered,
      total_failed,
      failed: total_failed,
      total_bounced,
      delivery_rate,
      summary: s,
      byChannel: byChannel || [],
      byCategory: byCategory || [],
    };
  }

  async getPreferenceDistribution(tenantId: string): Promise<{
    total_users: number;
    email_only: number;
    push_only: number;
    both: number;
    none: number;
  }> {
    const conn = await this.getConnection(tenantId);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        category VARCHAR(100) NOT NULL,
        channel VARCHAR(10) NOT NULL DEFAULT 'both',
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, category)
      )
    `).catch(() => {});

    const rows = await conn.query(`
      SELECT channel, COUNT(DISTINCT user_id)::int as count 
      FROM user_notification_preferences 
      GROUP BY channel
    `).catch(() => []);

    let email_only = 0;
    let push_only = 0;
    let both = 0;
    let none = 0;

    for (const r of rows || []) {
      const count = parseInt(r.count, 10) || 0;
      if (r.channel === 'email') email_only = count;
      else if (r.channel === 'push') push_only = count;
      else if (r.channel === 'both') both = count;
      else if (r.channel === 'none') none = count;
    }

    const userCountRes = await conn.query(
      `SELECT COUNT(*)::int as count FROM users WHERE is_active = true`
    ).catch(() => [{ count: email_only + push_only + both + none }]);
    const total_users = parseInt(userCountRes[0]?.count || (email_only + push_only + both + none).toString(), 10);

    return {
      total_users,
      email_only,
      push_only,
      both,
      none,
    };
  }

  async getChannelSummary(tenantId: string, days: number = 30): Promise<any[]> {
    const conn = await this.getConnection(tenantId);
    const rows = await conn.query(`
      SELECT
        channel,
        COUNT(*)::int AS sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)::int AS delivered,
        SUM(CASE WHEN status = 'failed'    THEN 1 ELSE 0 END)::int AS failed
      FROM notification_delivery_logs
      WHERE tenant_id = $1
        AND sent_at >= NOW() - ($2::int * INTERVAL '1 day')
      GROUP BY channel
    `, [tenantId, Number(days) || 30]).catch(() => []);

    return rows || [];
  }

  async recordEmailOpen(tenantId: string, messageId: string): Promise<boolean> {
    try {
      const conn = await this.getConnection(tenantId);
      const res = await conn.query(
        `UPDATE notification_delivery_logs
         SET opened_at = NOW(), status = CASE WHEN status = 'sent' THEN 'delivered' ELSE status END
         WHERE (message_id = $1 OR id::text = $1)
           AND channel = 'email'`,
        [messageId],
      );
      return res.rowCount > 0;
    } catch {
      return false;
    }
  }

  async recordEmailBounce(tenantId: string, messageId: string, reason?: string): Promise<boolean> {
    try {
      const conn = await this.getConnection(tenantId);
      const res = await conn.query(
        `UPDATE notification_delivery_logs
         SET status = 'bounced', error_message = $2
         WHERE (message_id = $1 OR id::text = $1)
           AND channel = 'email'`,
        [messageId, reason || 'Email delivery bounced'],
      );
      return res.rowCount > 0;
    } catch {
      return false;
    }
  }

  async getEmailAnalytics(tenantId: string, days: number = 30): Promise<{
    total_emails_sent: number;
    delivered_count: number;
    opened_count: number;
    bounced_count: number;
    open_rate_percent: number;
    bounce_rate_percent: number;
    delivery_rate_percent: number;
  }> {
    const conn = await this.getConnection(tenantId);
    const rows = await conn.query(
      `SELECT
         COUNT(*)::int AS total_emails_sent,
         SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END)::int AS delivered_count,
         SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END)::int AS opened_count,
         SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END)::int AS bounced_count
       FROM notification_delivery_logs
       WHERE tenant_id = $1
         AND channel = 'email'
         AND sent_at >= NOW() - ($2::int * INTERVAL '1 day')`,
      [tenantId, Number(days) || 30],
    ).catch(() => [{ total_emails_sent: 0, delivered_count: 0, opened_count: 0, bounced_count: 0 }]);

    const s = rows?.[0] || { total_emails_sent: 0, delivered_count: 0, opened_count: 0, bounced_count: 0 };
    const total_emails_sent = parseInt(s.total_emails_sent, 10) || 0;
    const delivered_count = parseInt(s.delivered_count, 10) || 0;
    const opened_count = parseInt(s.opened_count, 10) || 0;
    const bounced_count = parseInt(s.bounced_count, 10) || 0;

    const open_rate_percent = total_emails_sent > 0 ? Math.round((opened_count * 100) / total_emails_sent) : 0;
    const bounce_rate_percent = total_emails_sent > 0 ? Math.round((bounced_count * 100) / total_emails_sent) : 0;
    const delivery_rate_percent = total_emails_sent > 0 ? Math.round((delivered_count * 100) / total_emails_sent) : 0;

    return {
      total_emails_sent,
      delivered_count,
      opened_count,
      bounced_count,
      open_rate_percent,
      bounce_rate_percent,
      delivery_rate_percent,
    };
  }

  async getBouncedEmails(tenantId: string, limit: number = 50): Promise<any[]> {
    const conn = await this.getConnection(tenantId);
    const rows = await conn.query(
      `SELECT
         id,
         recipient_email,
         category,
         template_name,
         error_message,
         sent_at
       FROM notification_delivery_logs
       WHERE tenant_id = $1
         AND status = 'bounced'
       ORDER BY sent_at DESC
       LIMIT $2`,
      [tenantId, Number(limit) || 50],
    ).catch(() => []);
    return rows || [];
  }
}
