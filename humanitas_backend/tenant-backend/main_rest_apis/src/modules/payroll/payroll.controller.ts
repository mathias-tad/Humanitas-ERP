import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { PayrollScheduler } from './payroll.scheduler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import * as ExcelJS from 'exceljs';
import {
  CreateIncomeTypeDto,
  UpdateIncomeTypeDto,
  AssignUserIncomeDto,
  UpdateUserIncomeDto,
  UpdateEmployeeCategoryDto,
  CreateTaxRuleDto,
  UpdateTaxRuleDto,
  CreateHolidayDto,
  UpdateHolidayDto,
} from './dto/payroll.dto';

@ApiTags('Payroll')
@ApiBearerAuth()
@Controller('payroll')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly payrollScheduler: PayrollScheduler,
  ) { }

  // ==================== INCOME TYPES ====================
  @Get('income-types')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Get all income types' })
  async getIncomeTypes(@Request() req: any) {
    return this.payrollService.getIncomeTypes(req.user.tenantId);
  }

  @Post('income-types')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Create income type' })
  async createIncomeType(@Request() req: any, @Body() body: CreateIncomeTypeDto) {
    return this.payrollService.createIncomeType(req.user.tenantId, body);
  }

  @Patch('income-types/:id')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Update income type' })
  async updateIncomeType(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: UpdateIncomeTypeDto,
  ) {
    return this.payrollService.updateIncomeType(req.user.tenantId, id, body);
  }

  @Delete('income-types/:id')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Delete income type' })
  async deleteIncomeType(@Request() req: any, @Param('id') id: string) {
    return this.payrollService.deleteIncomeType(req.user.tenantId, id);
  }

  @Get('income-types/:id/calculate/:userId')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Calculate income amount for a user' })
  async calculateIncomeAmount(
    @Request() req: any,
    @Param('id') incomeTypeId: string,
    @Param('userId') userId: string,
  ) {
    return this.payrollService.calculateIncomeAmount(
      req.user.tenantId,
      incomeTypeId,
      userId,
    );
  }

  // ==================== USER INCOMES ====================
  @Get('user-incomes/:userId')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Get user incomes' })
  async getUserIncomes(@Request() req: any, @Param('userId') userId: string) {
    return this.payrollService.getUserIncomes(req.user.tenantId, userId);
  }

  @Post('user-incomes/:userId')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Assign income to user' })
  async assignUserIncome(
    @Request() req: any,
    @Param('userId') userId: string,
    @Body() body: AssignUserIncomeDto,
  ) {
    return this.payrollService.assignUserIncome(
      req.user.tenantId,
      userId,
      body,
    );
  }

  @Patch('user-incomes/:id')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Update user income assignment' })
  async updateUserIncome(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: UpdateUserIncomeDto,
  ) {
    return this.payrollService.updateUserIncome(
      req.user.tenantId,
      id,
      body,
    );
  }

  @Delete('user-incomes/:id')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Remove user income' })
  async removeUserIncome(@Request() req: any, @Param('id') id: string) {
    return this.payrollService.removeUserIncome(req.user.tenantId, id);
  }

  @Post('user-incomes/:userId/recalculate')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Recalculate all base income assignments for a user' })
  async recalculateUserIncomes(@Request() req: any, @Param('userId') userId: string) {
    return this.payrollService.recalculateUserBaseIncomes(req.user.tenantId, userId);
  }

  @Post('migrate-income-assignments')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Migrate and recalculate all existing income assignments' })
  async migrateIncomeAssignments(@Request() req: any) {
    // This should be protected and only accessible by administrators
    const connection = await this.payrollService['databaseService'].getTenantConnectionById(req.user.tenantId);

    // Get all users with income assignments
    const users = await connection.query(`SELECT DISTINCT user_id FROM user_incomes`);

    let recalculatedCount = 0;
    for (const user of users) {
      try {
        await this.payrollService.recalculateUserBaseIncomes(req.user.tenantId, user.user_id);
        recalculatedCount++;
      } catch (e) {
        console.error(`Failed to recalculate for user ${user.user_id}:`, e.message);
      }
    }

    return {
      message: `Migration complete. Recalculated incomes for ${recalculatedCount} users.`,
      total_users: users.length,
      successful: recalculatedCount,
    };
  }

  // ==================== EMPLOYEE CATEGORIES ====================
  @Get('employee-categories')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Get employee categories' })
  async getEmployeeCategories(@Request() req: any) {
    return this.payrollService.getEmployeeCategories(req.user.tenantId);
  }

  @Patch('employee-categories/:id')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Update employee category' })
  async updateEmployeeCategory(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: UpdateEmployeeCategoryDto,
  ) {
    return this.payrollService.updateEmployeeCategory(
      req.user.tenantId,
      id,
      body,
    );
  }

  @Get('category-allowances/:categoryId')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Get category allowances' })
  async getCategoryAllowances(
    @Request() req: any,
    @Param('categoryId') categoryId: string,
  ) {
    return this.payrollService.getCategoryAllowances(
      req.user.tenantId,
      categoryId,
    );
  }

  // ==================== TAX RULES ====================
  @Get('tax-rules')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Get all tax rules' })
  async getTaxRules(@Request() req: any) {
    return this.payrollService.getTaxRules(req.user.tenantId);
  }

  @Post('tax-rules')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Create tax rule' })
  async createTaxRule(@Request() req: any, @Body() body: CreateTaxRuleDto) {
    return this.payrollService.createTaxRule(req.user.tenantId, body);
  }

  @Patch('tax-rules/:id')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Update tax rule' })
  async updateTaxRule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: UpdateTaxRuleDto,
  ) {
    return this.payrollService.updateTaxRule(req.user.tenantId, id, body);
  }

  @Delete('tax-rules/:id')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Delete tax rule' })
  async deleteTaxRule(@Request() req: any, @Param('id') id: string) {
    return this.payrollService.deleteTaxRule(req.user.tenantId, id);
  }

  // ==================== HOLIDAYS ====================
  @Get('holidays')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Get all holidays' })
  async getHolidays(@Request() req: any, @Query('year') year?: string) {
    return this.payrollService.getHolidays(
      req.user.tenantId,
      year ? parseInt(year) : undefined,
    );
  }

  @Post('holidays')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Create holiday' })
  async createHoliday(@Request() req: any, @Body() body: CreateHolidayDto) {
    return this.payrollService.createHoliday(req.user.tenantId, body);
  }

  @Patch('holidays/:id')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Update holiday' })
  async updateHoliday(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: UpdateHolidayDto,
  ) {
    return this.payrollService.updateHoliday(req.user.tenantId, id, body);
  }

  @Delete('holidays/:id')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Delete holiday' })
  async deleteHoliday(@Request() req: any, @Param('id') id: string) {
    return this.payrollService.deleteHoliday(req.user.tenantId, id);
  }

  @Post('seed-tax-rules')
  @RequirePermissions('manage_payroll')
  @ApiOperation({ summary: 'Seed default Ethiopian tax rules' })
  async seedTaxRules(@Request() req: any) {
    return this.payrollService.seedDefaultTaxRules(req.user.tenantId);
  }


  // ==================== PAYSLIPS (USER) ====================
  @Get('my-payslips')
  @RequirePermissions('view_payroll')
  @ApiOperation({ summary: 'Get my payslip history' })
  async getMyPayslips(@Request() req: any) {
    return this.payrollService.getMyPayslips(req.user.tenantId, req.user.sub);
  }

  @Get('my-payslips/:id')
  @RequirePermissions('view_payroll')
  @ApiOperation({ summary: 'Get details of a specific payslip' })
  async getMyPayslipDetail(@Request() req: any, @Param('id') id: string) {
    return this.payrollService.getMyPayslipDetail(req.user.tenantId, req.user.sub, id);
  }

  // ==================== PAYROLL ====================
  @Get('history')
  @RequirePermissions('view_payroll')
  @ApiOperation({ summary: 'Get payroll history' })
  async getPayrollHistory(@Request() req: any) {
    return this.payrollService.getPayrollHistory(req.user.tenantId);
  }

  @Get('details')
  @RequirePermissions('view_payroll')
  @ApiOperation({ summary: 'Get payroll details for a month' })
  async getPayrollDetails(
    @Request() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.payrollService.getPayrollDetails(
      req.user.tenantId,
      parseInt(month),
      parseInt(year),
    );
  }

  @Post('run')
  @RequirePermissions('run_payroll')
  @ApiOperation({ summary: 'Run payroll for a specific month/year' })
  async runPayroll(
    @Request() req: any,
    @Body() body: { month: number; year: number },
  ) {
    // Delegate to Python calculation service via job queue
    const response = await fetch('http://localhost:8000/api/payroll/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: req.user.tenantId,
        month: body.month,
        year: body.year,
        user_id: req.user.sub
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to queue payroll: ${response.statusText}`);
    }

    return await response.json();
  }

  @Post('webhook/completed')
  @ApiOperation({ summary: 'Webhook called when payroll completes (from Python service)' })
  async payrollCompletedWebhook(@Body() body: { tenant_id: string; payroll_run_id: string; month: number; year: number; total_employees: number }) {
    try {
      console.log(`[Payroll Webhook] Received completion notification for ${body.month}/${body.year}`);

      // Send notifications to all employees
      await this.payrollService.notifyPayrollCompletion(
        body.tenant_id,
        body.payroll_run_id,
        body.month,
        body.year
      );

      return { success: true, message: 'Notifications sent' };
    } catch (error) {
      console.error('[Payroll Webhook] Error sending notifications:', error);
      return { success: false, error: error.message };
    }
  }

  @Get('status')
  @RequirePermissions('view_payroll')
  @ApiOperation({ summary: 'Check payroll job status for a specific month/year' })
  async getPayrollStatus(
    @Request() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    console.log(`[Payroll] Status check req: month=${month}, year=${year}`);

    const m = parseInt(month);
    const y = parseInt(year);

    if (isNaN(m) || isNaN(y)) {
      throw new BadRequestException('Invalid month or year provided');
    }

    return this.payrollService.getPayrollStatus(
      req.user.tenantId,
      m,
      y,
    );
  }

  @Post('trigger-auto')
  @RequirePermissions('run_payroll')
  @ApiOperation({ summary: 'Trigger auto payroll check (for testing)' })
  async triggerAutoPayroll(@Request() req: any) {
    return this.payrollScheduler.triggerAutoPayroll(req.user.tenantId);
  }

  @Get('export')
  @RequirePermissions('view_payroll')
  @ApiOperation({ summary: 'Export payroll to Excel' })
  async exportPayroll(
    @Request() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
    @Res() res: any,
  ) {
    const data = await this.payrollService.getPayrollDetails(
      req.user.tenantId,
      parseInt(month),
      parseInt(year),
    );

    const workbook = new ExcelJS.Workbook();

    // ==================== SHEET 1: PAYROLL SHEET ====================
    const payrollSheet = workbook.addWorksheet('Payroll Sheet');

    // Scan for unique allowances and deductions
    const allowanceTypes = new Set<string>();
    const deductionTypes = new Set<string>();

    data.forEach((item: any) => {
      const breakdown = typeof item.allowances_breakdown === 'string'
        ? JSON.parse(item.allowances_breakdown)
        : item.allowances_breakdown || [];

      breakdown.forEach((allowance: any) => {
        if (allowance.amount > 0) {
          allowanceTypes.add(allowance.name);
        }
      });

      // Check for other deductions in penalties_breakdown
      const penalties = typeof item.other_deductions === 'string'
        ? JSON.parse(item.other_deductions)
        : [];

      if (Array.isArray(penalties)) {
        penalties.forEach((p: any) => {
          if (p.amount > 0) {
            deductionTypes.add(p.type || 'Penalty');
          }
        });
      }
    });

    const allowanceColumns = Array.from(allowanceTypes);
    const deductionColumns = Array.from(deductionTypes);

    // Build dynamic headers
    const headers = [
      'S.No',
      'Employee Name',
      'Position',
      'Basic Salary',
      'TIN',
      'Working Days',
      ...allowanceColumns,
      'Gross Salary',
      'Taxable Income',
      'Income Tax',
      'Pension (7%)',
      'Pension (11%)',
      ...deductionColumns,
      'Total Deductions',
      'Net Pay',
    ];

    // Add title row (merged)
    payrollSheet.mergeCells('A1:' + this.columnToLetter(headers.length) + '1');
    const titleRow = payrollSheet.getRow(1);
    titleRow.getCell(1).value = `PAYROLL SHEET - ${this.getMonthName(parseInt(month))} ${year}`;
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 25;

    // Add headers in row 2
    const headerRow = payrollSheet.getRow(2);
    headers.forEach((header, index) => {
      headerRow.getCell(index + 1).value = header;
    });
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 20;

    // Add data rows
    data.forEach((item: any, idx: number) => {
      const rowNumber = idx + 3;
      const row = payrollSheet.getRow(rowNumber);

      const breakdown = typeof item.allowances_breakdown === 'string'
        ? JSON.parse(item.allowances_breakdown)
        : item.allowances_breakdown || [];

      const allowanceMap = new Map<string, number>();
      breakdown.forEach((a: any) => {
        allowanceMap.set(a.name, a.amount || 0);
      });

      // Check for other deductions in penalty_breakdown
      const penalties = typeof item.penalty_breakdown === 'string'
        ? JSON.parse(item.penalty_breakdown)
        : item.penalty_breakdown || [];
      const penaltyMap = new Map<string, number>();
      if (Array.isArray(penalties)) {
        penalties.forEach((p: any) => {
          penaltyMap.set(p.type || 'Penalty', p.amount || 0);
        });
      }

      let colIdx = 1;

      // S.No
      row.getCell(colIdx++).value = idx + 1;

      // Employee Name
      row.getCell(colIdx++).value = item.employee_name || '';

      // Position
      row.getCell(colIdx++).value = item.position || '';

      // Basic Salary
      const basicCol = colIdx++;
      row.getCell(basicCol).value = parseFloat(item.basic_salary) || 0;
      row.getCell(basicCol).numFmt = '#,##0.00';

      // TIN
      row.getCell(colIdx++).value = item.tin || '';

      // Working Days
      row.getCell(colIdx++).value = parseInt(item.days_worked) || 0;

      // Dynamic Allowances
      const allowanceStartCol = colIdx;
      allowanceColumns.forEach((allowanceName) => {
        const cell = row.getCell(colIdx++);
        cell.value = allowanceMap.get(allowanceName) || 0;
        cell.numFmt = '#,##0.00';
      });

      // Gross Salary
      const grossCol = colIdx++;
      row.getCell(grossCol).value = parseFloat(item.gross_salary) || 0;
      row.getCell(grossCol).numFmt = '#,##0.00';

      // Taxable Income
      const taxableCol = colIdx++;
      row.getCell(taxableCol).value = parseFloat(item.taxable_income) || 0;
      row.getCell(taxableCol).numFmt = '#,##0.00';

      // Income Tax
      const taxCol = colIdx++;
      row.getCell(taxCol).value = parseFloat(item.income_tax) || 0;
      row.getCell(taxCol).numFmt = '#,##0.00';

      // Pension (7%)
      const pension7Col = colIdx++;
      row.getCell(pension7Col).value = parseFloat(item.pension_employee) || 0;
      row.getCell(pension7Col).numFmt = '#,##0.00';

      // Pension (11%)
      const pension11Col = colIdx++;
      row.getCell(pension11Col).value = parseFloat(item.pension_employer) || 0;
      row.getCell(pension11Col).numFmt = '#,##0.00';

      // Dynamic Deductions/Penalties
      deductionColumns.forEach((deductionName) => {
        const cell = row.getCell(colIdx++);
        cell.value = penaltyMap.get(deductionName) || 0;
        cell.numFmt = '#,##0.00';
      });

      // Total Deductions
      const totalDeductionsCol = colIdx++;
      row.getCell(totalDeductionsCol).value = parseFloat(item.total_deductions) || 0;
      row.getCell(totalDeductionsCol).numFmt = '#,##0.00';

      // Net Pay
      const netCol = colIdx++;
      row.getCell(netCol).value = parseFloat(item.net_salary) || 0;
      row.getCell(netCol).numFmt = '#,##0.00';
    });

    // Add TOTALS row
    const totalRowNumber = data.length + 3;
    const totalRow = payrollSheet.getRow(totalRowNumber);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD700' },
    };

    totalRow.getCell(1).value = '';
    totalRow.getCell(2).value = 'TOTAL';

    // Calculate column totals using SUM formulas
    for (let col = 4; col <= headers.length; col++) {
      const colLetter = this.columnToLetter(col);
      // Skip non-numeric columns (Position, TIN, etc.)
      if (col === 3 || col === 5) { // Position, TIN
        totalRow.getCell(col).value = '';
      } else {
        totalRow.getCell(col).value = {
          formula: `=SUM(${colLetter}3:${colLetter}${totalRowNumber - 1})`
        };
        totalRow.getCell(col).numFmt = '#,##0.00';
      }
    }

    // Set column widths
    payrollSheet.getColumn(1).width = 6;  // S.No
    payrollSheet.getColumn(2).width = 25; // Name
    payrollSheet.getColumn(3).width = 18; // Position
    payrollSheet.getColumn(4).width = 14; // Basic
    payrollSheet.getColumn(5).width = 16; // TIN
    payrollSheet.getColumn(6).width = 12; // Days
    for (let i = 7; i <= headers.length; i++) {
      payrollSheet.getColumn(i).width = 14;
    }

    // Add borders to all cells
    for (let rowNum = 2; rowNum <= totalRowNumber; rowNum++) {
      for (let colNum = 1; colNum <= headers.length; colNum++) {
        payrollSheet.getRow(rowNum).getCell(colNum).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }

    // ==================== SHEET 2: BANK TRANSFER ====================
    const bankSheet = workbook.addWorksheet('Bank Transfer');

    // Title
    bankSheet.mergeCells('A1:C1');
    const bankTitleRow = bankSheet.getRow(1);
    bankTitleRow.getCell(1).value = `BANK TRANSFER - ${this.getMonthName(parseInt(month))} ${year}`;
    bankTitleRow.getCell(1).font = { bold: true, size: 14 };
    bankTitleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    bankTitleRow.height = 25;

    // Headers
    const bankHeaderRow = bankSheet.getRow(2);
    bankHeaderRow.getCell(1).value = 'Full Name';
    bankHeaderRow.getCell(2).value = 'Account Number';
    bankHeaderRow.getCell(3).value = 'Net Pay';
    bankHeaderRow.font = { bold: true };
    bankHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };
    bankHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Data
    data.forEach((item: any, idx: number) => {
      const row = bankSheet.getRow(idx + 3);
      row.getCell(1).value = item.employee_name || '';
      row.getCell(2).value = item.account_number || '';
      row.getCell(3).value = parseFloat(item.net_salary) || 0;
      row.getCell(3).numFmt = '#,##0.00';
    });

    // Totals
    const bankTotalRow = bankSheet.getRow(data.length + 3);
    bankTotalRow.font = { bold: true };
    bankTotalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD700' },
    };
    bankTotalRow.getCell(1).value = 'TOTAL';
    bankTotalRow.getCell(2).value = '';
    bankTotalRow.getCell(3).value = {
      formula: `=SUM(C3:C${data.length + 2})`
    };
    bankTotalRow.getCell(3).numFmt = '#,##0.00';

    // Set column widths
    bankSheet.getColumn(1).width = 30;
    bankSheet.getColumn(2).width = 20;
    bankSheet.getColumn(3).width = 16;

    // Add borders
    for (let rowNum = 2; rowNum <= data.length + 3; rowNum++) {
      for (let colNum = 1; colNum <= 3; colNum++) {
        bankSheet.getRow(rowNum).getCell(colNum).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    res.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.header(
      'Content-Disposition',
      `attachment; filename=payroll_${year}_${month}.xlsx`,
    );
    res.send(buffer);
  }

  // Helper: Convert column number to Excel letter (1=A, 2=B, etc.)
  private columnToLetter(column: number): string {
    let temp: number;
    let letter = '';
    while (column > 0) {
      temp = (column - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      column = (column - temp - 1) / 26;
    }
    return letter;
  }

  // Helper: Get month name
  private getMonthName(month: number): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || '';
  }
}
