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

  // ==================== CATEGORIES ====================

  @Get('categories')
  @RequirePermissions('view_expenses', 'view_my_expenses')
  getCategories(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.expensesService.getCategories(tenantId, companyId, branchId);
  }

  @Post('categories')
  @RequirePermissions('manage_expense_policies', 'manage_expenses')
  createCategory(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.expensesService.createCategory(tenantId, dto, companyId, branchId);
  }

  // ==================== EXPENSE REPORTS ====================

  @Get('reports')
  @RequirePermissions('view_expenses')
  getReports(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.expensesService.getReports(tenantId, employeeId, status, companyId, branchId);
  }

  @Get('my')
  @RequirePermissions('view_my_expenses', 'view_expenses')
  getMyReports(
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.getMyReports(tenantId, userId);
  }

  @Get('reports/:id')
  @RequirePermissions('view_expenses', 'view_my_expenses')
  getReportById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.expensesService.getReportById(tenantId, id);
  }

  @Post('reports')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  createReport(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId: string,
    @Headers('x-branch-id') branchId: string,
    @Req() req: any,
    @Body() dto: CreateExpenseReportDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.createReport(tenantId, dto, userId, companyId, branchId);
  }

  @Put('reports/:id')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  updateReport(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateExpenseReportDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.updateReport(tenantId, id, dto, userId);
  }

  @Post('reports/:id/items')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  addExpenseItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') reportId: string,
    @Body() dto: CreateExpenseItemDto,
  ) {
    return this.expensesService.addExpenseItem(tenantId, reportId, dto);
  }

  @Delete('reports/:id/items/:itemId')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  deleteExpenseItem(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') reportId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.expensesService.deleteExpenseItem(tenantId, reportId, itemId);
  }

  @Post('reports/:id/submit')
  @RequirePermissions('submit_expenses', 'view_my_expenses')
  submitReport(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') reportId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.submitReport(tenantId, reportId, userId);
  }

  @Post('reports/:id/approve')
  @RequirePermissions('approve_expenses', 'manage_expenses')
  approveReport(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') reportId: string,
    @Req() req: any,
    @Body() dto: ApproveExpenseReportDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.approveReport(tenantId, reportId, dto, userId);
  }

  @Post('reports/:id/reject')
  @RequirePermissions('approve_expenses', 'manage_expenses')
  rejectReport(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') reportId: string,
    @Req() req: any,
    @Body() dto: RejectExpenseReportDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.expensesService.rejectReport(tenantId, reportId, dto.rejection_reason, userId);
  }

  @Post('reports/:id/reimburse')
  @RequirePermissions('reimburse_expenses', 'manage_expenses')
  markReimbursed(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') reportId: string,
  ) {
    return this.expensesService.markReimbursed(tenantId, reportId);
  }

  // ==================== ANALYTICS ====================

  @Get('analytics')
  @RequirePermissions('view_expenses', 'view_expense_reports')
  getAnalytics(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyId?: string,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.expensesService.getExpenseAnalytics(tenantId, companyId, branchId);
  }
}
