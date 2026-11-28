import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../../products/widgets/barcode_capture_screen.dart';
import '../../products/widgets/products_common.dart' show ProductsErrorView;
import '../models/stocktake_models.dart';
import '../providers/stocktake_providers.dart';

/// Counting one stocktake: scan a location, then scan the products in it (each scan counts one;
/// a lot or serial number counts that lot), or type a quantity. Scanning keeps the camera open
/// until you go back. On a blind count the expected quantities stay hidden.
class CountScreen extends ConsumerStatefulWidget {
  final String countId;

  const CountScreen({super.key, required this.countId});

  @override
  ConsumerState<CountScreen> createState() => _CountScreenState();
}

class _CountScreenState extends ConsumerState<CountScreen> {
  String? _locationId;
  String? _locationCode;
  String? _filter;
  bool _busy = false;

  CountLinesQuery get _query => CountLinesQuery(widget.countId, locationId: _locationId, filter: _filter);

  void _refresh() {
    ref.invalidate(countLinesProvider(_query));
    ref.invalidate(stocktakeProvider(widget.countId));
  }

  void _snack(String message, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), backgroundColor: error ? AppColors.error : null));
  }

  /// Opens the camera again after every scan, until the person goes back.
  Future<void> _scanLoop() async {
    for (;;) {
      if (!mounted) return;
      final code = await Navigator.of(context).push<String>(
        MaterialPageRoute(builder: (_) => BarcodeCaptureScreen(title: _locationCode == null ? 'Scan the location' : 'Scan products in $_locationCode')),
      );
      if (code == null || !mounted) return;
      final ok = await _count(code);
      if (!ok) return;
    }
  }

  Future<bool> _count(String code) async {
    setState(() => _busy = true);
    try {
      final r = await ref.read(stocktakeRepositoryProvider).scan(widget.countId, code, locationId: _locationId);
      if (!mounted) return false;
      if (r.isLocation) {
        setState(() {
          _locationId = r.locationId;
          _locationCode = r.locationCode;
        });
        _snack('Counting in ${r.locationCode}');
      } else if (r.line != null) {
        final l = r.line!;
        _snack('${l.productName}${l.lotName != null ? ' · ${l.lotName}' : ''}: ${qtyText(l.counted)}');
      }
      _refresh();
      return true;
    } catch (e) {
      if (mounted) _snack(e.toString(), error: true);
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _typeCode() async {
    final controller = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter a code'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Location, barcode, SKU or serial'),
          onSubmitted: (v) => Navigator.pop(ctx, v),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('Count')),
        ],
      ),
    );
    controller.dispose();
    if (!mounted || code == null || code.trim().isEmpty) return;
    await _count(code.trim());
  }

  Future<void> _edit(CountLine line) async {
    final controller = TextEditingController(text: line.counted == null ? '' : qtyText(line.counted));
    final value = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(line.productName),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text([line.locationCode, line.lotName].whereType<String>().join(' · ')),
            if (line.expected != null) Text('Expected: ${qtyText(line.expected)}', style: const TextStyle(color: AppColors.textSecondaryLight)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Counted', hintText: 'Empty = not counted', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('Save')),
        ],
      ),
    );
    controller.dispose();
    if (value == null || !mounted) return;
    final text = value.trim();
    final qty = text.isEmpty ? null : double.tryParse(text.replaceAll(',', ''));
    if (text.isNotEmpty && (qty == null || qty < 0)) {
      _snack('A count is a number of 0 or more', error: true);
      return;
    }
    try {
      await ref.read(stocktakeRepositoryProvider).setCounted(widget.countId, line.id, qty);
      _refresh();
    } catch (e) {
      if (mounted) _snack(e.toString(), error: true);
    }
  }

  Future<void> _submit() async {
    try {
      await ref.read(stocktakeRepositoryProvider).submit(widget.countId);
      _refresh();
      ref.invalidate(openStocktakesProvider);
      if (mounted) _snack('Sent for review');
    } catch (e) {
      if (mounted) _snack(e.toString(), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final countAsync = ref.watch(stocktakeProvider(widget.countId));
    final count = countAsync.asData?.value;
    final canCount = count != null && count.isOpenForCounting && auth.hasPermission('count_stocktakes');
    final lines = ref.watch(countLinesProvider(_query));
    return Scaffold(
      appBar: AppBar(
        title: Text(count?.name ?? 'Stocktake'),
        actions: [
          if (canCount) IconButton(tooltip: 'Type a code', icon: const Icon(Icons.keyboard_outlined), onPressed: _busy ? null : _typeCode),
          if (count != null && count.state == 'counting' && auth.hasPermission('count_stocktakes'))
            TextButton(onPressed: _submit, child: const Text('Done')),
        ],
      ),
      floatingActionButton: canCount
          ? FloatingActionButton.extended(
              onPressed: _busy ? null : _scanLoop,
              icon: const Icon(Icons.qr_code_scanner),
              label: Text(_locationCode == null ? 'Scan location' : 'Scan in $_locationCode'),
            )
          : null,
      body: Column(
        children: [
          if (count != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text([count.where, count.stateLabel, if (count.expectedHidden) 'blind'].where((s) => s.isNotEmpty).join(' · ')),
                  const SizedBox(height: 6),
                  LinearProgressIndicator(value: count.progress, minHeight: 6),
                  const SizedBox(height: 4),
                  Text(count.progressLabel, style: const TextStyle(color: AppColors.textSecondaryLight)),
                ],
              ),
            ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(children: [
              if (_locationCode != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: InputChip(
                    avatar: const Icon(Icons.place_outlined, size: 18),
                    label: Text(_locationCode!),
                    onDeleted: () => setState(() {
                      _locationId = null;
                      _locationCode = null;
                    }),
                  ),
                ),
              for (final f in [(null, 'All'), ('uncounted', 'Not counted'), if (count?.expectedHidden == false) ('variance', 'Differences')])
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ChoiceChip(label: Text(f.$2), selected: _filter == f.$1, onSelected: (_) => setState(() => _filter = f.$1)),
                ),
            ]),
          ),
          if (_busy) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => _refresh(),
              child: lines.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [ProductsErrorView(error: e, onRetry: _refresh)]),
                data: (page) {
                  if (page.items.isEmpty) {
                    return ListView(children: [
                      const SizedBox(height: 60),
                      Center(child: Text(_locationCode == null ? 'Scan a location to start counting.' : 'Nothing here yet: scan the products.')),
                    ]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.only(bottom: 96),
                    itemCount: page.items.length + (page.hasMore ? 1 : 0),
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      if (i == page.items.length) {
                        return Padding(
                          padding: const EdgeInsets.all(12),
                          child: Center(child: Text('Showing ${page.items.length} of ${page.total}; narrow it with a location or a filter')),
                        );
                      }
                      final l = page.items[i];
                      final diff = varianceText(l.variance);
                      return ListTile(
                        leading: Icon(l.isCounted ? Icons.check_circle : Icons.radio_button_unchecked, color: l.isCounted ? AppColors.success : AppColors.textSecondaryLight),
                        title: Text(l.productName, overflow: TextOverflow.ellipsis),
                        subtitle: Text([
                          if (l.locationCode != null) l.locationCode!,
                          if (l.lotName != null) l.lotName!,
                          if (l.sku != null) l.sku!,
                          if (l.expected != null) 'expected ${qtyText(l.expected)}',
                          if (l.isUnexpected) 'found here',
                        ].join(' · ')),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(qtyText(l.counted), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            if (diff.isNotEmpty && diff != '0')
                              Text(diff, style: TextStyle(color: (l.variance ?? 0) < 0 ? AppColors.error : AppColors.success, fontSize: 12)),
                          ],
                        ),
                        onTap: canCount ? () => _edit(l) : null,
                      );
                    },
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
