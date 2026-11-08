import 'package:flutter_test/flutter_test.dart';
import 'package:humanitas_erp_mobile/features/attendance/models/attendance_record_model.dart';

void main() {
  group('AttendanceRecordModel Biometric & Regularization Tests', () {
    test('parses missed punch and overnight fields correctly from JSON', () {
      final json = {
        'id': 'rec-101',
        'user_id': 'usr-001',
        'date': '2026-11-08',
        'actual_in': '09:05:00',
        'actual_out': null,
        'status': 'present',
        'work_hours': 4.5,
        'clock_method': 'biometric',
        'device_name': 'Main Entrance Terminal',
        'missed_punch_type': 'missed_out',
        'is_overnight': true,
        'overtime_hours': 0.0,
        'auto_closed_at': '2026-11-09T00:00:00Z',
        'auto_close_reason': 'Midnight Auto-Day Close (Zero Overtime Credited)',
        'correction_status': 'pending',
      };

      final record = AttendanceRecordModel.fromJson(json);

      expect(record.id, 'rec-101');
      expect(record.userId, 'usr-001');
      expect(record.missedPunchType, 'missed_out');
      expect(record.isOvernight, true);
      expect(record.overtimeHours, 0.0);
      expect(record.autoClosedAt, '2026-11-09T00:00:00Z');
      expect(record.autoCloseReason, contains('Midnight Auto-Day Close'));
      expect(record.correctionStatus, 'pending');
    });

    test('defaults isOvernight to false and handles null missed punch', () {
      final json = {
        'id': 'rec-102',
        'user_id': 'usr-002',
        'date': '2026-11-08',
        'status': 'present',
      };

      final record = AttendanceRecordModel.fromJson(json);

      expect(record.isOvernight, false);
      expect(record.missedPunchType, isNull);
      expect(record.autoClosedAt, isNull);
    });
  });
}
