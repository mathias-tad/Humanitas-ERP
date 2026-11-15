import { Injectable } from '@nestjs/common';
import { AttendanceSchedulingService } from './attendance-scheduling.service';
import { AttendanceDevicesService } from './attendance-devices.service';
import { AttendanceClockService } from './attendance-clock.service';
import { AttendanceCorrectionsService } from './attendance-corrections.service';
import { AttendanceAbsenceService } from './attendance-absence.service';
import { AttendanceBiometricService } from './attendance-biometric.service';
import { AttendanceRemindersService } from './attendance-reminders.service';

/**
 * Public entry point for the attendance domain.
 *
 * The implementation lives in the focused services below; this class keeps the
 * original public API so controllers, the scheduler and other modules are
 * unchanged. New code can inject the focused services directly.
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly scheduling: AttendanceSchedulingService,
    private readonly devices: AttendanceDevicesService,
    private readonly clock: AttendanceClockService,
    private readonly corrections: AttendanceCorrectionsService,
    private readonly absence: AttendanceAbsenceService,
    private readonly biometric: AttendanceBiometricService,
    private readonly reminders: AttendanceRemindersService,
  ) { }

  // ---- Shifts, schedule patterns, shift/schedule assignments and per-user schedules.
  getShifts(...args: Parameters<AttendanceSchedulingService['getShifts']>) {
    return this.scheduling.getShifts(...args);
  }
  createShift(...args: Parameters<AttendanceSchedulingService['createShift']>) {
    return this.scheduling.createShift(...args);
  }
  updateShift(...args: Parameters<AttendanceSchedulingService['updateShift']>) {
    return this.scheduling.updateShift(...args);
  }
  deleteShift(...args: Parameters<AttendanceSchedulingService['deleteShift']>) {
    return this.scheduling.deleteShift(...args);
  }
  getSchedulePatterns(...args: Parameters<AttendanceSchedulingService['getSchedulePatterns']>) {
    return this.scheduling.getSchedulePatterns(...args);
  }
  createSchedulePattern(...args: Parameters<AttendanceSchedulingService['createSchedulePattern']>) {
    return this.scheduling.createSchedulePattern(...args);
  }
  getSchedulePatternById(...args: Parameters<AttendanceSchedulingService['getSchedulePatternById']>) {
    return this.scheduling.getSchedulePatternById(...args);
  }
  updateSchedulePattern(...args: Parameters<AttendanceSchedulingService['updateSchedulePattern']>) {
    return this.scheduling.updateSchedulePattern(...args);
  }
  deleteSchedulePattern(...args: Parameters<AttendanceSchedulingService['deleteSchedulePattern']>) {
    return this.scheduling.deleteSchedulePattern(...args);
  }
  getShiftAssignments(...args: Parameters<AttendanceSchedulingService['getShiftAssignments']>) {
    return this.scheduling.getShiftAssignments(...args);
  }
  assignShift(...args: Parameters<AttendanceSchedulingService['assignShift']>) {
    return this.scheduling.assignShift(...args);
  }
  removeAssignment(...args: Parameters<AttendanceSchedulingService['removeAssignment']>) {
    return this.scheduling.removeAssignment(...args);
  }
  assignSchedule(...args: Parameters<AttendanceSchedulingService['assignSchedule']>) {
    return this.scheduling.assignSchedule(...args);
  }
  getUserSchedule(...args: Parameters<AttendanceSchedulingService['getUserSchedule']>) {
    return this.scheduling.getUserSchedule(...args);
  }
  getSchedulingAuditLogs(...args: Parameters<AttendanceSchedulingService['getSchedulingAuditLogs']>) {
    return this.scheduling.getSchedulingAuditLogs(...args);
  }

  // ---- Admin corrections and employee correction requests, with their audit logs.
  correctAttendance(...args: Parameters<AttendanceCorrectionsService['correctAttendance']>) {
    return this.corrections.correctAttendance(...args);
  }
  getAttendanceCorrectionLogs(...args: Parameters<AttendanceCorrectionsService['getAttendanceCorrectionLogs']>) {
    return this.corrections.getAttendanceCorrectionLogs(...args);
  }

  // ---- Clock-in/out (manual and secure), attendance records, overtime workers and lateness.
  getOvertimeWorkers(...args: Parameters<AttendanceClockService['getOvertimeWorkers']>) {
    return this.clock.getOvertimeWorkers(...args);
  }
  forceClockOut(...args: Parameters<AttendanceClockService['forceClockOut']>) {
    return this.clock.forceClockOut(...args);
  }
  getUserAttendanceRecords(...args: Parameters<AttendanceClockService['getUserAttendanceRecords']>) {
    return this.clock.getUserAttendanceRecords(...args);
  }
  getAttendanceRecords(...args: Parameters<AttendanceClockService['getAttendanceRecords']>) {
    return this.clock.getAttendanceRecords(...args);
  }
  getAttendanceRecordById(...args: Parameters<AttendanceClockService['getAttendanceRecordById']>) {
    return this.clock.getAttendanceRecordById(...args);
  }
  recordAttendance(...args: Parameters<AttendanceClockService['recordAttendance']>) {
    return this.clock.recordAttendance(...args);
  }
  clockIn(...args: Parameters<AttendanceClockService['clockIn']>) {
    return this.clock.clockIn(...args);
  }
  clockOut(...args: Parameters<AttendanceClockService['clockOut']>) {
    return this.clock.clockOut(...args);
  }

  // ---- Shifts, schedule patterns, shift/schedule assignments and per-user schedules.
  getUnassignedUsers(...args: Parameters<AttendanceSchedulingService['getUnassignedUsers']>) {
    return this.scheduling.getUnassignedUsers(...args);
  }
  getUsersWithAssignments(...args: Parameters<AttendanceSchedulingService['getUsersWithAssignments']>) {
    return this.scheduling.getUsersWithAssignments(...args);
  }

  // ---- QR codes, registered attendance devices and allowed networks.
  generateQRCode(...args: Parameters<AttendanceDevicesService['generateQRCode']>) {
    return this.devices.generateQRCode(...args);
  }
  getCurrentQRCode(...args: Parameters<AttendanceDevicesService['getCurrentQRCode']>) {
    return this.devices.getCurrentQRCode(...args);
  }
  validateQRCode(...args: Parameters<AttendanceDevicesService['validateQRCode']>) {
    return this.devices.validateQRCode(...args);
  }
  registerDevice(...args: Parameters<AttendanceDevicesService['registerDevice']>) {
    return this.devices.registerDevice(...args);
  }
  getUserDevices(...args: Parameters<AttendanceDevicesService['getUserDevices']>) {
    return this.devices.getUserDevices(...args);
  }
  isDeviceRegistered(...args: Parameters<AttendanceDevicesService['isDeviceRegistered']>) {
    return this.devices.isDeviceRegistered(...args);
  }
  removeDevice(...args: Parameters<AttendanceDevicesService['removeDevice']>) {
    return this.devices.removeDevice(...args);
  }

  // ---- Shifts, schedule patterns, shift/schedule assignments and per-user schedules.
  getUserTodaySchedule(...args: Parameters<AttendanceSchedulingService['getUserTodaySchedule']>) {
    return this.scheduling.getUserTodaySchedule(...args);
  }

  // ---- Clock-in/out (manual and secure), attendance records, overtime workers and lateness.
  getHRAttendanceSettings(...args: Parameters<AttendanceClockService['getHRAttendanceSettings']>) {
    return this.clock.getHRAttendanceSettings(...args);
  }
  getEarlyPunchInMinutes(...args: Parameters<AttendanceClockService['getEarlyPunchInMinutes']>) {
    return this.clock.getEarlyPunchInMinutes(...args);
  }
  getLateTolerance(...args: Parameters<AttendanceClockService['getLateTolerance']>) {
    return this.clock.getLateTolerance(...args);
  }
  validateClockInTiming(...args: Parameters<AttendanceClockService['validateClockInTiming']>) {
    return this.clock.validateClockInTiming(...args);
  }
  secureClockIn(...args: Parameters<AttendanceClockService['secureClockIn']>) {
    return this.clock.secureClockIn(...args);
  }
  secureClockOut(...args: Parameters<AttendanceClockService['secureClockOut']>) {
    return this.clock.secureClockOut(...args);
  }

  // ---- QR codes, registered attendance devices and allowed networks.
  getAllDevices(...args: Parameters<AttendanceDevicesService['getAllDevices']>) {
    return this.devices.getAllDevices(...args);
  }

  // ---- Clock-in/out (manual and secure), attendance records, overtime workers and lateness.
  getLatenessSummary(...args: Parameters<AttendanceClockService['getLatenessSummary']>) {
    return this.clock.getLatenessSummary(...args);
  }

  // ---- QR codes, registered attendance devices and allowed networks.
  getPendingDevices(...args: Parameters<AttendanceDevicesService['getPendingDevices']>) {
    return this.devices.getPendingDevices(...args);
  }
  approveDevice(...args: Parameters<AttendanceDevicesService['approveDevice']>) {
    return this.devices.approveDevice(...args);
  }
  rejectDevice(...args: Parameters<AttendanceDevicesService['rejectDevice']>) {
    return this.devices.rejectDevice(...args);
  }
  getAllowedNetworks(...args: Parameters<AttendanceDevicesService['getAllowedNetworks']>) {
    return this.devices.getAllowedNetworks(...args);
  }
  addAllowedNetwork(...args: Parameters<AttendanceDevicesService['addAllowedNetwork']>) {
    return this.devices.addAllowedNetwork(...args);
  }
  removeAllowedNetwork(...args: Parameters<AttendanceDevicesService['removeAllowedNetwork']>) {
    return this.devices.removeAllowedNetwork(...args);
  }
  isNetworkAllowed(...args: Parameters<AttendanceDevicesService['isNetworkAllowed']>) {
    return this.devices.isNetworkAllowed(...args);
  }

  // ---- Absent-user processing, batch status updates and absence thresholds.
  processAbsentUsers(...args: Parameters<AttendanceAbsenceService['processAbsentUsers']>) {
    return this.absence.processAbsentUsers(...args);
  }
  batchUpdateAttendanceStatus(...args: Parameters<AttendanceAbsenceService['batchUpdateAttendanceStatus']>) {
    return this.absence.batchUpdateAttendanceStatus(...args);
  }
  getAbsenceThresholds(...args: Parameters<AttendanceAbsenceService['getAbsenceThresholds']>) {
    return this.absence.getAbsenceThresholds(...args);
  }
  updateAbsenceThresholds(...args: Parameters<AttendanceAbsenceService['updateAbsenceThresholds']>) {
    return this.absence.updateAbsenceThresholds(...args);
  }
  checkAbsenceThresholds(...args: Parameters<AttendanceAbsenceService['checkAbsenceThresholds']>) {
    return this.absence.checkAbsenceThresholds(...args);
  }

  // ---- Biometric punches (live, batch and offline import) and reconciliation overtime.
  processBiometricPunch(...args: Parameters<AttendanceBiometricService['processBiometricPunch']>) {
    return this.biometric.processBiometricPunch(...args);
  }
  processBiometricPunchesBatch(...args: Parameters<AttendanceBiometricService['processBiometricPunchesBatch']>) {
    return this.biometric.processBiometricPunchesBatch(...args);
  }
  importOfflinePunchLogs(...args: Parameters<AttendanceBiometricService['importOfflinePunchLogs']>) {
    return this.biometric.importOfflinePunchLogs(...args);
  }
  getPendingReconciliationOvertime(...args: Parameters<AttendanceBiometricService['getPendingReconciliationOvertime']>) {
    return this.biometric.getPendingReconciliationOvertime(...args);
  }
  decideReconciliationOvertime(...args: Parameters<AttendanceBiometricService['decideReconciliationOvertime']>) {
    return this.biometric.decideReconciliationOvertime(...args);
  }

  // ---- Admin corrections and employee correction requests, with their audit logs.
  requestAttendanceCorrection(...args: Parameters<AttendanceCorrectionsService['requestAttendanceCorrection']>) {
    return this.corrections.requestAttendanceCorrection(...args);
  }
  getAttendanceCorrectionRequests(...args: Parameters<AttendanceCorrectionsService['getAttendanceCorrectionRequests']>) {
    return this.corrections.getAttendanceCorrectionRequests(...args);
  }
  getMyAttendanceCorrectionRequests(...args: Parameters<AttendanceCorrectionsService['getMyAttendanceCorrectionRequests']>) {
    return this.corrections.getMyAttendanceCorrectionRequests(...args);
  }
  reviewAttendanceCorrectionRequest(...args: Parameters<AttendanceCorrectionsService['reviewAttendanceCorrectionRequest']>) {
    return this.corrections.reviewAttendanceCorrectionRequest(...args);
  }

  // ---- Missed clock-in alarms, shift reminders and midnight auto-close jobs.
  dismissMissedClockInAlarm(...args: Parameters<AttendanceRemindersService['dismissMissedClockInAlarm']>) {
    return this.reminders.dismissMissedClockInAlarm(...args);
  }
  checkMissedClockInAlarms(...args: Parameters<AttendanceRemindersService['checkMissedClockInAlarms']>) {
    return this.reminders.checkMissedClockInAlarms(...args);
  }
  checkPreShiftEndReminders(...args: Parameters<AttendanceRemindersService['checkPreShiftEndReminders']>) {
    return this.reminders.checkPreShiftEndReminders(...args);
  }
  checkVetShiftReminders(...args: Parameters<AttendanceRemindersService['checkVetShiftReminders']>) {
    return this.reminders.checkVetShiftReminders(...args);
  }
  sendPreMidnightWarning(...args: Parameters<AttendanceRemindersService['sendPreMidnightWarning']>) {
    return this.reminders.sendPreMidnightWarning(...args);
  }
  autoCloseDayShiftsAtMidnight(...args: Parameters<AttendanceRemindersService['autoCloseDayShiftsAtMidnight']>) {
    return this.reminders.autoCloseDayShiftsAtMidnight(...args);
  }
  autoCloseOvernightShifts(...args: Parameters<AttendanceRemindersService['autoCloseOvernightShifts']>) {
    return this.reminders.autoCloseOvernightShifts(...args);
  }
}
