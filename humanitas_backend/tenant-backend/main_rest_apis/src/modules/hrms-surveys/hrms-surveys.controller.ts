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
import { ModuleSubscriptionGuard } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { HrmsSurveysService } from './hrms-surveys.service';
import {
  CreateSurveyDto,
  SubmitSurveyResponseDto,
  CreateSurveyActionItemDto,
  UpdateSurveyActionItemDto,
} from './dto/hrms-surveys.dto';

@Controller('hrms/surveys')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class HrmsSurveysController {
  constructor(private readonly surveysService: HrmsSurveysService) {}

  private getTenantId(req: any, headerTenantId?: string): string {
    return (
      headerTenantId ||
      req?.user?.tenantId ||
      req?.user?.tenant_id ||
      req?.headers?.['x-tenant-id'] ||
      'default'
    );
  }

  @Get('analytics')
  @RequirePermissions('view_survey_results')
  async getAnalytics(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    const data = await this.surveysService.getSurveyAnalytics(tenantId, companyId, branchId);
    return { data };
  }

  @Get('actions')
  @RequirePermissions('view_surveys')
  async getActionItems(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Query('survey_id') surveyId?: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const data = await this.surveysService.getActionItems(tenantId, surveyId);
    return { data };
  }

  @Post('actions')
  @RequirePermissions('manage_survey_actions')
  async createActionItem(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Body() dto: CreateSurveyActionItemDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const createdBy = req.user?.sub || req.user?.id;
    const data = await this.surveysService.createActionItem(tenantId, dto, createdBy);
    return { data, message: 'Survey follow-up action created successfully' };
  }

  @Put('actions/:id')
  @RequirePermissions('manage_survey_actions')
  async updateActionItem(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSurveyActionItemDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const data = await this.surveysService.updateActionItem(tenantId, id, dto);
    return { data, message: 'Action item updated successfully' };
  }

  @Get()
  @RequirePermissions('view_surveys')
  async getSurveys(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('status') status?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    const data = await this.surveysService.getSurveys(tenantId, status, companyId, branchId);
    return { data };
  }

  @Get(':id')
  @RequirePermissions('view_surveys')
  async getSurveyById(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const currentUserId = req.user?.sub || req.user?.id;
    const data = await this.surveysService.getSurveyById(tenantId, id, currentUserId);
    return { data };
  }

  @Get(':id/results')
  @RequirePermissions('view_survey_results')
  async getSurveyResults(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const data = await this.surveysService.getSurveyResults(tenantId, id);
    return { data };
  }

  @Post(':id/respond')
  @RequirePermissions('view_surveys')
  async submitResponse(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
    @Body() dto: SubmitSurveyResponseDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id;
    const payload = { ...dto, survey_id: id };
    const data = await this.surveysService.submitResponse(tenantId, payload, userId);
    return data;
  }

  @Post()
  @RequirePermissions('manage_surveys')
  async createSurvey(
    @Request() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Body() dto: CreateSurveyDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const createdBy = req.user?.sub || req.user?.id;
    const companyId = dto.company_id || headerCompanyId;
    const branchId = dto.branch_id || headerBranchId;
    const data = await this.surveysService.createSurvey(tenantId, dto, createdBy, companyId, branchId);
    return { data, message: 'Survey created successfully' };
  }
}
