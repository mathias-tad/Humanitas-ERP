import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/features/payroll/screens/admin_payroll_screen.dart';

void main() {
  group('AdminPayrollScreen', () {
    testWidgets('renders screen title and action buttons', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: AdminPayrollScreen(initialRuns: []),
          ),
        ),
      );

      expect(find.text('Payroll Management'), findsOneWidget);
      expect(find.textContaining('Run Payroll'), findsOneWidget);
    });
  });
}
