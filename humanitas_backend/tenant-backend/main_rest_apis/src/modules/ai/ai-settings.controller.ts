import { Controller, Get, Put, Body, Headers, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AiSettingsConfigService } from './ai-settings.service';

@Controller('ai/settings')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class AiSettingsController {
  constructor(private aiSettingsService: AiSettingsConfigService) {}

  private getTenantId(req: any, headerTenantId?: string): string {
    return req.user?.tenantId || req.user?.tenant_id || headerTenantId;
  }

  @Get()
  @RequirePermissions('view_ai_settings')
  async getSettings(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.aiSettingsService.getAiConfig(tenantId);
  }

  @Put()
  @RequirePermissions('manage_ai_settings')
  async updateSettings(
    @Request() req: any,
    @Body() body: any,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    await this.aiSettingsService.updateAiConfig(tenantId, body);
    return { message: 'AI settings updated' };
  }
}
