import { Controller, Get, Post, Body, Param, UseGuards, Headers, ForbiddenException } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';

// Assuming there's a SuperAdminGuard or similar in your app. 
// For now we just place the controller here.
@Controller('admin/ai-settings')
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  @Post('test')
  async testConnection(@Body() updateDto: UpdateAiSettingsDto) {
    return this.aiSettingsService.testConnection(updateDto);
  }

  @Get(':tenantId')
  async getSettings(@Param('tenantId') tenantId: string) {
    return this.aiSettingsService.getSettings(tenantId);
  }

  @Post(':tenantId')
  async updateSettings(
    @Param('tenantId') tenantId: string,
    @Body() updateDto: UpdateAiSettingsDto,
  ) {
    return this.aiSettingsService.updateSettings(tenantId, updateDto);
  }

  /**
   * Internal endpoint — only accessible by trusted internal services (tenant-backend).
   * Returns the decrypted API key so the tenant backend can use it to call the AI provider.
   */
  @Get('internal/:tenantId/decrypted')
  async getDecryptedSettings(
    @Param('tenantId') tenantId: string,
    @Headers('x-internal-service') internalHeader: string,
  ) {
    if (internalHeader !== 'tenant-backend') {
      throw new ForbiddenException('Access denied');
    }
    return this.aiSettingsService.getDecryptedSettings(tenantId);
  }
}
