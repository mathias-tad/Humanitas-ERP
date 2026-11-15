import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AiSettingsService } from './ai-settings.service';
import { UpdateAiSettingsDto } from './dto/ai-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { InternalServiceGuard } from '../auth/guards/internal-service.guard';

@Controller('admin/ai-settings')
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  @Post('test')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async testConnection(@Body() updateDto: UpdateAiSettingsDto) {
    return this.aiSettingsService.testConnection(updateDto);
  }

  @Get(':tenantId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async getSettings(@Param('tenantId') tenantId: string) {
    return this.aiSettingsService.getSettings(tenantId);
  }

  @Post(':tenantId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async updateSettings(
    @Param('tenantId') tenantId: string,
    @Body() updateDto: UpdateAiSettingsDto,
  ) {
    return this.aiSettingsService.updateSettings(tenantId, updateDto);
  }

  /**
   * Internal endpoint — only for tenant-backend, authenticated with INTERNAL_SERVICE_SECRET.
   * Returns the decrypted API key so the tenant backend can call the AI provider.
   */
  @Get('internal/:tenantId/decrypted')
  @UseGuards(InternalServiceGuard)
  async getDecryptedSettings(@Param('tenantId') tenantId: string) {
    return this.aiSettingsService.getDecryptedSettings(tenantId);
  }
}
