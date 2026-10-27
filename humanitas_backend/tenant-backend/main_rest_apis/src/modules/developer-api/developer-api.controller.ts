import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DeveloperApiService } from './developer-api.service';
import {
  CreateApiKeyDto,
  UpdateApiKeyDto,
  CreateWebhookDto,
  UpdateWebhookDto,
  TestWebhookDto,
} from './dto/developer-api.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('developer-api')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeveloperApiController {
  constructor(private readonly developerApiService: DeveloperApiService) {}

  // ── API Key Endpoints ──────────────────────────────────────────────────────

  @Get('keys')
  @RequirePermissions('view_developer_api')
  async getApiKeys(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string,
  ) {
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    return this.developerApiService.getApiKeys(tenantId, companyId, branchId);
  }

  @Post('keys')
  @RequirePermissions('manage_developer_api')
  async createApiKey(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: any,
    @Body() dto: CreateApiKeyDto,
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.developerApiService.createApiKey(tenantId, userId, dto);
  }

  @Delete('keys/:id')
  @RequirePermissions('manage_developer_api')
  async revokeApiKey(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.developerApiService.revokeApiKey(tenantId, id);
  }

  @Get('keys/:id/logs')
  @RequirePermissions('view_developer_api')
  async getApiKeyLogs(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.developerApiService.getApiKeyLogs(tenantId, id, limit ? Number(limit) : 50);
  }

  // ── Webhook Subscriptions ──────────────────────────────────────────────────

  @Get('webhooks')
  @RequirePermissions('view_developer_api')
  async getWebhooks(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string,
  ) {
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    return this.developerApiService.getWebhooks(tenantId, companyId, branchId);
  }

  @Post('webhooks')
  @RequirePermissions('manage_developer_api')
  async createWebhook(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: any,
    @Body() dto: CreateWebhookDto,
  ) {
    const userId = req.user?.id || req.user?.userId;
    return this.developerApiService.createWebhook(tenantId, userId, dto);
  }

  @Put('webhooks/:id')
  @RequirePermissions('manage_developer_api')
  async updateWebhook(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.developerApiService.updateWebhook(tenantId, id, dto);
  }

  @Delete('webhooks/:id')
  @RequirePermissions('manage_developer_api')
  async deleteWebhook(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.developerApiService.deleteWebhook(tenantId, id);
  }

  @Post('webhooks/test')
  @RequirePermissions('manage_developer_api')
  async testWebhook(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: TestWebhookDto,
  ) {
    return this.developerApiService.testWebhook(tenantId, dto);
  }

  // ── Webhook Delivery Logs ──────────────────────────────────────────────────

  @Get('deliveries')
  @RequirePermissions('view_developer_api')
  async getDeliveries(
    @Headers('x-tenant-id') tenantId: string,
    @Query('webhook_id') webhookId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.developerApiService.getWebhookDeliveries(
      tenantId,
      webhookId,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

  @Post('deliveries/:id/retry')
  @RequirePermissions('manage_developer_api')
  async retryDelivery(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.developerApiService.retryWebhookDelivery(tenantId, id);
  }
}
