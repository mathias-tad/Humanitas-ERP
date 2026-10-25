import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/benefits/models/benefit_model.dart';
import 'package:humanitas_erp_mobile/features/benefits/providers/benefit_provider.dart';
import 'package:humanitas_erp_mobile/features/benefits/screens/benefits_screen.dart';

const _emptyPlans = <BenefitPlanModel>[];
const _emptyEnrollments = <BenefitEnrollmentModel>[];

const _fakeStats = BenefitStatsModel(
  totalPlans: 5,
  activeEnrollments: 12,
  totalMonthlyEmployerCost: 4200.0,
  totalMonthlyEmployeeCost: 1500.0,
  enrolledEmployeesCount: 12,
);

final _samplePlans = <BenefitPlanModel>[
  const BenefitPlanModel(
    id: 'plan-1',
    name: 'Comprehensive Health Plan',
    type: 'medical',
    providerName: 'BlueCross',
    employerContribution: 350.0,
    employeeContribution: 100.0,
    frequency: 'monthly',
    isActive: true,
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
  List<BenefitPlanModel>? initialPlans,
  List<BenefitEnrollmentModel>? initialEnrollments,
  BenefitStatsModel? initialStats,
}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((ref) => _buildNotifier(authState)),
      benefitPlansProvider.overrideWith((ref) => Future.value(initialPlans ?? _emptyPlans)),
      benefitEnrollmentsProvider.overrideWith((ref) => Future.value(initialEnrollments ?? _emptyEnrollments)),
      benefitStatsProvider.overrideWith((ref) => Future.value(initialStats ?? _fakeStats)),
    ],
    child: MaterialApp(
      home: BenefitsScreen(
        initialPlans: initialPlans,
        initialEnrollments: initialEnrollments,
        initialStats: initialStats,
      ),
    ),
  );
}

void main() {
  group('BenefitsScreen Widget Tests', () {
    testWidgets('shows Access Denied when user has no permissions', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _noPermAuthState(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
        find.text('You do not have permission to view benefits & insurance.'),
        findsOneWidget,
      );
    });

    testWidgets('shows Benefits & Insurance title and tabs for admin', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _adminAuthState(),
          initialPlans: _samplePlans,
          initialStats: _fakeStats,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Benefits & Insurance'), findsOneWidget);
      expect(find.text('Plans Catalog'), findsOneWidget);
      expect(find.text('Enrollments'), findsOneWidget);
      expect(find.text('Comprehensive Health Plan'), findsOneWidget);
      expect(find.text('Active Plans'), findsOneWidget);
    });

    testWidgets('switches to Enrollments tab on tap', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _adminAuthState(),
          initialPlans: _samplePlans,
          initialEnrollments: const [],
          initialStats: _fakeStats,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Enrollments'));
      await tester.pumpAndSettle();

      expect(find.text('No Enrollments Found'), findsOneWidget);
    });
  });
}
