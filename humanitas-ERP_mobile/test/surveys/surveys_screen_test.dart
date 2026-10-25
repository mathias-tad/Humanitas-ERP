import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/surveys/models/survey_model.dart';
import 'package:humanitas_erp_mobile/features/surveys/providers/survey_provider.dart';
import 'package:humanitas_erp_mobile/features/surveys/screens/surveys_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

const _emptySurveys = <SurveyModel>[];
const _emptyActions = <SurveyActionItemModel>[];

const _fakeAnalytics = SurveyAnalyticsModel(
  activeSurveys: 3,
  totalResponses: 45,
  averageEnps: 42.0,
  actionItemsCount: 6,
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
      activeSurveysProvider.overrideWith((_) async => _emptySurveys),
      allSurveysProvider.overrideWith((_) async => _emptySurveys),
      surveyActionItemsProvider.overrideWith((_) async => _emptyActions),
      surveyAnalyticsProvider.overrideWith((_) async => _fakeAnalytics),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

List<Override> _adminOverrides() => [
      activeSurveysProvider.overrideWith((_) async => _emptySurveys),
      allSurveysProvider.overrideWith((_) async => _emptySurveys),
      surveyActionItemsProvider.overrideWith((_) async => _emptyActions),
      surveyAnalyticsProvider.overrideWith((_) async => _fakeAnalytics),
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
}) {
  return ProviderScope(
    overrides: overrides,
    child: const MaterialApp(
      home: SurveysScreen(),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('SurveysScreen', () {
    testWidgets('shows Access Denied when user lacks permissions',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _nopermOverrides()));
      await tester.pumpAndSettle();

      expect(
          find.text('You do not have permission to view pulse surveys.'),
          findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('renders title and KPI tiles when user is admin',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _adminOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('Pulse Surveys'), findsWidgets);
      expect(find.text('Active'), findsOneWidget);
      expect(find.text('Responses'), findsOneWidget);
      expect(find.text('eNPS'), findsOneWidget);
      expect(find.text('Actions'), findsOneWidget);
    });

    testWidgets('renders tabs when user is admin', (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _adminOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('Active Surveys'), findsOneWidget);
      expect(find.text('Action Items'), findsOneWidget);
    });
  });
}
