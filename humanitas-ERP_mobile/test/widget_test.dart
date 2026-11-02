import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

/// A minimal asset manifest encoded with StandardMessageCodec (empty map).
ByteData _emptyAssetManifest() {
  final codec = const StandardMessageCodec();
  return codec.encodeMessage(<String, dynamic>{})!;
}

/// Decodes the asset-key string from the raw ByteData Flutter sends on the
/// flutter/assets channel. Returns null if it cannot be decoded.
String? _decodeAssetKey(ByteData? message) {
  if (message == null) return null;
  try {
    return utf8.decode(message.buffer.asUint8List(
      message.offsetInBytes,
      message.lengthInBytes,
    ));
  } catch (_) {
    return null;
  }
}

void main() {
  late Uint8List fakeImageBytes;

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    GoogleFonts.config.allowRuntimeFetching = false;

    fakeImageBytes = await _transparentPng();

    // Intercept flutter/assets channel:
    //  • Asset manifest requests → return an empty manifest (no real assets)
    //  • Image asset requests     → return a fake 1×1 PNG
    //  • Everything else          → return null (font files / other → unavailable)
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', (ByteData? message) async {
      final key = _decodeAssetKey(message);

      if (key == null || key == 'AssetManifest.bin' || key == 'AssetManifest.json') {
        return _emptyAssetManifest();
      }

      final lk = key.toLowerCase();
      if (lk.endsWith('.png') ||
          lk.endsWith('.jpg') ||
          lk.endsWith('.jpeg') ||
          lk.endsWith('.webp') ||
          lk.endsWith('.gif')) {
        return fakeImageBytes.buffer.asByteData();
      }

      // Font files and other binary assets → null so google_fonts falls back.
      return null;
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

    await tester.pump();
    expect(find.text('HUMANITAS'), findsOneWidget);

    // Advance past the 800 ms splash delay and animation
    await tester.pump(const Duration(milliseconds: 1500));
    expect(find.text('HUMANITAS'), findsOneWidget);
  });
}
