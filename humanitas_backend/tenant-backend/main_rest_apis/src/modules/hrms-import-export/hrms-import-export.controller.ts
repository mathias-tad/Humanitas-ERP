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
import { HrmsImportExportService } from './hrms-import-export.service';
import {
  ValidateImportDto,
  CommitImportDto,
  TriggerExportDto,
  CreateExportTemplateDto,
  UpdateExportTemplateDto,
  EntityType,
} from './dto/hrms-import-export.dto';

@Controller('hrms/import-export')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
export class HrmsImportExportController {
  constructor(private readonly service: HrmsImportExportService) {}

  @Get('stats')
  @RequirePermissions('view_import_export')
  async getStats(@Headers('x-tenant-id') tenantId: string) {
    const data = await this.service.getImportExportStats(tenantId);
    return { data };
  }

  @Get('template/:entityType')
  @RequirePermissions('manage_import')
  async getTemplate(@Param('entityType') entityType: EntityType) {
    const data = this.service.getTemplateSchema(entityType);
    return { data };
  }

  @Get('jobs')
  @RequirePermissions('view_import_export')
  async getJobs(
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: number
  ) {
    const data = await this.service.getJobs(tenantId, limit ? Number(limit) : 50);
    return { data };
  }

  @Get('jobs/:id')
  @RequirePermissions('view_import_export')
  async getJobById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string
  ) {
    const data = await this.service.getJobById(tenantId, id);
    return { data };
  }

  @Post('validate')
  @RequirePermissions('manage_import')
  async validateImport(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Body() dto: ValidateImportDto,
    @Request() req: any
  ) {
    const userId = req.user.id || req.user.sub;
    const data = await this.service.validateImport(tenantId, dto, userId, headerCompanyId, headerBranchId);
    return { data, message: 'File validated. Review preview and error breakdown before committing.' };
  }

  @Post('commit')
  @RequirePermissions('manage_import')
  async commitImport(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CommitImportDto,
    @Request() req: any
  ) {
    const userId = req.user.id || req.user.sub;
    const data = await this.service.commitImport(tenantId, dto, userId);
    return { data };
  }

  @Post('rollback/:id')
  @RequirePermissions('rollback_import')
  async rollbackImport(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Request() req: any
  ) {
    const userId = req.user.id || req.user.sub;
    const data = await this.service.rollbackImport(tenantId, id, userId);
    return { data };
  }

  @Post('export')
  @RequirePermissions('manage_export')
  async triggerExport(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') headerCompanyId: string,
    @Headers('x-branch-id') headerBranchId: string,
    @Body() dto: TriggerExportDto,
    @Request() req: any
  ) {
    const userId = req.user.id || req.user.sub;
    const data = await this.service.triggerExport(tenantId, dto, userId, headerCompanyId, headerBranchId);
    return { data, message: 'Data export generated successfully' };
  }

  @Get('export-templates')
  @RequirePermissions('view_import_export')
  async getExportTemplates(@Headers('x-tenant-id') tenantId: string) {
    const data = await this.service.getExportTemplates(tenantId);
    return { data };
  }

  @Post('export-templates')
  @RequirePermissions('manage_export_schedules')
  async createExportTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateExportTemplateDto,
    @Request() req: any
  ) {
    const userId = req.user.id || req.user.sub;
    const data = await this.service.createExportTemplate(tenantId, dto, userId);
    return { data };
  }

  @Put('export-templates/:id')
  @RequirePermissions('manage_export_schedules')
  async updateExportTemplate(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExportTemplateDto
  ) {
    const data = await this.service.updateExportTemplate(tenantId, id, dto);
    return { data };
  }
}
