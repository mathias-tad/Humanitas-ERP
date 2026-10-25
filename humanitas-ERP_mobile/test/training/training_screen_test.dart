import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/training/models/training_model.dart';
import 'package:humanitas_erp_mobile/features/training/providers/training_provider.dart';
import 'package:humanitas_erp_mobile/features/training/screens/training_screen.dart';

const _emptyCourses = <TrainingCourseModel>[];
const _emptyEnrollments = <TrainingEnrollmentModel>[];

const _fakeStats = TrainingStatsModel(
  totalCourses: 6,
  mandatoryCourses: 2,
  totalEnrollments: 25,
  completedEnrollments: 18,
  activeEnrollments: 7,
  completionRate: 72,
  complianceRate: 95,
  averageScore: 88.0,
  totalSkillsLogged: 45,
  verifiedSkills: 30,
);

final _sampleCourses = <TrainingCourseModel>[
  const TrainingCourseModel(
    id: 'course-1',
    title: 'Workplace Ethics & Compliance',
    category: 'compliance',
    deliveryMethod: 'online',
    durationHours: 2.0,
    isMandatory: true,
    passingScore: 85,
    totalEnrolled: 20,
    totalCompleted: 15,
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

Widget _buildTestWidget({
  required AuthState authState,
  List<TrainingCourseModel>? initialCourses,
  List<TrainingEnrollmentModel>? initialEnrollments,
  TrainingStatsModel? initialStats,
}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((ref) => _buildNotifier(authState)),
      trainingCoursesProvider.overrideWith((ref) => Future.value(initialCourses ?? _emptyCourses)),
      trainingEnrollmentsProvider.overrideWith((ref) => Future.value(initialEnrollments ?? _emptyEnrollments)),
      trainingStatsProvider.overrideWith((ref) => Future.value(initialStats ?? _fakeStats)),
    ],
    child: MaterialApp(
      home: TrainingScreen(
        initialCourses: initialCourses,
        initialEnrollments: initialEnrollments,
        initialStats: initialStats,
      ),
    ),
  );
}

void main() {
  group('TrainingScreen Widget Tests', () {
    testWidgets('shows Access Denied when user has no permissions', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _noPermAuthState(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
        find.text('You do not have permission to access training & learning.'),
        findsOneWidget,
      );
    });

    testWidgets('shows Training & Learning title and tabs for admin', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _adminAuthState(),
          initialCourses: _sampleCourses,
          initialStats: _fakeStats,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Training & Learning'), findsOneWidget);
      expect(find.text('Curricula'), findsNWidgets(2));
      expect(find.text('My Learning'), findsOneWidget);
      expect(find.text('Workplace Ethics & Compliance'), findsOneWidget);
      expect(find.text('Compliance'), findsOneWidget);
    });

    testWidgets('switches to My Learning tab on tap', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _adminAuthState(),
          initialCourses: _sampleCourses,
          initialEnrollments: const [],
          initialStats: _fakeStats,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('My Learning'));
      await tester.pumpAndSettle();

      expect(find.text('No Learning Enrollments Found'), findsOneWidget);
    });
  });
}
