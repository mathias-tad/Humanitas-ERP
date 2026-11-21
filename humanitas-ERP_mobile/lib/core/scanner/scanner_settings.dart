import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Barcode scanning preferences for this phone or tablet (saved on the device).
class ScannerSettings {
  /// Scan with the front camera (counter stands, tablets facing the customer).
  final bool useFrontCamera;

  /// A paired Bluetooth/USB scanner is used: the Products search stays ready for the next scan.
  final bool hardwareScannerMode;

  const ScannerSettings({this.useFrontCamera = false, this.hardwareScannerMode = false});

  ScannerSettings copyWith({bool? useFrontCamera, bool? hardwareScannerMode}) => ScannerSettings(
        useFrontCamera: useFrontCamera ?? this.useFrontCamera,
        hardwareScannerMode: hardwareScannerMode ?? this.hardwareScannerMode,
      );
}

class ScannerSettingsNotifier extends StateNotifier<ScannerSettings> {
  static const _frontKey = 'scanner.front_camera';
  static const _hardwareKey = 'scanner.hardware_mode';

  ScannerSettingsNotifier() : super(const ScannerSettings()) {
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      state = ScannerSettings(
        useFrontCamera: prefs.getBool(_frontKey) ?? false,
        hardwareScannerMode: prefs.getBool(_hardwareKey) ?? false,
      );
    } catch (_) {
      // No device storage (tests): keep the defaults.
    }
  }

  Future<void> update(ScannerSettings next) async {
    state = next;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_frontKey, next.useFrontCamera);
      await prefs.setBool(_hardwareKey, next.hardwareScannerMode);
    } catch (_) {
      // Not saved, but the setting still applies until the app restarts.
    }
  }
}

final scannerSettingsProvider = StateNotifierProvider<ScannerSettingsNotifier, ScannerSettings>(
  (ref) => ScannerSettingsNotifier(),
);
