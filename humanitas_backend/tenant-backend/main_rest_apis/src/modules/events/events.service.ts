import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';

@Injectable()
export class EventsService {
    constructor(
        private readonly databaseService: DatabaseService,
        private readonly notificationsService: NotificationsService,
        private readonly notificationsGateway: NotificationsGateway,
    ) { }

    async ensureEventsTables(connection: any) {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                content TEXT,
                event_date DATE NOT NULL,
                event_time TIME,
                location VARCHAR(255),
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
        await this.ensureEventsTables(connection);

        return connection.query(`
            SELECT e.*, u.full_name as created_by_name,
                   TO_CHAR(e.event_date, 'YYYY-MM-DD') as event_date
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            ORDER BY e.event_date DESC
        `);
    }

    async findOne(tenantId: string, id: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        const result = await connection.query(`
            SELECT e.*, u.full_name as created_by_name,
                   TO_CHAR(e.event_date, 'YYYY-MM-DD') as event_date
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.id = $1
        `, [id]);

        if (!result.length) throw new NotFoundException('Event not found');
        return result[0];
    }

    async create(tenantId: string, userId: string, dto: CreateEventDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await this.ensureEventsTables(connection);

        const result = await connection.query(`
            INSERT INTO events (title, content, event_date, event_time, location, target_type, target_ids, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            dto.title,
            dto.content,
            dto.event_date,
            dto.event_time,
            dto.location,
            dto.target_type,
            dto.target_ids || [],
            userId,
        ]);

        const event = result[0];

        // Send notifications to target users
        await this.sendNotifications(tenantId, event, 'New Event');

        return event;
    }

    async update(tenantId: string, id: string, dto: UpdateEventDto) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        const existing = await this.findOne(tenantId, id);
        if (!existing) throw new NotFoundException('Event not found');

        const fields: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (dto.title) { fields.push(`title = $${idx++}`); values.push(dto.title); }
        if (dto.content !== undefined) { fields.push(`content = $${idx++}`); values.push(dto.content); }
        if (dto.event_date) { fields.push(`event_date = $${idx++}`); values.push(dto.event_date); }
        if (dto.event_time !== undefined) { fields.push(`event_time = $${idx++}`); values.push(dto.event_time); }
        if (dto.location !== undefined) { fields.push(`location = $${idx++}`); values.push(dto.location); }
        if (dto.target_type) { fields.push(`target_type = $${idx++}`); values.push(dto.target_type); }
        if (dto.target_ids) { fields.push(`target_ids = $${idx++}`); values.push(dto.target_ids); }

        if (fields.length === 0) return existing;

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await connection.query(`
            UPDATE events SET ${fields.join(', ')}
            WHERE id = $${idx}
            RETURNING *
        `, values);

        const updated = result[0];

        // Send notification about update
        await this.sendNotifications(tenantId, updated, 'Event Updated');

        return updated;
    }

    async delete(tenantId: string, id: string) {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);
        await connection.query(`DELETE FROM events WHERE id = $1`, [id]);
        return { success: true };
    }

    private async sendNotifications(tenantId: string, event: any, actionTitle: string) {
        // Resolve target users
        const userIds = await this.notificationsService.resolveTargetUsers(
            tenantId,
            event.target_type,
            event.target_ids || [],
        );

        if (!userIds.length) return;

        // Create persistent notifications
        const notifications = await this.notificationsService.createBulkNotifications(
            tenantId,
            userIds,
            {
                type: 'event',
                referenceId: event.id,
                title: actionTitle,
                message: event.title,
            },
        );

        // Push real-time via WebSocket
        for (let i = 0; i < userIds.length; i++) {
            this.notificationsGateway.pushToUser(tenantId, userIds[i], notifications[i]);
        }
    }
}
