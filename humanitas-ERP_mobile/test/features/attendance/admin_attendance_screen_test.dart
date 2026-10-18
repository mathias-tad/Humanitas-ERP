import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/features/attendance/models/attendance_record_model.dart';
import 'package:humanitas_erp_mobile/features/attendance/providers/admin_attendance_provider.dart';
import 'package:humanitas_erp_mobile/features/attendance/screens/admin_attendance_screen.dart';

void main() {
  group('AdminAttendanceScreen', () {
    Widget buildSubject({
      AsyncValue<List<AttendanceRecordModel>> recordsValue = const AsyncValue.loading(),
    }) {
      return ProviderScope(
        overrides: [
          allRecordsProvider.overrideWith((ref, arg) async {
            if (recordsValue is AsyncData) {
              return (recordsValue as AsyncData<List<AttendanceRecordModel>>).value;
            }
            if (recordsValue is AsyncError) {
              throw (recordsValue as AsyncError).error;
            }
            return Completer<List<AttendanceRecordModel>>().future;
          }),
        ],
        child: const MaterialApp(home: AdminAttendanceScreen()),
      );
    }

    testWidgets('shows loading state initially', (tester) async {
      await tester.pumpWidget(buildSubject());
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows empty state when no attendance records', (tester) async {
      await tester.pumpWidget(buildSubject(
        recordsValue: const AsyncData([]),
      ));
      await tester.pumpAndSettle();
      expect(find.text('No records this month'), findsOneWidget);
    });

    testWidgets('renders attendance records with employee name and badges', (tester) async {
      final records = [
        AttendanceRecordModel(
          id: '1',
          userId: 'u1',
          employeeName: 'Sarah Connor',
          date: '2026-10-18',
          clockInTime: '2026-10-18T08:55:00Z',
          clockOutTime: '2026-10-18T17:05:00Z',
          status: 'present',
          clockMethod: 'biometric',
          deviceName: 'Main Entrance Terminal',
          workHours: 8.2,
        ),
      ];

      await tester.pumpWidget(buildSubject(
        recordsValue: AsyncData(records),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Sarah Connor'), findsOneWidget);
      expect(find.text('Present'), findsAtLeastNWidgets(1));
      expect(find.text('Biometric'), findsOneWidget);
      expect(find.text('Main Entrance Terminal'), findsOneWidget);
    });
  });
}
