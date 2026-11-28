import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../../products/widgets/products_common.dart' show ProductsErrorView;
import '../models/stocktake_models.dart';
import '../providers/stocktake_providers.dart';
import 'count_screen.dart';

/// Stocktakes being counted or in review (Home -> Quick Actions -> Count). Counts are planned and
/// posted on the web; the app is where people walk the shelves and scan.
class StocktakesScreen extends ConsumerWidget {
  const StocktakesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    if (!auth.isModuleSubscribed('inventory') || !auth.hasPermission('view_stocktakes')) {
      return Scaffold(appBar: AppBar(title: const Text('Count stock')), body: const Center(child: Text('Access denied')));
    }
    final list = ref.watch(openStocktakesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Count stock')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(openStocktakesProvider),
        child: list.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [ProductsErrorView(error: e, onRetry: () => ref.invalidate(openStocktakesProvider))]),
          data: (counts) {
            if (counts.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 32),
                  child: Text('No stocktake is being counted. A manager plans and starts counts in the web app (Inventory -> Stocktakes).',
                      textAlign: TextAlign.center),
                ),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.only(bottom: 32),
              itemCount: counts.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final c = counts[i];
                return ListTile(
                  leading: const Icon(Icons.fact_check_outlined),
                  title: Text('${c.name} · ${countTypeLabel[c.countType] ?? c.countType}'),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text([c.where, c.progressLabel, if (c.isBlind) 'blind'].where((s) => s.isNotEmpty).join(' · ')),
                      const SizedBox(height: 4),
                      LinearProgressIndicator(value: c.progress, minHeight: 4),
                    ],
                  ),
                  trailing: Text(c.stateLabel, style: const TextStyle(color: AppColors.textSecondaryLight)),
                  onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => CountScreen(countId: c.id))),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
