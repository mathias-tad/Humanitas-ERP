import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:humanitas_erp_mobile/main.dart';

void main() {
  testWidgets('App renders splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: HumanitasApp()));
    expect(find.text('HUMANITAS'), findsOneWidget);

    // Advance timer so splash animation and pending delays settle cleanly
    await tester.pump(const Duration(milliseconds: 1500));
  });
}
