import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import '../screens/product_detail_screen.dart';
import 'products_common.dart';

final _money = NumberFormat('#,##0.00');

/// Variants tab of a product with variants: each variant with its values, SKU and price.
/// Attributes and the variant matrix are set up in the web app (Products -> Attributes & Variants).
class ProductVariantsView extends ConsumerWidget {
  final Product product;

  const ProductVariantsView({super.key, required this.product});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final variants = ref.watch(productVariantsProvider(product.id));
    return RefreshIndicator(
      onRefresh: () => ref.refresh(productVariantsProvider(product.id).future),
      child: variants.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(
          children: [ProductsErrorView(error: e, onRetry: () => ref.invalidate(productVariantsProvider(product.id)))],
        ),
        data: (list) => ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Text(
                'Each variant is sold and scanned as its own product. Attributes and variants are set up in the web app.',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
              ),
            ),
            if (list.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No variants yet.')),
            for (final v in list) ...[
              ListTile(
                title: Text(v.variantLabel ?? v.name),
                subtitle: Text([
                  v.itemCode,
                  if (v.sku != null && v.sku != v.itemCode) v.sku!,
                  if (v.primaryBarcode != null) v.primaryBarcode!,
                  if (!v.isActive) 'Archived',
                ].join(' · ')),
                trailing: Text(_money.format(v.salesPrice), style: const TextStyle(fontWeight: FontWeight.w600)),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => ProductDetailScreen(productId: v.id)),
                ),
              ),
              const Divider(height: 1),
            ],
          ],
        ),
      ),
    );
  }
}

/// Prices tab: the price on every active price list at a quantity (quantity breaks), and whether a
/// rule or the sales price set it. Price lists are set up in the web app (Products -> Price Lists).
class ProductPricesView extends ConsumerStatefulWidget {
  final String productId;

  const ProductPricesView({super.key, required this.productId});

  @override
  ConsumerState<ProductPricesView> createState() => _ProductPricesViewState();
}

class _ProductPricesViewState extends ConsumerState<ProductPricesView> {
  double _quantity = 1;
  final _qty = TextEditingController(text: '1');

  @override
  void dispose() {
    _qty.dispose();
    super.dispose();
  }

  void _setQuantity(String text) {
    final q = double.tryParse(text.trim().replaceAll(',', '.'));
    if (q != null && q >= 0 && q != _quantity) setState(() => _quantity = q);
  }

  @override
  Widget build(BuildContext context) {
    final key = (widget.productId, _quantity);
    final prices = ref.watch(productPricesProvider(key));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            const Expanded(child: Text('Price at quantity')),
            SizedBox(
              width: 100,
              child: TextField(
                controller: _qty,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                textAlign: TextAlign.end,
                decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
                onSubmitted: _setQuantity,
                onChanged: _setQuantity,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        prices.when(
          loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
          error: (e, _) => ProductsErrorView(error: e, onRetry: () => ref.invalidate(productPricesProvider(key))),
          data: (p) {
            if (p.lists.isEmpty) return const Text('No active price lists.');
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final row in p.rows) ...[
                  if (p.rows.length > 1) ProductsSectionTitle(row.name),
                  for (final list in p.lists)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      title: Text(list.isDefault ? '${list.name} (default)' : list.name),
                      subtitle: Text(row.prices[list.id]?.fromRule == true ? 'Price list rule' : 'Sales price'),
                      trailing: Text(
                        row.prices[list.id] == null ? '—' : '${_money.format(row.prices[list.id]!.price)} ${list.currency}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  Text('Sales price: ${_money.format(row.basePrice)}',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
                  const SizedBox(height: 8),
                ],
                const SizedBox(height: 8),
                const Text(
                  'Price lists and their rules are set up in the web app (Products -> Price Lists).',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}
