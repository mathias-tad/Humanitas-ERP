import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
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
import { AttendanceSchedulingService } from './attendance-scheduling.service';
import { AttendanceDevicesService } from './attendance-devices.service';
import { AttendanceClockService } from './attendance-clock.service';
import { AttendanceCorrectionsService } from './attendance-corrections.service';
import { AttendanceAbsenceService } from './attendance-absence.service';
import { AttendanceBiometricService } from './attendance-biometric.service';
import { AttendanceRemindersService } from './attendance-reminders.service';
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
    private readonly attendanceSchedulingService: AttendanceSchedulingService,
    private readonly attendanceDevicesService: AttendanceDevicesService,
    private readonly attendanceClockService: AttendanceClockService,
    private readonly attendanceCorrectionsService: AttendanceCorrectionsService,
    private readonly attendanceAbsenceService: AttendanceAbsenceService,
    private readonly attendanceBiometricService: AttendanceBiometricService,
    private readonly attendanceRemindersService: AttendanceRemindersService,
    private readonly attendanceGateway: AttendanceGateway,
    private readonly schedulingService: SchedulingService,
  ) { }

  // ... (previous code)

  // ============ ROSTER / SCHEDULE ============

  @Get('user-schedule/:userId')
  @RequirePermissions('view_roster')
  @ApiOperation({ summary: 'Get user schedule (roster) with pattern and overrides' })
  async getUserSchedule(
    @Request() req: AuthenticatedRequest,
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
  async getShifts(@Request() req: AuthenticatedRequest) {
    return this.schedulingService.getShifts(req.user.tenantId);
  }

  @Post('shifts')
  @RequirePermissions('manage_shifts')
  @ApiOperation({ summary: 'Create a new shift' })
  async createShift(@Request() req: AuthenticatedRequest, @Body() data: CreateShiftDto) {
    return this.schedulingService.createShift(req.user.tenantId, data, req.user.sub);
  }

  @Put('shifts/:id')
  @RequirePermissions('manage_shifts')
  @ApiOperation({ summary: 'Update a shift' })
  async updateShift(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() data: UpdateShiftDto,
  ) {
    return this.schedulingService.updateShift(req.user.tenantId, id, data, req.user.sub);
  }

  @Delete('shifts/:id')
  @ApiOperation({ summary: 'Delete a shift' })
  async deleteShift(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.schedulingService.deleteShift(req.user.tenantId, id, req.user.sub);
  }

  // ============ SCHEDULE PATTERNS ============
  @Get('patterns')
  @RequirePermissions('view_shifts')
  @ApiOperation({ summary: 'Get all schedule patterns' })
  async getSchedulePatterns(@Request() req: AuthenticatedRequest) {
    return this.schedulingService.getPatterns(req.user.tenantId);
  }

  @Post('patterns')
  @RequirePermissions('manage_shifts')
  @ApiOperation({ summary: 'Create a new schedule pattern' })
  async createSchedulePattern(@Request() req: AuthenticatedRequest, @Body() data: CreateShiftPatternDto) {
    return this.schedulingService.createPattern(
      req.user.tenantId,
      data,
      req.user.sub,
    );
  }

  @Get('patterns/:id')
  @ApiOperation({ summary: 'Get schedule pattern by ID' })
  async getSchedulePatternById(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.schedulingService.getPatternById(req.user.tenantId, id);
  }

  @Put('patterns/:id')
  @RequirePermissions('manage_shifts')
  @ApiOperation({ summary: 'Update a schedule pattern' })
  async updateSchedulePattern(
    @Request() req: AuthenticatedRequest,
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
  async deleteSchedulePattern(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.schedulingService.deletePattern(req.user.tenantId, id);
  }

  // ============ SHIFT ASSIGNMENTS ============
  @Get('assignments')
  @ApiOperation({ summary: 'Get all shift assignments' })
  async getShiftAssignments(@Request() req: AuthenticatedRequest) {
    return this.schedulingService.getUserShiftPatterns(req.user.tenantId);
  }

  @Post('assignments')
  @RequirePermissions('manage_shift_assignments')
  @ApiOperation({ summary: 'Assign shift to user' })
  async assignShift(@Request() req: AuthenticatedRequest, @Body() data: AssignPatternDto) {
    return this.schedulingService.assignPattern(req.user.tenantId, data, req.user.sub);
  }

  @Delete('assignments/:userId')
  @RequirePermissions('manage_shift_assignments')
  @ApiOperation({ summary: 'Remove shift assignment' })
  async removeAssignment(@Request() req: AuthenticatedRequest, @Param('userId') userId: string) {
    return this.schedulingService.removePatternAssignment(req.user.tenantId, userId, req.user.sub);
  }

  @Get('users/unassigned')
  @ApiOperation({ summary: 'Get users without shift assignments' })
  async getUnassignedUsers(@Request() req: AuthenticatedRequest) {
    return this.schedulingService.getUnassignedUsers(req.user.tenantId);
  }

  @Get('users/with-assignments')
  @ApiOperation({ summary: 'Get all users with their assignment status' })
  async getUsersWithAssignments(@Request() req: AuthenticatedRequest) {
    return this.schedulingService.getUsersWithAssignments(req.user.tenantId);
  }

  // ============ ROSTER / SCHEDULE ============



  @Post('assign-pattern')
  @RequirePermissions('manage_roster')
  @ApiOperation({ summary: 'Assign pattern to user (Flexible)' })
  async assignPattern(@Request() req: AuthenticatedRequest, @Body() data: AssignPatternDto) {
    return this.schedulingService.assignPattern(
      req.user.tenantId,
      data,
      req.user.sub
    );
  }

  @Post('assign-schedule')
  @RequirePermissions('manage_roster')
  @ApiOperation({ summary: 'Assign/Override specific day schedule' })
  async assignSchedule(@Request() req: AuthenticatedRequest, @Body() data: AssignScheduleDto) {
    return this.attendanceSchedulingService.assignSchedule(
      req.user.tenantId,
      data,
      req.user.sub,
    );
  }

  @Get('scheduling-audit-logs')
  @ApiOperation({ summary: 'Get scheduling audit logs' })
  async getSchedulingAuditLogs(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.attendanceSchedulingService.getSchedulingAuditLogs(req.user.tenantId, {
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
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CorrectAttendanceDto,
  ) {
    return this.attendanceCorrectionsService.correctAttendance(
      req.user.tenantId,
      id,
      dto,
      req.user.sub,
    );
  }

  @Get('correction-logs')
  @ApiOperation({ summary: 'Get attendance correction audit logs' })
  async getAttendanceCorrectionLogs(
    @Request() req: AuthenticatedRequest,
    @Query('userId') userId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.attendanceCorrectionsService.getAttendanceCorrectionLogs(req.user.tenantId, {
      userId,
      page: page ? parseInt(page as any) : 1,
      limit: limit ? parseInt(limit as any) : 20,
    });
  }

  @Get('overtime-workers')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('view_overtime_workers')
  @ApiOperation({ summary: 'Get currently working overtime employees' })
  async getOvertimeWorkers(@Request() req: AuthenticatedRequest) {
    return this.attendanceClockService.getOvertimeWorkers(req.user.tenantId);
  }

  @Get('records/my')
  @ApiOperation({ summary: 'Get current user attendance records' })
  async getMyAttendanceRecordsNew(
    @Request() req: AuthenticatedRequest,
    @Query('month') month: number,
    @Query('year') year: number,
  ) {
    return this.attendanceClockService.getUserAttendanceRecords(req.user.tenantId, req.user.sub, { month, year });
  }

  @Get('late-summary')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('view_attendance')
  @ApiOperation({ summary: 'Get lateness summary (Today, Week, Month)' })
  async getLatenessSummary(
    @Request() req: AuthenticatedRequest,
    @Query('date') date?: string,
    @Query('userId') userId?: string,
  ) {
    return this.attendanceClockService.getLatenessSummary(req.user.tenantId, date, userId);
  }

  @Post('force-clockout')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('force_clockout')
  @ApiOperation({ summary: 'Force clock out a user' })
  async forceClockOut(
    @Request() req: AuthenticatedRequest,
    @Body() body: { userId: string; reason?: string },
  ) {
    return this.attendanceClockService.forceClockOut(
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
    @Request() req: AuthenticatedRequest,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.attendanceClockService.getUserAttendanceRecords(
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
    @Request() req: AuthenticatedRequest,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.attendanceClockService.getUserAttendanceRecords(
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
    @Request() req: AuthenticatedRequest,
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
    const tenantId = req.user.tenantId;
    return this.attendanceClockService.getAttendanceRecords(tenantId, {
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
    @Request() req: AuthenticatedRequest,
    @Body() dto: BatchAttendanceStatusDto,
  ) {
    const tenantId = req.user.tenantId;
    const updatedBy = req.user?.sub;
    return this.attendanceAbsenceService.batchUpdateAttendanceStatus(
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
  async getAbsenceThresholds(@Request() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    return this.attendanceAbsenceService.getAbsenceThresholds(tenantId);
  }

  @Put('absence-thresholds')
  @RequirePermissions('manage_attendance')
  @ApiOperation({ summary: 'Update absence alert thresholds' })
  async updateAbsenceThresholds(
    @Request() req: AuthenticatedRequest,
    @Body() dto: AbsenceThresholdsDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.attendanceAbsenceService.updateAbsenceThresholds(tenantId, dto);
  }

  @Post('records')
  @ApiOperation({ summary: 'Create/update attendance record' })
  async recordAttendance(@Request() req: AuthenticatedRequest, @Body() data: RecordAttendanceDto) {
    return this.attendanceClockService.recordAttendance(req.user.tenantId, data);
  }

  @Post('clock-in')
  @ApiOperation({ summary: 'Clock in for current user' })
  async clockIn(@Request() req: AuthenticatedRequest) {
    const result = await this.attendanceClockService.clockIn(
      req.user.tenantId,
      req.user.sub,
    );
    const fullRecord = await this.attendanceClockService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockIn(req.user.tenantId, fullRecord);
    return result;
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Clock out for current user' })
  async clockOut(@Request() req: AuthenticatedRequest) {
    const result = await this.attendanceClockService.clockOut(
      req.user.tenantId,
      req.user.sub,
    );
    const fullRecord = await this.attendanceClockService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockOut(req.user.tenantId, fullRecord);
    return result;
  }

  @Post('clock-in/:userId')
  @ApiOperation({ summary: 'Clock in for specific user (admin)' })
  async clockInUser(@Request() req: AuthenticatedRequest, @Param('userId') userId: string) {
    const result = await this.attendanceClockService.clockIn(
      req.user.tenantId,
      userId,
    );
    const fullRecord = await this.attendanceClockService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockIn(req.user.tenantId, fullRecord);
    return result;
  }

  @Post('clock-out/:userId')
  @ApiOperation({ summary: 'Clock out for specific user (admin)' })
  async clockOutUser(@Request() req: AuthenticatedRequest, @Param('userId') userId: string) {
    const result = await this.attendanceClockService.clockOut(
      req.user.tenantId,
      userId,
    );
    const fullRecord = await this.attendanceClockService.getAttendanceRecordById(
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
    @Request() req: AuthenticatedRequest,
    @Query('type') type?: 'clock_in' | 'clock_out',
  ) {
    return this.attendanceDevicesService.getCurrentQRCode(
      req.user.tenantId,
      type || 'clock_in',
    );
  }

  @Post('qr-code/generate')
  @ApiOperation({ summary: 'Generate new QR code' })
  async generateQRCode(
    @Request() req: AuthenticatedRequest,
    @Body() body: { type?: 'clock_in' | 'clock_out' },
  ) {
    return this.attendanceDevicesService.generateQRCode(
      req.user.tenantId,
      body.type || 'clock_in',
    );
  }

  @Post('device/register')
  @ApiOperation({ summary: 'Register device for current user' })
  async registerDevice(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: { device_id: string; device_name?: string; device_type?: string },
  ) {
    return this.attendanceDevicesService.registerDevice(
      req.user.tenantId,
      req.user.sub,
      body,
    );
  }

  @Get('device/my-devices')
  @ApiOperation({ summary: 'Get current user registered devices' })
  async getMyDevices(@Request() req: AuthenticatedRequest) {
    return this.attendanceDevicesService.getUserDevices(
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Delete('device/:deviceId')
  @ApiOperation({ summary: 'Remove device' })
  async removeDevice(@Request() req: AuthenticatedRequest, @Param('deviceId') deviceId: string) {
    return this.attendanceDevicesService.removeDevice(
      req.user.tenantId,
      req.user.sub,
      deviceId,
    );
  }

  @Get('my-schedule')
  @ApiOperation({
    summary: 'Get current user today schedule and clock in eligibility',
  })
  async getMySchedule(@Request() req: AuthenticatedRequest) {
    const schedule = await this.attendanceSchedulingService.getUserTodaySchedule(
      req.user.tenantId,
      req.user.sub,
    );
    const validation = await this.attendanceClockService.validateClockInTiming(
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
    @Request() req: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Body() body: { qr_code: string; device_id: string },
  ) {
    const result = await this.attendanceClockService.secureClockIn(
      req.user.tenantId,
      req.user.sub,
      body.qr_code,
      body.device_id,
      clientIp,
    );
    const fullRecord = await this.attendanceClockService.getAttendanceRecordById(
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
    @Request() req: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Body() body: { qr_code: string; device_id: string },
  ) {
    const result = await this.attendanceClockService.secureClockOut(
      req.user.tenantId,
      req.user.sub,
      body.qr_code,
      body.device_id,
      clientIp,
    );
    const fullRecord = await this.attendanceClockService.getAttendanceRecordById(
      req.user.tenantId,
      result.id,
    );
    this.attendanceGateway.emitClockOut(req.user.tenantId, fullRecord);
    return result;
  }

  // Admin endpoints for device management
  @Get('devices/all')
  @ApiOperation({ summary: 'Get all registered devices (admin)' })
  async getAllDevices(@Request() req: AuthenticatedRequest) {
    return this.attendanceDevicesService.getAllDevices(req.user.tenantId);
  }

  @Get('devices/pending')
  @ApiOperation({ summary: 'Get pending device registrations (admin)' })
  async getPendingDevices(@Request() req: AuthenticatedRequest) {
    return this.attendanceDevicesService.getPendingDevices(req.user.tenantId);
  }

  @Post('devices/:id/approve')
  @ApiOperation({ summary: 'Approve device registration (admin)' })
  async approveDevice(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.attendanceDevicesService.approveDevice(
      req.user.tenantId,
      id,
      req.user.sub,
    );
  }

  @Post('devices/:id/reject')
  @ApiOperation({ summary: 'Reject device registration (admin)' })
  async rejectDevice(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.attendanceDevicesService.rejectDevice(req.user.tenantId, id);
  }

  // ============ NETWORK MANAGEMENT ============

  @Get('networks')
  @ApiOperation({ summary: 'Get all allowed networks' })
  async getAllowedNetworks(@Request() req: AuthenticatedRequest) {
    return this.attendanceDevicesService.getAllowedNetworks(req.user.tenantId);
  }

  @Post('networks')
  @ApiOperation({ summary: 'Add allowed network (admin)' })
  async addAllowedNetwork(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      name: string;
      ip_address: string;
      subnet_mask?: string;
      description?: string;
    },
  ) {
    return this.attendanceDevicesService.addAllowedNetwork(
      req.user.tenantId,
      body,
      req.user.sub,
    );
  }

  @Delete('networks/:id')
  @ApiOperation({ summary: 'Remove allowed network (admin)' })
  async removeAllowedNetwork(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.attendanceDevicesService.removeAllowedNetwork(req.user.tenantId, id);
  }

  @Get('network-check')
  @ApiOperation({ summary: 'Check if current network is allowed' })
  async checkNetwork(@Request() req: AuthenticatedRequest, @Ip() clientIp: string) {
    return this.attendanceDevicesService.isNetworkAllowed(req.user.tenantId, clientIp);
  }

  // ============ ATTENDANCE REGULARIZATION & CORRECTION REQUESTS ============

  @Post('correction-requests')
  @RequirePermissions('mark_attendance')
  @ApiOperation({ summary: 'Submit attendance regularization/correction request' })
  async requestAttendanceCorrection(
    @Request() req: AuthenticatedRequest,
    @Body() body: { attendance_record_id?: string; work_date: string; requested_in?: string; requested_out?: string; reason: string },
  ) {
    return this.attendanceCorrectionsService.requestAttendanceCorrection(req.user.tenantId, req.user.sub, body.attendance_record_id || "", body);
  }

  @Get('correction-requests/my')
  @RequirePermissions('mark_attendance')
  @ApiOperation({ summary: 'List current user attendance correction requests' })
  async getMyCorrectionRequests(@Request() req: AuthenticatedRequest) {
    return this.attendanceCorrectionsService.getMyAttendanceCorrectionRequests(req.user.tenantId, req.user.sub);
  }

  @Get('correction-requests')
  @RequirePermissions('correct_attendance')
  @ApiOperation({ summary: 'List all attendance correction requests for management review' })
  async getAllCorrectionRequests(
    @Request() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    return this.attendanceCorrectionsService.getAttendanceCorrectionRequests(req.user.tenantId, status ? { status } : undefined);
  }

  @Patch('correction-requests/:id/review')
  @RequirePermissions('correct_attendance')
  @ApiOperation({ summary: 'Review and approve/reject attendance correction request' })
  async reviewCorrectionRequest(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected'; reviewer_notes?: string },
  ) {
    return this.attendanceCorrectionsService.reviewAttendanceCorrectionRequest(
      req.user.tenantId,
      id,
      req.user.sub,
      body,
    );
  }

  // ============ ALARM DISMISSAL ============

  @Post('alarm/dismiss')
  @RequirePermissions('mark_attendance')
  @ApiOperation({ summary: 'Dismiss morning missed clock-in ringing alarm' })
  async dismissAlarm(@Request() req: AuthenticatedRequest) {
    return this.attendanceRemindersService.dismissMissedClockInAlarm(req.user.tenantId, req.user.sub);
  }

  // ============ BIOMETRIC OFFLINE PUNCH IMPORT & RECONCILIATION ============

  @Post('biometric/import-offline-logs')
  @RequirePermissions('manage_biometric_devices')
  @ApiOperation({ summary: 'Import offline biometric punch logs from USB / CSV / TXT backup' })
  async importOfflineLogs(
    @Request() req: AuthenticatedRequest,
    @Body() body: { device_serial_number: string; content: string },
  ) {
    return this.attendanceBiometricService.importOfflinePunchLogs(
      req.user.tenantId,
      body.device_serial_number,
      body.content,
    );
  }

  @Get('overtime/pending-reconciliation')
  @RequirePermissions('view_overtime_workers')
  @ApiOperation({ summary: 'Get records with pending overtime approval from offline sync reconciliation' })
  async getPendingReconciliationOvertime(@Request() req: AuthenticatedRequest) {
    return this.attendanceBiometricService.getPendingReconciliationOvertime(req.user.tenantId);
  }

  @Post('overtime/decide-reconciliation')
  @RequirePermissions('force_clockout')
  @ApiOperation({ summary: 'Decide (grant or zero) overtime hours for reconciled offline records' })
  async decideReconciliationOvertime(
    @Request() req: AuthenticatedRequest,
    @Body() body: { record_id: string; grant_overtime: boolean },
  ) {
    return this.attendanceBiometricService.decideReconciliationOvertime(
      req.user.tenantId,
      body.record_id,
      body.grant_overtime,
      req.user.sub,
    );
  }

}
