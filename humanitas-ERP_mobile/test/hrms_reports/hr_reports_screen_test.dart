import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/hrms_reports/models/hrms_summary_model.dart';
import 'package:humanitas_erp_mobile/features/hrms_reports/providers/hrms_reports_provider.dart';
import 'package:humanitas_erp_mobile/features/hrms_reports/screens/hr_reports_screen.dart';

class FakeAuthRepository implements AuthRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class TestAuthNotifier extends AuthNotifier {
  TestAuthNotifier(AuthState initial) : super(FakeAuthRepository()) {
    state = initial;
  }
}

void main() {
  const fakeSummary = HrmsSummaryModel(
    totalHeadcount: 120,
    activeEmployees: 115,
    newHiresThisMonth: 6,
    turnoverRatePercentage: 4.5,
    averageTenureYears: 2.3,
    absenteeismRatePercentage: 1.8,
    monthlyWorkforceSpend: 650000.0,
  );

  const fakeHeadcount = HeadcountDemographicsModel(
    byDepartment: [
      DepartmentHeadcountItem(name: 'Engineering', count: 45),
      DepartmentHeadcountItem(name: 'Sales', count: 30),
    ],
    byGender: [
      DepartmentHeadcountItem(name: 'Male', count: 65),
      DepartmentHeadcountItem(name: 'Female', count: 50),
    ],
    byTenure: [
      DepartmentHeadcountItem(name: '1-3 Years', count: 60),
    ],
    byEmploymentType: [
      DepartmentHeadcountItem(name: 'Full-Time', count: 110),
    ],
  );

  Widget buildApp({required AuthState auth, HrmsSummaryModel? summary, HeadcountDemographicsModel? headcount}) {
    return ProviderScope(
      overrides: [
        authProvider.overrideWith((ref) => TestAuthNotifier(auth)),
        if (summary != null) hrmsSummaryProvider.overrideWith((ref) async => summary),
        if (headcount != null) hrmsHeadcountProvider.overrideWith((ref) async => headcount),
      ],
      child: MaterialApp(
        home: HrReportsScreen(
          initialSummary: summary,
          initialHeadcount: headcount,
        ),
      ),
    );
  }

  group('HrReportsScreen', () {
    testWidgets('shows permission denied message when user lacks permission', (tester) async {
      final unauth = AuthState(
        status: AuthStatus.authenticated,
        permissions: const [],
      );

      await tester.pumpWidget(buildApp(auth: unauth));
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(find.text('You do not have permission to view HRMS executive reports.'), findsOneWidget);
    });

    testWidgets('renders KPI metrics and department breakdown when authorized', (tester) async {
      final adminAuth = AuthState(
        status: AuthStatus.authenticated,
        user: UserModel(
          id: 'u1',
          email: 'admin@example.com',
          role: 'admin',
        ),
        permissions: const ['view_hrms_reports'],
      );

      await tester.pumpWidget(buildApp(
        auth: adminAuth,
        summary: fakeSummary,
        headcount: fakeHeadcount,
      ));
      await tester.pumpAndSettle();

      expect(find.text('People Analytics'), findsOneWidget);
      expect(find.text('Total Headcount'), findsOneWidget);
      expect(find.text('120'), findsOneWidget);
      expect(find.text('Active Workforce'), findsOneWidget);
      expect(find.text('115'), findsOneWidget);
      expect(find.text('Engineering'), findsOneWidget);
      expect(find.text('Sales'), findsOneWidget);
    });

    testWidgets('switches between Department Breakdown and Gender/Tenure tabs', (tester) async {
      final adminAuth = AuthState(
        status: AuthStatus.authenticated,
        user: UserModel(
          id: 'u1',
          email: 'admin@example.com',
          role: 'admin',
        ),
        permissions: const ['view_hrms_reports'],
      );

      await tester.pumpWidget(buildApp(
        auth: adminAuth,
        summary: fakeSummary,
        headcount: fakeHeadcount,
      ));
      await tester.pumpAndSettle();

      // Tap on 'Gender & Tenure' tab
      await tester.tap(find.text('Gender & Tenure'));
      await tester.pumpAndSettle();

      expect(find.text('Gender Representation'), findsOneWidget);
      expect(find.text('Tenure Distribution'), findsOneWidget);
      expect(find.text('Male'), findsOneWidget);
      expect(find.text('Female'), findsOneWidget);
    });
  });
}
