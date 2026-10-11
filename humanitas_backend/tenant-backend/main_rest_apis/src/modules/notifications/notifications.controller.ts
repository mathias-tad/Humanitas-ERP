import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    async getNotifications(@Request() req: any) {
        return this.notificationsService.getUserNotifications(
            req.user.tenantId,
            req.user.sub,
        );
    }

    @Get('unread-count')
    async getUnreadCount(@Request() req: any) {
        const count = await this.notificationsService.getUnreadCount(
            req.user.tenantId,
            req.user.sub,
        );
        return { count };
    }

    @Post(':id/read')
    async markAsRead(@Request() req: any, @Param('id') id: string) {
        return this.notificationsService.markAsRead(
            req.user.tenantId,
            req.user.sub,
            id,
        );
    }

    @Post('read-all')
    async markAllAsRead(@Request() req: any) {
        return this.notificationsService.markAllAsRead(
            req.user.tenantId,
            req.user.sub,
        );
    }
}
