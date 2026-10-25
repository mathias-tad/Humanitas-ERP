import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/models/user_model.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/approvals/models/approval_model.dart';
import 'package:humanitas_erp_mobile/features/approvals/providers/approval_provider.dart';
import 'package:humanitas_erp_mobile/features/approvals/screens/approvals_screen.dart';

final _samplePendingRequest = ApprovalRequestModel(
  id: 'req-1',
  workflowType: 'purchase_order',
  entityType: 'purchase_order',
  referenceNumber: 'PO-2026-001',
  title: 'Hardware Equipment Upgrade',
  amount: 4500.00,
  currency: 'USD',
  submitterName: 'Alice Smith',
  submitterEmail: 'alice@example.com',
  department: 'Engineering',
  currentStepOrder: 1,
  totalSteps: 2,
  status: 'pending',
  createdAt: DateTime(2026, 10, 20, 10, 30),
);

final _sampleApprovedRequest = ApprovalRequestModel(
  id: 'req-2',
  workflowType: 'expense',
  entityType: 'expense_report',
  referenceNumber: 'EXP-2026-042',
  title: 'Client Dinner & Travel Reimbursement',
  amount: 320.50,
  currency: 'USD',
  submitterName: 'Alice Smith',
  submitterEmail: 'alice@example.com',
  department: 'Engineering',
  currentStepOrder: 2,
  totalSteps: 2,
  status: 'approved',
  createdAt: DateTime(2026, 10, 18, 14, 0),
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

AuthState _adminAuthState() => AuthState(
      status: AuthStatus.authenticated,
      user: _adminUser,
      permissions: const ['approve_requests', 'view_approval_requests'],
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

Widget _buildTestWidget({
  required AuthState authState,
  List<ApprovalRequestModel>? initialPendingRequests,
  List<ApprovalRequestModel>? initialMyRequests,
  List<ApprovalRequestModel>? initialHistoryRequests,
  int? initialPendingCount,
}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith((ref) => _buildNotifier(authState)),
      pendingApprovalsProvider.overrideWith(
        (ref) => Future.value(initialPendingRequests ?? [_samplePendingRequest]),
      ),
      mySubmittedApprovalsProvider.overrideWith(
        (ref) => Future.value(initialMyRequests ?? [_sampleApprovedRequest]),
      ),
      allApprovalsHistoryProvider.overrideWith(
        (ref) => Future.value(initialHistoryRequests ?? [_sampleApprovedRequest]),
      ),
      myPendingApprovalsCountProvider.overrideWith(
        (ref) => Future.value(initialPendingCount ?? 1),
      ),
    ],
    child: MaterialApp(
      home: ApprovalsScreen(
        initialPendingRequests: initialPendingRequests,
        initialMyRequests: initialMyRequests,
        initialHistoryRequests: initialHistoryRequests,
        initialPendingCount: initialPendingCount,
      ),
    ),
  );
}

void main() {
  group('ApprovalsScreen Widget Tests', () {
    testWidgets('Test 1: Permission denied view for unauthorized user', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(authState: _noPermAuthState()),
      );
      await tester.pumpAndSettle();

      expect(find.text('Access Denied'), findsOneWidget);
      expect(
        find.text('You do not have permission to view or manage approvals.'),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    });

    testWidgets('Test 2: Authorized user renders "Approval Center" and tab bar', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _adminAuthState(),
          initialPendingRequests: [_samplePendingRequest],
          initialMyRequests: [_sampleApprovedRequest],
          initialHistoryRequests: [_sampleApprovedRequest],
          initialPendingCount: 1,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Approval Center'), findsOneWidget);
      expect(find.text('Pending Review'), findsOneWidget);
      expect(find.text('My Requests'), findsOneWidget);
      expect(find.text('History'), findsOneWidget);
    });

    testWidgets('Test 3: Pending approval card renders with Approve & Reject action buttons', (tester) async {
      await tester.pumpWidget(
        _buildTestWidget(
          authState: _adminAuthState(),
          initialPendingRequests: [_samplePendingRequest],
          initialPendingCount: 1,
        ),
      );
      await tester.pumpAndSettle();

      // Verify card content
      expect(find.text('PO-2026-001'), findsOneWidget);
      expect(find.text('Hardware Equipment Upgrade'), findsOneWidget);
      expect(find.text('\$4500.00'), findsOneWidget);
      expect(find.text('Alice Smith • Engineering'), findsOneWidget);

      // Verify direct action buttons
      expect(find.text('Approve'), findsOneWidget);
      expect(find.text('Reject'), findsOneWidget);
      expect(find.byIcon(Icons.check), findsOneWidget);
      expect(find.byIcon(Icons.close), findsOneWidget);
    });
  });
}
