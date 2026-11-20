import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:humanitas_erp_mobile/core/api/client_headers.dart';

void main() {
  test('mobile platforms identify themselves', () {
    expect(clientHeaders(isWeb: false, platform: TargetPlatform.android)['x-client-platform'], 'android');
    expect(clientHeaders(isWeb: false, platform: TargetPlatform.iOS)['x-client-platform'], 'ios');
  });

  test('desktop and web builds identify themselves', () {
    expect(clientHeaders(isWeb: false, platform: TargetPlatform.windows)['x-client-platform'], 'windows');
    expect(clientHeaders(isWeb: false, platform: TargetPlatform.macOS)['x-client-platform'], 'macos');
    expect(clientHeaders(isWeb: true, platform: TargetPlatform.android)['x-client-platform'], 'web');
  });

  test('always sends the app version', () {
    expect(clientHeaders(isWeb: false, platform: TargetPlatform.android)['x-app-version'], isNotEmpty);
  });
}
