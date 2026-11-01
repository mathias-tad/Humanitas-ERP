import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/main.dart';

class _FakeAuthRepository implements AuthRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _TestAuthNotifier extends AuthNotifier {
  _TestAuthNotifier(AuthState initial) : super(_FakeAuthRepository()) {
    state = initial;
  }

  @override
  Future<void> checkAuthStatus() async {
    // No-op in test to prevent unhandled platform channel / network errors
  }
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  testWidgets('App renders splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authProvider.overrideWith(
            (ref) => _TestAuthNotifier(AuthState(status: AuthStatus.initial)),
          ),
        ],
        child: const HumanitasApp(),
      ),
    );
    expect(find.text('HUMANITAS'), findsOneWidget);

    // Advance timer so splash animation and pending delays settle cleanly
    await tester.pump(const Duration(milliseconds: 1500));
    expect(find.text('HUMANITAS'), findsOneWidget);
  });
}
