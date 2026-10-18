import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/features/users/models/user_model.dart';
import 'package:humanitas_erp_mobile/features/users/providers/users_provider.dart';
import 'package:humanitas_erp_mobile/features/users/screens/users_screen.dart';

void main() {
  group('UsersScreen', () {
    Widget buildSubject({
      AsyncValue<List<UserModel>> usersValue = const AsyncValue.loading(),
    }) {
      return ProviderScope(
        overrides: [
          usersProvider.overrideWith((ref) async {
            if (usersValue is AsyncData) {
              return (usersValue as AsyncData<List<UserModel>>).value;
            }
            if (usersValue is AsyncError) {
              throw (usersValue as AsyncError).error;
            }
            return Completer<List<UserModel>>().future;
          }),
        ],
        child: const MaterialApp(home: UsersScreen()),
      );
    }

    testWidgets('shows loading state initially', (tester) async {
      await tester.pumpWidget(buildSubject());
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows empty state when no users found', (tester) async {
      await tester.pumpWidget(buildSubject(
        usersValue: const AsyncData([]),
      ));
      await tester.pumpAndSettle();
      expect(find.text('No employees found'), findsOneWidget);
    });

    testWidgets('renders user cards with name, department and role', (tester) async {
      final users = [
        const UserModel(
          id: 'u1',
          displayName: 'John Smith',
          email: 'john@example.com',
          position: 'Lead Engineer',
          department: 'Engineering',
          role: 'employee',
          isActive: true,
        ),
      ];

      await tester.pumpWidget(buildSubject(
        usersValue: AsyncData(users),
      ));
      await tester.pumpAndSettle();

      expect(find.text('John Smith'), findsOneWidget);
      expect(find.text('Lead Engineer · Engineering'), findsOneWidget);
    });
  });
}
