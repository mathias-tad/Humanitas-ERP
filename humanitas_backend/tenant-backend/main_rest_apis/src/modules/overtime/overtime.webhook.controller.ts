import { Controller, Post, Body, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { CalculationStatus } from '../system-logs/entities/calculation-log.entity';

@Controller('overtime/webhook')
export class OvertimeWebhookController {
    constructor(
        @Inject(forwardRef(() => NotificationsGateway))
        private readonly notificationsGateway: NotificationsGateway,
        private readonly systemLogsService: SystemLogsService
    ) { }

    @Post('notification')
    async handleNotification(@Body() body: any) {
        // body: { tenantId, type, payload, userId?, logId?, status? }
        console.log('[Webhook] Received notification:', body);

        const { tenantId, type, payload, userId, logId, status, error } = body;

        if (!tenantId || !type) {
            throw new BadRequestException('Invalid payload');
        }

        // 1. Update System Log if logId is present
        if (logId) {
            let calcStatus = CalculationStatus.PROCESSING;
            if (status === 'COMPLETED') calcStatus = CalculationStatus.COMPLETED;
            if (status === 'FAILED') calcStatus = CalculationStatus.FAILED;

            await this.systemLogsService.updateLogStatus(
                logId,
                calcStatus,
                status === 'COMPLETED' ? payload : null, // Store result
                error || null
            );
        }

        // 2. Broadcast Notifications
        if (type === 'OVERTIME_CALCULATION_COMPLETED') {
            // Granular notifications
            const result = payload;
            const total = result.total_entries_created || 0;
            const updated = result.total_entries_updated || 0;
            const users = result.entries || [];

            // Notify Tenant Admin
            this.notificationsGateway.broadcastToTenant(tenantId, 'overtime_calculation_completed', {
                message: `Calculation completed. Created: ${total}, Updated: ${updated}`,
                result
            });

            // Notify Individual Users
            if (users.length > 0) {
                for (const userEntry of users) {
                    if (userEntry.user_id && userEntry.total_ot_hours > 0) {
                        this.notificationsGateway.pushToUser(tenantId, userEntry.user_id, {
                            title: 'Overtime Calculated',
                            message: `You have ${userEntry.total_ot_hours} hours of overtime for this period.`,
                            type: 'info'
                        });
                    }
                }
            }

        } else if (userId) {
            // Targeted notification
            this.notificationsGateway.pushToUser(tenantId, userId, {
                title: 'Overtime Update',
                message: JSON.stringify(payload),
                type: 'info'
            });
        } else {
            // General Tenant Broadcast
            this.notificationsGateway.broadcastToTenant(tenantId, type, payload);
        }

        return { status: 'received' };
    }
}
