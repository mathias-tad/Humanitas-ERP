import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/scanner/barcode_check.dart';
import '../../../core/scanner/scanner_settings.dart';

/// Opens the camera and pops with the first barcode or QR code it reads (null if the user goes back).
class BarcodeCaptureScreen extends ConsumerStatefulWidget {
  final String title;

  const BarcodeCaptureScreen({super.key, this.title = 'Scan a barcode'});

  @override
  ConsumerState<BarcodeCaptureScreen> createState() => _BarcodeCaptureScreenState();
}

class _BarcodeCaptureScreenState extends ConsumerState<BarcodeCaptureScreen> {
  // Camera chosen in Scanner settings.
  late final MobileScannerController _controller = MobileScannerController(
    facing: ref.read(scannerSettingsProvider).useFrontCamera ? CameraFacing.front : CameraFacing.back,
    formats: const [
      BarcodeFormat.ean13,
      BarcodeFormat.ean8,
      BarcodeFormat.upcA,
      BarcodeFormat.upcE,
      BarcodeFormat.code128,
      BarcodeFormat.code39,
      BarcodeFormat.itf,
      BarcodeFormat.qrCode,
    ],
  );
  // A blurry frame can decode to a wrong code: accept it only with a valid check digit,
  // read the same way twice in a row.
  final ReadConfirmer _confirmer = ReadConfirmer();
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_done) return;
    String? code;
    for (final b in capture.barcodes) {
      final value = b.rawValue?.trim();
      if (value != null && isPlausibleRead(value, b.format.name)) {
        code = value;
        break;
      }
    }
    if (code == null || _confirmer.push(code) == null) return;
    _done = true;
    Navigator.of(context).pop(code);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Center(
            child: Container(
              width: 260,
              height: 160,
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.primary, width: 3),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const Positioned(
            left: 16,
            right: 16,
            bottom: 32,
            child: Text(
              'Hold the barcode flat and steady inside the box. It is read automatically.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
