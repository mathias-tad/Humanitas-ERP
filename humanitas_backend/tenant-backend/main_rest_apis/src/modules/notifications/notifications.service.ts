import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly notificationsGateway: NotificationsGateway
    ) { }

    // ... (ensureNotificationsTables, tables setup omitted for brevity if unchanged, but I need to keep them or not replace them. 
    // Wait, replace_file_content replaces lines. I should target constructor and create methods)

    async ensureNotificationsTables(connection: any) {
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
        `);
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
}
