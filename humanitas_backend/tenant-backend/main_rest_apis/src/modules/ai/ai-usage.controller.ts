import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AiUsageService } from './services/ai-usage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, PERMISSIONS_KEY } from '../auth/guards/permissions.guard';
import { SetMetadata } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

@Controller('ai/usage')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiUsageController {
  constructor(
    private readonly usageService: AiUsageService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /ai/usage/summary
   * Company-level summary (requires view_ai_usage).
   */
  @Get('summary')
  @Permissions('view_ai_usage')
  async getSummary(@Req() req) {
    const adminUrl = this.configService.get<string>('ADMIN_BACKEND_URL');
    try {
      const res = await axios.get(`${adminUrl}/ai/usage/tenant/${req.user.tenantId}/summary`, {
        headers: { 'x-internal-service': 'tenant-backend' },
        timeout: 5000,
      });
      return res.data;
    } catch {
      return { message: 'Usage data is currently unavailable. Please try again later.' };
    }
  }

  /**
   * GET /ai/usage/breakdown
   * Per-user breakdown table (requires view_ai_usage).
   */
  @Get('breakdown')
  @Permissions('view_ai_usage')
  async getBreakdown(@Req() req) {
    const adminUrl = this.configService.get<string>('ADMIN_BACKEND_URL');
    try {
      const res = await axios.get(`${adminUrl}/ai/usage/tenant/${req.user.tenantId}/breakdown`, {
        headers: { 'x-internal-service': 'tenant-backend' },
        timeout: 5000,
      });
      return res.data;
    } catch {
      return { message: 'Breakdown data is currently unavailable.' };
    }
  }

  /**
   * GET /ai/usage/me
   * Current user's own AI usage (any use_ai user can call this).
   */
  @Get('me')
  @Permissions('use_ai')
  async getMyUsage(@Req() req) {
    const adminUrl = this.configService.get<string>('ADMIN_BACKEND_URL');
    try {
      const res = await axios.get(
        `${adminUrl}/ai/usage/tenant/${req.user.tenantId}/user/${req.user.sub}`,
        {
          headers: { 'x-internal-service': 'tenant-backend' },
          timeout: 5000,
        },
      );
      return res.data;
    } catch {
      return { tokens_used: 0, cost_usd: 0, message: 'Your usage data is currently unavailable.' };
    }
  }
}
