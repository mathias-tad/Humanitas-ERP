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
import {
  CreateDelegationDto,
  DelegationsFilterDto,
  LogDelegatedActionDto,
} from './dto/delegation.dto';

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
    @Req() req: any,
    @Body() dto: CreateDelegationDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub || req.user?.id;
    const delegatorId = dto.delegator_id || userId;

    if (!dto.company_id && headerCompanyId) dto.company_id = headerCompanyId;
    if (!dto.branch_id && headerBranchId) dto.branch_id = headerBranchId;

    return this.delegationsService.createDelegation(tenantId, delegatorId, dto, userId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user delegations (both granted and received)' })
  async getMyDelegations(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub || req.user?.id;
    return this.delegationsService.getMyDelegations(tenantId, userId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get currently active delegations received by user' })
  async getActiveDelegations(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub || req.user?.id;
    return this.delegationsService.getActiveDelegationsForUser(tenantId, userId);
  }

  @Get('all')
  @RequirePermissions('view_delegations')
  @ApiOperation({ summary: 'Get all delegations org-wide (Admin/Manager)' })
  async getAllDelegations(
    @Req() req: any,
    @Query() filters: DelegationsFilterDto,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    if (!filters.company_id && headerCompanyId) filters.company_id = headerCompanyId;
    if (!filters.branch_id && headerBranchId) filters.branch_id = headerBranchId;

    return this.delegationsService.getAllDelegations(tenantId, filters);
  }

  @Get('acting-preview')
  @ApiOperation({ summary: 'Calculate live acting allowance preview for a delegator' })
  async getActingPreview(
    @Req() req: any,
    @Query('delegator_id') delegatorId: string,
    @Query('percentage') percentage?: string,
    @Query('amount') amount?: string,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const pct = percentage ? parseFloat(percentage) : 0;
    const amt = amount ? parseFloat(amount) : 0;
    return this.delegationsService.calculateActingAllowancePreview(tenantId, delegatorId, pct, amt);
  }

  @Get('acting-assignments')
  @ApiOperation({ summary: 'Get active HR acting assignments' })
  async getActingAssignments(
    @Req() req: any,
    @Query('user_id') userId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.delegationsService.getActiveActingAssignments(tenantId, userId, startDate, endDate);
  }

  @Put(':id/revoke')
  @ApiOperation({ summary: 'Revoke an active delegation' })
  async revokeDelegation(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub || req.user?.id;
    const isAdmin =
      req.user?.role === 'owner' ||
      req.user?.role === 'admin' ||
      req.user?.permissions?.includes?.('manage_delegations');

    return this.delegationsService.revokeDelegation(tenantId, id, userId, isAdmin);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Get delegation audit trail' })
  async getDelegationAudit(
    @Req() req: any,
    @Query('delegation_id') delegationId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.sub || req.user?.id;
    const canViewAll =
      req.user?.role === 'owner' ||
      req.user?.role === 'admin' ||
      req.user?.permissions?.includes?.('view_audit_logs') ||
      req.user?.permissions?.includes?.('manage_delegations');

    return this.delegationsService.getDelegationAudit(tenantId, delegationId, userId, canViewAll);
  }

  @Post('audit')
  @ApiOperation({ summary: 'Record action performed on behalf of delegator' })
  async logDelegatedAction(@Req() req: any, @Body() dto: LogDelegatedActionDto) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.delegationsService.logDelegatedAction(tenantId, dto);
  }
}
