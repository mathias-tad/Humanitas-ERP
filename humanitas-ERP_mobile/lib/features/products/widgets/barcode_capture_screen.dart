import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/constants/app_colors.dart';

/// Opens the camera and pops with the first barcode or QR code it reads (null if the user goes back).
class BarcodeCaptureScreen extends StatefulWidget {
  final String title;

  const BarcodeCaptureScreen({super.key, this.title = 'Scan a barcode'});

  @override
  State<BarcodeCaptureScreen> createState() => _BarcodeCaptureScreenState();
}

class _BarcodeCaptureScreenState extends State<BarcodeCaptureScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_done || capture.barcodes.isEmpty) return;
    final code = capture.barcodes.first.rawValue?.trim();
    if (code == null || code.isEmpty) return;
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
              'Point the camera at the barcode. It is read automatically.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
