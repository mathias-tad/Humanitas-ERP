import { Controller, Get, Put, Post, Param, Body, Request, UseGuards, Query } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';

@Controller('notifications/email-templates')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('notifications')
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Get()
  @RequirePermissions('manage_notification_templates')
  async getAllTemplates(@Request() req: any) {
    return this.emailTemplatesService.getAllTemplates(req.user.tenantId);
  }

  @Put(':key')
  @RequirePermissions('manage_notification_templates')
  async upsertTemplate(
    @Request() req: any,
    @Param('key') key: string,
    @Body() body: { subject: string; html_body: string; plain_text_body?: string },
  ) {
    await this.emailTemplatesService.upsertTemplate(req.user.tenantId, key, body, req.user.sub);
    return { success: true };
  }

  @Post(':key/reset')
  @RequirePermissions('manage_notification_templates')
  async resetToDefault(@Request() req: any, @Param('key') key: string) {
    await this.emailTemplatesService.resetToDefault(req.user.tenantId, key);
    return { success: true };
  }

  @Get(':key/preview')
  @RequirePermissions('manage_notification_templates')
  async previewTemplate(
    @Request() req: any,
    @Param('key') key: string,
    @Query() query: Record<string, string>,
  ) {
    const html = await this.emailTemplatesService.previewTemplate(req.user.tenantId, key, query);
    return { html };
  }
}
