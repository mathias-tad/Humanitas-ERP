import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { HrmsOnboardingService } from './hrms-onboarding.service';
import {
  CreateChecklistTemplateDto,
  CreateChecklistItemDto,
  StartOnboardingDto,
  UpdateOnboardingTaskDto,
  RecordProbationOutcomeDto,
  StartOffboardingDto,
  UpdateOffboardingTaskDto,
  SubmitExitInterviewDto,
  OnboardingFilterDto,
} from './dto/hrms-onboarding.dto';

@Controller('hrms')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class HrmsOnboardingController {
  constructor(private readonly onboardingService: HrmsOnboardingService) {}

  private getTenantId(req: any, headerTenantId?: string): string {
    return req.user?.tenantId || req.user?.tenant_id || headerTenantId;
  }

  // ── TEMPLATES ─────────────────────────────────────────────────────────────

  @Get('onboarding/templates')
  @RequirePermissions('view_onboarding')
  async getTemplates(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query('type') type?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getTemplates(tenantId, type);
  }

  @Get('onboarding/templates/:id')
  @RequirePermissions('view_onboarding')
  async getTemplateById(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getTemplateById(tenantId, id);
  }

  @Post('onboarding/templates')
  @RequirePermissions('manage_onboarding')
  async createTemplate(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: CreateChecklistTemplateDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.createTemplate(tenantId, dto);
  }

  @Post('onboarding/templates/:id/items')
  @RequirePermissions('manage_onboarding')
  async createTemplateItem(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') templateId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    dto.template_id = templateId;
    return this.onboardingService.createTemplateItem(tenantId, dto);
  }

  // ── ONBOARDING INSTANCES ──────────────────────────────────────────────────

  @Get('onboarding/stats')
  @RequirePermissions('view_onboarding')
  async getOnboardingStats(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getOnboardingStats(tenantId);
  }

  @Get('onboarding/instances')
  @RequirePermissions('view_onboarding')
  async getOnboardings(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query() filters: OnboardingFilterDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userRole = req.user?.role?.toLowerCase() || '';
    const permissions: string[] = req.user?.permissions || [];

    const isPrivileged =
      ['admin', 'administrator', 'owner', 'manager'].includes(userRole) ||
      permissions.includes('manage_onboarding');

    // Scoping fallback
    filters.company_id = filters.company_id || headerCompanyId;
    filters.branch_id = filters.branch_id || headerBranchId;

    // Normal employee only sees their own onboarding record
    if (!isPrivileged) {
      filters.user_id = (req.user?.sub || req.user?.id);
    }

    return this.onboardingService.getOnboardings(tenantId, filters);
  }

  @Get('onboarding/instances/:id')
  @RequirePermissions('view_onboarding')
  async getOnboardingById(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getOnboardingById(tenantId, id);
  }

  @Post('onboarding/start')
  @RequirePermissions('manage_onboarding')
  async startOnboarding(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: StartOnboardingDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const createdBy = (req.user?.sub || req.user?.id);
    return this.onboardingService.startOnboarding(tenantId, dto, createdBy);
  }

  @Put('onboarding/tasks/:id')
  @RequirePermissions('manage_onboarding')
  async updateOnboardingTask(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateOnboardingTaskDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    if (!dto.completed_by) {
      dto.completed_by = (req.user?.sub || req.user?.id);
    }
    return this.onboardingService.updateOnboardingTask(tenantId, taskId, dto);
  }

  @Post('onboarding/probation')
  @RequirePermissions('manage_onboarding')
  async recordProbationOutcome(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: RecordProbationOutcomeDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.recordProbationOutcome(tenantId, dto);
  }

  // ── OFFBOARDING INSTANCES ─────────────────────────────────────────────────

  @Get('offboarding/instances')
  @RequirePermissions('view_onboarding')
  async getOffboardings(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getOffboardings(tenantId);
  }

  @Get('offboarding/instances/:id')
  @RequirePermissions('view_onboarding')
  async getOffboardingById(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getOffboardingById(tenantId, id);
  }

  @Post('offboarding/start')
  @RequirePermissions('manage_onboarding')
  async startOffboarding(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: StartOffboardingDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const initiatedBy = (req.user?.sub || req.user?.id);
    return this.onboardingService.startOffboarding(tenantId, dto, initiatedBy);
  }

  @Put('offboarding/tasks/:id')
  @RequirePermissions('manage_onboarding')
  async updateOffboardingTask(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateOffboardingTaskDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.updateOffboardingTask(tenantId, taskId, dto);
  }

  @Post('offboarding/exit-interview')
  @RequirePermissions('view_onboarding')
  async submitExitInterview(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: SubmitExitInterviewDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = (req.user?.sub || req.user?.id);
    return this.onboardingService.submitExitInterview(tenantId, dto, userId);
  }

  // ── C1: Welcome Portal ────────────────────────────────────────────────────

  @Get('onboarding/welcome-portal')
  @RequirePermissions('view_onboarding')
  async getWelcomeStatus(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query('userId') userId?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const targetId = userId || (req.user?.sub || req.user?.id);
    return this.onboardingService.getWelcomePortalStatus(tenantId, targetId);
  }

  @Put('onboarding/welcome-portal/step')
  @RequirePermissions('view_onboarding')
  async updateWelcomeStep(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() body: { step: string; value: boolean; e_signature?: string },
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.updateWelcomePortalStep(
      tenantId,
      (req.user?.sub || req.user?.id),
      body.step,
      body.value,
      body.e_signature,
    );
  }

  // ── C2: Reports ───────────────────────────────────────────────────────────

  @Get('onboarding/reports/offboarding-compliance')
  @RequirePermissions('view_onboarding')
  async getOffboardingCompliance(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getOffboardingComplianceReport(tenantId);
  }

  @Get('onboarding/reports/retention')
  @RequirePermissions('view_onboarding')
  async getRetentionReport(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getNewHireRetentionReport(tenantId);
  }

  // ── PART 1B: WELCOME PORTAL, REPORTS & 1-CLICK SEPARATION ──────────────────

  @Get('onboarding/welcome/:userId')
  @RequirePermissions('view_onboarding')
  async getWelcomeChecklist(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('userId') userId: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getWelcomeChecklist(tenantId, userId);
  }

  @Put('onboarding/welcome/:userId')
  @RequirePermissions('view_onboarding')
  async updateWelcomeChecklist(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('userId') userId: string,
    @Body() body: { onboarding_id?: string; updates: Record<string, boolean> },
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.updateWelcomeChecklist(
      tenantId,
      userId,
      body.onboarding_id || '',
      body.updates || {},
    );
  }

  @Get('onboarding/retention-metrics')
  @RequirePermissions('view_onboarding')
  async getRetentionMetrics(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getRetentionMetrics(tenantId);
  }

  @Get('offboarding/compliance-report')
  @RequirePermissions('view_onboarding')
  async getOffboardingComplianceReportEndpoint(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.getOffboardingComplianceReport(tenantId);
  }

  @Get('offboarding/separation-preview/:userId')
  @RequirePermissions('manage_onboarding')
  async get1ClickPreview(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('userId') userId: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.onboardingService.get1ClickSeparationPreview(tenantId, userId);
  }

  @Post('offboarding/1-click-separation')
  @RequirePermissions('manage_onboarding')
  async execute1ClickSeparation(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() body: { user_id: string },
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const initiatedBy = (req.user?.sub || req.user?.id);
    return this.onboardingService.execute1ClickSeparation(tenantId, body.user_id, initiatedBy);
  }
}

