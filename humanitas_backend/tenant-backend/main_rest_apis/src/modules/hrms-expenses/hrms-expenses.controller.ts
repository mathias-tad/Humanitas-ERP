import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { HrmsExpensesService } from './hrms-expenses.service';
import {
  CreateExpenseCategoryDto,
  CreateExpenseReportDto,
  UpdateExpenseReportDto,
  CreateExpenseItemDto,
  ApproveExpenseReportDto,
  RejectExpenseReportDto,
} from './dto/hrms-expenses.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('hrms/expenses')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class HrmsExpensesController {
  constructor(private readonly expensesService: HrmsExpensesService) {}

  private getTenantId(req: any, headerTenantId?: string): string {
    return req?.user?.tenantId || req?.user?.tenant_id || headerTenantId;
  }

  // ==================== CATEGORIES ====================

  @Get('categories')
  @RequirePermissions('view_expenses', 'view_my_expenses')
  getCategories(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.expensesService.getCategories(tenantId, companyId, branchId);
  }

  @Post('categories')
  @RequirePermissions('manage_expense_policies', 'manage_expenses')
  createCategory(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.expensesService.createCategory(tenantId, dto, companyId, branchId);
  }

  // ==================== EXPENSE REPORTS ====================

  @Get('reports')
  @RequirePermissions('view_expenses')
  getReports(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.expensesService.getReports(tenantId, employeeId, status, companyId, branchId);
  }

  @Get('my')
  @RequirePermissions('view_my_expenses', 'view_expenses')
  getMyReports(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.getMyReports(tenantId, userId);
  }

  @Get('reports/:id')
  @RequirePermissions('view_expenses', 'view_my_expenses')
  getReportById(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.expensesService.getReportById(tenantId, id);
  }

  @Post('reports')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  createReport(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Body() dto: CreateExpenseReportDto,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.createReport(tenantId, dto, userId, companyId, branchId);
  }

  @Put('reports/:id')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  updateReport(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseReportDto,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.updateReport(tenantId, id, dto, userId);
  }

  @Post('reports/:id/items')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  addExpenseItem(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') reportId: string,
    @Body() dto: CreateExpenseItemDto,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.expensesService.addExpenseItem(tenantId, reportId, dto);
  }

  @Delete('reports/:id/items/:itemId')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  deleteExpenseItem(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') reportId: string,
    @Param('itemId') itemId: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.expensesService.deleteExpenseItem(tenantId, reportId, itemId);
  }

  @Post('reports/:id/submit')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  submitReport(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') reportId: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.submitReport(tenantId, reportId, userId);
  }

  @Post('reports/:id/approve')
  @RequirePermissions('approve_expenses', 'manage_expenses')
  approveReport(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') reportId: string,
    @Body() dto: ApproveExpenseReportDto,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.approveReport(tenantId, reportId, dto, userId);
  }

  @Post('reports/:id/reject')
  @RequirePermissions('approve_expenses', 'manage_expenses')
  rejectReport(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') reportId: string,
    @Body() dto: RejectExpenseReportDto,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.rejectReport(tenantId, reportId, dto.rejection_reason, userId);
  }

  @Post('reports/:id/reimburse')
  @RequirePermissions('reimburse_expenses', 'manage_expenses')
  markReimbursed(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId: string,
    @Param('id') reportId: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.expensesService.markReimbursed(tenantId, reportId);
  }

  // ==================== ANALYTICS ====================

  @Get('analytics')
  @RequirePermissions('view_expenses', 'view_expense_reports')
  getAnalytics(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.expensesService.getExpenseAnalytics(tenantId, companyId, branchId);
  }
}
