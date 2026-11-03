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
  UseGuards,
  Request,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AttendanceService } from './attendance.service';
import { AttendanceGateway } from './attendance.gateway';
import { AbsenceThresholdsDto } from './dto/absence-thresholds.dto';
import { BatchAttendanceStatusDto } from './dto/batch-attendance-status.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { SchedulingService } from '../scheduling/scheduling.service';
import { CreateShiftDto, UpdateShiftDto } from '../scheduling/dto/create-shift.dto';
import { CreateShiftPatternDto, UpdateShiftPatternDto } from '../scheduling/dto/create-pattern.dto';
import { AssignPatternDto } from '../scheduling/dto/assign-pattern.dto';
import { AssignScheduleDto } from '../scheduling/dto/assign-schedule.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly attendanceGateway: AttendanceGateway,
    private readonly schedulingService: SchedulingService,
  ) { }

  // ... (previous code)

  // ============ ROSTER / SCHEDULE ============

  @Get('user-schedule/:userId')
  @RequirePermissions('view_roster')
  @ApiOperation({ summary: 'Get user schedule (roster) with pattern and overrides' })
  async getUserSchedule(
    @Request() req: any,
    @Param('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    // Delegate to SchedulingService for robust timezone handling and flexible patterns
    return this.schedulingService.getUserSchedule(
      req.user.tenantId,
      userId,
      startDate,
      endDate
    );
  }

  // ============ SHIFTS ============
  @Get('shifts')
  @RequirePermissions('view_shifts')
  @ApiOperation({ summary: 'Get all shifts' })
  async getShifts(@Request() req: any) {
    return this.schedulingService.getShifts(req.user.tenantId);
  }

  @Post('shifts')
  @RequirePermissions('manage_shifts')
  @ApiOperation({ summary: 'Create a new shift' })
  async createShift(@Request() req: any, @Body() data: CreateShiftDto) {
    return this.schedulingService.createShift(req.user.tenantId, data, req.user.sub);
  }

  @Put('shifts/:id')
  @RequirePermissions('manage_shifts')
  @ApiOperation({ summary: 'Update a shift' })
  async updateShift(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: UpdateShiftDto,
  ) {
    return this.schedulingService.updateShift(req.user.tenantId, id, data, req.user.sub);
  }

  @Delete('shifts/:id')
  @ApiOperation({ summary: 'Delete a shift' })
  async deleteShift(@Request() req: any, @Param('id') id: string) {
    return this.schedulingService.deleteShift(req.user.tenantId, id, req.user.sub);
  }

  // ============ SCHEDULE PATTERNS ============
  @Get('patterns')
  @RequirePermissions('view_shifts')
  @ApiOperation({ summary: 'Get all schedule patterns' })
  async getSchedulePatterns(@Request() req: any) {
    return this.schedulingService.getPatterns(req.user.tenantId);
  }

  @Post('patterns')
  @RequirePermissions('manage_shifts')
  @ApiOperation({ summary: 'Create a new schedule pattern' })
  async createSchedulePattern(@Request() req: any, @Body() data: CreateShiftPatternDto) {
    return this.schedulingService.createPattern(
      req.user.tenantId,
      data,
      req.user.sub,
    );
  }

  @Get('patterns/:id')
  @ApiOperation({ summary: 'Get schedule pattern by ID' })
  async getSchedulePatternById(@Request() req: any, @Param('id') id: string) {
    return this.schedulingService.getPatternById(req.user.tenantId, id);
  }

  @Put('patterns/:id')
  @RequirePermissions('manage_shifts')
  @ApiOperation({ summary: 'Update a schedule pattern' })
  async updateSchedulePattern(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: UpdateShiftPatternDto,
  ) {
    return this.schedulingService.updatePattern(
      req.user.tenantId,
      id,
      data,
    );
  }

  @Delete('patterns/:id')
  @ApiOperation({ summary: 'Delete a schedule pattern' })
  async deleteSchedulePattern(@Request() req: any, @Param('id') id: string) {
    return this.schedulingService.deletePattern(req.user.tenantId, id);
  }

  // ============ SHIFT ASSIGNMENTS ============
  @Get('assignments')
  @ApiOperation({ summary: 'Get all shift assignments' })
  async getShiftAssignments(@Request() req: any) {
    return this.schedulingService.getUserShiftPatterns(req.user.tenantId);
  }

  @Post('assignments')
  @RequirePermissions('manage_shift_assignments')
  @ApiOperation({ summary: 'Assign shift to user' })
  async assignShift(@Request() req: any, @Body() data: AssignPatternDto) {
    return this.schedulingService.assignPattern(req.user.tenantId, data, req.user.sub);
  }

  @Delete('assignments/:userId')
  @RequirePermissions('manage_shift_assignments')
  @ApiOperation({ summary: 'Remove shift assignment' })
  async removeAssignment(@Request() req: any, @Param('userId') userId: string) {
    return this.schedulingService.removePatternAssignment(req.user.tenantId, userId, req.user.sub);
  }

  @Get('users/unassigned')
  @ApiOperation({ summary: 'Get users without shift assignments' })
  async getUnassignedUsers(@Request() req: any) {
    return this.schedulingService.getUnassignedUsers(req.user.tenantId);
  }

  @Get('users/with-assignments')
  @ApiOperation({ summary: 'Get all users with their assignment status' })
  async getUsersWithAssignments(@Request() req: any) {
    return this.schedulingService.getUsersWithAssignments(req.user.tenantId);
  }

  // ============ ROSTER / SCHEDULE ============



  @Post('assign-pattern')
  @RequirePermissions('manage_roster')
  @ApiOperation({ summary: 'Assign pattern to user (Flexible)' })
  async assignPattern(@Request() req: any, @Body() data: AssignPatternDto) {
    return this.schedulingService.assignPattern(
      req.user.tenantId,
      data,
      req.user.sub
    );
  }

  @Post('assign-schedule')
  @RequirePermissions('manage_roster')
  @ApiOperation({ summary: 'Assign/Override specific day schedule' })
  async assignSchedule(@Request() req: any, @Body() data: AssignScheduleDto) {
    return this.attendanceService.assignSchedule(
      req.user.tenantId,
      data,
      req.user.sub,
    );
  }

  @Get('scheduling-audit-logs')
  @ApiOperation({ summary: 'Get scheduling audit logs' })
  async getSchedulingAuditLogs(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.attendanceService.getSchedulingAuditLogs(req.user.tenantId, {
      page: page ? parseInt(page as any) : 1,
      limit: limit ? parseInt(limit as any) : 50,
      search,
    });
  }

  // ============ ATTENDANCE CORRECTION ============
  @Patch('records/:id/correct')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('correct_attendance')
  @ApiOperation({ summary: 'Correct an attendance record (admin)' })
  async correctAttendance(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CorrectAttendanceDto,
  ) {
    return this.attendanceService.correctAttendance(
      req.user.tenantId,
      id,
      dto,
      req.user.sub,
    );
  }

  @Get('correction-logs')
  @ApiOperation({ summary: 'Get attendance correction audit logs' })
  async getAttendanceCorrectionLogs(
    @Request() req: any,
    @Query('userId') userId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.attendanceService.getAttendanceCorrectionLogs(req.user.tenantId, {
      userId,
      page: page ? parseInt(page as any) : 1,
      limit: limit ? parseInt(limit as any) : 20,
    });
  }

  @Get('overtime-workers')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('view_overtime_workers')
  @ApiOperation({ summary: 'Get currently working overtime employees' })
  async getOvertimeWorkers(@Request() req: any) {
    return this.attendanceService.getOvertimeWorkers(req.user.tenantId);
  }

  @Get('records/my')
  @ApiOperation({ summary: 'Get current user attendance records' })
  async getMyAttendanceRecordsNew(
    @Request() req: any,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.attendanceService.getUserAttendanceRecords(req.user.tenantId, req.user.sub, { month, year });
  }

  @Get('late-summary')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('view_attendance')
  @ApiOperation({ summary: 'Get lateness summary (Today, Week, Month)' })
  async getLatenessSummary(
    @Request() req: any,
    @Query('date') date?: string,
    @Query('userId') userId?: string,
  ) {
    return this.attendanceService.getLatenessSummary(req.user.tenantId, date, userId);
  }

  @Post('force-clockout')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('force_clockout')
  @ApiOperation({ summary: 'Force clock out a user' })
  async forceClockOut(
    @Request() req: any,
    @Body() body: { userId: string; reason?: string },
  ) {
    return this.attendanceService.forceClockOut(
      req.user.tenantId,
      req.user.sub,
      body.userId,
      body.reason,
    );
  }

  // ============ ATTENDANCE RECORDS ============
  @Get('my-records')
  @ApiOperation({ summary: 'Get current user attendance records' })
  async getMyAttendanceRecords(
    @Request() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.attendanceService.getUserAttendanceRecords(
      req.user.tenantId,
      req.user.sub,
      {
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
      },
    );
  }

  @Get('my-monthly-calendar')
  @ApiOperation({ summary: 'Get current user monthly attendance calendar (alias for my-records)' })
  async getMyMonthlyCalendar(
    @Request() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.attendanceService.getUserAttendanceRecords(
      req.user.tenantId,
      req.user.sub,
      {
        month: month ? parseInt(month) : undefined,
        year: year ? parseInt(year) : undefined,
      },
    );
  }

  @Get('records')
  @RequirePermissions('view_attendance')
  @ApiOperation({ summary: 'Get attendance records' })
  async getAttendanceRecords(
    @Request() req: any,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('user_id') userId?: string,
    @Query('status') status?: string,
    @Query('department') department?: string,
    @Query('branch_id') queryBranchId?: string,
    @Query('company_id') queryCompanyId?: string,
    @Headers('x-company-id') headerCompanyId?: string,
    @Headers('x-branch-id') headerBranchId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.attendanceService.getAttendanceRecords(tenantId, {
      date,
      startDate,
      endDate,
      user_id: userId,
      status,
      department,
      branch_id: queryBranchId || headerBranchId,
      company_id: queryCompanyId || headerCompanyId,
    });
  }

  @Post('records/batch-status')
  @RequirePermissions('manage_attendance')
  @ApiOperation({ summary: 'Batch update attendance records status' })
  async batchUpdateAttendanceStatus(
    @Request() req: any,
    @Body() dto: BatchAttendanceStatusDto,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const updatedBy = req.user?.sub || req.user?.id;
    return this.attendanceService.batchUpdateAttendanceStatus(
      tenantId,
      dto.record_ids,
      dto.status,
      dto.remarks,
      updatedBy,
    );
  }

  @Get('absence-thresholds')
  @RequirePermissions('view_attendance')
  @ApiOperation({ summary: 'Get absence alert thresholds' })
  async getAbsenceThresholds(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.attendanceService.getAbsenceThresholds(tenantId);
  }

  @Put('absence-thresholds')
  @RequirePermissions('manage_attendance')
  @ApiOperation({ summary: 'Update absence alert thresholds' })
  async updateAbsenceThresholds(
    @Request() req: any,
    @Body() dto: AbsenceThresholdsDto,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.attendanceService.updateAbsenceThresholds(tenantId, dto);
  }

  @Post('records')
  @ApiOperation({ summary: 'Create/update attendance record' })
  async recordAttendance(@Request() req: any, @Body() data: RecordAttendanceDto) {
    return this.attendanceService.recordAttendance(req.user.tenantId, data);
  }

  @Post('clock-in')
  @ApiOperation({ summary: 'Clock in for current user' })
  async clockIn(@Request() req: any) {
    const result = await this.attendanceService.clockIn(
      req.user.tenantId,
      req.user.sub,
    );
    const fullRecord = await this.attendanceService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockIn(req.user.tenantId, fullRecord);
    return result;
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Clock out for current user' })
  async clockOut(@Request() req: any) {
    const result = await this.attendanceService.clockOut(
      req.user.tenantId,
      req.user.sub,
    );
    const fullRecord = await this.attendanceService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockOut(req.user.tenantId, fullRecord);
    return result;
  }

  @Post('clock-in/:userId')
  @ApiOperation({ summary: 'Clock in for specific user (admin)' })
  async clockInUser(@Request() req: any, @Param('userId') userId: string) {
    const result = await this.attendanceService.clockIn(
      req.user.tenantId,
      userId,
    );
    const fullRecord = await this.attendanceService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockIn(req.user.tenantId, fullRecord);
    return result;
  }

  @Post('clock-out/:userId')
  @ApiOperation({ summary: 'Clock out for specific user (admin)' })
  async clockOutUser(@Request() req: any, @Param('userId') userId: string) {
    const result = await this.attendanceService.clockOut(
      req.user.tenantId,
      userId,
    );
    const fullRecord = await this.attendanceService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockOut(req.user.tenantId, fullRecord);
    return result;
  }

  // ============ QR CODE & DEVICE BINDING ============

  @Get('qr-code')
  @ApiOperation({ summary: 'Get current QR code for attendance' })
  async getQRCode(
    @Request() req: any,
    @Query('type') type?: 'clock_in' | 'clock_out',
  ) {
    return this.attendanceService.getCurrentQRCode(
      req.user.tenantId,
      type || 'clock_in',
    );
  }

  @Post('qr-code/generate')
  @ApiOperation({ summary: 'Generate new QR code' })
  async generateQRCode(
    @Request() req: any,
    @Body() body: { type?: 'clock_in' | 'clock_out' },
  ) {
    return this.attendanceService.generateQRCode(
      req.user.tenantId,
      body.type || 'clock_in',
    );
  }

  @Post('device/register')
  @ApiOperation({ summary: 'Register device for current user' })
  async registerDevice(
    @Request() req: any,
    @Body()
    body: { device_id: string; device_name?: string; device_type?: string },
  ) {
    return this.attendanceService.registerDevice(
      req.user.tenantId,
      req.user.sub,
      body,
    );
  }

  @Get('device/my-devices')
  @ApiOperation({ summary: 'Get current user registered devices' })
  async getMyDevices(@Request() req: any) {
    return this.attendanceService.getUserDevices(
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Delete('device/:deviceId')
  @ApiOperation({ summary: 'Remove device' })
  async removeDevice(@Request() req: any, @Param('deviceId') deviceId: string) {
    return this.attendanceService.removeDevice(
      req.user.tenantId,
      req.user.sub,
      deviceId,
    );
  }

  @Get('my-schedule')
  @ApiOperation({
    summary: 'Get current user today schedule and clock in eligibility',
  })
  async getMySchedule(@Request() req: any) {
    const schedule = await this.attendanceService.getUserTodaySchedule(
      req.user.tenantId,
      req.user.sub,
    );
    const validation = await this.attendanceService.validateClockInTiming(
      req.user.tenantId,
      req.user.sub,
    );
    return {
      schedule,
      validation,
    };
  }

  @Post('secure-clock-in')
  @ApiOperation({
    summary: 'Secure clock in with QR code, device, and network validation',
  })
  async secureClockIn(
    @Request() req: any,
    @Ip() clientIp: string,
    @Body() body: { qr_code: string; device_id: string },
  ) {
    const result = await this.attendanceService.secureClockIn(
      req.user.tenantId,
      req.user.sub,
      body.qr_code,
      body.device_id,
      clientIp,
    );
    const fullRecord = await this.attendanceService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockIn(req.user.tenantId, fullRecord);
    return result;
  }

  @Post('secure-clock-out')
  @ApiOperation({
    summary: 'Secure clock out with QR code, device, and network validation',
  })
  async secureClockOut(
    @Request() req: any,
    @Ip() clientIp: string,
    @Body() body: { qr_code: string; device_id: string },
  ) {
    const result = await this.attendanceService.secureClockOut(
      req.user.tenantId,
      req.user.sub,
      body.qr_code,
      body.device_id,
      clientIp,
    );
    const fullRecord = await this.attendanceService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockOut(req.user.tenantId, fullRecord);
    return result;
  }

  // Admin endpoints for device management
  @Get('devices/all')
  @ApiOperation({ summary: 'Get all registered devices (admin)' })
  async getAllDevices(@Request() req: any) {
    return this.attendanceService.getAllDevices(req.user.tenantId);
  }

  @Get('devices/pending')
  @ApiOperation({ summary: 'Get pending device registrations (admin)' })
  async getPendingDevices(@Request() req: any) {
    return this.attendanceService.getPendingDevices(req.user.tenantId);
  }

  @Post('devices/:id/approve')
  @ApiOperation({ summary: 'Approve device registration (admin)' })
  async approveDevice(@Request() req: any, @Param('id') id: string) {
    return this.attendanceService.approveDevice(
      req.user.tenantId,
      id,
      req.user.sub,
    );
  }

  @Post('devices/:id/reject')
  @ApiOperation({ summary: 'Reject device registration (admin)' })
  async rejectDevice(@Request() req: any, @Param('id') id: string) {
    return this.attendanceService.rejectDevice(req.user.tenantId, id);
  }

  // ============ NETWORK MANAGEMENT ============

  @Get('networks')
  @ApiOperation({ summary: 'Get all allowed networks' })
  async getAllowedNetworks(@Request() req: any) {
    return this.attendanceService.getAllowedNetworks(req.user.tenantId);
  }

  @Post('networks')
  @ApiOperation({ summary: 'Add allowed network (admin)' })
  async addAllowedNetwork(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      ip_address: string;
      subnet_mask?: string;
      description?: string;
    },
  ) {
    return this.attendanceService.addAllowedNetwork(
      req.user.tenantId,
      body,
      req.user.sub,
    );
  }

  @Delete('networks/:id')
  @ApiOperation({ summary: 'Remove allowed network (admin)' })
  async removeAllowedNetwork(@Request() req: any, @Param('id') id: string) {
    return this.attendanceService.removeAllowedNetwork(req.user.tenantId, id);
  }

  @Get('network-check')
  @ApiOperation({ summary: 'Check if current network is allowed' })
  async checkNetwork(@Request() req: any, @Ip() clientIp: string) {
    return this.attendanceService.isNetworkAllowed(req.user.tenantId, clientIp);
  }
}
