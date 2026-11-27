import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../products/models/product_models.dart';
import '../../products/providers/products_providers.dart';
import '../../products/widgets/barcode_capture_screen.dart';
import '../../products/widgets/products_common.dart';
import '../models/stock_models.dart';
import '../providers/inventory_providers.dart';
import '../repositories/inventory_repository.dart';

/// Stock on hand (Inventory depends on Products, so it may use the product scanner, rule 30).
/// Search or scan a product, see where it is, and adjust a line with the reason.
class StockScreen extends ConsumerStatefulWidget {
  const StockScreen({super.key});

  @override
  ConsumerState<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends ConsumerState<StockScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  final List<StockLine> _lines = [];
  int _page = 1;
  int _total = 0;
  bool _loading = false;
  String? _error;
  String? _productId;
  String? _productName;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref.read(inventoryRepositoryProvider).stock(
            search: _search.text.trim(),
            productId: _productId,
            page: reset ? 1 : _page + 1,
          );
      if (!mounted) return;
      setState(() {
        if (reset) _lines.clear();
        _lines.addAll(page.lines);
        _page = page.page;
        _total = page.total;
      });
    } on InventoryApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _scan() async {
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const BarcodeCaptureScreen(title: "Scan a product's barcode")),
    );
    if (code == null || !mounted) return;
    final Product? product;
    try {
      product = await ref.read(productsRepositoryProvider).lookup(code);
    } catch (e) {
      if (mounted) showProductsSnack(context, e.toString(), error: true);
      return;
    }
    if (!mounted) return;
    if (product == null) {
      showProductsSnack(context, 'No product has the barcode $code', error: true);
      return;
    }
    final found = product;
    setState(() {
      _productId = found.id;
      _productName = found.name;
    });
    await _load(reset: true);
  }

  Future<void> _adjust(StockLine line) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AdjustSheet(line: line),
    );
    if (changed == true) await _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final canAdjust = ref.watch(authProvider).hasPermission('adjust_stock');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Stock on hand'),
        actions: [IconButton(tooltip: 'Scan a barcode', icon: const Icon(Icons.qr_code_scanner), onPressed: _scan)],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: TextField(
              controller: _search,
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Product, SKU, location or lot', border: OutlineInputBorder()),
              onChanged: (_) {
                _debounce?.cancel();
                _debounce = Timer(const Duration(milliseconds: 350), () => _load(reset: true));
              },
            ),
          ),
          if (_productName != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Align(
                alignment: Alignment.centerLeft,
                child: InputChip(
                  label: Text(_productName!),
                  onDeleted: () {
                    setState(() {
                      _productId = null;
                      _productName = null;
                    });
                    _load(reset: true);
                  },
                ),
              ),
            ),
          if (_error != null) Padding(padding: const EdgeInsets.all(12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _load(reset: true),
              child: ListView.builder(
                itemCount: _lines.length + 1,
                itemBuilder: (context, i) {
                  if (i == _lines.length) {
                    if (_loading) return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
                    if (_lines.isEmpty) return const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No stock here yet.')));
                    if (_lines.length < _total) {
                      return TextButton(onPressed: () => _load(), child: Text('Load more (${_lines.length} of $_total)'));
                    }
                    return Padding(padding: const EdgeInsets.all(12), child: Center(child: Text('Showing ${_lines.length} of $_total')));
                  }
                  final l = _lines[i];
                  return ListTile(
                    title: Text(l.productName),
                    subtitle: Text([l.warehouseName, l.locationCode, if (l.lotName != null) 'Lot ${l.lotName}'].whereType<String>().join(' · ')),
                    trailing: Text(qtyText(l.quantity), style: TextStyle(fontWeight: FontWeight.w600, color: l.quantity < 0 ? Colors.red : null)),
                    onTap: canAdjust ? () => _adjust(l) : null,
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdjustSheet extends ConsumerStatefulWidget {
  final StockLine line;
  const _AdjustSheet({required this.line});

  @override
  ConsumerState<_AdjustSheet> createState() => _AdjustSheetState();
}

class _AdjustSheetState extends ConsumerState<_AdjustSheet> {
  final _qty = TextEditingController();
  final _reason = TextEditingController();
  bool _remove = false;
  bool _saving = false;

  @override
  void dispose() {
    _qty.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final q = double.tryParse(_qty.text.replaceAll(',', '.'));
    if (q == null || q <= 0) {
      showProductsSnack(context, 'Enter how many', error: true);
      return;
    }
    if (_reason.text.trim().isEmpty) {
      showProductsSnack(context, 'Write the reason', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(inventoryRepositoryProvider).adjust(
            productId: widget.line.productId,
            locationId: widget.line.locationId,
            lotId: widget.line.lotId,
            quantity: _remove ? -q : q,
            reason: _reason.text.trim(),
          );
      if (!mounted) return;
      showProductsSnack(context, 'Stock adjusted');
      Navigator.of(context).pop(true);
    } on InventoryApiException catch (e) {
      if (mounted) showProductsSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.line;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Adjust ${l.productName}', style: Theme.of(context).textTheme.titleMedium),
          Text('${l.locationCode} · on hand ${qtyText(l.quantity)}'),
          const SizedBox(height: 12),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Add'), icon: Icon(Icons.add)),
              ButtonSegment(value: true, label: Text('Remove'), icon: Icon(Icons.remove)),
            ],
            selected: {_remove},
            onSelectionChanged: (s) => setState(() => _remove = s.first),
          ),
          const SizedBox(height: 12),
          TextField(controller: _qty, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Quantity', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: _reason, decoration: const InputDecoration(labelText: 'Reason (kept in the history)', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : 'Save')),
        ],
      ),
    );
  }
}
