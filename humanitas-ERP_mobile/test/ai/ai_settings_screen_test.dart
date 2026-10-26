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
import 'package:humanitas_erp_mobile/features/ai/providers/ai_settings_provider.dart';
import 'package:humanitas_erp_mobile/features/ai/screens/ai_settings_screen.dart';

// ── Fake data ──────────────────────────────────────────────────────────────────

const _fakeSettings = <String, dynamic>{
  'provider': 'Gemini Pro',
  'maxTokens': 4096,
  'temperature': 0.7,
  'actionExecutionEnabled': true,
  'documentGenerationEnabled': false,
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
      aiSettingsProvider.overrideWith((_) async => _fakeSettings),
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
    ];

List<Override> _nopermOverrides() => [
      aiSettingsProvider.overrideWith((_) async => _fakeSettings),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
  Map<String, dynamic>? initialSettings,
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(home: AiSettingsScreen(initialSettings: initialSettings)),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('AiSettingsScreen', () {
    testWidgets('shows Access Denied when user lacks permissions',
        (tester) async {
      await tester.pumpWidget(
          _buildApp(overrides: _nopermOverrides(), initialSettings: _fakeSettings));
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('AiSettingsScreen shows title', (tester) async {
      await tester.pumpWidget(
          _buildApp(overrides: _adminOverrides(), initialSettings: _fakeSettings));
      await tester.pumpAndSettle();

      expect(find.text('AI Settings'), findsWidgets);
    });

    testWidgets('renders Scaffold and AppBar', (tester) async {
      await tester.pumpWidget(
          _buildApp(overrides: _adminOverrides(), initialSettings: _fakeSettings));
      await tester.pumpAndSettle();

      expect(find.byType(Scaffold), findsOneWidget);
      expect(find.byType(AppBar), findsOneWidget);
    });

    testWidgets('shows settings cards when admin user has data', (tester) async {
      await tester.pumpWidget(
          _buildApp(overrides: _adminOverrides(), initialSettings: _fakeSettings));
      await tester.pumpAndSettle();

      expect(find.text('AI Provider'), findsOneWidget);
      expect(find.text('Gemini Pro'), findsOneWidget);
      expect(find.text('Max Tokens'), findsOneWidget);
      expect(find.text('4096'), findsOneWidget);
    });
  });
}
