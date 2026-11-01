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

  @Get('analytics')
  @RequirePermissions('view_survey_results')
  async getAnalytics(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string
  ) {
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    const data = await this.surveysService.getSurveyAnalytics(tenantId, companyId, branchId);
    return { data };
  }

  @Get('actions')
  @RequirePermissions('view_surveys')
  async getActionItems(
    @Headers('x-tenant-id') tenantId: string,
    @Query('survey_id') surveyId?: string
  ) {
    const data = await this.surveysService.getActionItems(tenantId, surveyId);
    return { data };
  }

  @Post('actions')
  @RequirePermissions('manage_survey_actions')
  async createActionItem(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateSurveyActionItemDto,
    @Request() req: any
  ) {
    const createdBy = req.user.sub || req.user.id || req.user.sub;
    const data = await this.surveysService.createActionItem(tenantId, dto, createdBy);
    return { data, message: 'Survey follow-up action created successfully' };
  }

  @Put('actions/:id')
  @RequirePermissions('manage_survey_actions')
  async updateActionItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSurveyActionItemDto
  ) {
    const data = await this.surveysService.updateActionItem(tenantId, id, dto);
    return { data, message: 'Action item updated successfully' };
  }

  @Get()
  @RequirePermissions('view_surveys')
  async getSurveys(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Query('status') status?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string
  ) {
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    const data = await this.surveysService.getSurveys(tenantId, status, companyId, branchId);
    return { data };
  }

  @Get(':id')
  @RequirePermissions('view_surveys')
  async getSurveyById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: any
  ) {
    const currentUserId = req.user.sub || req.user.id || req.user.sub;
    const data = await this.surveysService.getSurveyById(tenantId, id, currentUserId);
    return { data };
  }

  @Get(':id/results')
  @RequirePermissions('view_survey_results')
  async getSurveyResults(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    const data = await this.surveysService.getSurveyResults(tenantId, id);
    return { data };
  }

  @Post()
  @RequirePermissions('manage_surveys')
  async createSurvey(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Body() dto: CreateSurveyDto,
    @Request() req: any
  ) {
    const createdBy = req.user.sub || req.user.id || req.user.sub;
    const companyId = headerCompanyId;
    const branchId = headerBranchId;
    const data = await this.surveysService.createSurvey(tenantId, dto, createdBy, companyId, branchId);
    return { data, message: 'Survey published successfully' };
  }

  @Post('respond')
  @RequirePermissions('participate_survey')
  async submitResponse(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: SubmitSurveyResponseDto,
    @Request() req: any
  ) {
    const userId = req.user.sub || req.user.id || req.user.sub;
    const data = await this.surveysService.submitResponse(tenantId, dto, userId);
    return { data, message: 'Response recorded successfully' };
  }
}
