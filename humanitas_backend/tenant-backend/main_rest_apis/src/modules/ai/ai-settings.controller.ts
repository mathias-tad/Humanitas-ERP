import { Controller, Get, Put, Body, Headers, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AiSettingsConfigService } from './ai-settings.service';

@Controller('ai/settings')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class AiSettingsController {
  constructor(private aiSettingsService: AiSettingsConfigService) {}

  @Get()
  @RequirePermissions('view_ai_settings')
  async getSettings(@Headers('x-tenant-id') tenantId: string) {
    return this.aiSettingsService.getAiConfig(tenantId);
  }

  @Put()
  @RequirePermissions('manage_ai_settings')
  async updateSettings(
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: any,
  ) {
    await this.aiSettingsService.updateAiConfig(tenantId, body);
    return { message: 'AI settings updated' };
  }
}
