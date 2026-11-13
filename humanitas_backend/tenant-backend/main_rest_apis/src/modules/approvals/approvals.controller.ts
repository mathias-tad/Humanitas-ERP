import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  SubmitApprovalRequestDto,
  DecideApprovalRequestDto,
  FilterApprovalRequestsDto,
} from './dto/approvals.dto';

@ApiTags('Dynamic Approvals')
@Controller('approvals')
@RequireModule('approvals')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@ApiBearerAuth()
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  private getTenantId(req: any, headerTenantId?: string): string {
    return req.user?.tenantId || req.user?.tenant_id || headerTenantId || req.user?.tenantSlug;
  }

  private resolveScope(
    req: any,
    queryCompanyId?: string,
    queryBranchId?: string,
    headerCompanyId?: string,
    headerBranchId?: string,
  ) {
    const company_id =
      queryCompanyId ||
      headerCompanyId ||
      req.headers?.['x-company-id'] ||
      req.user?.company_id ||
      req.user?.companyId;
    const branch_id =
      queryBranchId ||
      headerBranchId ||
      req.headers?.['x-branch-id'] ||
      req.user?.branch_id ||
      req.user?.branchId;
    return { company_id, branch_id };
  }

  // ==================== WORKFLOWS ====================

  @Get('workflows')
  @RequirePermissions('view_approval_rules')
  @ApiOperation({ summary: 'Get approval workflows' })
  async getWorkflows(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('workflow_type') workflowType?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('companyId') queryCompanyIdCamel?: string,
    @Query('branch_id') queryBranchId?: string,
    @Query('branchId') queryBranchIdCamel?: string,
    @Query('is_active') isActive?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const { company_id, branch_id } = this.resolveScope(
      req,
      queryCompanyId || queryCompanyIdCamel,
      queryBranchId || queryBranchIdCamel,
      headerCompanyId,
      headerBranchId,
    );
    return this.approvalsService.getWorkflows(tenantId, {
      company_id,
      branch_id,
      workflow_type: workflowType,
      is_active: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('workflows/:id')
  @RequirePermissions('view_approval_rules')
  @ApiOperation({ summary: 'Get approval workflow by ID' })
  async getWorkflowById(
    @Req() req: any,
    @Param('id') id: string,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.approvalsService.getWorkflowById(tenantId, id);
  }

  @Post('workflows')
  @RequirePermissions('manage_approval_rules')
  @ApiOperation({ summary: 'Create a new approval workflow' })
  async createWorkflow(
    @Req() req: any,
    @Body() dto: CreateWorkflowDto,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const { company_id, branch_id } = this.resolveScope(
      req,
      dto.company_id,
      dto.branch_id,
      headerCompanyId,
      headerBranchId,
    );
    return this.approvalsService.createWorkflow(tenantId, {
      ...dto,
      company_id,
      branch_id,
    });
  }

  @Put('workflows/:id')
  @RequirePermissions('manage_approval_rules')
  @ApiOperation({ summary: 'Update an approval workflow (PUT)' })
  async updateWorkflowPut(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.approvalsService.updateWorkflow(tenantId, id, dto);
  }

  @Patch('workflows/:id')
  @RequirePermissions('manage_approval_rules')
  @ApiOperation({ summary: 'Update an approval workflow (PATCH)' })
  async updateWorkflowPatch(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.approvalsService.updateWorkflow(tenantId, id, dto);
  }

  @Delete('workflows/:id')
  @RequirePermissions('manage_approval_rules')
  @ApiOperation({ summary: 'Delete an approval workflow' })
  async deleteWorkflow(
    @Req() req: any,
    @Param('id') id: string,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.approvalsService.deleteWorkflow(tenantId, id);
  }

  // ==================== DASHBOARD & METRICS ====================

  @Get('pending-count')
  @RequirePermissions('view_approval_requests', 'approve_requests')
  @ApiOperation({ summary: 'Get pending approvals count alias' })
  async getPendingCount(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    return this.getMyPendingCount(req, headerTenantId);
  }

  @Get('my-pending-count')
  @RequirePermissions('view_approval_requests', 'approve_requests')
  @ApiOperation({ summary: 'Get pending approvals count for current authenticated user' })
  async getMyPendingCount(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id;
    const userRole = req.user?.role || req.user?.role_name || '';
    return this.approvalsService.getMyPendingCount(tenantId, userId, userRole);
  }

  @Get('requests/my-pending-count')
  @RequirePermissions('view_approval_requests', 'approve_requests')
  @ApiOperation({ summary: 'Get pending approvals count for current authenticated user (requests alias)' })
  async getRequestsMyPendingCount(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    return this.getMyPendingCount(req, headerTenantId);
  }

  @Get('analytics')
  @RequirePermissions('view_approval_rules', 'view_approval_requests')
  @ApiOperation({ summary: 'Get approval analytics, cycle times, and volume trends' })
  async getAnalytics(
    @Req() req: any,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Query('companyId') queryCompanyIdCamel?: string,
    @Query('branch_id') queryBranchId?: string,
    @Query('branchId') queryBranchIdCamel?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const { company_id, branch_id } = this.resolveScope(
      req,
      queryCompanyId || queryCompanyIdCamel,
      queryBranchId || queryBranchIdCamel,
      headerCompanyId,
      headerBranchId,
    );
    return this.approvalsService.getApprovalAnalytics(tenantId, company_id, branch_id);
  }

  // ==================== REQUESTS ====================

  @Get('requests')
  @RequirePermissions('approve_requests', 'view_approval_requests')
  @ApiOperation({ summary: 'Get approval requests list with filters' })
  async getRequests(
    @Req() req: any,
    @Query() query: FilterApprovalRequestsDto,
    @Query('companyId') queryCompanyIdCamel?: string,
    @Query('branchId') queryBranchIdCamel?: string,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const { company_id, branch_id } = this.resolveScope(
      req,
      query.company_id || queryCompanyIdCamel,
      query.branch_id || queryBranchIdCamel,
      headerCompanyId,
      headerBranchId,
    );
    return this.approvalsService.getRequests(tenantId, {
      ...query,
      company_id,
      branch_id,
      user_id: req.user?.sub || req.user?.id,
      user_role: req.user?.role || req.user?.role_name,
    });
  }

  @Get('requests/:id')
  @RequirePermissions('approve_requests', 'view_approval_requests')
  @ApiOperation({ summary: 'Get approval request details, workflow steps and audit trail' })
  async getRequestById(
    @Req() req: any,
    @Param('id') id: string,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    return this.approvalsService.getRequestById(tenantId, id);
  }

  @Post('requests')
  @RequirePermissions('view_approval_requests', 'approve_requests')
  @ApiOperation({ summary: 'Submit an approval request with workflow auto-matching' })
  async submitRequest(
    @Req() req: any,
    @Body() dto: SubmitApprovalRequestDto,
    @Headers('x-tenant-id') headerTenantId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const { company_id, branch_id } = this.resolveScope(
      req,
      dto.company_id,
      dto.branch_id,
      headerCompanyId,
      headerBranchId,
    );
    return this.approvalsService.submitRequest(
      tenantId,
      { ...dto, company_id, branch_id },
      req.user,
    );
  }

  @Post('requests/:id/decide')
  @RequirePermissions('approve_requests')
  @ApiOperation({ summary: 'Approve, reject, or escalate an approval request' })
  async decideRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: DecideApprovalRequestDto,
    @Headers('x-tenant-id') headerTenantId?: string,
  ) {
    const tenantId = this.getTenantId(req, headerTenantId);
    const userId = req.user?.sub || req.user?.id || '00000000-0000-0000-0000-000000000001';
    const userName = req.user?.full_name || req.user?.name || req.user?.email || 'Approver';
    const userRole = req.user?.role || req.user?.role_name || 'manager';
    return this.approvalsService.decideRequest(
      tenantId,
      id,
      userId,
      userName,
      userRole,
      dto,
    );
  }
}
