import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/project_model.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/pms/models/pms_agile_model.dart';
import 'package:humanitas_erp_mobile/features/pms/providers/pms_provider.dart';
import 'package:humanitas_erp_mobile/features/pms/screens/project_timeline_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

final _sampleProjects = <ProjectModel>[
  ProjectModel(
    id: 'p1',
    name: 'ERP Cloud Platform',
    status: 'active',
    visibility: 'public',
  ),
];

final _sampleGantt = <GanttTaskModel>[
  const GanttTaskModel(
    id: 'g1',
    title: 'DB Schema Migrations',
    status: 'Done',
    priority: 'High',
    startDate: '2026-10-01',
    dueDate: '2026-10-10',
    progress: 100,
    isMilestone: false,
    storyPoints: 5,
  ),
  const GanttTaskModel(
    id: 'g2',
    title: 'Beta Release Milestone',
    status: 'In Progress',
    priority: 'Critical',
    startDate: '2026-10-15',
    dueDate: '2026-10-15',
    progress: 50,
    isMilestone: true,
  ),
];

final _sampleCalendar = <ProjectCalendarEventModel>[
  const ProjectCalendarEventModel(
    id: 'e1',
    title: 'Sprint 1 Review',
    type: 'sprint',
    start: '2026-10-12',
  ),
  const ProjectCalendarEventModel(
    id: 'e2',
    title: 'Q4 Delivery Checkpoint',
    type: 'milestone',
    start: '2026-10-25',
    isMilestone: true,
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

// ── Provider overrides ────────────────────────────────────────────────────────

List<Override> _noPermOverrides() => [
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

List<Override> _adminOverrides() => [
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
      pmsProjectsProvider.overrideWith((_) async => _sampleProjects),
      pmsGanttProvider('p1').overrideWith((_) async => _sampleGantt),
      pmsCalendarProvider('p1').overrideWith((_) async => _sampleCalendar),
    ];

void main() {
  testWidgets('ProjectTimelineScreen: shows restricted access for unauthorized users', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _noPermOverrides(),
        child: const MaterialApp(
          home: ProjectTimelineScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Access Restricted'), findsOneWidget);
  });

  testWidgets('ProjectTimelineScreen: renders Gantt tasks with progress and milestone badges', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _adminOverrides(),
        child: const MaterialApp(
          home: ProjectTimelineScreen(initialProjectId: 'p1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Project Timeline & Calendar'), findsOneWidget);
    expect(find.text('Gantt Timeline'), findsOneWidget);
    expect(find.text('Calendar'), findsOneWidget);

    // Verify Gantt tasks
    expect(find.text('DB Schema Migrations'), findsOneWidget);
    expect(find.text('Beta Release Milestone'), findsOneWidget);
    expect(find.text('5 pts'), findsOneWidget);
    expect(find.text('M'), findsOneWidget); // Milestone badge
  });

  testWidgets('ProjectTimelineScreen: switches to Calendar view and displays deadlines', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _adminOverrides(),
        child: const MaterialApp(
          home: ProjectTimelineScreen(initialProjectId: 'p1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Tap Calendar tab
    await tester.tap(find.text('Calendar'));
    await tester.pumpAndSettle();

    expect(find.text('Sprint 1 Review'), findsOneWidget);
    expect(find.text('Q4 Delivery Checkpoint'), findsOneWidget);
    expect(find.text('SPRINT'), findsOneWidget);
    expect(find.text('MILESTONE'), findsOneWidget);
  });
}
