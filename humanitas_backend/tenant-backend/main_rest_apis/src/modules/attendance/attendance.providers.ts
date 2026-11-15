import { Provider } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceSchedulingService } from './attendance-scheduling.service';
import { AttendanceDevicesService } from './attendance-devices.service';
import { AttendanceClockService } from './attendance-clock.service';
import { AttendanceCorrectionsService } from './attendance-corrections.service';
import { AttendanceAbsenceService } from './attendance-absence.service';
import { AttendanceBiometricService } from './attendance-biometric.service';
import { AttendanceRemindersService } from './attendance-reminders.service';

/**
 * Services that make up the attendance domain. AttendanceModule registers
 * these, and the characterization spec builds the same set, so a refactor
 * that adds or moves services only needs to change this list.
 */
export const ATTENDANCE_SERVICE_PROVIDERS: Provider[] = [
  AttendanceService,
  AttendanceSchedulingService,
  AttendanceDevicesService,
  AttendanceClockService,
  AttendanceCorrectionsService,
  AttendanceAbsenceService,
  AttendanceBiometricService,
  AttendanceRemindersService,
];
