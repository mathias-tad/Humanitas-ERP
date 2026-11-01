import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WfmOpportunitiesService } from './wfm-opportunities.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { ClaimOpportunityDto } from './dto/claim-opportunity.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';
import { UpdateWfmSettingsDto } from './dto/update-wfm-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('wfm')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('scheduling')
export class WfmOpportunitiesController {
  constructor(private readonly wfmService: WfmOpportunitiesService) {}

  @Get('settings')
  @RequirePermissions('view_wfm_opportunities')
  getSettings(@Req() req: any, @Query('companyId') qCompanyId?: string, @Query('branchId') qBranchId?: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const companyId = req.headers['x-company-id'] || qCompanyId;
    const branchId = req.headers['x-branch-id'] || qBranchId;
    return this.wfmService.getSettings(tenantId, companyId, branchId);
  }

  @Put('settings')
  @RequirePermissions('manage_wfm_settings')
  updateSettings(@Req() req: any, @Body() dto: UpdateWfmSettingsDto) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub;
    return this.wfmService.updateSettings(tenantId, dto, userId);
  }

  @Post('opportunities')
  @RequirePermissions('broadcast_wfm_opportunities')
  broadcastOpportunity(@Req() req: any, @Body() dto: CreateOpportunityDto) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub;
    const companyId = req.headers['x-company-id'] || dto.company_id;
    const branchId = req.headers['x-branch-id'] || dto.branch_id;
    return this.wfmService.broadcastOpportunity(tenantId, { ...dto, company_id: companyId, branch_id: branchId }, userId);
  }

  @Get('opportunities')
  @RequirePermissions('view_wfm_opportunities')
  getOpportunities(
    @Req() req: any,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
    @Query('companyId') qCompanyId?: string,
    @Query('branchId') qBranchId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub;
    const companyId = req.headers['x-company-id'] || qCompanyId;
    const branchId = req.headers['x-branch-id'] || qBranchId;

    return this.wfmService.getOpportunities(tenantId, {
      type,
      status,
      startDate,
      endDate,
      departmentId,
      companyId,
      branchId,
      userId,
    });
  }

  @Delete('opportunities/:id')
  @RequirePermissions('broadcast_wfm_opportunities')
  cancelOpportunity(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub;
    return this.wfmService.cancelOpportunity(tenantId, id, userId);
  }

  @Get('my-claims')
  @RequirePermissions('view_wfm_opportunities')
  getMyClaims(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub;
    return this.wfmService.getMyClaims(tenantId, userId);
  }

  @Post('opportunities/:id/claim')
  @RequirePermissions('claim_wfm_opportunities')
  claimOpportunity(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ClaimOpportunityDto,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub;
    const companyId = req.headers['x-company-id'];
    const branchId = req.headers['x-branch-id'];
    return this.wfmService.claimOpportunity(tenantId, id, userId, dto, companyId, branchId);
  }

  @Delete('claims/:claimId/cancel')
  @RequirePermissions('claim_wfm_opportunities')
  cancelClaim(@Req() req: any, @Param('claimId') claimId: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub;
    return this.wfmService.cancelClaim(tenantId, claimId, userId);
  }

  @Get('claims')
  @RequirePermissions('manage_wfm_claims')
  getClaimsReviewQueue(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('companyId') qCompanyId?: string,
    @Query('branchId') qBranchId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const companyId = req.headers['x-company-id'] || qCompanyId;
    const branchId = req.headers['x-branch-id'] || qBranchId;

    return this.wfmService.getClaimsReviewQueue(tenantId, {
      status,
      departmentId,
      companyId,
      branchId,
    });
  }

  @Post('claims/:claimId/review')
  @RequirePermissions('manage_wfm_claims')
  reviewClaim(
    @Req() req: any,
    @Param('claimId') claimId: string,
    @Body() dto: ReviewClaimDto,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const reviewerId = req.user?.sub;
    return this.wfmService.reviewClaim(tenantId, claimId, reviewerId, dto);
  }

  @Get('stats')
  @RequirePermissions('view_wfm_opportunities')
  getWfmStats(@Req() req: any, @Query('companyId') qCompanyId?: string, @Query('branchId') qBranchId?: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const companyId = req.headers['x-company-id'] || qCompanyId;
    const branchId = req.headers['x-branch-id'] || qBranchId;
    return this.wfmService.getWfmStats(tenantId, companyId, branchId);
  }
}
