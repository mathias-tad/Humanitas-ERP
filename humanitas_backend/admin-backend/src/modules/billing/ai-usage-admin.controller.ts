import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { InternalServiceGuard } from '../auth/guards/internal-service.guard';

@Controller('ai/usage')
export class AiUsageAdminController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * GET /ai/usage
   * Platform-wide usage summary across all tenants.
   */
  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  getPlatformSummary() {
    return this.billingService.getPlatformSummary();
  }

  /**
   * GET /ai/usage/tenant/:tenantId/summary
   * Single tenant usage summary (by day + feature).
   */
  @Get('tenant/:tenantId/summary')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getTenantSummary(@Param('tenantId') tenantId: string) {
    return this.billingService.getTenantUsageSummary(tenantId);
  }

  /**
   * GET /ai/usage/tenant/:tenantId/breakdown
   * Per-user breakdown for a tenant.
   */
  @Get('tenant/:tenantId/breakdown')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getTenantBreakdown(@Param('tenantId') tenantId: string) {
    return this.billingService.getTenantUserBreakdown(tenantId);
  }

  /**
   * GET /ai/usage/tenant/:tenantId/user/:userId
   * Individual user usage within a tenant.
   */
  @Get('tenant/:tenantId/user/:userId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getUserUsage(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.billingService.getUserUsage(tenantId, userId);
  }

  // ── Internal (tenant-backend) read endpoints — scoped to the calling tenant by the tenant API ──

  @Get('internal/tenant/:tenantId/summary')
  @UseGuards(InternalServiceGuard)
  getTenantSummaryInternal(@Param('tenantId') tenantId: string) {
    return this.billingService.getTenantUsageSummary(tenantId);
  }

  @Get('internal/tenant/:tenantId/breakdown')
  @UseGuards(InternalServiceGuard)
  getTenantBreakdownInternal(@Param('tenantId') tenantId: string) {
    return this.billingService.getTenantUserBreakdown(tenantId);
  }

  @Get('internal/tenant/:tenantId/user/:userId')
  @UseGuards(InternalServiceGuard)
  getUserUsageInternal(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.billingService.getUserUsage(tenantId, userId);
  }

  /**
   * GET /ai/usage/budget-check/:tenantId
   * Check whether a tenant has remaining token budget (called by tenant-backend).
   */
  @Get('budget-check/:tenantId')
  @UseGuards(InternalServiceGuard)
  checkBudget(@Param('tenantId') tenantId: string) {
    return this.billingService.checkTokenBudget(tenantId);
  }

  /**
   * POST /ai/usage
   * Internal endpoint for tenant-backend to log an AI call.
   */
  @Post()
  @UseGuards(InternalServiceGuard)
  logUsage(@Body() payload: any) {
    return this.billingService.logUsage(payload);
  }
}
