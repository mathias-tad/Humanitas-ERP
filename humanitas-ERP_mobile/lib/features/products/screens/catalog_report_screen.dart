import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../providers/products_providers.dart';
import '../widgets/products_common.dart';

/// Catalog report (web: Product Reports): totals, completeness, gaps to fix and the lowest margins.
class CatalogReportScreen extends ConsumerWidget {
  const CatalogReportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportAsync = ref.watch(catalogReportProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Catalog report')),
      body: reportAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ProductsErrorView(error: e, onRetry: () => ref.invalidate(catalogReportProvider)),
        data: (r) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(catalogReportProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _Tile('Products', '${r.products}', '${r.variants} variants'),
                  _Tile('Sold items', '${r.sellable}', 'products and variants'),
                  _Tile('Kits / combos', '${r.kits} / ${r.combos}', ''),
                  _Tile('Complete', '${r.completeness}%', 'with no gap'),
                  _Tile('Average margin', r.avgMargin == null ? '—' : '${r.avgMargin}%', ''),
                  _Tile('Archived', '${r.archived}', ''),
                ],
              ),
              const ProductsSectionTitle('Gaps to fix', icon: Icons.rule),
              for (final i in r.issues)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: Icon(i.count == 0 ? Icons.check_circle_outline : Icons.warning_amber_rounded,
                      color: i.count == 0 ? AppColors.success : AppColors.warning),
                  title: Text(i.label),
                  trailing: Text('${i.count}', style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              const Text('Open Product Reports in the web app to fix them from the list.',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
              if (r.lowestMargins.isNotEmpty) ...[
                const ProductsSectionTitle('Lowest margins', icon: Icons.trending_down),
                for (final m in r.lowestMargins)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: Text(m.name),
                    trailing: Text('${m.margin.toStringAsFixed(1)}%',
                        style: TextStyle(color: m.margin < 0 ? AppColors.error : null, fontWeight: FontWeight.w600)),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final String label;
  final String value;
  final String hint;

  const _Tile(this.label, this.value, this.hint);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
              const SizedBox(height: 4),
              Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              if (hint.isNotEmpty) Text(hint, style: const TextStyle(fontSize: 11, color: AppColors.textSecondaryLight)),
            ],
          ),
        ),
      ),
    );
  }
}
