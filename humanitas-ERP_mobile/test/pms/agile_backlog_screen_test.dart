import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/project_model.dart';
import 'package:humanitas_erp_mobile/core/models/task_model.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/pms/models/pms_agile_model.dart';
import 'package:humanitas_erp_mobile/features/pms/providers/pms_provider.dart';
import 'package:humanitas_erp_mobile/features/pms/screens/agile_backlog_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

final _sampleProjects = <ProjectModel>[
  ProjectModel(
    id: 'p1',
    name: 'Apollo ERP Core',
    status: 'active',
    visibility: 'public',
  ),
  ProjectModel(
    id: 'p2',
    name: 'Project Confidential',
    status: 'active',
    visibility: 'private',
  ),
];

final _sampleSprints = <SprintModel>[
  const SprintModel(
    id: 'sp-1',
    projectId: 'p1',
    name: 'Sprint 1 - Foundations',
    goal: 'Build core architecture',
    status: 'active',
    totalPoints: 20,
    completedPoints: 12,
  ),
];

final _sampleBacklog = <TaskModel>[
  TaskModel(
    id: 't1',
    title: 'Multi-entity tenant isolation',
    status: 'todo',
    priority: 'high',
    storyPoints: 8,
    isMilestone: true,
    backlogOrder: 1,
  ),
  TaskModel(
    id: 't2',
    title: 'TanStack Query cache sync',
    status: 'in_progress',
    priority: 'medium',
    storyPoints: 5,
    isMilestone: false,
    backlogOrder: 2,
  ),
];

const _sampleVelocity = SprintVelocityModel(
  averageVelocity: 16.5,
  sprints: [],
);

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
      pmsSprintsProvider('p1').overrideWith((_) async => _sampleSprints),
      pmsVelocityProvider('p1').overrideWith((_) async => _sampleVelocity),
      pmsBacklogProvider('p1').overrideWith((_) async => _sampleBacklog),
    ];

void main() {
  testWidgets('AgileBacklogScreen: shows permission denied for unauthorized role', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _noPermOverrides(),
        child: const MaterialApp(
          home: AgileBacklogScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Access Restricted'), findsOneWidget);
    expect(find.byIcon(Icons.lock_outline), findsOneWidget);
  });

  testWidgets('AgileBacklogScreen: renders tabs, projects, and sprint details for authorized user', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _adminOverrides(),
        child: const MaterialApp(
          home: AgileBacklogScreen(initialProjectId: 'p1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Verify Title & Tabs
    expect(find.text('Agile Sprints & Backlog'), findsOneWidget);
    expect(find.text('Sprints'), findsOneWidget);
    expect(find.text('Backlog'), findsOneWidget);

    // Verify Active Sprint Content
    expect(find.text('Sprint 1 - Foundations'), findsOneWidget);
    expect(find.text('Sprint Velocity'), findsOneWidget);
    expect(find.text('16.5 pts / sprint'), findsOneWidget);
  });

  testWidgets('AgileBacklogScreen: switches to Backlog tab and renders tasks with story points & milestone', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: _adminOverrides(),
        child: const MaterialApp(
          home: AgileBacklogScreen(initialProjectId: 'p1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Tap the Backlog tab
    await tester.tap(find.text('Backlog'));
    await tester.pumpAndSettle();

    // Verify tasks rendered
    expect(find.text('Multi-entity tenant isolation'), findsOneWidget);
    expect(find.text('8 pts'), findsOneWidget);
    expect(find.text('TanStack Query cache sync'), findsOneWidget);
    expect(find.text('5 pts'), findsOneWidget);

    // Verify milestone diamond badge 'M'
    expect(find.text('M'), findsOneWidget);
  });
}
