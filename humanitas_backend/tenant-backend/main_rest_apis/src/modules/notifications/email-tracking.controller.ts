import { Controller, Get, Post, Param, Query, Body, Res, Headers } from '@nestjs/common';
import { Response } from 'express';
import { NotificationReportsService } from './notification-reports.service';

const TRANSPARENT_1PX_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

@Controller('notifications/email')
export class EmailTrackingController {
  constructor(private readonly notificationReportsService: NotificationReportsService) {}

  @Get('track-open/:messageId')
  async trackOpen(
    @Param('messageId') messageId: string,
    @Query('tenantId') queryTenantId: string,
    @Res() res: Response,
  ) {
    if (queryTenantId && messageId) {
      await this.notificationReportsService.recordEmailOpen(queryTenantId, messageId);
    }
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send(TRANSPARENT_1PX_GIF);
  }

  @Post('webhook/bounce')
  async webhookBounce(
    @Headers('x-tenant-id') headerTenantId: string,
    @Body() body: { tenantId?: string; messageId?: string; reason?: string; email?: string },
  ) {
    const tenantId = body.tenantId || headerTenantId;
    const messageId = body.messageId;
    if (tenantId && messageId) {
      await this.notificationReportsService.recordEmailBounce(tenantId, messageId, body.reason);
    }
    return { received: true };
  }
}
