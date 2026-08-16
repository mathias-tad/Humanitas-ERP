import { Controller, Post, Get, Body, UseGuards, Req, Param } from '@nestjs/common';
import { AiOnboardingService } from './services/ai-onboarding.service';
import { AiPerformanceService } from './services/ai-performance.service';
import { AiAttritionService } from './services/ai-attrition.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, PERMISSIONS_KEY } from '../auth/guards/permissions.guard';
import { SetMetadata } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';

export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export class ReviewSummarizeDto {
  @IsString()
  @IsNotEmpty()
  managerNotes: string;
}

@Controller('ai/lifecycle')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiLifecycleController {
  constructor(
    private readonly onboardingService: AiOnboardingService,
    private readonly performanceService: AiPerformanceService,
    private readonly attritionService: AiAttritionService,
  ) {}

  /**
   * GET /ai/lifecycle/onboarding/:employeeId
   * Generate an onboarding checklist for a new employee.
   * Requires: manage_users or use_ai
   */
  @Get('onboarding/:employeeId')
  @Permissions('use_ai')
  async getOnboardingChecklist(@Req() req, @Param('employeeId') employeeId: string) {
    return this.onboardingService.generateOnboardingChecklist(req.user.tenantSlug, employeeId);
  }

  /**
   * POST /ai/lifecycle/review/summarize
   * Summarize manager notes and detect bias.
   * Requires: use_ai
   */
  @Post('review/summarize')
  @Permissions('use_ai')
  async summarizeReview(@Body() body: ReviewSummarizeDto) {
    return this.performanceService.summarizeReview(body.managerNotes);
  }

  /**
   * GET /ai/lifecycle/attrition
   * Get flight-risk scores for all active employees.
   * Requires: use_ai (restricted to HR/Admin by role context)
   */
  @Get('attrition')
  @Permissions('use_ai')
  async getAttritionReport(@Req() req) {
    const user = req.user;
    // Only admin/owner/HR can access org-wide attrition data
    if (!['owner', 'admin', 'hr'].includes(user.role?.toLowerCase())) {
      return { error: 'Access denied. Only Admin and HR can view attrition reports.' };
    }
    return this.attritionService.computeFlightRiskForTenant(user.tenantSlug);
  }
}
