import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/import_export/models/import_export_model.dart';
import 'package:humanitas_erp_mobile/features/import_export/providers/import_export_provider.dart';
import 'package:humanitas_erp_mobile/features/import_export/screens/import_export_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

const _emptyJobs = <ImportExportJobModel>[];
const _emptyTemplates = <ExportTemplateModel>[];

const _fakeStats = ImportExportStatsModel(
  totalImports: 14,
  totalExports: 8,
  totalRowsProcessed: 3200,
  successRatePct: 95,
  activeSchedules: 4,
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
      importExportJobsProvider.overrideWith((_) async => _emptyJobs),
      exportTemplatesProvider.overrideWith((_) async => _emptyTemplates),
      importExportStatsProvider.overrideWith((_) async => _fakeStats),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

List<Override> _adminOverrides() => [
      importExportJobsProvider.overrideWith((_) async => _emptyJobs),
      exportTemplatesProvider.overrideWith((_) async => _emptyTemplates),
      importExportStatsProvider.overrideWith((_) async => _fakeStats),
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
}) {
  return ProviderScope(
    overrides: overrides,
    child: const MaterialApp(
      home: ImportExportScreen(),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('ImportExportScreen', () {
    testWidgets('shows Access Denied when user lacks permissions',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _nopermOverrides()));
      await tester.pumpAndSettle();

      expect(
          find.text('You do not have permission to view bulk import/export.'),
          findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('renders title and KPI tiles when user is admin',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _adminOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('Import / Export Engine'), findsOneWidget);
      expect(find.text('Imports'), findsOneWidget);
      expect(find.text('Exports'), findsOneWidget);
      expect(find.text('Rows'), findsOneWidget);
      expect(find.text('Success'), findsOneWidget);
    });

    testWidgets('renders tabs when user is admin', (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _adminOverrides()));
      await tester.pumpAndSettle();

      expect(find.text('Audit Log'), findsOneWidget);
      expect(find.text('Export Recipes'), findsOneWidget);
    });
  });
}
