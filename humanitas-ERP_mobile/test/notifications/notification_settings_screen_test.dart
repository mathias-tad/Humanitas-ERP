import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/notifications/models/notification_preference_model.dart';
import 'package:humanitas_erp_mobile/features/notifications/providers/notification_provider.dart';
import 'package:humanitas_erp_mobile/features/notifications/screens/notification_settings_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

const _emptyPreferences = <NotificationPreferenceModel>[];

const _samplePreferences = <NotificationPreferenceModel>[
  NotificationPreferenceModel(
    category: 'leave_status_updates',
    channel: 'both',
  ),
  NotificationPreferenceModel(
    category: 'leave_approval_requests',
    channel: 'email',
  ),
  NotificationPreferenceModel(
    category: 'payroll_run_completed',
    channel: 'push',
  ),
];

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

AuthState _employeeAuthState() => AuthState(
      status: AuthStatus.authenticated,
      user: _employeeUser,
      permissions: const ['view_notification_preferences'],
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
      notificationPreferencesProvider
          .overrideWith((_) async => _emptyPreferences),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

List<Override> _adminOverrides(
        [List<NotificationPreferenceModel> prefs = _emptyPreferences]) =>
    [
      notificationPreferencesProvider.overrideWith((_) async => prefs),
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
    ];

List<Override> _employeeOverrides(
        [List<NotificationPreferenceModel> prefs = _emptyPreferences]) =>
    [
      notificationPreferencesProvider.overrideWith((_) async => prefs),
      authProvider.overrideWith((ref) => _buildNotifier(_employeeAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
  List<NotificationPreferenceModel>? initialPreferences,
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: NotificationSettingsScreen(
        initialPreferences: initialPreferences,
      ),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('NotificationSettingsScreen', () {
    testWidgets('Permission denied: shows lock icon message when user lacks permissions',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _nopermOverrides()));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
      expect(find.text('Access Denied'), findsOneWidget);
      expect(
        find.text(
            'You do not have permission to manage notification preferences.'),
        findsOneWidget,
      );
    });

    testWidgets('Authorized user: shows AppBar title Notification Preferences when role is admin',
        (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(_emptyPreferences),
        initialPreferences: _emptyPreferences,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Notification Preferences'), findsOneWidget);
    });

    testWidgets('Channel pills: Email Only text appears when preferences are loaded',
        (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(_samplePreferences),
        initialPreferences: _samplePreferences,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Email Only'), findsWidgets);
      expect(find.text('Leave Request Updates'), findsOneWidget);
      expect(find.text('Pending Leave Approvals'), findsOneWidget);
      expect(find.text('Payroll Run Completed'), findsOneWidget);
    });

    testWidgets('Empty state: shows no-categories message when preferences list is empty',
        (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(_emptyPreferences),
        initialPreferences: _emptyPreferences,
      ));
      await tester.pumpAndSettle();

      expect(find.text('No notification categories available'), findsOneWidget);
      expect(
        find.text('No notification categories available for your role.'),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.notifications_off_outlined), findsOneWidget);
    });

    testWidgets('Employee user: hides manager and admin categories according to permissions',
        (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _employeeOverrides(_samplePreferences),
        initialPreferences: _samplePreferences,
      ));
      await tester.pumpAndSettle();

      // Personal category (null permission) must be visible to employee
      expect(find.text('Leave Request Updates'), findsOneWidget);

      // Manager category (approve_leave) must NOT be visible to employee
      expect(find.text('Pending Leave Approvals'), findsNothing);

      // Admin category (run_payroll) must NOT be visible to employee
      expect(find.text('Payroll Run Completed'), findsNothing);
    });
  });
}
