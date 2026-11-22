import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import '../repositories/products_repository.dart';
import '../widgets/products_common.dart';
import '../widgets/product_variants_prices.dart';
import 'product_form_screen.dart';

/// One product: details with e-invoicing readiness, and its full change history (featureslist §30).
class ProductDetailScreen extends ConsumerWidget {
  final String productId;

  const ProductDetailScreen({super.key, required this.productId});

  Future<void> _toggleArchive(BuildContext context, WidgetRef ref, Product p) async {
    final archiving = p.isActive;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(archiving ? 'Archive product?' : 'Restore product?'),
        content: Text(archiving
            ? '"${p.name}" will be hidden from lists and scanners. Its history is kept and you can restore it later.'
            : '"${p.name}" will appear in lists and scanners again.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: Text(archiving ? 'Archive' : 'Restore')),
        ],
      ),
    );
    if (ok != true) return;
    final repo = ref.read(productsRepositoryProvider);
    try {
      if (archiving) {
        await repo.archiveProduct(p.id);
      } else {
        await repo.restoreProduct(p.id);
      }
      invalidateProducts(ref);
      if (!context.mounted) return;
      showProductsSnack(context, archiving ? 'Product archived' : 'Product restored');
    } on ProductsApiException catch (e) {
      if (!context.mounted) return;
      showProductsSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final productAsync = ref.watch(productDetailProvider(productId));
    final product = productAsync.asData?.value;

    final showVariants = product != null && product.hasVariants;
    final showPrices = product != null && auth.hasPermission('view_price_lists');
    final tabs = <Tab>[
      const Tab(text: 'Details'),
      if (showVariants) const Tab(text: 'Variants'),
      if (showPrices) const Tab(text: 'Prices'),
      const Tab(text: 'History'),
    ];

    return DefaultTabController(
      key: ValueKey(tabs.length),
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: Text(product?.name ?? 'Product'),
          actions: [
            if (product != null && auth.hasPermission('edit_products'))
              IconButton(
                tooltip: 'Edit',
                icon: const Icon(Icons.edit_outlined),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<Product>(builder: (_) => ProductFormScreen(product: product)),
                ),
              ),
            if (product != null &&
                (product.isActive ? auth.hasPermission('delete_products') : auth.hasPermission('restore_products')))
              IconButton(
                tooltip: product.isActive ? 'Archive' : 'Restore',
                icon: Icon(product.isActive ? Icons.archive_outlined : Icons.unarchive_outlined),
                onPressed: () => _toggleArchive(context, ref, product),
              ),
          ],
          bottom: TabBar(isScrollable: tabs.length > 3, tabs: tabs),
        ),
        body: productAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ProductsErrorView(error: e, onRetry: () => ref.invalidate(productDetailProvider(productId))),
          data: (p) => TabBarView(
            children: [
              _ProductDetails(product: p),
              if (showVariants) ProductVariantsView(product: p),
              if (showPrices) ProductPricesView(productId: p.id),
              ProductTimelineView(productId: p.id),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductDetails extends StatelessWidget {
  final Product product;

  const _ProductDetails({required this.product});

  @override
  Widget build(BuildContext context) {
    final p = product;
    final money = NumberFormat('#,##0.00');
    final excise = p.exciseRate == null
        ? '${formatNumber(p.effectiveExciseRate)}% (from category)'
        : '${formatNumber(p.exciseRate!)}%';
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (!p.isActive)
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text('This product is archived: hidden from lists and scanners.'),
          ),
        EimsReadinessBanner(product: p),
        if (p.isVariant) _Row('Variant of', [p.parentName ?? '—', if (p.variantLabel != null) p.variantLabel!].join(' · ')),
        if (p.hasVariants) _Row('Variants', '${p.variantCount} (see the Variants tab)'),
        _Row('Item code', p.itemCode),
        _Row('SKU', p.sku ?? '—'),
        _Row('Type', p.typeLabel),
        _Row('Category', p.categoryName ?? '—'),
        _Row('Unit', p.uomMorCode == null ? p.unitLabel : '${p.unitLabel} · MoR ${p.uomMorCode}'),
        _Row('Sales price', money.format(p.salesPrice)),
        _Row('Cost', money.format(p.costPrice)),
        _Row('Tax', kEimsTaxCodeLabels[p.taxCode] ?? p.taxCode),
        _Row('Excise', excise),
        _Row('Supply type', p.natureOfSupply == 'service' ? 'Service' : 'Goods'),
        _Row('HS code', p.harmonizationCode ?? '—'),
        _Row('Invoice description', p.invoiceDescription ?? 'Same as the name'),
        _Row('Can be sold', p.canBeSold ? 'Yes' : 'No'),
        _Row('Can be purchased', p.canBePurchased ? 'Yes' : 'No'),
        const ProductsSectionTitle('Barcodes', icon: Icons.qr_code_2),
        if (p.barcodes.isEmpty) const Text('No barcodes'),
        for (final b in p.barcodes)
          ListTile(
            contentPadding: EdgeInsets.zero,
            dense: true,
            leading: Icon(b.isPrimary ? Icons.star : Icons.qr_code),
            title: Text(b.barcode),
            subtitle: Text([
              if (b.packaging != null && b.packaging!.isNotEmpty) b.packaging!,
              'Qty ${formatNumber(b.quantity)}',
              if (b.isPrimary) 'Primary',
            ].join(' · ')),
          ),
        if (p.description != null && p.description!.isNotEmpty) ...[
          const ProductsSectionTitle('Description'),
          Text(p.description!),
        ],
      ],
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;

  const _Row(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(label, style: const TextStyle(color: AppColors.textSecondaryLight)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }
}

/// Read-only history of a product, newest first, loaded page by page.
class ProductTimelineView extends ConsumerStatefulWidget {
  final String productId;

  const ProductTimelineView({super.key, required this.productId});

  @override
  ConsumerState<ProductTimelineView> createState() => _ProductTimelineViewState();
}

class _ProductTimelineViewState extends ConsumerState<ProductTimelineView> {
  final List<TimelineEvent> _events = [];
  String? _cursor;
  bool _loading = false;
  bool _done = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_loading || _done) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref.read(productsRepositoryProvider).productTimeline(widget.productId, before: _cursor);
      if (!mounted) return;
      setState(() {
        _events.addAll(page.events);
        _cursor = page.nextCursor;
        _done = page.nextCursor == null;
        _loading = false;
      });
    } on ProductsApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_events.isEmpty && _error != null) {
      return ProductsErrorView(error: _error!, onRetry: _load);
    }
    if (_events.isEmpty && _loading) return const Center(child: CircularProgressIndicator());
    if (_events.isEmpty) return const Center(child: Text('No history yet'));
    final when = DateFormat('d MMM y, HH:mm');
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _events.length + 1,
      itemBuilder: (context, i) {
        if (i == _events.length) {
          if (_done) return const SizedBox(height: 24);
          return Center(
            child: TextButton(onPressed: _loading ? null : _load, child: Text(_loading ? 'Loading…' : 'Load older')),
          );
        }
        final e = _events[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(e.summary ?? e.eventType, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(
                  [
                    e.createdByName ?? 'System',
                    if (e.occurredAt != null) when.format(e.occurredAt!),
                    e.clientLabel,
                  ].join(' · '),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                ),
                if (e.eventType != 'created')
                  for (final c in e.changes)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        '${c.label}: ${formatTimelineValue(c.oldValue)} → ${formatTimelineValue(c.newValue)}',
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
              ],
            ),
          ),
        );
      },
    );
  }
}
