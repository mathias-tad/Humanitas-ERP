import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:humanitas_erp_mobile/features/messaging/widgets/direct_chat_access_dialog.dart';

void main() {
  testWidgets('DirectChatAccessDialog renders target user, triage prompt, and buttons', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: DirectChatAccessDialog(
              targetUserId: 'hr-123',
              targetUserName: 'Sarah HR Manager',
              targetUserRole: 'hr_manager',
              triagePrompt: 'Please review company policy documents with AI assistant before reaching out directly.',
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Protected Direct Chat'), findsOneWidget);
    expect(find.textContaining('Sarah HR Manager'), findsOneWidget);
    expect(find.textContaining('Please review company policy documents'), findsOneWidget);
    expect(find.text('Ask AI Assistant First'), findsOneWidget);
    expect(find.text('Request Direct Chat Access'), findsOneWidget);
  });

  testWidgets('DirectChatAccessDialog displays pending status when pending request is provided', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: DirectChatAccessDialog(
              targetUserId: 'hr-123',
              targetUserName: 'Sarah HR Manager',
              targetUserRole: 'hr_manager',
              pendingRequest: {
                'id': 'grant-1',
                'status': 'pending',
                'reason': 'Confidential contract clarification',
              },
            ),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Request Pending Review'), findsOneWidget);
    expect(find.textContaining('awaiting review by Sarah HR Manager'), findsOneWidget);
  });
}
