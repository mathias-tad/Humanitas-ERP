import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/onboarding/models/onboarding_model.dart';
import 'package:humanitas_erp_mobile/features/onboarding/providers/onboarding_provider.dart';
import 'package:humanitas_erp_mobile/features/onboarding/screens/onboarding_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

const _emptyOnboardings = <OnboardingInstanceModel>[];

const _fakeStats = OnboardingStatsModel(
  totalOnboarding: 5,
  inProgressOnboarding: 3,
  completedOnboarding: 2,
  overdueTasks: 1,
  avgCompletionDays: 14.5,
  upcomingProbationReviews: 2,
);

final _sampleOnboardings = <OnboardingInstanceModel>[
  const OnboardingInstanceModel(
    id: 'onb-1',
    userId: 'u-101',
    firstName: 'Jane',
    lastName: 'Doe',
    department: 'Engineering',
    status: 'in_progress',
    totalTasks: 8,
    completedTasks: 4,
    completionPercentage: 50.0,
  ),
];

final _adminUser = UserModel(
  id: 'u1',
  email: 'admin@example.com',
  role: 'admin',
);

// ── Auth state helpers ─────────────────────────────────────────────────────────

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

// ── Provider override helpers ──────────────────────────────────────────────────

List<Override> _nopermOverrides() => [
      onboardingsListProvider.overrideWith((_) async => _emptyOnboardings),
      onboardingStatsProvider.overrideWith((_) async => _fakeStats),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

List<Override> _adminOverrides() => [
      onboardingsListProvider.overrideWith((_) async => _emptyOnboardings),
      onboardingStatsProvider.overrideWith((_) async => _fakeStats),
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
  List<OnboardingInstanceModel>? initialOnboardings,
  OnboardingStatsModel? initialStats,
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: OnboardingScreen(
        initialOnboardings: initialOnboardings,
        initialStats: initialStats,
      ),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('OnboardingScreen', () {
    testWidgets('shows Access Denied when user lacks permissions',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _nopermOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
          find.text('You do not have permission to view onboarding.'),
          findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('renders title and stats cards when user is admin',
        (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(),
        initialStats: _fakeStats,
        initialOnboardings: _emptyOnboardings,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Onboarding & Offboarding'), findsOneWidget);
      expect(find.text('Total Onboarding'), findsOneWidget);
      expect(find.text('In Progress'), findsWidgets); // Filter chip + Stat card
      expect(find.text('Completed'), findsWidgets);
      expect(find.text('Overdue Tasks'), findsOneWidget);
      expect(find.text('5'), findsOneWidget); // total
    });

    testWidgets('renders active onboarding list card', (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(),
        initialStats: _fakeStats,
        initialOnboardings: _sampleOnboardings,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Jane Doe'), findsOneWidget);
      expect(find.text('Engineering'), findsOneWidget);
      expect(find.text('50%'), findsOneWidget);
      expect(find.text('Tasks: 4/8'), findsOneWidget);
    });
  });
}
