import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/features/leave/screens/admin_leave_screen.dart';

void main() {
  group('AdminLeaveScreen', () {
    Widget buildSubject({
      AsyncValue<List<LeaveRequestAdminModel>> requestsValue =
          const AsyncValue.loading(),
    }) {
      return ProviderScope(
        overrides: [
          adminLeaveRequestsProvider.overrideWith((ref, status) async {
            if (requestsValue is AsyncData) {
              return (requestsValue as AsyncData<List<LeaveRequestAdminModel>>).value;
            }
            if (requestsValue is AsyncError) {
              throw (requestsValue as AsyncError).error;
            }
            return Completer<List<LeaveRequestAdminModel>>().future;
          }),
        ],
        child: const MaterialApp(home: AdminLeaveScreen()),
      );
    }

    testWidgets('shows loading indicator when loading', (tester) async {
      await tester.pumpWidget(buildSubject());
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows empty state when no requests', (tester) async {
      await tester.pumpWidget(buildSubject(
        requestsValue: const AsyncData([]),
      ));
      await tester.pumpAndSettle();
      expect(find.text('No leave requests found'), findsOneWidget);
    });

    testWidgets('shows leave request card with employee name', (tester) async {
      final req = LeaveRequestAdminModel(
        id: '1',
        employeeName: 'Jane Doe',
        leaveType: 'Annual Leave',
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        days: 3,
        status: 'pending',
      );
      await tester.pumpWidget(buildSubject(
        requestsValue: AsyncData([req]),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Jane Doe'), findsOneWidget);
      expect(find.text('Annual Leave'), findsOneWidget);
      expect(find.text('Approve'), findsOneWidget);
      expect(find.text('Reject'), findsOneWidget);
    });

    testWidgets('shows status badges for approved/rejected', (tester) async {
      final reqs = [
        LeaveRequestAdminModel(
          id: '2',
          employeeName: 'John Smith',
          leaveType: 'Sick Leave',
          startDate: '2026-10-01',
          endDate: '2026-10-02',
          status: 'approved',
        ),
        LeaveRequestAdminModel(
          id: '3',
          employeeName: 'Alice Brown',
          leaveType: 'Sick Leave',
          startDate: '2026-10-05',
          endDate: '2026-10-05',
          status: 'rejected',
        ),
      ];
      await tester.pumpWidget(buildSubject(
        requestsValue: AsyncData(reqs),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Approved'), findsNWidgets(2));
      expect(find.text('Rejected'), findsNWidgets(2));
      // Approve/Reject buttons should NOT appear for non-pending
      expect(find.text('Approve'), findsNothing);
    });

    testWidgets('shows filter chips', (tester) async {
      await tester.pumpWidget(buildSubject(requestsValue: const AsyncData([])));
      await tester.pumpAndSettle();
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
      expect(find.text('Approved'), findsOneWidget);
      expect(find.text('Rejected'), findsOneWidget);
    });
  });
}
