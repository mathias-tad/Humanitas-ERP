import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  Headers,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DelegationsService } from './delegations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AttachPermissions } from '../auth/guards/permissions.guard';
import {
  CreateDelegationDto,
  DelegationsFilterDto,
  LogDelegatedActionDto,
} from './dto/delegation.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

@ApiTags('Delegations')
@Controller('delegations')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@ApiBearerAuth()
export class DelegationsController {
  private readonly logger = new Logger(DelegationsController.name);

  constructor(private readonly delegationsService: DelegationsService) {}

  @Post()
  @RequirePermissions('manage_delegations')
  @ApiOperation({ summary: 'Create authority delegation (self-delegating or admin)' })
  async createDelegation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateDelegationDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user?.sub;
    const delegatorId = dto.delegator_id || userId;

    if (!dto.company_id && headerCompanyId) dto.company_id = headerCompanyId;
    if (!dto.branch_id && headerBranchId) dto.branch_id = headerBranchId;

    return this.delegationsService.createDelegation(tenantId, delegatorId, dto, userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user delegations (both granted and received)' })
  async getMyDelegations(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    const userId = req.user?.sub;
    return this.delegationsService.getMyDelegations(tenantId, userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get currently active delegations received by user' })
  async getActiveDelegations(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    const userId = req.user?.sub;
    return this.delegationsService.getActiveDelegationsForUser(tenantId, userId);
  }

  @Get('all')
  @RequirePermissions('view_delegations')
  @ApiOperation({ summary: 'Get all delegations org-wide (Admin/Manager)' })
  async getAllDelegations(
    @Req() req: AuthenticatedRequest,
    @Query() filters: DelegationsFilterDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user.tenantId;
    if (!filters.company_id && headerCompanyId) filters.company_id = headerCompanyId;
    if (!filters.branch_id && headerBranchId) filters.branch_id = headerBranchId;

    return this.delegationsService.getAllDelegations(tenantId, filters);
  }

  @Get('acting-preview')
  @ApiOperation({ summary: 'Calculate live acting allowance preview for a delegator' })
  async getActingPreview(
    @Req() req: AuthenticatedRequest,
    @Query('delegator_id') delegatorId: string,
    @Query('percentage') percentage?: string,
    @Query('amount') amount?: string,
  ) {
    const tenantId = req.user.tenantId;
    const pct = percentage ? parseFloat(percentage) : 0;
    const amt = amount ? parseFloat(amount) : 0;
    return this.delegationsService.calculateActingAllowancePreview(tenantId, delegatorId, pct, amt);
  }

  @Get('acting-assignments')
  @ApiOperation({ summary: 'Get active HR acting assignments' })
  async getActingAssignments(
    @Req() req: AuthenticatedRequest,
    @Query('user_id') userId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const tenantId = req.user.tenantId;
    return this.delegationsService.getActiveActingAssignments(tenantId, userId, startDate, endDate);
  }

  @Put(':id/revoke')
  @AttachPermissions()
  @ApiOperation({ summary: 'Revoke an active delegation' })
  async revokeDelegation(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const userId = req.user?.sub;
    const isAdmin =
      req.user?.role === 'owner' ||
      req.user?.role === 'admin' ||
      req.user?.permissions?.includes?.('manage_delegations');

    return this.delegationsService.revokeDelegation(tenantId, id, userId, isAdmin);
  }

  @Get('audit')
  @AttachPermissions()
  @ApiOperation({ summary: 'Get delegation audit trail' })
  async getDelegationAudit(
    @Req() req: AuthenticatedRequest,
    @Query('delegation_id') delegationId?: string,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user?.sub;
    const canViewAll =
      req.user?.role === 'owner' ||
      req.user?.role === 'admin' ||
      req.user?.permissions?.includes?.('view_audit_logs') ||
      req.user?.permissions?.includes?.('manage_delegations');

    return this.delegationsService.getDelegationAudit(tenantId, delegationId, userId, canViewAll);
  }

  @Post('audit')
  @ApiOperation({ summary: 'Record action performed on behalf of delegator' })
  async logDelegatedAction(@Req() req: AuthenticatedRequest, @Body() dto: LogDelegatedActionDto) {
    const tenantId = req.user.tenantId;
    return this.delegationsService.logDelegatedAction(tenantId, dto);
  }
}
