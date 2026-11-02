import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:humanitas_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_mobile/main.dart';

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

/// Returns a 1×1 transparent PNG as bytes so Image.asset never throws in tests.
Future<Uint8List> _transparentPng() async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawColor(Colors.transparent, BlendMode.src);
  final picture = recorder.endRecording();
  final img = await picture.toImage(1, 1);
  final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
  return byteData!.buffer.asUint8List();
}

void main() {
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;

    // Provide a fake 1×1 PNG for every asset path so Image.asset doesn't throw.
    final fakeImageBytes = await _transparentPng();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', (ByteData? message) async {
      return fakeImageBytes.buffer.asByteData();
    });
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
