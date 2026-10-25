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
import { HrmsGrievancesService } from './hrms-grievances.service';
import {
  FileGrievanceDto,
  UpdateGrievanceStatusDto,
  AssignInvestigatorDto,
  ProposeResolutionDto,
  SubmitSatisfactionFeedbackDto,
  AddGrievanceNoteDto,
} from './dto/hrms-grievances.dto';

@Controller('hrms/grievances')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class HrmsGrievancesController {
  constructor(private readonly grievancesService: HrmsGrievancesService) {}

  private getTenantId(req: any, headerTenantId?: string): string {
    return req.user?.tenantId || req.user?.tenant_id || headerTenantId;
  }

  @Post()
  @RequirePermissions('file_grievance', 'manage_grievances')
  async fileGrievance(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Headers('x-branch-id') branchIdHeader: string,
    @Body() dto: FileGrievanceDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.id || req.user.sub;
    const companyId = req.user.company_id || companyIdHeader;
    const branchId = req.user.branch_id || branchIdHeader;
    return this.grievancesService.fileGrievance(tenantId, userId, dto, companyId, branchId);
  }

  @Get()
  @RequirePermissions('view_grievances', 'manage_grievances')
  async getGrievances(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Headers('x-branch-id') branchIdHeader: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.id || req.user.sub;
    const userRole = (req.user.role || '').toLowerCase();
    const permissions: string[] = req.user.permissions || [];

    const hasManagePerm =
      ['owner', 'admin', 'administrator'].includes(userRole) ||
      permissions.includes('manage_grievances') ||
      permissions.includes('investigate_grievances');

    const filters = {
      status,
      category,
      company_id: companyIdHeader || req.user.company_id,
      branch_id: branchIdHeader || req.user.branch_id,
    };

    return this.grievancesService.getGrievances(tenantId, userId, hasManagePerm, filters);
  }

  @Get('reports/stats')
  @RequirePermissions('view_grievance_reports', 'manage_grievances')
  async getStats(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Headers('x-branch-id') branchIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const companyId = companyIdHeader || req.user.company_id;
    const branchId = branchIdHeader || req.user.branch_id;
    return this.grievancesService.getStats(tenantId, companyId, branchId);
  }

  @Get(':id')
  @RequirePermissions('view_grievances', 'manage_grievances')
  async getGrievanceById(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.id || req.user.sub;
    const userRole = (req.user.role || '').toLowerCase();
    const permissions: string[] = req.user.permissions || [];

    const hasManagePerm =
      ['owner', 'admin', 'administrator'].includes(userRole) ||
      permissions.includes('manage_grievances') ||
      permissions.includes('investigate_grievances');

    return this.grievancesService.getGrievanceById(tenantId, id, userId, hasManagePerm);
  }

  @Put(':id/status')
  @RequirePermissions('manage_grievances', 'investigate_grievances')
  async updateStatus(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
    @Body() dto: UpdateGrievanceStatusDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.id || req.user.sub;
    return this.grievancesService.updateStatus(tenantId, id, userId, dto);
  }

  @Post(':id/assign')
  @RequirePermissions('manage_grievances')
  async assignInvestigator(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
    @Body() dto: AssignInvestigatorDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.id || req.user.sub;
    return this.grievancesService.assignInvestigator(tenantId, id, userId, dto);
  }

  @Post(':id/resolution')
  @RequirePermissions('manage_grievances', 'investigate_grievances')
  async proposeResolution(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
    @Body() dto: ProposeResolutionDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.id || req.user.sub;
    return this.grievancesService.proposeResolution(tenantId, id, userId, dto);
  }

  @Post(':id/feedback')
  @RequirePermissions('view_grievances', 'file_grievance')
  async submitFeedback(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
    @Body() dto: SubmitSatisfactionFeedbackDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.id || req.user.sub;
    return this.grievancesService.submitFeedback(tenantId, id, userId, dto);
  }

  @Post(':id/notes')
  @RequirePermissions('manage_grievances', 'investigate_grievances')
  async addNote(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
    @Body() dto: AddGrievanceNoteDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.id || req.user.sub;
    return this.grievancesService.addNote(tenantId, id, userId, dto);
  }
}
