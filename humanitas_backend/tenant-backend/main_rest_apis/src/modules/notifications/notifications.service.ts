import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsGateway } from './notifications.gateway';
import { NOTIFICATION_CATEGORY_PERMISSION_MAP, NOTIFICATION_CATEGORY_MODULE_MAP } from './dto/notification-preferences.dto';

@Injectable()
export class NotificationsService {
    private ensuredDatabases = new Set<string>();

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly notificationsGateway: NotificationsGateway
    ) { }

    async ensureNotificationsTables(connection: any) {
        const dbName = connection.options?.database || 'default';
        if (this.ensuredDatabases.has(dbName)) return;

        try {
            await connection.query(`
                CREATE TABLE IF NOT EXISTS notifications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    reference_id UUID,
                    title VARCHAR(255) NOT NULL,
                    message TEXT,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
                CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
                CREATE TABLE IF NOT EXISTS user_notification_preferences (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    channel VARCHAR(10) NOT NULL DEFAULT 'both',
                    updated_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id, category)
                );
                CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON user_notification_preferences(user_id);
            `);
            this.ensuredDatabases.add(dbName);
        } catch (err: any) {
            if (
                err.message?.includes('pg_type_typname_nsp_index') ||
                err.message?.includes('already exists') ||
                err.code === '23505'
            ) {
                this.ensuredDatabases.add(dbName);
                return;
            }
            throw err;
        }
    }

    async getUserNotifications(tenantId: string, userId: string, limit = 20) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureNotificationsTables(connection);

        return connection.query(`
            SELECT id, user_id, type, reference_id, title, message, is_read,
                   to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
            FROM notifications 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2
        `, [userId, limit]);
    }

    async getUnreadCount(tenantId: string, userId: string): Promise<number> {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureNotificationsTables(connection);

        const result = await connection.query(`
            SELECT COUNT(*) as count FROM notifications 
            WHERE user_id = $1 AND is_read = FALSE
        `, [userId]);

        return parseInt(result[0]?.count || '0', 10);
    }

    async createNotification(
        tenantId: string,
        userId: string,
        data: { type: string; referenceId?: string; title: string; message?: string; priority?: string }
    ) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureNotificationsTables(connection);

        const result = await connection.query(`
            INSERT INTO notifications (user_id, type, reference_id, title, message)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, user_id, type, reference_id, title, message, is_read,
                      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
        `, [userId, data.type, data.referenceId, data.title, data.message]);

        const notification = result[0];

        // Emit via socket
        this.notificationsGateway.pushToUser(tenantId, userId, {
            ...notification,
            priority: data.priority
        });

        return notification;
    }

    async createBulkNotifications(
        tenantId: string,
        userIds: string[],
        data: { type: string; referenceId?: string; title: string; message?: string; priority?: string }
    ) {
        if (!userIds.length) return [];

        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureNotificationsTables(connection);

        const results: any[] = [];
        for (const userId of userIds) {
            const result = await connection.query(`
                INSERT INTO notifications (user_id, type, reference_id, title, message)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, user_id, type, reference_id, title, message, is_read,
                          to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
            `, [userId, data.type, data.referenceId, data.title, data.message]);

            const notification = result[0];
            results.push(notification);

            // Emit individually or use bulk push if available on gateway. 
            // Gateway has pushToUsers but it sends Same Notification Object. 
            // Here each notification has unique ID but same content. 
            // Better to emit individually to ensure ID correctness for "Mark Read".
            this.notificationsGateway.pushToUser(tenantId, userId, {
                ...notification,
                priority: data.priority
            });
        }

        return results;
    }

    async markAsRead(tenantId: string, userId: string, notificationId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        await connection.query(`
            UPDATE notifications SET is_read = TRUE 
            WHERE id = $1 AND user_id = $2
        `, [notificationId, userId]);

        return { success: true };
    }

    async markAllAsRead(tenantId: string, userId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        await connection.query(`
            UPDATE notifications SET is_read = TRUE 
            WHERE user_id = $1 AND is_read = FALSE
        `, [userId]);

        return { success: true };
    }

    // Resolve target users based on target_type and target_ids
    async resolveTargetUsers(
        tenantId: string,
        targetType: 'all' | 'role' | 'category' | 'individual',
        targetIds: string[]
    ): Promise<string[]> {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        if (targetType === 'all') {
            const users = await connection.query(`SELECT id FROM users WHERE is_active = true`);
            console.log('[NotificationsService] Found all active users:', users.length);
            return users.map((u: any) => u.id);
        }

        if (targetType === 'role') {
            const users = await connection.query(`
                SELECT id FROM users 
                WHERE role_id = ANY($1::uuid[]) AND is_active = true
            `, [targetIds]);
            return users.map((u: any) => u.id);
        }

        if (targetType === 'category') {
            const users = await connection.query(`
                SELECT id FROM users 
                WHERE employee_category_id = ANY($1::uuid[]) AND is_active = true
            `, [targetIds]);
            return users.map((u: any) => u.id);
        }

        if (targetType === 'individual') {
            return targetIds;
        }

        return [];
    }

  async getNotificationPreferences(
    tenantId: string,
    userId: string,
    userPermissions: string[],
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureNotificationsTables(connection);

    const saved = await connection.query(
      `SELECT category, channel FROM user_notification_preferences WHERE user_id = $1`,
      [userId],
    );
    const savedMap: Record<string, string> = {};
    for (const row of saved) {
      savedMap[row.category] = row.channel;
    }

    const result: { category: string; channel: string; required_permission: string | null }[] = [];
    const isOwnerOrAdmin = userPermissions.includes('*');

    for (const [category, requiredPermission] of Object.entries(NOTIFICATION_CATEGORY_PERMISSION_MAP)) {
      const hasAccess =
        requiredPermission === null ||
        isOwnerOrAdmin ||
        userPermissions.includes(requiredPermission);

      if (hasAccess) {
        result.push({
          category,
          channel: savedMap[category] || 'both',
          required_permission: requiredPermission,
        });
      }
    }

    return result;
  }

  async updateNotificationPreference(
    tenantId: string,
    userId: string,
    category: string,
    channel: string,
    userPermissions: string[],
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureNotificationsTables(connection);

    const requiredPermission = NOTIFICATION_CATEGORY_PERMISSION_MAP[category];
    if (requiredPermission === undefined) {
      throw new Error(`Unknown notification category: ${category}`);
    }

    const isOwnerOrAdmin = userPermissions.includes('*');
    const hasAccess =
      requiredPermission === null ||
      isOwnerOrAdmin ||
      userPermissions.includes(requiredPermission);

    if (!hasAccess) {
      throw new Error(`You do not have permission for notification category: ${category}`);
    }

    await connection.query(
      `INSERT INTO user_notification_preferences (user_id, category, channel, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, category) DO UPDATE SET channel = $3, updated_at = NOW()`,
      [userId, category, channel],
    );

    return { success: true, category, channel };
  }

  async bulkUpdatePreferences(
    tenantId: string,
    userId: string,
    preferences: { category: string; channel: string }[],
    userPermissions: string[],
  ) {
    const results: any[] = [];
    for (const pref of preferences) {
      try {
        const result = await this.updateNotificationPreference(
          tenantId, userId, pref.category, pref.channel, userPermissions,
        );
        results.push(result);
      } catch (err: any) {
        results.push({ success: false, category: pref.category, error: err.message });
      }
    }
    return results;
  }

  async getEffectiveChannel(
    tenantId: string,
    userId: string,
    category: string,
  ): Promise<string> {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureNotificationsTables(connection);

    const result = await connection.query(
      `SELECT channel FROM user_notification_preferences WHERE user_id = $1 AND category = $2`,
      [userId, category],
    );

    return result[0]?.channel || 'both';
  }
}

