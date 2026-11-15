/**
 * Characterization ("golden master") tests for AttendanceService.
 *
 * Every public method is called against a scripted tenant connection in two
 * scenarios (empty database / populated database). The full sequence of SQL
 * statements, collaborator calls and the returned value (or thrown error) is
 * snapshotted. Any refactor of the attendance module must keep these
 * snapshots byte-identical; a diff means behaviour changed.
 */
import { Test } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { ATTENDANCE_SERVICE_PROVIDERS } from './attendance.providers';
import { AttendanceGateway } from './attendance.gateway';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SettingsService } from '../settings/settings.service';
import { HolidaysService } from '../holidays/holidays.service';
import { AbsencePenaltyService } from '../payroll/absence-penalty.service';
import { LateMinuteService } from '../payroll/late-minute.service';

type Scenario = 'empty' | 'populated';

const FIXED_NOW = new Date('2026-11-10T07:30:00.000Z'); // Tuesday 10:30 in Africa/Addis_Ababa

function makeRow(): Record<string, any> {
  return {
    id: 'row-1',
    user_id: 'user-1',
    target_user_id: 'user-1',
    shift_id: 'shift-1',
    pattern_id: 'pattern-1',
    attendance_record_id: 'rec-1',
    record_id: 'rec-1',
    device_id: 'device-1',
    company_id: 'company-1',
    branch_id: 'branch-1',
    supervisor_id: 'sup-1',
    name: 'Day Shift',
    shift_name: 'Day Shift',
    full_name: 'Test User',
    target_user_name: 'Test User',
    corrected_by_name: 'Admin User',
    email: 'user@example.test',
    department: 'Ops',
    avatar_url: null,
    color: '#123456',
    status: 'Present',
    date: '2026-11-10',
    start_date: '2026-11-01',
    end_date: null,
    start_time: '09:00',
    end_time: '17:00',
    standard_start_time: '09:00',
    standard_end_time: '17:00',
    scheduled_in: '2026-11-10T06:00:00.000Z',
    scheduled_out: '2026-11-10T14:00:00.000Z',
    clock_in: '2026-11-10T06:05:00.000Z',
    clock_out: null,
    actual_in: '2026-11-10T06:05:00.000Z',
    actual_out: null,
    clock_method: 'manual',
    grace_minutes: 10,
    late_minutes: 5,
    late_tolerance_minutes: 15,
    early_punch_in_minutes: 30,
    wait_for_absent_minutes: 60,
    work_hours: 8,
    work_days: [1, 2, 3, 4, 5],
    days_off: [0, 6],
    day_off_days: [0, 6],
    auto_rotate_dayoff: false,
    cycle_length_days: 7,
    pattern_shifts: [],
    shifts: [],
    is_overnight: false,
    is_day_off: false,
    is_corrected: false,
    is_active: true,
    is_override: false,
    pending_overtime_approval: true,
    missed_punch_type: null,
    remarks: null,
    reason: 'test',
    ip_address: '10.0.0.0',
    subnet_mask: '255.255.255.0',
    device_name: 'Phone',
    device_type: 'mobile',
    code: 'qr-code-1',
    type: 'clock_in',
    expires_at: '2026-11-10T08:30:00.000Z',
    monthly_threshold: 3,
    consecutive_threshold: 2,
    notify_employee: true,
    notify_supervisor: true,
    notify_hr: true,
    count: '1',
    total: '1',
    permissions: [],
    allowed_attendance_methods: ['manual', 'qr', 'biometric'],
    previous_state: {},
    new_state: {},
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    data: {
      timezone: 'Africa/Addis_Ababa',
      early_punch_in_minutes: 30,
      late_tolerance_minutes: 15,
      wait_for_absent_minutes: 60,
      allowed_attendance_methods: ['manual', 'qr', 'biometric'],
    },
  };
}

const MAX_LOG_ENTRIES = 2000;

/** Offset of a paginated query (0 for the first page or unpaginated SQL). */
function pageOffset(sql: string, params?: unknown[]): number {
  const placeholder = /\bOFFSET \$(\d+)/i.exec(sql);
  if (placeholder) return Number(params?.[Number(placeholder[1]) - 1]) || 0;
  const literal = /\bOFFSET (\d+)/i.exec(sql);
  return literal ? Number(literal[1]) : 0;
}

function normalizeSql(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

function toPlain(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value === undefined ? '__undefined__' : value, (_k, v) =>
      v instanceof Map ? { __map__: [...v.entries()] } : v instanceof Set ? { __set__: [...v] } : v,
    ),
  );
}

async function buildHarness(scenario: Scenario) {
  const log: unknown[] = [];
  const connection = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      const text = normalizeSql(sql);
      log.push({ sql: text, params: toPlain(params ?? null) });
      if (log.length > MAX_LOG_ENTRIES) {
        throw new Error(`characterization harness: more than ${MAX_LOG_ENTRIES} calls (runaway loop?)`);
      }
      if (scenario === 'empty' || pageOffset(text, params) > 0) return [];
      return [makeRow()];
    }),
  };
  const recorder = (name: string, result: unknown = undefined) =>
    jest.fn(async (...args: unknown[]) => {
      log.push({ call: name, args: toPlain(args) });
      return typeof result === 'function' ? (result as () => unknown)() : result;
    });

  const databaseService = {
    getTenantConnectionById: recorder('db.getTenantConnectionById', () => connection),
    getTenantConnection: recorder('db.getTenantConnection', () => connection),
  };
  const attendanceGateway = {
    emitAttendanceUpdate: recorder('gateway.emitAttendanceUpdate'),
    emitClockIn: recorder('gateway.emitClockIn'),
    emitClockOut: recorder('gateway.emitClockOut'),
  };
  const notificationsService = {
    createNotification: recorder('notifications.createNotification', () => ({ id: 'notif-1' })),
  };
  const notificationsGateway = { pushToUser: recorder('notificationsGateway.pushToUser') };
  const settingsService = {
    getHRSettings: recorder('settings.getHRSettings', () =>
      scenario === 'empty' ? {} : makeRow().data,
    ),
  };
  const holidaysService = {
    findAll: recorder('holidays.findAll', () => (scenario === 'empty' ? [] : [{ date: '2026-11-11', name: 'Holiday' }])),
  };
  const absencePenaltyService = { createAbsencePenalty: recorder('absencePenalty.createAbsencePenalty') };
  const lateMinuteService = { recordLateArrival: recorder('lateMinute.recordLateArrival') };

  const moduleRef = await Test.createTestingModule({
    providers: [
      ...ATTENDANCE_SERVICE_PROVIDERS,
      { provide: DatabaseService, useValue: databaseService },
      { provide: AttendanceGateway, useValue: attendanceGateway },
      { provide: NotificationsService, useValue: notificationsService },
      { provide: NotificationsGateway, useValue: notificationsGateway },
      { provide: SettingsService, useValue: settingsService },
      { provide: HolidaysService, useValue: holidaysService },
      { provide: AbsencePenaltyService, useValue: absencePenaltyService },
      { provide: LateMinuteService, useValue: lateMinuteService },
    ],
  }).compile();

  return { service: moduleRef.get(AttendanceService), log };
}

const T = 'tenant-1';
const punch = {
  userId: 'user-1',
  pin: '1001',
  deviceId: 'device-1',
  deviceSerialNumber: 'SN123',
  punchTime: new Date('2026-11-10T06:02:00.000Z'),
  verifyMethod: 'fingerprint',
  rawPayload: '1001\t2026-11-10 09:02:00\t0\t1',
};

// [label, invoke]
const CASES: Array<[string, (s: AttendanceService) => Promise<unknown>]> = [
  ['getShifts', (s) => s.getShifts(T)],
  ['createShift', (s) => s.createShift(T, { name: 'Day', start_time: '09:00', end_time: '17:00', grace_minutes: 10 }, 'admin-1')],
  ['updateShift', (s) => s.updateShift(T, 'shift-1', { name: 'Day 2', end_time: '18:00' }, 'admin-1')],
  ['deleteShift', (s) => s.deleteShift(T, 'shift-1', 'admin-1')],
  ['getSchedulePatterns', (s) => s.getSchedulePatterns(T)],
  ['createSchedulePattern', (s) => s.createSchedulePattern(T, { name: 'Pattern', cycle_length_days: 7, shifts: [{ day: 1, shift_id: 'shift-1' }] }, 'admin-1')],
  ['getSchedulePatternById', (s) => s.getSchedulePatternById(T, 'pattern-1')],
  ['updateSchedulePattern', (s) => s.updateSchedulePattern(T, 'pattern-1', { name: 'Pattern 2', shifts: [{ day: 2, shift_id: 'shift-1' }] }, 'admin-1')],
  ['deleteSchedulePattern', (s) => s.deleteSchedulePattern(T, 'pattern-1', 'admin-1')],
  ['getShiftAssignments', (s) => s.getShiftAssignments(T)],
  ['assignShift', (s) => s.assignShift(T, { user_id: 'user-1', shift_id: 'shift-1', start_date: '2026-11-10' }, 'admin-1')],
  ['removeAssignment', (s) => s.removeAssignment(T, 'user-1', 'admin-1')],
  ['assignSchedule', (s) => s.assignSchedule(T, { user_ids: ['user-1'], user_id: 'user-1', pattern_id: 'pattern-1', start_date: '2026-11-10' }, 'admin-1')],
  ['getUserSchedule', (s) => s.getUserSchedule(T, 'user-1', '2026-11-09', '2026-11-12')],
  ['getSchedulingAuditLogs', (s) => s.getSchedulingAuditLogs(T, { page: 1, limit: 10, search: 'Day' })],
  ['correctAttendance', (s) => s.correctAttendance(T, 'rec-1', { status: 'Present', clock_in: '2026-11-10T06:00:00.000Z', clock_out: '2026-11-10T14:00:00.000Z', reason: 'fix' }, 'admin-1')],
  ['getAttendanceCorrectionLogs', (s) => s.getAttendanceCorrectionLogs(T, { userId: 'user-1', page: 1, limit: 10 })],
  ['getOvertimeWorkers', (s) => s.getOvertimeWorkers(T)],
  ['forceClockOut', (s) => s.forceClockOut(T, 'admin-1', 'user-1', 'left', true)],
  ['getUserAttendanceRecords', (s) => s.getUserAttendanceRecords(T, 'user-1', { month: 11, year: 2026 })],
  ['getAttendanceRecords', (s) => s.getAttendanceRecords(T, { startDate: '2026-11-01', endDate: '2026-11-10', user_id: 'user-1', status: 'Present', department: 'Ops', branch_id: 'branch-1', company_id: 'company-1' })],
  ['getAttendanceRecordById', (s) => s.getAttendanceRecordById(T, 'rec-1')],
  ['recordAttendance', (s) => s.recordAttendance(T, { user_id: 'user-1', date: '2026-11-10', status: 'Present', clock_in: '2026-11-10T06:00:00.000Z' })],
  ['clockIn', (s) => s.clockIn(T, 'user-1', 'manual', null)],
  ['clockOut', (s) => s.clockOut(T, 'user-1', 'manual', 'device-1')],
  ['getUnassignedUsers', (s) => s.getUnassignedUsers(T)],
  ['getUsersWithAssignments', (s) => s.getUsersWithAssignments(T)],
  ['generateQRCode', (s) => s.generateQRCode(T, 'clock_in')],
  ['getCurrentQRCode', (s) => s.getCurrentQRCode(T, 'clock_out')],
  ['validateQRCode', (s) => s.validateQRCode(T, 'qr-code-1')],
  ['registerDevice', (s) => s.registerDevice(T, 'user-1', { device_id: 'device-1', device_name: 'Phone', device_type: 'mobile' })],
  ['getUserDevices', (s) => s.getUserDevices(T, 'user-1')],
  ['isDeviceRegistered', (s) => s.isDeviceRegistered(T, 'user-1', 'device-1')],
  ['removeDevice', (s) => s.removeDevice(T, 'user-1', 'device-1')],
  ['getUserTodaySchedule', (s) => s.getUserTodaySchedule(T, 'user-1')],
  ['getHRAttendanceSettings', (s) => s.getHRAttendanceSettings(T)],
  ['getEarlyPunchInMinutes', (s) => s.getEarlyPunchInMinutes(T)],
  ['getLateTolerance', (s) => s.getLateTolerance(T)],
  ['validateClockInTiming', (s) => s.validateClockInTiming(T, 'user-1')],
  ['secureClockIn', (s) => s.secureClockIn(T, 'user-1', 'qr-code-1', 'device-1', '10.0.0.5')],
  ['secureClockOut', (s) => s.secureClockOut(T, 'user-1', 'qr-code-1', 'device-1', '10.0.0.5')],
  ['getAllDevices', (s) => s.getAllDevices(T)],
  ['getLatenessSummary', (s) => s.getLatenessSummary(T, '2026-11-10', 'user-1')],
  ['getPendingDevices', (s) => s.getPendingDevices(T)],
  ['approveDevice', (s) => s.approveDevice(T, 'device-rec-1', 'admin-1')],
  ['rejectDevice', (s) => s.rejectDevice(T, 'device-rec-1')],
  ['getAllowedNetworks', (s) => s.getAllowedNetworks(T)],
  ['addAllowedNetwork', (s) => s.addAllowedNetwork(T, { name: 'Office', ip_address: '10.0.0.0', subnet_mask: '255.255.255.0', description: 'HQ' }, 'admin-1')],
  ['removeAllowedNetwork', (s) => s.removeAllowedNetwork(T, 'net-1')],
  ['isNetworkAllowed (inside)', (s) => s.isNetworkAllowed(T, '10.0.0.5')],
  ['isNetworkAllowed (outside)', (s) => s.isNetworkAllowed(T, '192.168.1.5')],
  ['processAbsentUsers', (s) => s.processAbsentUsers(T)],
  ['batchUpdateAttendanceStatus', (s) => s.batchUpdateAttendanceStatus(T, ['rec-1'], 'Absent', 'no show', 'admin-1')],
  ['getAbsenceThresholds', (s) => s.getAbsenceThresholds(T)],
  ['updateAbsenceThresholds', (s) => s.updateAbsenceThresholds(T, { monthly_threshold: 4, consecutive_threshold: 2, notify_employee: true, notify_supervisor: false, notify_hr: true } as any)],
  ['checkAbsenceThresholds', (s) => s.checkAbsenceThresholds(T, 'user-1', '2026-11-10')],
  ['processBiometricPunch', (s) => s.processBiometricPunch(T, { ...punch })],
  ['processBiometricPunch (offline)', (s) => s.processBiometricPunch(T, { ...punch, isOfflineSync: true, companyId: 'company-1', branchId: 'branch-1' })],
  ['processBiometricPunchesBatch', (s) => s.processBiometricPunchesBatch(T, [{ ...punch }, { ...punch, punchTime: new Date('2026-11-10T14:05:00.000Z') }])],
  ['importOfflinePunchLogs', (s) => s.importOfflinePunchLogs(T, 'SN123', '1001\t2026-11-10 09:02:00\t0\t1\t0\n1001\t2026-11-10 17:05:00\t1\t1\t0\n')],
  ['getPendingReconciliationOvertime', (s) => s.getPendingReconciliationOvertime(T)],
  ['decideReconciliationOvertime', (s) => s.decideReconciliationOvertime(T, 'rec-1', true, 'admin-1')],
  ['requestAttendanceCorrection', (s) => s.requestAttendanceCorrection(T, 'user-1', 'rec-1', { requested_in: '2026-11-10T06:00:00.000Z', requested_out: '2026-11-10T14:00:00.000Z', reason: 'forgot' })],
  ['getAttendanceCorrectionRequests', (s) => s.getAttendanceCorrectionRequests(T, { status: 'pending' })],
  ['getMyAttendanceCorrectionRequests', (s) => s.getMyAttendanceCorrectionRequests(T, 'user-1')],
  ['reviewAttendanceCorrectionRequest (approve)', (s) => s.reviewAttendanceCorrectionRequest(T, 'admin-1', 'req-1', { status: 'approved', reviewer_notes: 'ok' })],
  ['reviewAttendanceCorrectionRequest (reject)', (s) => s.reviewAttendanceCorrectionRequest(T, 'admin-1', 'req-1', { status: 'rejected' })],
  ['dismissMissedClockInAlarm', (s) => s.dismissMissedClockInAlarm(T, 'user-1')],
  ['checkMissedClockInAlarms', (s) => s.checkMissedClockInAlarms(T)],
  ['checkPreShiftEndReminders', (s) => s.checkPreShiftEndReminders(T)],
  ['checkVetShiftReminders', (s) => s.checkVetShiftReminders(T)],
  ['sendPreMidnightWarning', (s) => s.sendPreMidnightWarning(T)],
  ['autoCloseDayShiftsAtMidnight', (s) => s.autoCloseDayShiftsAtMidnight(T)],
  ['autoCloseOvernightShifts', (s) => s.autoCloseOvernightShifts(T)],
];

describe('AttendanceService characterization', () => {
  beforeAll(() => {
    jest.useFakeTimers({
      now: FIXED_NOW,
      doNotFake: [
        'nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout',
        'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance',
      ],
    });
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs with the timezone the snapshots were recorded in', () => {
    // Pinned by test/jest-global-setup.js. If this fails, the snapshot
    // diffs below are timezone noise, not behaviour changes.
    expect(new Date('2026-01-01T00:00:00').toISOString()).toBe('2025-12-31T21:00:00.000Z');
  });

  it('exposes every public method covered here', () => {
    const proto = AttendanceService.prototype as unknown as Record<string, unknown>;
    for (const [label] of CASES) {
      const name = label.split(' ')[0];
      expect(typeof proto[name]).toBe('function');
    }
  });

  for (const scenario of ['empty', 'populated'] as Scenario[]) {
    describe(`${scenario} database`, () => {
      for (const [label, invoke] of CASES) {
        it(label, async () => {
          const { service, log } = await buildHarness(scenario);
          let outcome: unknown;
          try {
            outcome = { result: toPlain(await invoke(service)) };
          } catch (err: any) {
            outcome = { error: err?.constructor?.name ?? 'Error', message: String(err?.message ?? err) };
          }
          expect({ outcome, log }).toMatchSnapshot();
        }, 20000);
      }
    });
  }
});
