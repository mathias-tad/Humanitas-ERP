import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Query,
  Param,
  Headers,
  UseGuards,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { RecruitmentService } from './recruitment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import {
  CreateJobDto,
  UpdateJobDto,
  RerankCandidatesDto,
  BulkShortlistDto,
  StartExportDto,
  UpdateFormDto,
  CreateApplicationLinkDto,
  ManageJobLinksDto,
  SubmitApplicationDto,
  RecruitmentWebhookDto,
  CreateInterviewDto,
  UpdateInterviewDto,
  FilterInterviewDto,
  CreateOfferDto,
  UpdateOfferStatusDto,
  FilterOfferDto,
  ConvertCandidateToEmployeeDto,
  RecruitmentReportsFilterDto,
} from './dto/recruitment.dto';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    sub: string;
    tenantSlug: string;
    tenantId?: string;
    tenant_id?: string;
    email: string;
    role: string;
    company_id?: string;
    companyId?: string;
    branch_id?: string;
    branchId?: string;
  };
}

@ApiTags('Recruitment')
@Controller('recruitment')
@RequireModule('recruitment')
export class RecruitmentController {
  private readonly logger = new Logger(RecruitmentController.name);

  constructor(private readonly recruitmentService: RecruitmentService) {}

  private getTenantIdentifier(req: any, headerTenantId?: string): string {
    return req.user?.tenantId || req.user?.tenant_id || headerTenantId || req.user?.tenantSlug;
  }

  private resolveScope(
    req: any,
    headerCompanyId?: string,
    headerBranchId?: string,
    queryCompanyId?: string,
    queryBranchId?: string,
  ) {
    const company_id =
      queryCompanyId ||
      headerCompanyId ||
      req.headers?.['x-company-id'] ||
      req.user?.company_id ||
      req.user?.companyId;
    const branch_id =
      queryBranchId ||
      headerBranchId ||
      req.headers?.['x-branch-id'] ||
      req.user?.branch_id ||
      req.user?.branchId;
    return { company_id, branch_id };
  }

  @Get('jobs')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('view_dashboard') // Assuming view_dashboard or similar is needed
  @ApiOperation({ summary: 'Get jobs from Krinai AI Screening' })
  async getJobs(@Req() req: AuthenticatedRequest) {
    return this.recruitmentService.getJobs(req.user.tenantSlug);
  }

  @Get('applications')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('view_dashboard')
  @ApiOperation({ summary: 'Get applications from Krinai AI Screening' })
  async getApplications(
    @Req() req: AuthenticatedRequest,
    @Query('job_id') jobId?: string,
  ) {
    return this.recruitmentService.getApplications(req.user.tenantSlug, jobId);
  }

  @Get('jobs/:jobId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('view_dashboard')
  @ApiOperation({ summary: 'Get a single job from Krinai AI Screening' })
  async getJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    return this.recruitmentService.getJob(req.user.tenantSlug, jobId);
  }

  @Get('jobs/:jobId/form')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Get form definition for a job' })
  async getForm(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    return this.recruitmentService.getForm(req.user.tenantSlug, jobId);
  }

  @Put('jobs/:jobId/form')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Update form definition for a job' })
  async updateForm(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() data: UpdateFormDto,
  ) {
    return this.recruitmentService.updateForm(req.user.tenantSlug, jobId, data);
  }

  @Get('jobs/:jobId/leaderboard')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Get leaderboard for a job from Krinai AI Screening' })
  async getLeaderboard(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    return this.recruitmentService.getLeaderboard(req.user.tenantSlug, jobId);
  }

  @Post('jobs/:jobId/rerank')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Rerank candidates using custom weights' })
  async rerankCandidates(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() data: RerankCandidatesDto,
  ) {
    return this.recruitmentService.rerankCandidates(req.user.tenantSlug, jobId, data);
  }

  @Post('jobs/:jobId/bulk-shortlist')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Bulk shortlist candidates based on cutoff score' })
  async bulkShortlist(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() data: BulkShortlistDto,
  ) {
    return this.recruitmentService.bulkShortlist(req.user.tenantSlug, jobId, data);
  }

  @Post('jobs/:jobId/exports')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Start a data export job' })
  async startExport(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() data: StartExportDto,
  ) {
    return this.recruitmentService.startExport(req.user.tenantSlug, jobId, data);
  }

  @Get('jobs/:jobId/exports/estimate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Estimate export size' })
  async estimateExport(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Query('scope_type') scopeType: string,
    @Query('status_filter') statusFilter?: string,
  ) {
    return this.recruitmentService.estimateExport(req.user.tenantSlug, jobId, scopeType, statusFilter);
  }

  @Get('jobs/:jobId/exports/:exportId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Check status of an export job' })
  async checkExportStatus(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Param('exportId') exportId: string,
  ) {
    return this.recruitmentService.checkExportStatus(req.user.tenantSlug, jobId, exportId);
  }

  @Post('jobs')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Create a new job in Krinai' })
  async createJob(
    @Req() req: AuthenticatedRequest,
    @Body() jobData: CreateJobDto,
  ) {
    return this.recruitmentService.createJob(req.user.tenantSlug, jobData);
  }

  @Patch('jobs/:jobId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Update a job in Krinai' })
  async updateJob(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() jobData: UpdateJobDto,
  ) {
    return this.recruitmentService.updateJob(req.user.tenantSlug, jobId, jobData);
  }

  @Patch('jobs/:jobId/applications/:appId/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Update an application status in Krinai' })
  async updateApplicationStatus(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Param('appId') appId: string,
    @Body('status') status: string,
  ) {
    if (!status) {
      throw new BadRequestException('status is required');
    }
    return this.recruitmentService.updateApplicationStatus(req.user.tenantSlug, jobId, appId, status);
  }

  @Post('applications')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Create a new application in Krinai' })
  async createApplication(@Req() req: AuthenticatedRequest) {
    const data = await (req as any).file();
    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    const buffer = await data.toBuffer();
    const formData = new FormData();

    // Append text fields
    for (const key of Object.keys(data.fields)) {
      if (key !== data.fieldname && data.fields[key]?.value !== undefined) {
        formData.append(key, data.fields[key].value);
      }
    }

    // Append file as a Blob
    const blob = new Blob([buffer], { type: data.mimetype });
    formData.append(data.fieldname || 'resume_file', blob, data.filename);

    return this.recruitmentService.createApplication(req.user.tenantSlug, formData);
  }

  @Post('webhook/:tenantSlug')
  @ApiOperation({ summary: 'Receive webhooks from Krinai AI Screening' })
  async receiveWebhook(
    @Param('tenantSlug') tenantSlug: string,
    @Body() payload: RecruitmentWebhookDto,
  ) {
    this.logger.log(`Received webhook for tenant ${tenantSlug}:`, payload);
    // Here we can dispatch notifications or update local states based on payload.event_type
    // For now, we just acknowledge receipt to Krinai
    return { received: true };
  }

  @Post('register-webhook')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('edit_general_settings')
  @ApiOperation({ summary: 'Register Humanitas webhook with Krinai' })
  async registerWebhook(@Req() req: AuthenticatedRequest) {
    // 1. Fetch API key from settings
    // 2. Call Krinai
    // We can do this in the service
    // Actually, RecruitmentService already has getApiKey(tenantSlug) 
    // so we just pass the tenantSlug.
    const apiKey = await this.recruitmentService.getApiKey(req.user.tenantSlug);
    return this.recruitmentService.registerWebhook(req.user.tenantSlug, apiKey);
  }

  // --- Application Links Management ---

  @Post('jobs/:jobId/links')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Create an application link' })
  async createApplicationLink(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() data: CreateApplicationLinkDto,
  ) {
    return this.recruitmentService.createApplicationLink(req.user.tenantSlug, jobId, data);
  }

  @Get('jobs/:jobId/links')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Get application links' })
  async getJobLinks(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
  ) {
    return this.recruitmentService.getJobLinks(req.user.tenantSlug, jobId);
  }

  @Post('jobs/:jobId/links/expire')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Expire application links' })
  async expireJobLinks(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() data: ManageJobLinksDto,
  ) {
    return this.recruitmentService.expireJobLinks(req.user.tenantSlug, jobId, data);
  }

  @Post('jobs/:jobId/links/reopen')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Reopen application links' })
  async reopenJobLinks(
    @Req() req: AuthenticatedRequest,
    @Param('jobId') jobId: string,
    @Body() data: ManageJobLinksDto,
  ) {
    return this.recruitmentService.reopenJobLinks(req.user.tenantSlug, jobId, data);
  }

  // --- Public Application Endpoints ---
  // No UseGuards or ApiBearerAuth since candidates are anonymous.

  @Get('apply/:token/form')
  @ApiOperation({ summary: 'Get job form definition by token (Public)' })
  async getPublicFormByToken(@Param('token') token: string) {
    return this.recruitmentService.getPublicFormByToken(token);
  }

  @Post('apply/:token/submit')
  @ApiOperation({ summary: 'Submit application by token (Public)' })
  async submitApplicationByToken(
    @Param('token') token: string,
    @Body() payload: SubmitApplicationDto
  ) {
    return this.recruitmentService.submitApplicationByToken(token, payload);
  }

  @Post('apply/:token/upload')
  @ApiOperation({ summary: 'Upload file for application by token (Public)' })
  @ApiConsumes('multipart/form-data')
  async uploadApplicationFileByToken(
    @Param('token') token: string,
    @Req() req: any
  ) {
    const data = await (req as any).file();
    if (!data) {
      throw new BadRequestException('No file uploaded');
    }
    const buffer = await data.toBuffer();
    const formData = new FormData();
    const blob = new Blob([buffer], { type: data.mimetype });
    formData.append(data.fieldname || 'file', blob, data.filename);

    return this.recruitmentService.uploadPublicFile(token, formData);
  }

  // ── INTERVIEW SCHEDULING & CALENDAR ──────────────────────────────────────────

  @Get('interviews')
  @UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('view_recruitment', 'manage_recruitment')
  @ApiOperation({ summary: 'List scheduled interviews with filters & multi-branch scope' })
  async getInterviews(
    @Req() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Query('job_id') jobId?: string,
    @Query('candidate_id') candidateId?: string,
    @Query('status') status?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('company_id') companyId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const tenantIdentifier = this.getTenantIdentifier(req, headerTenantId);
    const scope = this.resolveScope(req, headerCompanyId, headerBranchId, companyId, branchId);
    return this.recruitmentService.getInterviews(tenantIdentifier, {
      job_id: jobId,
      candidate_id: candidateId,
      status,
      start_date: startDate,
      end_date: endDate,
      company_id: scope.company_id,
      branch_id: scope.branch_id,
    });
  }

  @Post('interviews')
  @UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Schedule an interview and notify participants' })
  async createInterview(
    @Req() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Body() data: CreateInterviewDto,
  ) {
    const tenantIdentifier = this.getTenantIdentifier(req, headerTenantId);
    const scope = this.resolveScope(req, headerCompanyId, headerBranchId, data.company_id, data.branch_id);
    return this.recruitmentService.createInterview(tenantIdentifier, {
      ...data,
      company_id: scope.company_id,
      branch_id: scope.branch_id,
    });
  }

  @Put('interviews/:id')
  @UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Update interview status, rating, and feedback' })
  async updateInterview(
    @Req() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
    @Body() data: UpdateInterviewDto,
  ) {
    const tenantIdentifier = this.getTenantIdentifier(req, headerTenantId);
    return this.recruitmentService.updateInterview(tenantIdentifier, id, data);
  }

  // ── OFFER LETTERS & DIGITAL ACCEPTANCE ─────────────────────────────────────

  @Get('offers')
  @UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('view_recruitment', 'manage_recruitment')
  @ApiOperation({ summary: 'List candidate offers' })
  async getOffers(
    @Req() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Query('job_id') jobId?: string,
    @Query('candidate_id') candidateId?: string,
    @Query('status') status?: string,
    @Query('company_id') companyId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const tenantIdentifier = this.getTenantIdentifier(req, headerTenantId);
    const scope = this.resolveScope(req, headerCompanyId, headerBranchId, companyId, branchId);
    return this.recruitmentService.getOffers(tenantIdentifier, {
      job_id: jobId,
      candidate_id: candidateId,
      status,
      company_id: scope.company_id,
      branch_id: scope.branch_id,
    });
  }

  @Post('offers')
  @UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Create and generate a candidate offer letter' })
  async createOffer(
    @Req() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Body() data: CreateOfferDto,
  ) {
    const tenantIdentifier = this.getTenantIdentifier(req, headerTenantId);
    const scope = this.resolveScope(req, headerCompanyId, headerBranchId, data.company_id, data.branch_id);
    return this.recruitmentService.createOffer(
      tenantIdentifier,
      {
        ...data,
        company_id: scope.company_id,
        branch_id: scope.branch_id,
      },
      req.user?.sub,
    );
  }

  @Put('offers/:id/status')
  @UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: 'Update offer status (sent, accepted, rejected, expired)' })
  async updateOfferStatus(
    @Req() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
    @Body() data: UpdateOfferStatusDto,
  ) {
    const tenantIdentifier = this.getTenantIdentifier(req, headerTenantId);
    return this.recruitmentService.updateOfferStatus(tenantIdentifier, id, data);
  }

  // ── 1-CLICK CANDIDATE-TO-EMPLOYEE CONVERSION ──────────────────────────────

  @Post('candidates/:candidateId/convert-to-employee')
  @UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('manage_recruitment')
  @ApiOperation({ summary: '1-Click Candidate-to-Employee Conversion with Onboarding' })
  async convertToEmployee(
    @Req() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Param('candidateId') candidateId: string,
    @Body() data: ConvertCandidateToEmployeeDto,
  ) {
    const tenantIdentifier = this.getTenantIdentifier(req, headerTenantId);
    const scope = this.resolveScope(req, headerCompanyId, headerBranchId, data.company_id, data.branch_id);
    return this.recruitmentService.convertToEmployee(
      tenantIdentifier,
      candidateId,
      {
        ...data,
        company_id: scope.company_id,
        branch_id: scope.branch_id,
      },
      req.user?.sub,
    );
  }

  // ── RECRUITMENT ANALYTICS & REPORTS ───────────────────────────────────────

  @Get('reports/funnel')
  @UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('view_recruitment', 'manage_recruitment')
  @ApiOperation({ summary: 'Get recruitment hiring funnel stage counts and conversion rates' })
  async getFunnelReport(
    @Req() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Query('job_id') jobId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('company_id') companyId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const tenantIdentifier = this.getTenantIdentifier(req, headerTenantId);
    const scope = this.resolveScope(req, headerCompanyId, headerBranchId, companyId, branchId);
    return this.recruitmentService.getFunnelReport(tenantIdentifier, {
      job_id: jobId,
      start_date: startDate,
      end_date: endDate,
      company_id: scope.company_id,
      branch_id: scope.branch_id,
    });
  }

  @Get('reports/analytics')
  @UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermissions('view_recruitment', 'manage_recruitment')
  @ApiOperation({ summary: 'Get recruitment KPIs: time to hire, cost per hire, and department breakdown' })
  async getAnalyticsReport(
    @Req() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Query('company_id') companyId?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const tenantIdentifier = this.getTenantIdentifier(req, headerTenantId);
    const scope = this.resolveScope(req, headerCompanyId, headerBranchId, companyId, branchId);
    return this.recruitmentService.getAnalyticsReport(tenantIdentifier, {
      company_id: scope.company_id,
      branch_id: scope.branch_id,
    });
  }
}


