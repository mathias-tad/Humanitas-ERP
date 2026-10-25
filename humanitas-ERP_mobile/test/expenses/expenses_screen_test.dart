import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/expenses/models/expense_model.dart';
import 'package:humanitas_erp_mobile/features/expenses/providers/expense_provider.dart';
import 'package:humanitas_erp_mobile/features/expenses/screens/expenses_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

const _emptyReports = <ExpenseReportModel>[];

const _fakeAnalytics = ExpenseAnalyticsModel(
  totalSubmitted: 0,
  totalApproved: 0,
  totalPending: 0,
  reportCount: 0,
  pendingApprovals: 0,
  categoryBreakdown: [],
);

final _adminUser = UserModel(
  id: 'u1',
  email: 'admin@example.com',
  role: 'admin',
);

final _employeeUser = UserModel(
  id: 'u2',
  email: 'employee@example.com',
  role: 'employee',
);

// ── Auth state helpers ─────────────────────────────────────────────────────────

AuthState _adminAuthState() => AuthState(
      status: AuthStatus.authenticated,
      user: _adminUser,
      permissions: const [],
    );

AuthState _noPermAuthState() => AuthState(
      status: AuthStatus.authenticated,
      user: _employeeUser,
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
      myExpenseReportsProvider.overrideWith((_) async => _emptyReports),
      allExpenseReportsProvider.overrideWith((_) async => _emptyReports),
      expenseAnalyticsProvider.overrideWith((_) async => _fakeAnalytics),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

List<Override> _adminOverrides() => [
      myExpenseReportsProvider.overrideWith((_) async => _emptyReports),
      allExpenseReportsProvider.overrideWith((_) async => _emptyReports),
      expenseAnalyticsProvider.overrideWith((_) async => _fakeAnalytics),
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
}) {
  return ProviderScope(
    overrides: overrides,
    child: const MaterialApp(
      home: ExpensesScreen(),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('ExpensesScreen', () {
    testWidgets('shows Access Denied when user lacks permissions',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _nopermOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
          find.text('You do not have permission to view expense claims.'),
          findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('renders title and stats cards when user is admin',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _adminOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('Expense Claims'), findsOneWidget);
      expect(find.text('Report Count'), findsOneWidget);
      expect(find.text('Total Approved'), findsOneWidget);
      expect(find.text('Pending Approvals'), findsOneWidget);
      expect(find.text('Pending Amount'), findsOneWidget);
    });

    testWidgets('renders tabs when user is admin', (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _adminOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('My Claims'), findsOneWidget);
      expect(find.text('Approvals'), findsOneWidget);
    });
  });
}
