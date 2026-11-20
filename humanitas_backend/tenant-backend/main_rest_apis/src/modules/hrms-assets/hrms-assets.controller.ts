import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { HrmsAssetsService } from './hrms-assets.service';
import {
  CreateAssetCategoryDto,
  CreateAssetDto,
  UpdateAssetDto,
  AssignAssetDto,
  ReturnAssetDto,
  CreateMaintenanceLogDto,
} from './dto/hrms-assets.dto';
import { firstHeader, type AuthenticatedRequest } from '../../common/types/authenticated-request';

@RequireModule('hrms')
@Controller('hrms/assets')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class HrmsAssetsController {
  constructor(private readonly assetsService: HrmsAssetsService) {}

  private getTenantId(req: AuthenticatedRequest, headerTenantId?: string): string {
    return (
      req?.user?.tenantId ||
      headerTenantId ||
      firstHeader(req?.headers['x-tenant-id']) ||
      'default'
    );
  }

  @Get('categories')
  @RequirePermissions('view_assets')
  async getCategories(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId?: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const data = await this.assetsService.getCategories(tenantId);
    return { data };
  }

  @Post('categories')
  @RequirePermissions('manage_assets')
  async createCategory(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Body() dto: CreateAssetCategoryDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const data = await this.assetsService.createCategory(tenantId, dto);
    return { data, message: 'Asset category created successfully' };
  }

  @Get('my-assets')
  @RequirePermissions('view_my_assets')
  async getMyAssets(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId?: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub;
    const data = await this.assetsService.getMyAssets(tenantId, userId);
    return { data };
  }

  @Post('assignments/:assignmentId/acknowledge')
  @RequirePermissions('view_my_assets')
  async acknowledgeAsset(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('assignmentId') assignmentId: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub;
    const data = await this.assetsService.acknowledgeAsset(tenantId, assignmentId, userId);
    return { data, message: 'Asset custody acknowledged successfully' };
  }

  @Get('analytics')
  @RequirePermissions('view_asset_reports')
  async getAnalytics(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    const data = await this.assetsService.getAssetAnalytics(tenantId, companyId, branchId);
    return { data };
  }

  @Get('maintenance')
  @RequirePermissions('view_assets')
  async getMaintenanceLogs(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Query('asset_id') assetId?: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const data = await this.assetsService.getMaintenanceLogs(tenantId, assetId);
    return { data };
  }

  @Get()
  @RequirePermissions('view_assets')
  async getAssets(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('category_id') categoryId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    const data = await this.assetsService.getAssets(
      tenantId,
      { category_id: categoryId, status, search },
      companyId,
      branchId
    );
    return { data };
  }

  @Get(':id')
  @RequirePermissions('view_assets')
  async getAssetById(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const data = await this.assetsService.getAssetById(tenantId, id);
    return { data };
  }

  @Post()
  @RequirePermissions('manage_assets')
  async createAsset(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Body() dto: CreateAssetDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const createdBy = req.user?.sub;
    const companyId = dto.company_id || headerCompanyId;
    const branchId = dto.branch_id || headerBranchId;
    const data = await this.assetsService.createAsset(
      tenantId,
      dto,
      createdBy,
      companyId,
      branchId
    );
    return { data, message: 'Asset created successfully' };
  }

  @Put(':id')
  @RequirePermissions('manage_assets')
  async updateAsset(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const data = await this.assetsService.updateAsset(tenantId, id, dto);
    return { data, message: 'Asset updated successfully' };
  }

  @Delete(':id')
  @RequirePermissions('manage_assets')
  async deleteAsset(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const data = await this.assetsService.deleteAsset(tenantId, id);
    return { data, message: 'Asset deleted successfully' };
  }

  @Post(':id/assign')
  @RequirePermissions('assign_assets')
  async assignAsset(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
    @Body() dto: AssignAssetDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const assignedBy = req.user?.sub;
    const data = await this.assetsService.assignAsset(tenantId, id, dto, assignedBy);
    return { data, message: 'Asset assigned successfully' };
  }

  @Post(':id/return')
  @RequirePermissions('manage_assets')
  async returnAsset(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
    @Body() dto: ReturnAssetDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const receivedBy = req.user?.sub;
    const data = await this.assetsService.returnAsset(tenantId, id, dto, receivedBy);
    return { data, message: 'Asset returned successfully' };
  }

  @Post(':id/maintenance')
  @RequirePermissions('manage_assets')
  async logMaintenance(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateMaintenanceLogDto
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const loggedBy = req.user?.sub;
    const data = await this.assetsService.createMaintenanceLog(tenantId, id, dto, loggedBy);
    return { data, message: 'Maintenance record logged successfully' };
  }
}
