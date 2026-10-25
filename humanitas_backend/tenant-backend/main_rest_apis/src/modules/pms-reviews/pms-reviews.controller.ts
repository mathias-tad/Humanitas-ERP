import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { PmsReviewsService } from './pms-reviews.service';
import {
  CreateReviewCycleDto,
  UpdateReviewCycleDto,
  NominatePeersDto,
  SubmitFeedbackDto,
  CalibrateReviewDto,
  CreatePipDto,
  UpdatePipDto,
} from './dto/pms-reviews.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('pms/reviews')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('pms')
export class PmsReviewsController {
  constructor(private readonly reviewsService: PmsReviewsService) {}

  // ==================== REVIEW CYCLES ====================

  @Get('cycles')
  @RequirePermissions('view_reviews')
  getCycles(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
    @Query('companyId') qCompanyId?: string,
    @Query('branchId') qBranchId?: string,
  ) {
    return this.reviewsService.getReviewCycles(tenantId, companyId || qCompanyId, branchId || qBranchId);
  }

  @Post('cycles')
  @RequirePermissions('manage_reviews')
  createCycle(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Req() req: any,
    @Body() dto: CreateReviewCycleDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.reviewsService.createReviewCycle(tenantId, dto, userId, companyId, branchId);
  }

  @Get('cycles/:id')
  @RequirePermissions('view_reviews')
  getCycleById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.reviewsService.getReviewCycleById(tenantId, id);
  }

  @Put('cycles/:id')
  @RequirePermissions('manage_reviews')
  updateCycle(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewCycleDto,
  ) {
    return this.reviewsService.updateReviewCycle(tenantId, id, dto);
  }

  // ==================== EMPLOYEE REVIEWS & MY REVIEWS ====================

  @Get('my')
  @RequirePermissions('view_my_reviews', 'view_reviews')
  getMyReviews(
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.reviewsService.getMyReviews(tenantId, userId);
  }

  @Get('employees')
  @RequirePermissions('view_reviews')
  getEmployeeReviews(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.reviewsService.getEmployeeReviews(tenantId, cycleId, companyId, branchId);
  }

  @Get('employees/:id')
  @RequirePermissions('view_reviews', 'view_my_reviews')
  getReviewById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.reviewsService.getReviewById(tenantId, id);
  }

  @Post('employees/:id/nominate-peers')
  @RequirePermissions('view_my_reviews', 'manage_reviews')
  nominatePeers(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') reviewId: string,
    @Req() req: any,
    @Body() dto: NominatePeersDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.reviewsService.nominatePeers(tenantId, reviewId, dto, userId);
  }

  @Post('feedbacks/:id/submit')
  @RequirePermissions('view_my_reviews', 'view_reviews')
  submitFeedback(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') feedbackId: string,
    @Req() req: any,
    @Body() dto: SubmitFeedbackDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.reviewsService.submitFeedback(tenantId, feedbackId, dto, userId);
  }

  @Post('employees/:id/calibrate')
  @RequirePermissions('calibrate_reviews', 'manage_reviews')
  calibrateReview(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') reviewId: string,
    @Req() req: any,
    @Body() dto: CalibrateReviewDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.reviewsService.calibrateReview(tenantId, reviewId, dto, userId);
  }

  // ==================== COMPETENCIES ====================

  @Get('competencies')
  @RequirePermissions('view_reviews', 'view_my_reviews')
  getCompetencies(@Headers('x-tenant-id') tenantId: string) {
    return this.reviewsService.getCompetencies(tenantId);
  }

  // ==================== PERFORMANCE IMPROVEMENT PLANS ====================

  @Get('pips')
  @RequirePermissions('view_reviews', 'view_my_reviews')
  getPips(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.reviewsService.getPips(tenantId, employeeId, companyId, branchId);
  }

  @Post('pips')
  @RequirePermissions('manage_pips', 'manage_reviews')
  createPip(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Req() req: any,
    @Body() dto: CreatePipDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.reviewsService.createPip(tenantId, dto, userId, companyId, branchId);
  }

  @Put('pips/:id')
  @RequirePermissions('manage_pips', 'manage_reviews')
  updatePip(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePipDto,
  ) {
    return this.reviewsService.updatePip(tenantId, id, dto);
  }

  // ==================== ANALYTICS & REPORTS ====================

  @Get('analytics')
  @RequirePermissions('view_reviews', 'view_pms_reports')
  getAnalytics(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.reviewsService.getReviewAnalytics(tenantId, cycleId, companyId, branchId);
  }
}
