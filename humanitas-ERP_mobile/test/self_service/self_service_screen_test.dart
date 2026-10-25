import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/self_service/models/self_service_model.dart';
import 'package:humanitas_erp_mobile/features/self_service/providers/self_service_provider.dart';
import 'package:humanitas_erp_mobile/features/self_service/screens/self_service_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

const _sampleDashboard = SelfServiceDashboardModel(
  userId: 'u-1',
  employeeName: 'Alex Morgan',
  email: 'alex@example.com',
  position: 'Senior Engineer',
  department: 'Product Development',
  streakDays: 14,
  punctualityScore: 98,
  pendingLeaveRequests: 1,
  pendingProfileRequests: 0,
  annualLeaveRemaining: 16,
  latestNetPay: 4250.00,
  latestPayPeriod: '10/2026',
);

final _employeeUser = UserModel(
  id: 'u1',
  email: 'alex@example.com',
  role: 'employee',
);

// ── Auth state helpers ─────────────────────────────────────────────────────────

AuthState _authorizedAuthState() => AuthState(
      status: AuthStatus.authenticated,
      user: _employeeUser,
      permissions: const ['view_self_service', 'edit_my_profile'],
    );

AuthState _noPermAuthState() => AuthState(
      status: AuthStatus.authenticated,
      permissions: const [],
    );

extension on AuthNotifier {
  void hackState(AuthState s) => state = s;
}

AuthNotifier _buildNotifier(AuthState initialState) {
  final storage = SecureStorageService();
  final apiClient = ApiClient(storage);
  final repo = AuthRepository(apiClient, storage);
  return AuthNotifier(repo)..hackState(initialState);
}

// ── Provider override helpers ──────────────────────────────────────────────────

List<Override> _nopermOverrides() => [
      selfServiceDashboardProvider.overrideWith((_) async => _sampleDashboard),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

List<Override> _authorizedOverrides() => [
      selfServiceDashboardProvider.overrideWith((_) async => _sampleDashboard),
      authProvider.overrideWith((ref) => _buildNotifier(_authorizedAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
  SelfServiceDashboardModel? initialDashboard,
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: SelfServiceScreen(
        initialDashboard: initialDashboard,
      ),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('SelfServiceScreen', () {
    testWidgets('shows Access Denied when user lacks permissions',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _nopermOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
          find.text('You do not have permission to view self-service.'),
          findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('renders title and employee name when authorized',
        (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _authorizedOverrides(),
        initialDashboard: _sampleDashboard,
      ));
      await tester.pumpAndSettle();

      expect(find.text('My HR Self-Service'), findsOneWidget);
      expect(find.text('Alex Morgan'), findsOneWidget);
      expect(find.text('Senior Engineer • Product Development'), findsOneWidget);
    });

    testWidgets('renders metric tiles and latest net pay', (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _authorizedOverrides(),
        initialDashboard: _sampleDashboard,
      ));
      await tester.pumpAndSettle();

      expect(find.text('14 Days'), findsOneWidget);
      expect(find.text('Attendance Streak'), findsOneWidget);
      expect(find.text('98%'), findsOneWidget);
      expect(find.text('Punctuality'), findsOneWidget);
      expect(find.text('16 Days'), findsOneWidget);
      expect(find.text('Annual Leave'), findsOneWidget);
      expect(find.text('\$4250.00'), findsOneWidget);
    });
  });
}
