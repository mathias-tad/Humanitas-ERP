import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:humanitas_erp_mobile/features/messaging/screens/direct_chat_requests_screen.dart';

void main() {
  testWidgets('DirectChatRequestsScreen renders self-override, whitelist section, and requests', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DirectChatRequestsScreen(
          initialAllowOverride: false,
          initialActiveGrants: [
            {
              'id': 'grant-101',
              'employee': {
                'id': 'emp-1',
                'fullName': 'John Developer',
                'role': 'developer',
              },
              'expiresAt': null, // Permanent
            },
          ],
          initialRequests: [
            {
              'id': 'grant-102',
              'status': 'pending',
              'requester': {
                'id': 'emp-2',
                'fullName': 'Alice Designer',
                'role': 'ui_designer',
              },
              'reason': 'Need feedback on direct chat mockups',
            },
          ],
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Chat Access & Permissions'), findsOneWidget);
    expect(find.text('Direct Chat Self-Override'), findsOneWidget);
    expect(find.text('Expose to Specific Employee'), findsOneWidget);
    expect(find.textContaining('Currently Whitelisted Employees (1)'), findsOneWidget);
    expect(find.text('John Developer'), findsOneWidget);
    expect(find.text('Permanent Access'), findsOneWidget);
    expect(find.textContaining('Pending Access Requests (1)'), findsOneWidget);
    expect(find.text('Alice Designer'), findsOneWidget);
    expect(find.text('"Need feedback on direct chat mockups"'), findsOneWidget);
    expect(find.text('Approve'), findsOneWidget);
    expect(find.text('Decline'), findsOneWidget);
  });
}
