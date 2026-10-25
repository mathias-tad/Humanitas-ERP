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
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  SubmitApprovalRequestDto,
  DecideApprovalRequestDto,
} from './dto/approvals.dto';

@ApiTags('Approvals')
@Controller('approvals')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@ApiBearerAuth()
export class ApprovalsController {
  private readonly logger = new Logger(ApprovalsController.name);

  constructor(private readonly approvalsService: ApprovalsService) {}

  // --- Workflows Definition ---

  @Get('workflows')
  @RequirePermissions('view_approval_rules')
  @ApiOperation({ summary: 'List all approval workflows' })
  async getWorkflows(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Headers('x-branch-id') branchIdHeader: string,
    @Query('workflow_type') workflowType?: string,
    @Query('company_id') companyIdQuery?: string,
    @Query('branch_id') branchIdQuery?: string,
  ) {
    return this.approvalsService.getWorkflows(tenantId, {
      workflow_type: workflowType,
      company_id: companyIdQuery || companyIdHeader,
      branch_id: branchIdQuery || branchIdHeader,
    });
  }

  @Get('workflows/:id')
  @RequirePermissions('view_approval_rules')
  @ApiOperation({ summary: 'Get workflow definition by ID' })
  async getWorkflowById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.approvalsService.getWorkflowById(tenantId, id);
  }

  @Post('workflows')
  @RequirePermissions('manage_approval_rules')
  @ApiOperation({ summary: 'Create a new multi-tier approval workflow' })
  async createWorkflow(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.approvalsService.createWorkflow(tenantId, dto);
  }

  @Put('workflows/:id')
  @RequirePermissions('manage_approval_rules')
  @ApiOperation({ summary: 'Update an approval workflow' })
  async updateWorkflow(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.approvalsService.updateWorkflow(tenantId, id, dto);
  }

  @Delete('workflows/:id')
  @RequirePermissions('manage_approval_rules')
  @ApiOperation({ summary: 'Delete an approval workflow' })
  async deleteWorkflow(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.approvalsService.deleteWorkflow(tenantId, id);
  }

  // --- Requests & Decisions ---

  @Get('requests')
  @RequirePermissions('view_approval_requests')
  @ApiOperation({ summary: 'List approval requests with filters' })
  async getRequests(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-company-id') companyIdHeader: string,
    @Headers('x-branch-id') branchIdHeader: string,
    @Req() req: any,
    @Query('status') status?: string,
    @Query('workflow_type') workflowType?: string,
    @Query('submitter_id') submitterId?: string,
    @Query('my_pending') myPending?: string,
  ) {
    const user = req.user || {};
    return this.approvalsService.getRequests(tenantId, {
      status,
      workflow_type: workflowType,
      submitter_id: submitterId,
      company_id: companyIdHeader,
      branch_id: branchIdHeader,
      my_pending: myPending === 'true',
      user_role: user.role,
      user_id: user.sub || user.id,
    });
  }

  @Get('requests/my-pending-count')
  @RequirePermissions('view_approval_requests')
  @ApiOperation({ summary: 'Get count of pending requests awaiting action' })
  async getMyPendingCount(
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
  ) {
    const user = req.user || {};
    return this.approvalsService.getMyPendingCount(tenantId, user.sub || user.id, user.role);
  }

  @Get('requests/:id')
  @RequirePermissions('view_approval_requests')
  @ApiOperation({ summary: 'Get approval request detail with timeline' })
  async getRequestById(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.approvalsService.getRequestById(tenantId, id);
  }

  @Post('requests')
  @RequirePermissions('view_approval_requests')
  @ApiOperation({ summary: 'Submit a new approval request' })
  async submitRequest(
    @Headers('x-tenant-id') tenantId: string,
    @Req() req: any,
    @Body() dto: SubmitApprovalRequestDto,
  ) {
    const user = req.user || {};
    const submitter = {
      id: user.sub || user.id || '00000000-0000-0000-0000-000000000001',
      name: user.full_name || user.name || user.email || 'Employee',
      email: user.email,
      role: user.role,
    };
    return this.approvalsService.submitRequest(tenantId, submitter, dto);
  }

  @Post('requests/:id/decide')
  @RequirePermissions('approve_requests')
  @ApiOperation({ summary: 'Approve or reject an approval request' })
  async decideRequest(
    @Headers('x-tenant-id') tenantId: string,
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: DecideApprovalRequestDto,
  ) {
    const user = req.user || {};
    const approver = {
      id: user.sub || user.id || '00000000-0000-0000-0000-000000000001',
      name: user.full_name || user.name || user.email || 'Approver',
      role: user.role || 'manager',
    };
    return this.approvalsService.decideRequest(tenantId, id, approver, dto);
  }

  @Get('analytics')
  @RequirePermissions('view_approval_rules')
  @ApiOperation({ summary: 'Get approval turnaround analytics and metrics' })
  async getApprovalAnalytics(@Headers('x-tenant-id') tenantId: string) {
    return this.approvalsService.getApprovalAnalytics(tenantId);
  }
}
