import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/notifications/providers/notification_reports_provider.dart';
import 'package:humanitas_erp_mobile/features/notifications/screens/notification_reports_screen.dart';

// ── Fake data ──────────────────────────────────────────────────────────────────

const _fakeDeliveryStats = <String, dynamic>{
  'totalSent': 1200,
  'delivered': 1150,
  'failed': 50,
  'deliveryRate': 95.8,
};

const _fakePreferenceDist = <String, dynamic>{
  'emailOnly': 30,
  'pushOnly': 45,
  'both': 120,
  'none': 5,
};

// ── Auth helpers ───────────────────────────────────────────────────────────────

final _adminUser = UserModel(
  id: 'u1',
  email: 'admin@example.com',
  role: 'admin',
);

AuthState _adminAuthState() => AuthState(
      status: AuthStatus.authenticated,
      user: _adminUser,
      permissions: const [],
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

// ── Provider overrides ─────────────────────────────────────────────────────────

List<Override> _adminOverrides() => [
      notificationDeliveryStatsProvider(30)
          .overrideWith((_) async => _fakeDeliveryStats),
      notificationPreferenceDistributionProvider
          .overrideWith((_) async => _fakePreferenceDist),
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
    ];

List<Override> _nopermOverrides() => [
      notificationDeliveryStatsProvider(30)
          .overrideWith((_) async => _fakeDeliveryStats),
      notificationPreferenceDistributionProvider
          .overrideWith((_) async => _fakePreferenceDist),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
  Map<String, dynamic>? initialDeliveryStats,
  Map<String, dynamic>? initialPreferenceDistribution,
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: NotificationReportsScreen(
        initialDeliveryStats: initialDeliveryStats,
        initialPreferenceDistribution: initialPreferenceDistribution,
      ),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('NotificationReportsScreen', () {
    testWidgets('shows Access Denied when user lacks permissions',
        (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _nopermOverrides(),
        initialDeliveryStats: _fakeDeliveryStats,
        initialPreferenceDistribution: _fakePreferenceDist,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('NotificationReportsScreen shows title', (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(),
        initialDeliveryStats: _fakeDeliveryStats,
        initialPreferenceDistribution: _fakePreferenceDist,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Notification Reports'), findsWidgets);
    });

    testWidgets('renders Scaffold and AppBar', (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(),
        initialDeliveryStats: _fakeDeliveryStats,
        initialPreferenceDistribution: _fakePreferenceDist,
      ));
      await tester.pumpAndSettle();

      expect(find.byType(Scaffold), findsOneWidget);
      expect(find.byType(AppBar), findsOneWidget);
    });

    testWidgets('shows delivery stat cards for authorized user', (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(),
        initialDeliveryStats: _fakeDeliveryStats,
        initialPreferenceDistribution: _fakePreferenceDist,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Delivery Statistics'), findsOneWidget);
      expect(find.text('Total Sent'), findsOneWidget);
      expect(find.text('1200'), findsOneWidget);
      expect(find.text('Delivered'), findsOneWidget);
      expect(find.text('Failed'), findsOneWidget);
    });

    testWidgets('shows preference distribution for authorized user',
        (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(),
        initialDeliveryStats: _fakeDeliveryStats,
        initialPreferenceDistribution: _fakePreferenceDist,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Preference Distribution'), findsOneWidget);
      expect(find.text('Email Only'), findsOneWidget);
      expect(find.text('Push Only'), findsOneWidget);
      expect(find.text('Both'), findsOneWidget);
      expect(find.text('None'), findsOneWidget);
    });
  });
}
