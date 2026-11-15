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
import { HrmsBenefitsService } from './hrms-benefits.service';
import {
  CreateBenefitPlanDto,
  UpdateBenefitPlanDto,
  EnrollEmployeeDto,
  AddDependentDto,
  CreateOpenEnrollmentDto,
} from './dto/hrms-benefits.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@Controller('hrms/benefits')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class HrmsBenefitsController {
  constructor(private readonly benefitsService: HrmsBenefitsService) {}

  private getTenantId(req: AuthenticatedRequest, headerTenantId?: string): string {
    return req.user.tenantId;
  }

  // ── PLANS CATALOG ─────────────────────────────────────────────────────────

  @Get('plans')
  @RequirePermissions('view_benefit_plans', 'view_my_benefits', 'manage_benefits')
  async getPlans(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Query('type') type?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const companyId = companyIdHeader;
    return this.benefitsService.getPlans(tenantId, type, companyId);
  }

  @Get('plans/:id')
  @RequirePermissions('view_benefit_plans', 'view_my_benefits', 'manage_benefits')
  async getPlanById(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.benefitsService.getPlanById(tenantId, id);
  }

  @Post('plans')
  @RequirePermissions('manage_benefits')
  async createPlan(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Headers('x-branch-id') branchIdHeader: string,
    @Body() dto: CreateBenefitPlanDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const companyId = companyIdHeader;
    const branchId = branchIdHeader;
    return this.benefitsService.createPlan(tenantId, dto, companyId, branchId);
  }

  @Put('plans/:id')
  @RequirePermissions('manage_benefits')
  async updatePlan(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
    @Body() dto: UpdateBenefitPlanDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.benefitsService.updatePlan(tenantId, id, dto);
  }

  // ── ENROLLMENTS ───────────────────────────────────────────────────────────

  @Get('enrollments')
  @RequirePermissions('view_my_benefits', 'manage_enrollments', 'manage_benefits')
  async getEnrollments(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Query('user_id') userIdParam?: string,
    @Query('plan_id') planId?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.sub;
    const userRole = (req.user.role || '').toLowerCase();
    // FIXME(auth): req.user.permissions is never populated (always undefined), so this check only sees roles. Decide whether PermissionsGuard should attach the user's permissions.
    const permissions: string[] = req.user.permissions || [];

    const hasManagePerm =
      ['owner', 'admin', 'administrator', 'manager'].includes(userRole) ||
      permissions.includes('manage_enrollments') ||
      permissions.includes('manage_benefits');

    const filters = {
      user_id: userIdParam,
      plan_id: planId,
      status,
      company_id: companyIdHeader,
    };

    return this.benefitsService.getEnrollments(tenantId, userId, hasManagePerm, filters);
  }

  @Get('enrollments/:id')
  @RequirePermissions('view_my_benefits', 'manage_enrollments', 'manage_benefits')
  async getEnrollmentById(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.sub;
    const userRole = (req.user.role || '').toLowerCase();
    // FIXME(auth): req.user.permissions is never populated (always undefined), so this check only sees roles. Decide whether PermissionsGuard should attach the user's permissions.
    const permissions: string[] = req.user.permissions || [];

    const hasManagePerm =
      ['owner', 'admin', 'administrator', 'manager'].includes(userRole) ||
      permissions.includes('manage_enrollments') ||
      permissions.includes('manage_benefits');

    return this.benefitsService.getEnrollmentById(tenantId, id, userId, hasManagePerm);
  }

  @Post('enrollments')
  @RequirePermissions('manage_enrollments', 'manage_benefits')
  async enrollEmployee(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Headers('x-branch-id') branchIdHeader: string,
    @Body() dto: EnrollEmployeeDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const companyId = companyIdHeader;
    const branchId = branchIdHeader;
    return this.benefitsService.enrollEmployee(tenantId, dto, companyId, branchId);
  }

  @Post('enrollments/:id/dependents')
  @RequirePermissions('view_my_benefits', 'manage_enrollments', 'manage_benefits')
  async addDependent(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') enrollmentId: string,
    @Body() dto: AddDependentDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.sub;
    const userRole = (req.user.role || '').toLowerCase();
    // FIXME(auth): req.user.permissions is never populated (always undefined), so this check only sees roles. Decide whether PermissionsGuard should attach the user's permissions.
    const permissions: string[] = req.user.permissions || [];

    const hasManagePerm =
      ['owner', 'admin', 'administrator'].includes(userRole) ||
      permissions.includes('manage_enrollments') ||
      permissions.includes('manage_benefits');

    return this.benefitsService.addDependent(tenantId, enrollmentId, userId, hasManagePerm, dto);
  }

  @Delete('dependents/:id')
  @RequirePermissions('view_my_benefits', 'manage_enrollments', 'manage_benefits')
  async removeDependent(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') dependentId: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const userId = req.user.sub;
    const userRole = (req.user.role || '').toLowerCase();
    // FIXME(auth): req.user.permissions is never populated (always undefined), so this check only sees roles. Decide whether PermissionsGuard should attach the user's permissions.
    const permissions: string[] = req.user.permissions || [];

    const hasManagePerm =
      ['owner', 'admin', 'administrator'].includes(userRole) ||
      permissions.includes('manage_enrollments') ||
      permissions.includes('manage_benefits');

    return this.benefitsService.removeDependent(tenantId, dependentId, userId, hasManagePerm);
  }

  // ── OPEN ENROLLMENT PERIODS ───────────────────────────────────────────────

  @Get('open-periods')
  @RequirePermissions('view_benefit_plans', 'view_my_benefits', 'manage_benefits')
  async getOpenPeriods(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const companyId = companyIdHeader;
    return this.benefitsService.getOpenEnrollmentPeriods(tenantId, companyId);
  }

  @Post('open-periods')
  @RequirePermissions('manage_benefits')
  async createOpenPeriod(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Body() dto: CreateOpenEnrollmentDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const companyId = companyIdHeader;
    return this.benefitsService.createOpenEnrollmentPeriod(tenantId, dto, companyId);
  }

  // ── INTEGRATIONS & REPORTS ────────────────────────────────────────────────

  @Get('payroll-deductions')
  @RequirePermissions('manage_payroll', 'manage_benefits')
  async getPayrollDeductions(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const companyId = companyIdHeader;
    return this.benefitsService.getPayrollDeductions(tenantId, companyId);
  }

  @Get('reports/stats')
  @RequirePermissions('view_benefit_reports', 'manage_benefits')
  async getStats(
    @Request() req: AuthenticatedRequest,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Headers('x-branch-id') branchIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const companyId = companyIdHeader;
    const branchId = branchIdHeader;
    return this.benefitsService.getStats(tenantId, companyId, branchId);
  }
}
