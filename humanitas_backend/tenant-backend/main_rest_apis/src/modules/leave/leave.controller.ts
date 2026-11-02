import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { LeaveService } from './leave.service';
import { LeaveGateway } from './leave.gateway';
import { LeaveScheduler } from './leave.scheduler';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { SetLeaveWorkflowDto } from './dto/set-leave-workflow.dto';

@ApiTags('Leave')
@ApiBearerAuth()
@Controller('leave')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('leave')
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly leaveGateway: LeaveGateway,
    private readonly leaveScheduler: LeaveScheduler,
  ) { }

  // ============ USER ENDPOINTS ============

  @Get('types')
  @RequirePermissions('view_leave')
  @ApiOperation({ summary: 'Get available leave types' })
  async getLeaveTypes(@Request() req: any) {
    return this.leaveService.getLeaveTypes(req.user.tenantId);
  }

  @Get('my-requests')
  @RequirePermissions('view_leave')
  @ApiOperation({ summary: 'Get current user leave requests' })
  async getMyLeaveRequests(@Request() req: any) {
    return this.leaveService.getMyLeaveRequests(
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Get('my-balances')
  @RequirePermissions('view_leave')
  @ApiOperation({ summary: 'Get current user leave balances' })
  async getMyLeaveBalances(@Request() req: any) {
    return this.leaveService.getMyLeaveBalances(
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post('apply')
  @RequirePermissions('request_leave')
  @ApiOperation({ summary: 'Apply for leave' })
  async applyForLeave(@Request() req: any, @Body() data: ApplyLeaveDto) {
    const result = await this.leaveService.applyForLeave(
      req.user.tenantId,
      req.user.sub,
      data,
    );

    // Get full request details with user info for WebSocket
    const fullRequest = await this.leaveService.getLeaveRequestById(
      req.user.tenantId,
      result.id,
    );
    this.leaveGateway.emitNewLeaveRequest(req.user.tenantId, fullRequest);

    return result;
  }

  @Delete('my-requests/:id')
  @RequirePermissions('request_leave')
  @ApiOperation({ summary: 'Cancel a pending leave request' })
  async cancelLeaveRequest(@Request() req: any, @Param('id') id: string) {
    const result = await this.leaveService.cancelLeaveRequest(
      req.user.tenantId,
      req.user.sub,
      id,
    );
    this.leaveGateway.emitLeaveRequestCancelled(req.user.tenantId, id);
    return result;
  }

  // ============ ADMIN ENDPOINTS ============

  @Get('requests')
  @RequirePermissions('view_leave')
  @ApiOperation({ summary: 'Get all leave requests (admin)' })
  async getAllLeaveRequests(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('user_id') userId?: string,
  ) {
    return this.leaveService.getAllLeaveRequests(req.user.tenantId, {
      status,
      user_id: userId,
    });
  }

  // ============ WORKFLOW ENDPOINTS ============

  @Get('workflow')
  @RequirePermissions('manage_leave')
  @ApiOperation({ summary: 'Get leave approval workflow' })
  async getWorkflow(@Request() req: any) {
    return this.leaveService.getWorkflow(req.user.tenantId);
  }

  @Post('workflow')
  @RequirePermissions('manage_leave')
  @ApiOperation({ summary: 'Set leave approval workflow' })
  async setWorkflow(@Request() req: any, @Body() dto: SetLeaveWorkflowDto) {
    return this.leaveService.setWorkflowSteps(req.user.tenantId, dto.steps);
  }

  @Get('roles')
  @RequirePermissions('manage_leave')
  @ApiOperation({ summary: 'Get roles for workflow config' })
  async getRoles(@Request() req: any) {
    return this.leaveService.getRoles(req.user.tenantId);
  }


  // ============ REQUEST ENDPOINTS ============

  @Post('requests/:id/approve')
  @RequirePermissions('approve_leave')
  @ApiOperation({ summary: 'Approve a leave request' })
  async approveLeaveRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { comment?: string }
  ) {
    await this.leaveService.approveLeaveRequest(
      req.user.tenantId,
      req.user.sub,
      id,
      body?.comment
    );
    const updatedRequest = await this.leaveService.getLeaveRequestById(
      req.user.tenantId,
      id,
    );
    this.leaveGateway.emitLeaveRequestUpdate(req.user.tenantId, updatedRequest);
    return { message: 'Leave request approved' };
  }

  @Post('requests/:id/reject')
  @RequirePermissions('approve_leave')
  @ApiOperation({ summary: 'Reject a leave request' })
  async rejectLeaveRequest(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    await this.leaveService.rejectLeaveRequest(
      req.user.tenantId,
      req.user.sub,
      id,
      body.reason,
    );
    const updatedRequest = await this.leaveService.getLeaveRequestById(
      req.user.tenantId,
      id,
    );
    this.leaveGateway.emitLeaveRequestUpdate(req.user.tenantId, updatedRequest);
    return { message: 'Leave request rejected' };
  }

  // ============ LEAVE ACCRUAL ENDPOINTS (via FastAPI) ============

  @Get('status')
  @RequirePermissions('view_leave')
  @ApiOperation({
    summary: 'Get current user leave status (probation, years of service)',
  })
  async getMyLeaveStatus(@Request() req: any) {
    return this.leaveService.getUserLeaveStatus(
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Get('status/:userId')
  @RequirePermissions('manage_leave')
  @ApiOperation({ summary: 'Get user leave status (admin)' })
  async getUserLeaveStatus(
    @Request() req: any,
    @Param('userId') userId: string,
  ) {
    return this.leaveService.getUserLeaveStatus(req.user.tenantId, userId);
  }

  @Get('calculated-balance')
  @RequirePermissions('view_leave')
  @ApiOperation({ summary: 'Get current user calculated leave balance' })
  async getMyCalculatedBalance(@Request() req: any) {
    return this.leaveService.calculateUserLeaveBalance(
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Get('calculated-balance/:userId')
  @RequirePermissions('manage_leave')
  @ApiOperation({ summary: 'Get user calculated leave balance (admin)' })
  async getUserCalculatedBalance(
    @Request() req: any,
    @Param('userId') userId: string,
  ) {
    return this.leaveService.calculateUserLeaveBalance(
      req.user.tenantId,
      userId,
    );
  }

  @Post('accrual/run')
  @RequirePermissions('manage_leave')
  @ApiOperation({ summary: 'Run monthly leave accrual for all users (admin)' })
  async runMonthlyAccrual(@Request() req: any) {
    return this.leaveService.runMonthlyLeaveAccrual(req.user.tenantId);
  }

  @Post('accrual/trigger')
  @RequirePermissions('manage_leave')
  @ApiOperation({
    summary: 'Trigger monthly leave accrual manually (for testing)',
  })
  async triggerMonthlyAccrual(@Request() req: any) {
    return this.leaveScheduler.triggerLeaveAccrual(req.user.tenantId);
  }

  // ============ INITIAL BALANCE REGISTRATION (for existing employees) ============

  @Get('balances/:userId')
  @RequirePermissions('manage_leave')
  @ApiOperation({
    summary: 'Get user leave balances with calculated annual leave (admin)',
  })
  async getUserBalances(@Request() req: any, @Param('userId') userId: string) {
    return this.leaveService.getUserBalancesWithCalculation(
      req.user.tenantId,
      userId,
    );
  }

  @Post('balances/:userId')
  @RequirePermissions('manage_leave')
  @ApiOperation({
    summary: 'Register/update initial leave balance for existing employee',
  })
  async registerInitialBalance(
    @Request() req: any,
    @Param('userId') userId: string,
    @Body()
    data: {
      leave_type_id: string;
      carried_over: number;
      used_days: number;
      year?: number;
      total_days?: number;
    },
  ) {
    return this.leaveService.registerInitialBalance(
      req.user.tenantId,
      userId,
      data,
    );
  }

  @Post('balances/:userId/calculate')
  @RequirePermissions('manage_leave')
  @ApiOperation({
    summary:
      'Auto-calculate leave balance based on hire date and years of service',
  })
  async calculateAndSetBalance(
    @Request() req: any,
    @Param('userId') userId: string,
  ) {
    return this.leaveService.calculateAndSetInitialBalance(
      req.user.tenantId,
      userId,
    );
  }
}
