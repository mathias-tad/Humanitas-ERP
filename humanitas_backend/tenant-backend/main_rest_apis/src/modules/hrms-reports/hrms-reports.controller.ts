import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Res,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { RequireModule } from '../auth/guards/module-subscription.guard';
import { HrmsReportsService } from './hrms-reports.service';
import { HrmsReportsFilterDto, BankTransferExportDto } from './dto/hrms-reports.dto';

@ApiTags('HRMS Reports')
@Controller('hrms/reports')
@RequireModule('hrms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class HrmsReportsController {
  constructor(private readonly reportsService: HrmsReportsService) {}

  private extractScope(
    req: any,
    headerCompanyId?: string,
    headerBranchId?: string,
    queryCompanyId?: string,
    queryBranchId?: string,
  ): { company_id?: string; branch_id?: string } {
    const company_id = queryCompanyId || headerCompanyId || req.headers?.['x-company-id'];
    const branch_id = queryBranchId || headerBranchId || req.headers?.['x-branch-id'];
    return { company_id, branch_id };
  }

  @Get('summary')
  @RequirePermissions('view_hrms_reports')
  @ApiOperation({ summary: 'Get high-level executive HR summary metrics' })
  async getSummary(
    @Req() req: any,
    @Query() query: HrmsReportsFilterDto,
    @Headers('x-company-id') hCompany?: string,
    @Headers('x-branch-id') hBranch?: string,
  ) {
    const scope = this.extractScope(req, hCompany, hBranch, query.company_id, query.branch_id);
    const filter: HrmsReportsFilterDto = { ...query, ...scope };
    return this.reportsService.getSummary(req.user.tenantId, filter);
  }

  @Get('headcount')
  @RequirePermissions('view_hrms_reports')
  @ApiOperation({ summary: 'Get detailed headcount demographics and distributions' })
  async getHeadcount(
    @Req() req: any,
    @Query() query: HrmsReportsFilterDto,
    @Headers('x-company-id') hCompany?: string,
    @Headers('x-branch-id') hBranch?: string,
  ) {
    const scope = this.extractScope(req, hCompany, hBranch, query.company_id, query.branch_id);
    const filter: HrmsReportsFilterDto = { ...query, ...scope };
    return this.reportsService.getHeadcountDemographics(req.user.tenantId, filter);
  }

  @Get('turnover')
  @RequirePermissions('view_hrms_reports')
  @ApiOperation({ summary: 'Get turnover and retention trends' })
  async getTurnover(
    @Req() req: any,
    @Query() query: HrmsReportsFilterDto,
    @Headers('x-company-id') hCompany?: string,
    @Headers('x-branch-id') hBranch?: string,
  ) {
    const scope = this.extractScope(req, hCompany, hBranch, query.company_id, query.branch_id);
    const filter: HrmsReportsFilterDto = { ...query, ...scope };
    return this.reportsService.getTurnoverAnalytics(req.user.tenantId, filter);
  }

  @Get('attendance-analytics')
  @RequirePermissions('view_hrms_reports')
  @ApiOperation({ summary: 'Get attendance punctuality, absence, and overtime analytics' })
  async getAttendanceAnalytics(
    @Req() req: any,
    @Query() query: HrmsReportsFilterDto,
    @Headers('x-company-id') hCompany?: string,
    @Headers('x-branch-id') hBranch?: string,
  ) {
    const scope = this.extractScope(req, hCompany, hBranch, query.company_id, query.branch_id);
    const filter: HrmsReportsFilterDto = { ...query, ...scope };
    return this.reportsService.getAttendanceAnalytics(req.user.tenantId, filter);
  }

  @Get('payroll-analytics')
  @RequirePermissions('view_hrms_reports')
  @ApiOperation({ summary: 'Get workforce payroll cost breakdowns by department and period' })
  async getPayrollAnalytics(
    @Req() req: any,
    @Query() query: HrmsReportsFilterDto,
    @Headers('x-company-id') hCompany?: string,
    @Headers('x-branch-id') hBranch?: string,
  ) {
    const scope = this.extractScope(req, hCompany, hBranch, query.company_id, query.branch_id);
    const filter: HrmsReportsFilterDto = { ...query, ...scope };
    return this.reportsService.getPayrollAnalytics(req.user.tenantId, filter);
  }

  @Get('bank-transfer-file')
  @RequirePermissions('export_bank_transfer_file')
  @ApiOperation({ summary: 'Generate and download commercial bank direct transfer payment file (CSV/NACHA/ABA)' })
  async downloadBankTransferFile(
    @Req() req: any,
    @Res() res: any,
    @Query() query: BankTransferExportDto,
    @Headers('x-company-id') hCompany?: string,
    @Headers('x-branch-id') hBranch?: string,
  ) {
    const scope = this.extractScope(req, hCompany, hBranch, query.company_id, query.branch_id);
    const dto: BankTransferExportDto = { ...query, ...scope };
    const result = await this.reportsService.generateBankTransferFile(req.user.tenantId, dto);

    res.header('Content-Type', result.contentType);
    res.header('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.content);
  }
}
