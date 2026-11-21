import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/scanner/scanner_settings.dart';

/// Scanner settings for this device. Products → menu → Scanner settings.
class ScannerSettingsScreen extends ConsumerStatefulWidget {
  const ScannerSettingsScreen({super.key});

  @override
  ConsumerState<ScannerSettingsScreen> createState() => _ScannerSettingsScreenState();
}

class _ScannerSettingsScreenState extends ConsumerState<ScannerSettingsScreen> {
  final _testController = TextEditingController();
  String? _lastScan;

  @override
  void dispose() {
    _testController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(scannerSettingsProvider);
    final notifier = ref.read(scannerSettingsProvider.notifier);
    return Scaffold(
      appBar: AppBar(title: const Text('Scanner settings')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          SwitchListTile(
            title: const Text('Use the front camera'),
            subtitle: const Text('For a counter stand or a tablet facing the customer.'),
            value: settings.useFrontCamera,
            onChanged: (v) => notifier.update(settings.copyWith(useFrontCamera: v)),
          ),
          SwitchListTile(
            title: const Text('Bluetooth / USB scanner mode'),
            subtitle: const Text('Keeps the Products search ready, so every scan opens the product.'),
            value: settings.hardwareScannerMode,
            onChanged: (v) => notifier.update(settings.copyWith(hardwareScannerMode: v)),
          ),
          const ListTile(
            leading: Icon(Icons.bluetooth),
            title: Text('Connect a Bluetooth scanner'),
            subtitle: Text("Pair it in your phone's Bluetooth settings in keyboard (HID) mode, then test it below."),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _testController,
              decoration: const InputDecoration(
                labelText: 'Test your scanner',
                hintText: 'Tap here and scan a barcode',
                border: OutlineInputBorder(),
              ),
              onSubmitted: (v) {
                setState(() => _lastScan = v.trim());
                _testController.clear();
              },
            ),
          ),
          if (_lastScan != null && _lastScan!.isNotEmpty)
            ListTile(
              leading: const Icon(Icons.check_circle, color: AppColors.success),
              title: Text('Read: $_lastScan'),
              subtitle: const Text('Your scanner works with the app.'),
            ),
        ],
      ),
    );
  }
}
