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
import { ModuleSubscriptionGuard } from '../auth/guards/module-subscription.guard';
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

@Controller('hrms/assets')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class HrmsAssetsController {
  constructor(private readonly assetsService: HrmsAssetsService) {}

  @Get('categories')
  @RequirePermissions('view_assets')
  async getCategories(@Headers('x-tenant-id') tenantId: string) {
    const data = await this.assetsService.getCategories(tenantId);
    return { data };
  }

  @Post('categories')
  @RequirePermissions('manage_assets')
  async createCategory(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateAssetCategoryDto
  ) {
    const data = await this.assetsService.createCategory(tenantId, dto);
    return { data, message: 'Asset category created successfully' };
  }

  @Get('my-assets')
  @RequirePermissions('view_my_assets')
  async getMyAssets(
    @Headers('x-tenant-id') tenantId: string,
    @Request() req: any
  ) {
    const userId = req.user.sub || req.user.id || req.user.sub;
    const data = await this.assetsService.getMyAssets(tenantId, userId);
    return { data };
  }

  @Post('assignments/:assignmentId/acknowledge')
  @RequirePermissions('view_my_assets')
  async acknowledgeAsset(
    @Headers('x-tenant-id') tenantId: string,
    @Param('assignmentId') assignmentId: string,
    @Request() req: any
  ) {
    const userId = req.user.sub || req.user.id || req.user.sub;
    const data = await this.assetsService.acknowledgeAsset(tenantId, assignmentId, userId);
    return { data, message: 'Asset custody acknowledged successfully' };
  }

  @Get('analytics')
  @RequirePermissions('view_asset_reports')
  async getAnalytics(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Query('company_id') queryCompanyId: string,
    @Query('branch_id') queryBranchId: string
  ) {
    const companyId = queryCompanyId || headerCompanyId;
    const branchId = queryBranchId || headerBranchId;
    const data = await this.assetsService.getAssetAnalytics(tenantId, companyId, branchId);
    return { data };
  }

  @Get('maintenance')
  @RequirePermissions('view_assets')
  async getMaintenanceLogs(
    @Headers('x-tenant-id') tenantId: string,
    @Query('asset_id') assetId?: string
  ) {
    const data = await this.assetsService.getMaintenanceLogs(tenantId, assetId);
    return { data };
  }

  @Get()
  @RequirePermissions('view_assets')
  async getAssets(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Query('category_id') categoryId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('branch_id') queryBranchId?: string
  ) {
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
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    const data = await this.assetsService.getAssetById(tenantId, id);
    return { data };
  }

  @Post()
  @RequirePermissions('manage_assets')
  async createAsset(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Body() dto: CreateAssetDto,
    @Request() req: any
  ) {
    const createdBy = req.user.sub || req.user.id || req.user.sub;
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
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto
  ) {
    const data = await this.assetsService.updateAsset(tenantId, id, dto);
    return { data, message: 'Asset updated successfully' };
  }

  @Delete(':id')
  @RequirePermissions('manage_assets')
  async deleteAsset(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    const data = await this.assetsService.deleteAsset(tenantId, id);
    return { data, message: 'Asset deleted successfully' };
  }

  @Post(':id/assign')
  @RequirePermissions('assign_assets')
  async assignAsset(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: AssignAssetDto,
    @Request() req: any
  ) {
    const assignedBy = req.user.sub || req.user.id || req.user.sub;
    const data = await this.assetsService.assignAsset(tenantId, id, dto, assignedBy);
    return { data, message: 'Asset assigned successfully' };
  }

  @Post(':id/return')
  @RequirePermissions('manage_assets')
  async returnAsset(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: ReturnAssetDto,
    @Request() req: any
  ) {
    const receivedBy = req.user.sub || req.user.id || req.user.sub;
    const data = await this.assetsService.returnAsset(tenantId, id, dto, receivedBy);
    return { data, message: 'Asset returned successfully' };
  }

  @Post(':id/maintenance')
  @RequirePermissions('manage_assets')
  async logMaintenance(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateMaintenanceLogDto,
    @Request() req: any
  ) {
    const loggedBy = req.user.sub || req.user.id || req.user.sub;
    const data = await this.assetsService.createMaintenanceLog(tenantId, id, dto, loggedBy);
    return { data, message: 'Maintenance record logged successfully' };
  }
}
