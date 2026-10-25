import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/documents/models/document_model.dart';
import 'package:humanitas_erp_mobile/features/documents/providers/documents_provider.dart';
import 'package:humanitas_erp_mobile/features/documents/screens/document_vault_screen.dart';

// ── Fake models ────────────────────────────────────────────────────────────────

const _emptyDocs = <EmployeeDocumentModel>[];

const _emptySummary = ExpiringDocumentsSummaryModel(
  expiredCount: 0,
  expiring30Days: 0,
  expiring60Days: 0,
  expiring90Days: 0,
  totalActiveTracked: 0,
  upcomingExpiringDocuments: [],
);

final _adminUser = UserModel(
  id: 'u1',
  email: 'admin@example.com',
  role: 'admin',
);

// ── Auth state helpers ─────────────────────────────────────────────────────────

/// Admin role → DocumentVaultScreen grants full access.
AuthState _adminAuthState() => AuthState(
      status: AuthStatus.authenticated,
      user: _adminUser,
      permissions: const [],
    );

/// No user + no permissions → permission denied.
AuthState _noPermAuthState() => AuthState(
      status: AuthStatus.authenticated,
      permissions: const [],
    );

// Extension to inject state without triggering real auth calls.
extension on AuthNotifier {
  void hackState(AuthState s) => state = s;
}

/// Build an AuthNotifier that is safe to construct in tests.
/// ApiClient and SecureStorageService constructors don't call platform channels.
AuthNotifier _buildNotifier(AuthState initialState) {
  final storage = SecureStorageService();
  final apiClient = ApiClient(storage);
  final repo = AuthRepository(apiClient, storage);
  return AuthNotifier(repo)..hackState(initialState);
}

// ── Provider override helpers ──────────────────────────────────────────────────

List<Override> _nopermOverrides() => [
      documentsListProvider.overrideWith((_) async => _emptyDocs),
      expiringSummaryProvider.overrideWith((_) async => _emptySummary),
      authProvider.overrideWith((ref) => _buildNotifier(_noPermAuthState())),
    ];

List<Override> _adminOverrides() => [
      documentsListProvider.overrideWith((_) async => _emptyDocs),
      expiringSummaryProvider.overrideWith((_) async => _emptySummary),
      authProvider.overrideWith((ref) => _buildNotifier(_adminAuthState())),
    ];

// ── Widget builder ─────────────────────────────────────────────────────────────

Widget _buildApp({
  required List<Override> overrides,
  List<EmployeeDocumentModel>? initialDocuments,
  ExpiringDocumentsSummaryModel? initialExpiring,
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: DocumentVaultScreen(
        initialDocuments: initialDocuments,
        initialExpiring: initialExpiring,
      ),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

void main() {
  group('DocumentVaultScreen', () {
    // ── Test 1: Permission denied ──────────────────────────────────────────────

    testWidgets(
        'shows Access Denied when user has no permissions and no elevated role',
        (tester) async {
      await tester.pumpWidget(_buildApp(overrides: _nopermOverrides()));
      await tester.pump();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
        find.text(
            'You do not have permission to view employee documents.'),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    // ── Test 2: Admin sees the Document Vault screen ───────────────────────────

    testWidgets('shows Document Vault title when user has admin role',
        (tester) async {
      // Pre-load data via constructor to avoid async settling.
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(),
        initialDocuments: _emptyDocs,
        initialExpiring: _emptySummary,
      ));

      await tester.pump();

      expect(find.text('Document Vault'), findsOneWidget);
      expect(find.text('Access Denied'), findsNothing);
    });

    // ── Test 3: Tab switching ──────────────────────────────────────────────────

    testWidgets('tab switching between Documents and Expirations works',
        (tester) async {
      await tester.pumpWidget(_buildApp(
        overrides: _adminOverrides(),
        initialDocuments: _emptyDocs,
        initialExpiring: _emptySummary,
      ));

      await tester.pump();

      // Tab 0 (Documents) selected by default — empty-state is visible.
      expect(find.text('No Documents Found'), findsOneWidget);
      expect(find.text('All Credentials Compliant'), findsNothing);

      // Tap the Expirations tab.
      await tester.tap(find.text('Expirations (0)'));
      await tester.pumpAndSettle();

      // Expirations empty state is now visible.
      expect(find.text('All Credentials Compliant'), findsOneWidget);
      expect(find.text('No Documents Found'), findsNothing);

      // Switch back to the Documents tab.
      await tester.tap(find.text('Documents (0)'));
      await tester.pumpAndSettle();

      expect(find.text('No Documents Found'), findsOneWidget);
      expect(find.text('All Credentials Compliant'), findsNothing);
    });
  });
}
