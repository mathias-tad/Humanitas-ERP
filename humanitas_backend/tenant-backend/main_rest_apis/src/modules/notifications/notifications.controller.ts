import { Controller, Get, Post, Put, Delete, Param, Body, Request, UseGuards, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationReportsService } from './notification-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { UpdateNotificationPreferenceDto, BulkUpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';
import { RolesService } from '../roles/roles.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly notificationReportsService: NotificationReportsService,
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

    private async resolveUserPermissions(user: any): Promise<string[]> {
        const role = (user?.role || '').toLowerCase();
        if (role === 'owner' || role === 'admin' || role === 'administrator') {
            return ['*'];
        }
        try {
            return await this.rolesService.getPermissionsForUser(user.tenantSlug || user.tenantId, user.sub);
        } catch {
            return [];
        }
    }

    @Get('preferences')
    async getPreferences(@Request() req: any) {
        const user = req.user;
        const permissions = await this.resolveUserPermissions(user);
        return this.notificationsService.getNotificationPreferences(
            user.tenantId,
            user.sub,
            permissions,
        );
    }

    @Put('preferences')
    async updatePreference(@Request() req: any, @Body() body: UpdateNotificationPreferenceDto) {
        const user = req.user;
        const permissions = await this.resolveUserPermissions(user);
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
        const permissions = await this.resolveUserPermissions(user);
        return this.notificationsService.bulkUpdatePreferences(
            user.tenantId,
            user.sub,
            body.preferences,
            permissions,
        );
    }

    @Get('digest-config')
    @RequirePermissions('manage_notification_preferences')
    async getDigestConfig(@Request() req: any) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        return this.notificationsService.getDigestConfig(tenantId);
    }

    @Put('digest-config')
    @RequirePermissions('manage_notification_preferences')
    async updateDigestConfig(
        @Request() req: any,
        @Body() body: { mode: string; digest_time?: string },
    ) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        return this.notificationsService.updateDigestConfig(tenantId, body);
    }

    @Get('reports/delivery-stats')
    @RequirePermissions('view_notification_reports')
    async getDeliveryStats(
        @Request() req: any,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('days') days?: number,
    ) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        return this.notificationReportsService.getDeliveryStats(tenantId, startDate, endDate, days);
    }

    @Get('reports/preference-distribution')
    @RequirePermissions('view_notification_reports')
    async getPreferenceDistribution(@Request() req: any) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        return this.notificationReportsService.getPreferenceDistribution(tenantId);
    }

    @Get('reports/channel-summary')
    @RequirePermissions('view_notification_reports')
    async getChannelSummary(@Request() req: any, @Query('days') days: number = 30) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        return this.notificationReportsService.getChannelSummary(tenantId, Number(days) || 30);
    }

    @Get('reports/email-analytics')
    @RequirePermissions('view_notification_reports')
    async getEmailAnalytics(@Request() req: any, @Query('days') days: number = 30) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        return this.notificationReportsService.getEmailAnalytics(tenantId, Number(days) || 30);
    }

    @Get('reports/bounced-emails')
    @RequirePermissions('view_notification_reports')
    async getBouncedEmails(@Request() req: any, @Query('limit') limit: number = 50) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        return this.notificationReportsService.getBouncedEmails(tenantId, Number(limit) || 50);
    }

    @Post('push/register')
    @RequirePermissions('view_notification_preferences')
    async registerPushToken(
        @Request() req: any,
        @Body() body: { token: string; platform?: 'android' | 'ios' | 'web' },
    ) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        const userId = req.user?.sub || req.user?.id;
        await this.notificationsService.registerPushToken(
            tenantId,
            userId,
            body.token,
            body.platform || 'android',
        );
        return { success: true };
    }

    @Delete('push/deregister')
    @RequirePermissions('view_notification_preferences')
    async deregisterPushToken(
        @Request() req: any,
        @Body() body: { token: string },
    ) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        const userId = req.user?.sub || req.user?.id;
        await this.notificationsService.deregisterPushToken(
            tenantId,
            userId,
            body.token,
        );
        return { success: true };
    }

    @Post('push/deregister')
    @RequirePermissions('view_notification_preferences')
    async deregisterPushTokenPost(
        @Request() req: any,
        @Body() body: { token: string },
    ) {
        const tenantId = req.headers?.['x-tenant-id'] || req.user?.tenantId;
        const userId = req.user?.sub || req.user?.id;
        await this.notificationsService.deregisterPushToken(
            tenantId,
            userId,
            body.token,
        );
        return { success: true };
    }
}
