import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/grievances/models/grievance_model.dart';
import 'package:humanitas_erp_mobile/features/grievances/providers/grievance_provider.dart';
import 'package:humanitas_erp_mobile/features/grievances/screens/grievances_screen.dart';

const _emptyGrievances = <GrievanceModel>[];

const _fakeStats = GrievanceStatsModel(
  totalCases: 6,
  openCases: 3,
  closedCases: 3,
  slaBreachedCases: 0,
  retaliationMonitoringCount: 1,
  avgResolutionDays: 6.2,
  slaComplianceRate: 100,
);

final _sampleGrievances = <GrievanceModel>[
  const GrievanceModel(
    id: 'grv-1',
    ticketNumber: 'GRV-202610-1001',
    category: 'harassment',
    subject: 'Hostile conduct in meeting',
    description: 'Verbal harassment occurred in conference room A',
    status: 'investigating',
    priority: 'high',
    submitterName: 'Jane Smith',
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
  List<GrievanceModel>? initialGrievances,
  GrievanceStatsModel? initialStats,
}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((ref) => _buildNotifier(authState)),
      grievancesListProvider.overrideWith((ref) => Future.value(initialGrievances ?? _emptyGrievances)),
      grievanceStatsProvider.overrideWith((ref) => Future.value(initialStats ?? _fakeStats)),
    ],
    child: MaterialApp(
      home: GrievancesScreen(
        initialGrievances: initialGrievances,
        initialStats: initialStats,
      ),
    ),
  );
}

void main() {
  group('GrievancesScreen Widget Tests', () {
    testWidgets('shows Access Denied when user has no permissions', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _noPermAuthState(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
        find.text('You do not have permission to view grievances.'),
        findsOneWidget,
      );
    });

    testWidgets('renders screen title and whistleblower banner when authorized', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _adminAuthState(),
          initialGrievances: _sampleGrievances,
          initialStats: _fakeStats,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Grievances & Whistleblower'), findsOneWidget);
      expect(find.text('Strict Zero-Retaliation Protection'), findsOneWidget);
    });

    testWidgets('renders KPI summary and grievance cards', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _adminAuthState(),
          initialGrievances: _sampleGrievances,
          initialStats: _fakeStats,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Total Cases'), findsOneWidget);
      expect(find.text('GRV-202610-1001'), findsOneWidget);
      expect(find.text('Hostile conduct in meeting'), findsOneWidget);
    });
  });
}
