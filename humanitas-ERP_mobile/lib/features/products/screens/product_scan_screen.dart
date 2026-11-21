import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import '../repositories/products_repository.dart';
import '../widgets/products_common.dart';
import 'product_detail_screen.dart';
import 'product_form_screen.dart';

/// Scan (or type) a barcode, item code or SKU and open the matching product.
/// When nothing matches, users with `create_products` can create a product with that barcode.
class ProductScanScreen extends ConsumerStatefulWidget {
  const ProductScanScreen({super.key});

  @override
  ConsumerState<ProductScanScreen> createState() => _ProductScanScreenState();
}

class _ProductScanScreenState extends ConsumerState<ProductScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  final _manualController = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    _manualController.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_busy || capture.barcodes.isEmpty) return;
    final code = capture.barcodes.first.rawValue;
    if (code == null || code.trim().isEmpty) return;
    await _find(code.trim());
  }

  Future<void> _find(String code) async {
    setState(() => _busy = true);
    _controller.stop();
    try {
      final product = await ref.read(productsRepositoryProvider).lookup(code);
      if (!mounted) return;
      if (product != null) {
        await Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(builder: (_) => ProductDetailScreen(productId: product.id)),
        );
        return;
      }
      await _notFound(code);
    } on ProductsApiException catch (e) {
      if (!mounted) return;
      showProductsSnack(context, e.message, error: true);
    }
    if (!mounted) return;
    setState(() => _busy = false);
    _controller.start();
  }

  Future<void> _notFound(String code) async {
    final canCreate = ref.read(authProvider).hasPermission('create_products');
    final create = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('No product found'),
        content: Text(canCreate
            ? 'No active product has the code "$code". Create one with this barcode?'
            : 'No active product has the code "$code".'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Scan again')),
          if (canCreate) FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('Create product')),
        ],
      ),
    );
    if (create != true || !mounted) return;
    final created = await Navigator.of(context).push<Product>(
      MaterialPageRoute(builder: (_) => ProductFormScreen(initialBarcode: code)),
    );
    if (created == null || !mounted) return;
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => ProductDetailScreen(productId: created.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan a product')),
      body: Column(
        children: [
          Expanded(
            child: Stack(
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
                if (_busy)
                  const Positioned.fill(
                    child: ColoredBox(
                      color: Colors.black54,
                      child: Center(child: CircularProgressIndicator(color: AppColors.primary)),
                    ),
                  ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: _manualController,
                enabled: !_busy,
                decoration: InputDecoration(
                  labelText: 'Or type a barcode, item code or SKU',
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    tooltip: 'Find',
                    icon: const Icon(Icons.search),
                    onPressed: () {
                      final code = _manualController.text.trim();
                      if (code.isNotEmpty) _find(code);
                    },
                  ),
                ),
                onSubmitted: (v) {
                  if (v.trim().isNotEmpty) _find(v.trim());
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
