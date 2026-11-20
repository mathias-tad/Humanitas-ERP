import 'package:flutter/foundation.dart';

/// App version sent to the API. Release builds pass it with
/// `--dart-define=APP_VERSION=<version from pubspec.yaml>`.
const String kAppVersion = String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0');

/// Identifies this app to the API so record history shows
/// "Mobile app · Android 1.0.0" instead of an unknown client (featureslist §30).
Map<String, String> clientHeaders({bool? isWeb, TargetPlatform? platform}) {
  final web = isWeb ?? kIsWeb;
  final target = platform ?? defaultTargetPlatform;
  final name = web
      ? 'web'
      : switch (target) {
          TargetPlatform.android => 'android',
          TargetPlatform.iOS => 'ios',
          TargetPlatform.windows => 'windows',
          TargetPlatform.macOS => 'macos',
          TargetPlatform.linux => 'linux',
          TargetPlatform.fuchsia => 'android',
        };
  return {'x-client-platform': name, 'x-app-version': kAppVersion};
}
