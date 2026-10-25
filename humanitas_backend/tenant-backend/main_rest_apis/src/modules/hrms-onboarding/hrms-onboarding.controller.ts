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
      filters.user_id = req.user?.id;
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
    const createdBy = req.user?.id;
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
      dto.completed_by = req.user?.id;
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
    const initiatedBy = req.user?.id;
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
    const userId = req.user?.id;
    return this.onboardingService.submitExitInterview(tenantId, dto, userId);
  }
}
