import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/scanner/scanner_settings.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import '../repositories/products_repository.dart';
import '../widgets/products_common.dart';
import 'product_categories_screen.dart';
import 'catalog_report_screen.dart';
import 'product_detail_screen.dart';
import 'product_form_screen.dart';
import 'product_scan_screen.dart';
import 'scanner_settings_screen.dart';
import 'units_screen.dart';

/// Products catalog on mobile: search, filter, scan, open and create products.
/// Opened from Home → Quick Actions → Products.
class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key});

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  ProductQuery _query = const ProductQuery();
  Timer? _debounce;
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _onSearch(String text) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = _query.copyWith(q: text, limit: 25));
    });
  }

  /// A Bluetooth scanner (or typing a code and pressing search) opens the matching product directly.
  /// Text that is not a code simply stays as the search.
  Future<void> _onSearchSubmitted(String text) async {
    final code = text.trim();
    if (code.isEmpty) return;
    try {
      final product = await ref.read(productsRepositoryProvider).lookup(code);
      if (product == null || !mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => ProductDetailScreen(productId: product.id)),
      );
      // Scanner mode: clear the search and wait for the next scan.
      if (mounted && ref.read(scannerSettingsProvider).hardwareScannerMode) {
        _searchController.clear();
        setState(() => _query = _query.copyWith(q: '', limit: 25));
        _searchFocus.requestFocus();
      }
    } on ProductsApiException {
      // Not reachable right now: the typed text still filters the list.
    }
  }

  Future<void> _openCreate({String? name}) async {
    final created = await Navigator.of(context).push<Product>(
      MaterialPageRoute(builder: (_) => ProductFormScreen(initialName: name)),
    );
    if (created == null || !mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => ProductDetailScreen(productId: created.id)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    if (!auth.isModuleSubscribed('products') || !auth.hasPermission('view_products')) {
      return const ProductsAccessDenied(
        title: 'Products',
        message: 'You need the Products module and the "view_products" permission to see the catalog.',
      );
    }
    final canCreate = auth.hasPermission('create_products');
    final listAsync = ref.watch(productPagesProvider(_query));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Products'),
        actions: [
          IconButton(
            tooltip: 'Scan a barcode',
            icon: const Icon(Icons.qr_code_scanner_rounded),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const ProductScanScreen()),
            ),
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              final Widget screen = switch (v) {
                'categories' => const ProductCategoriesScreen(),
                'units' => const UnitsScreen(),
                'report' => const CatalogReportScreen(),
                _ => const ScannerSettingsScreen(),
              };
              Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
            },
            itemBuilder: (_) => [
              if (auth.hasPermission('view_product_categories'))
                const PopupMenuItem(value: 'categories', child: Text('Categories')),
              if (auth.hasPermission('view_uoms')) const PopupMenuItem(value: 'units', child: Text('Units of measure')),
              if (auth.hasPermission('view_product_reports'))
                const PopupMenuItem(value: 'report', child: Text('Catalog report')),
              const PopupMenuItem(value: 'scanner', child: Text('Scanner settings')),
            ],
          ),
        ],
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: () => _openCreate(),
              icon: const Icon(Icons.add),
              label: const Text('New product'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _searchController,
              focusNode: _searchFocus,
              autofocus: ref.watch(scannerSettingsProvider).hardwareScannerMode,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search or scan: name, item code, SKU or barcode',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              textInputAction: TextInputAction.search,
              onChanged: _onSearch,
              onSubmitted: _onSearchSubmitted,
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                for (final s in const [('active', 'Active'), ('archived', 'Archived'), ('all', 'All')])
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(s.$2),
                      selected: _query.status == s.$1,
                      onSelected: (_) => setState(() => _query = _query.copyWith(status: s.$1, limit: 25)),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: FilterChip(
                    label: const Text('Needs e-invoicing fix'),
                    selected: _query.eims == 'not_ready',
                    onSelected: (on) => setState(
                      () => _query = on ? _query.copyWith(eims: 'not_ready', limit: 25) : _query.copyWith(clearEims: true, limit: 25),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(productPagesProvider(_query).notifier).refresh(),
              child: listAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(
                  children: [ProductsErrorView(error: e, onRetry: () => ref.invalidate(productPagesProvider(_query)))],
                ),
                data: (page) => _ProductList(
                  page: page,
                  query: _query,
                  canCreate: canCreate,
                  onLoadMore: () => ref.read(productPagesProvider(_query).notifier).loadMore(),
                  onCreate: (name) => _openCreate(name: name),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Loads the next page as soon as the end of the list comes into view (AGENTS.md rule 24 item 21).
class _AutoLoadMore extends StatefulWidget {
  final VoidCallback onLoadMore;
  final int loaded;
  final int total;

  const _AutoLoadMore({required this.onLoadMore, required this.loaded, required this.total});

  @override
  State<_AutoLoadMore> createState() => _AutoLoadMoreState();
}

class _AutoLoadMoreState extends State<_AutoLoadMore> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onLoadMore();
    });
  }

  @override
  Widget build(BuildContext context) {
    return TextButton.icon(
      onPressed: widget.onLoadMore,
      icon: const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
      label: Text('Loading more (${widget.loaded} of ${widget.total})…'),
    );
  }
}

class _ProductList extends ConsumerWidget {
  final ProductPage page;
  final ProductQuery query;
  final bool canCreate;
  final VoidCallback onLoadMore;
  final ValueChanged<String?> onCreate;

  const _ProductList({
    required this.page,
    required this.query,
    required this.canCreate,
    required this.onLoadMore,
    required this.onCreate,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (page.items.isEmpty) {
      final q = query.q.trim();
      return ListView(
        children: [
          const SizedBox(height: 80),
          const Icon(Icons.inventory_2_outlined, size: 48, color: AppColors.textSecondaryLight),
          const SizedBox(height: 12),
          Center(child: Text(q.isEmpty ? 'No products here yet.' : 'No products match "$q".')),
          if (canCreate && query.status != 'archived')
            Padding(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: OutlinedButton.icon(
                  onPressed: () => onCreate(q.isEmpty ? null : q),
                  icon: const Icon(Icons.add),
                  label: Text(q.isEmpty ? 'Create the first product' : 'Create "$q"'),
                ),
              ),
            ),
        ],
      );
    }
    final money = NumberFormat('#,##0.00');
    final canLoadMore = page.hasMore;
    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 96),
      itemCount: page.items.length + 1,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) {
        if (i == page.items.length) {
          return Padding(
            padding: const EdgeInsets.all(12),
            child: Center(
              child: canLoadMore
                  ? _AutoLoadMore(onLoadMore: onLoadMore, loaded: page.items.length, total: page.total)
                  : Text('${page.total} product${page.total == 1 ? '' : 's'}',
                      style: const TextStyle(color: AppColors.textSecondaryLight)),
            ),
          );
        }
        final p = page.items[i];
        final thumb = ref.read(productsRepositoryProvider).mediaUrl(p.imageUrl);
        return ListTile(
          leading: thumb.isEmpty
              ? null
              : ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Image.network(thumb, width: 40, height: 40, fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const SizedBox(width: 40, height: 40)),
                ),
          title: Row(
            children: [
              Flexible(child: Text(p.name, overflow: TextOverflow.ellipsis)),
              if (!p.isActive)
                const Padding(
                  padding: EdgeInsets.only(left: 6),
                  child: Text('Archived', style: TextStyle(fontSize: 11, color: AppColors.textSecondaryLight)),
                ),
            ],
          ),
          subtitle: Text([
            if (p.variantLabel != null) p.variantLabel!,
            p.itemCode,
            if (p.sku != null && p.sku != p.itemCode) p.sku!,
            p.unitLabel,
            if (p.hasVariants) '${p.variantCount} variants',
            if (p.compositionLabel != null) p.compositionLabel!,
            if (p.isBelowCost) 'below cost',
          ].join(' · ')),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(money.format(p.salesPrice), style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(width: 8),
              Icon(
                p.eimsReady ? Icons.verified_rounded : Icons.warning_amber_rounded,
                size: 18,
                color: p.eimsReady ? AppColors.success : AppColors.warning,
                semanticLabel: p.eimsReady ? 'Ready for e-invoicing' : 'Not ready for e-invoicing',
              ),
            ],
          ),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => ProductDetailScreen(productId: p.id)),
          ),
        );
      },
    );
  }
}
