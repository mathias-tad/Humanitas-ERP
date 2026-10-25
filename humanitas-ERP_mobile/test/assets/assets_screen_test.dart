import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/assets/models/asset_model.dart';
import 'package:humanitas_erp_mobile/features/assets/providers/asset_provider.dart';
import 'package:humanitas_erp_mobile/features/assets/screens/assets_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

const _emptyAssets = <CompanyAssetModel>[];

const _fakeAnalytics = AssetAnalyticsModel(
  totalAssets: 12,
  availableCount: 5,
  assignedCount: 6,
  maintenanceCount: 1,
  retiredCount: 0,
  totalValuation: 24000.0,
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
      allAssetsProvider.overrideWith((_) async => _emptyAssets),
      myAssetsProvider.overrideWith((_) async => _emptyAssets),
      assetAnalyticsProvider.overrideWith((_) async => _fakeAnalytics),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

List<Override> _adminOverrides() => [
      allAssetsProvider.overrideWith((_) async => _emptyAssets),
      myAssetsProvider.overrideWith((_) async => _emptyAssets),
      assetAnalyticsProvider.overrideWith((_) async => _fakeAnalytics),
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
}) {
  return ProviderScope(
    overrides: overrides,
    child: const MaterialApp(
      home: AssetsScreen(),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('AssetsScreen', () {
    testWidgets('shows Access Denied when user lacks permissions',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _nopermOverrides()));
      await tester.pumpAndSettle();

      expect(
          find.text('You do not have permission to view assets.'),
          findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('renders title and stats cards when user is admin',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _adminOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('Asset Tracking'), findsOneWidget);
      expect(find.text('Total'), findsOneWidget);
      expect(find.text('Available'), findsOneWidget);
      expect(find.text('In Custody'), findsOneWidget);
      expect(find.text('Service'), findsOneWidget);
    });

    testWidgets('renders tabs when user is admin', (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _adminOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('All Assets'), findsOneWidget);
      expect(find.text('My Assets'), findsOneWidget);
    });
  });
}
