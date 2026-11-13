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
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('developer-api')
@RequireModule('developer_api')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class DeveloperApiController {
  constructor(private readonly developerApiService: DeveloperApiService) {}

  private getTenantId(req: any, headerTenantId?: string): string {
    return req.user?.tenantId || req.user?.tenant_id || headerTenantId;
  }

  // ── API Key Endpoints ───────────────────────────────────────────────────────

  @Get('keys')
  @RequirePermissions('view_developer_api')
  async getApiKeys(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    return this.developerApiService.getApiKeys(tenantId, companyId, branchId);
  }

  @Post('keys')
  @RequirePermissions('manage_developer_api')
  async createApiKey(
    @Request() req: any,
    @Body() dto: CreateApiKeyDto,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.developerApiService.createApiKey(tenantId, userId, dto);
  }

  @Delete('keys/:id')
  @RequirePermissions('manage_developer_api')
  async revokeApiKey(
    @Request() req: any,
    @Param('id') id: string,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.developerApiService.revokeApiKey(tenantId, id);
  }

  @Get('keys/:id/logs')
  @RequirePermissions('view_developer_api')
  async getApiKeyLogs(
    @Request() req: any,
    @Param('id') id: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Query('limit') limit?: number,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.developerApiService.getApiKeyLogs(tenantId, id, limit ? Number(limit) : 50);
  }

  // ── Webhook Subscriptions ──────────────────────────────────────────────────

  @Get('webhooks')
  @RequirePermissions('view_developer_api')
  async getWebhooks(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    return this.developerApiService.getWebhooks(tenantId, companyId, branchId);
  }

  @Post('webhooks')
  @RequirePermissions('manage_developer_api')
  async createWebhook(
    @Request() req: any,
    @Body() dto: CreateWebhookDto,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.developerApiService.createWebhook(tenantId, userId, dto);
  }

  @Put('webhooks/:id')
  @RequirePermissions('manage_developer_api')
  async updateWebhook(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.developerApiService.updateWebhook(tenantId, id, dto);
  }

  @Delete('webhooks/:id')
  @RequirePermissions('manage_developer_api')
  async deleteWebhook(
    @Request() req: any,
    @Param('id') id: string,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.developerApiService.deleteWebhook(tenantId, id);
  }

  @Post('webhooks/test')
  @RequirePermissions('manage_developer_api')
  async testWebhook(
    @Request() req: any,
    @Body() dto: TestWebhookDto,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.developerApiService.testWebhook(tenantId, dto);
  }

  // ── Webhook Delivery Logs ──────────────────────────────────────────────────

  @Get('deliveries')
  @RequirePermissions('view_developer_api')
  async getDeliveries(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Query('webhook_id') webhookId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
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
    @Request() req: any,
    @Param('id') id: string,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.developerApiService.retryWebhookDelivery(tenantId, id);
  }
}
