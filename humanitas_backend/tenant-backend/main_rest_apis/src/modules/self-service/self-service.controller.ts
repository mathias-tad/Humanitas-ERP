import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ModuleSubscriptionGuard,
  RequireModule,
} from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { SelfServiceService } from './self-service.service';
import {
  UpdateProfileSelfDto,
  RequestSensitiveChangeDto,
  ReviewSensitiveChangeDto,
} from './dto/self-service.dto';

@Controller('self-service')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class SelfServiceController {
  constructor(private readonly selfServiceService: SelfServiceService) {}

  @Get('dashboard')
  @RequirePermissions('view_self_service')
  async getDashboard(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    return this.selfServiceService.getDashboard(tenantId, userId);
  }

  @Get('attendance-heatmap')
  @RequirePermissions('view_self_service')
  async getAttendanceHeatmap(
    @Request() req: any,
    @Query('days') days?: string,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    const daysBack = days ? parseInt(days, 10) : 90;
    return this.selfServiceService.getAttendanceHeatmap(tenantId, userId, daysBack);
  }

  @Get('payslips')
  @RequirePermissions('view_self_service')
  async getPayslips(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    return this.selfServiceService.getPayslips(tenantId, userId);
  }

  @Get('profile')
  @RequirePermissions('view_self_service')
  async getProfile(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    return this.selfServiceService.getProfile(tenantId, userId);
  }

  @Put('profile')
  @RequirePermissions('edit_my_profile')
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateProfileSelfDto,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    return this.selfServiceService.updateProfile(tenantId, userId, dto);
  }

  @Post('change-request')
  @RequirePermissions('edit_my_profile')
  async requestSensitiveChange(
    @Request() req: any,
    @Body() dto: RequestSensitiveChangeDto,
  ) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    return this.selfServiceService.requestSensitiveChange(tenantId, userId, dto);
  }

  @Get('change-requests')
  @RequirePermissions('view_self_service')
  async getChangeRequests(
    @Request() req: any,
    @Query('status') status?: string,
  ) {
    const tenantId = req.user.tenantId;
    const user = req.user;
    const userId = user.sub || user.id;
    const userRole = (user?.role || '').toLowerCase();
    const isManagerOrAdmin =
      userRole === 'admin' ||
      userRole === 'owner' ||
      userRole === 'administrator' ||
      userRole === 'manager' ||
      user?.permissions?.includes('manage_profile_requests');

    return this.selfServiceService.getChangeRequests(
      tenantId,
      userId,
      isManagerOrAdmin,
      status || 'pending',
    );
  }

  @Put('change-requests/:id/review')
  @RequirePermissions('manage_profile_requests')
  async reviewChangeRequest(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: ReviewSensitiveChangeDto,
  ) {
    const tenantId = req.user.tenantId;
    const reviewerId = req.user.sub || req.user.id;
    return this.selfServiceService.reviewChangeRequest(tenantId, id, reviewerId, dto);
  }

  @Get('analytics')
  @RequirePermissions('view_self_service')
  async getAnalytics(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub || req.user.id;
    return this.selfServiceService.getAnalytics(tenantId, userId);
  }
}
