import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:humanitas_erp_mobile/core/scanner/scanner_settings.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('loads the saved scanner settings and saves changes on the device', () async {
    SharedPreferences.setMockInitialValues({'scanner.front_camera': true});
    final notifier = ScannerSettingsNotifier();
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(notifier.state.useFrontCamera, isTrue);
    expect(notifier.state.hardwareScannerMode, isFalse);

    await notifier.update(notifier.state.copyWith(hardwareScannerMode: true));
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('scanner.hardware_mode'), isTrue);
    expect(prefs.getBool('scanner.front_camera'), isTrue);
    notifier.dispose();
  });

  test('defaults to the back camera and no hardware scanner', () {
    const s = ScannerSettings();
    expect(s.useFrontCamera, isFalse);
    expect(s.hardwareScannerMode, isFalse);
    expect(s.copyWith(useFrontCamera: true).useFrontCamera, isTrue);
  });
}
