import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/reviews/models/review_model.dart';
import 'package:humanitas_erp_mobile/features/reviews/providers/review_provider.dart';
import 'package:humanitas_erp_mobile/features/reviews/screens/reviews_screen.dart';

const _fakeAnalytics = ReviewAnalyticsModel(
  totalCycles: 3,
  totalReviews: 24,
  completedReviews: 18,
  completionRate: 75,
  averageRating: 4.2,
  activePips: 2,
);

final _sampleCycles = <ReviewCycleModel>[
  const ReviewCycleModel(
    id: 'cycle-1',
    title: 'Q1 2026 Performance Review',
    cycleType: 'quarterly',
    status: 'active',
    startDate: '2026-01-01',
    dueDate: '2026-03-31',
    totalParticipants: 20,
    completedReviews: 15,
  ),
];

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

Widget _buildTestApp({
  required AuthState authState,
  List<ReviewCycleModel>? initialCycles,
  Map<String, dynamic>? initialMyReviews,
  ReviewAnalyticsModel? initialAnalytics,
}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((ref) => _buildNotifier(authState)),
      reviewCyclesProvider.overrideWith((ref) => Future.value(initialCycles ?? [])),
      myReviewsProvider.overrideWith((ref) => Future.value(initialMyReviews ?? {})),
      reviewAnalyticsProvider.overrideWith((ref) => Future.value(initialAnalytics ?? _fakeAnalytics)),
    ],
    child: MaterialApp(
      home: ReviewsScreen(
        initialCycles: initialCycles,
        initialMyReviews: initialMyReviews,
        initialAnalytics: initialAnalytics,
      ),
    ),
  );
}

void main() {
  group('ReviewsScreen Widget Tests', () {
    testWidgets('shows Access Denied when user has no permissions', (tester) async {
      await tester.pumpWidget(_buildTestApp(authState: _noPermAuthState()));
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
        find.text('You do not have permission to access performance reviews.'),
        findsOneWidget,
      );
    });

    testWidgets('shows 360° Performance Reviews title and tabs for admin', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          authState: _adminAuthState(),
          initialCycles: _sampleCycles,
          initialAnalytics: _fakeAnalytics,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('360° Performance Reviews'), findsOneWidget);
      expect(find.text('My 360'), findsOneWidget);
      expect(find.text('Cycles (1)'), findsOneWidget);
    });

    testWidgets('switches to Cycles tab on tap', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          authState: _adminAuthState(),
          initialCycles: _sampleCycles,
          initialAnalytics: _fakeAnalytics,
        ),
      );
      await tester.pumpAndSettle();

      final cyclesTab = find.text('Cycles (1)');
      expect(cyclesTab, findsOneWidget);

      await tester.tap(cyclesTab);
      await tester.pumpAndSettle();

      expect(find.text('Q1 2026 Performance Review'), findsOneWidget);
    });
  });
}
