import { Controller, Get, Post, Put, Param, Body, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { UpdateNotificationPreferenceDto, BulkUpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';
import { RolesService } from '../roles/roles.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly rolesService: RolesService,
    ) { }

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

    @Get('preferences')
    async getPreferences(@Request() req: any) {
        const user = req.user;
        let permissions: string[] = [];
        try {
            permissions = await this.rolesService.getPermissionsForUser(user.tenantSlug, user.sub);
        } catch {
            permissions = [];
        }
        return this.notificationsService.getNotificationPreferences(
            user.tenantId,
            user.sub,
            permissions,
        );
    }

    @Put('preferences')
    async updatePreference(@Request() req: any, @Body() body: UpdateNotificationPreferenceDto) {
        const user = req.user;
        let permissions: string[] = [];
        try {
            permissions = await this.rolesService.getPermissionsForUser(user.tenantSlug, user.sub);
        } catch {
            permissions = [];
        }
        return this.notificationsService.updateNotificationPreference(
            user.tenantId,
            user.sub,
            body.category,
            body.channel,
            permissions,
        );
    }

    @Put('preferences/bulk')
    async bulkUpdatePreferences(@Request() req: any, @Body() body: BulkUpdateNotificationPreferencesDto) {
        const user = req.user;
        let permissions: string[] = [];
        try {
            permissions = await this.rolesService.getPermissionsForUser(user.tenantSlug, user.sub);
        } catch {
            permissions = [];
        }
        return this.notificationsService.bulkUpdatePreferences(
            user.tenantId,
            user.sub,
            body.preferences,
            permissions,
        );
    }
}
