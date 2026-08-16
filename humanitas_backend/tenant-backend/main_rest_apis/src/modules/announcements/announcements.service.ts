import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
    ) { }

    async ensureAnnouncementsTables(connection: any) {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                priority VARCHAR(20) DEFAULT 'normal',
                target_type VARCHAR(20) NOT NULL,
                target_ids TEXT[],
                created_by UUID,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
    }

    async findAll(tenantId: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureAnnouncementsTables(connection);

        return connection.query(`
            SELECT a.*, u.full_name as created_by_name
            FROM announcements a
            LEFT JOIN users u ON a.created_by = u.id
            ORDER BY a.created_at DESC
        `);
    }

    async findOne(tenantId: string, id: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const result = await connection.query(`
            SELECT a.*, u.full_name as created_by_name
            FROM announcements a
            LEFT JOIN users u ON a.created_by = u.id
            WHERE a.id = $1
        `, [id]);

        if (!result.length) throw new NotFoundException('Announcement not found');
        return result[0];
    }

    async create(tenantId: string, userId: string, dto: CreateAnnouncementDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureAnnouncementsTables(connection);

        const result = await connection.query(`
            INSERT INTO announcements (title, content, priority, target_type, target_ids, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            dto.title,
            dto.content,
            dto.priority || 'normal',
            dto.target_type,
            dto.target_ids || [],
            userId,
        ]);

        const announcement = result[0];

        // Send notifications to target users
        await this.sendNotifications(tenantId, announcement, 'New Announcement');

        return announcement;
    }

    async update(tenantId: string, id: string, dto: UpdateAnnouncementDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        const existing = await this.findOne(tenantId, id);
        if (!existing) throw new NotFoundException('Announcement not found');

        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (dto.title) { fields.push(`title = $${idx++}`); values.push(dto.title); }
        if (dto.content) { fields.push(`content = $${idx++}`); values.push(dto.content); }
        if (dto.priority) { fields.push(`priority = $${idx++}`); values.push(dto.priority); }
        if (dto.target_type) { fields.push(`target_type = $${idx++}`); values.push(dto.target_type); }
        if (dto.target_ids) { fields.push(`target_ids = $${idx++}`); values.push(dto.target_ids); }

        if (fields.length === 0) return existing;

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await connection.query(`
            UPDATE announcements SET ${fields.join(', ')}
            WHERE id = $${idx}
            RETURNING *
        `, values);

        const updated = result[0];

        // Send notification about update
        await this.sendNotifications(tenantId, updated, 'Announcement Updated');

        return updated;
    }

    async delete(tenantId: string, id: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await connection.query(`DELETE FROM announcements WHERE id = $1`, [id]);
        return { success: true };
    }

    private async sendNotifications(tenantId: string, announcement: any, actionTitle: string) {
        console.log('[Announcements] sendNotifications called for:', actionTitle);

        // Resolve target users
        const userIds = await this.notificationsService.resolveTargetUsers(
            tenantId,
            announcement.target_type,
            announcement.target_ids || [],
        );

        console.log('[Announcements] Resolved target userIds:', userIds);

        if (!userIds.length) {
            console.log('[Announcements] No users to notify');
            return;
        }

        // Create persistent notifications
        const notifications = await this.notificationsService.createBulkNotifications(
            tenantId,
            userIds,
            {
                type: 'announcement',
                referenceId: announcement.id,
                title: actionTitle,
                message: announcement.title,
            },
        );

        console.log('[Announcements] Created notifications:', notifications.length);

        // Push real-time via WebSocket
        for (let i = 0; i < userIds.length; i++) {
            console.log('[Announcements] Pushing to user:', userIds[i]);
            this.notificationsGateway.pushToUser(tenantId, userIds[i], notifications[i]);
        }
    }
}
