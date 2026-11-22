import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import 'products_common.dart';

/// Packaging levels and kit / combo contents on the product's Details tab (set up in the web app).
class ProductStructureSection extends ConsumerWidget {
  final Product product;

  const ProductStructureSection({super.key, required this.product});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = product;
    final money = NumberFormat('#,##0.00');
    String qty(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (p.packagings.isNotEmpty) ...[
          const ProductsSectionTitle('Packaging', icon: Icons.inventory_2_outlined),
          for (final k in p.packagings)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              leading: const Icon(Icons.all_inbox_outlined),
              title: Text('${k.name} · ${qty(k.quantity)} ${p.unitLabel}'),
              subtitle: Text([
                k.levelLabel,
                if (k.gtin != null) 'GTIN ${k.gtin}',
                if (!k.canSell) 'not sold',
                if (!k.canBuy) 'not bought',
              ].join(' · ')),
            ),
        ],
        if (p.composition != 'single')
          ref.watch(productCompositionProvider(p.id)).when(
                loading: () => const Padding(padding: EdgeInsets.all(12), child: LinearProgressIndicator()),
                error: (e, _) => Text(e.toString(), style: const TextStyle(color: AppColors.error)),
                data: (c) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ProductsSectionTitle(c.isKit ? 'Kit contents' : 'Combo choices', icon: Icons.widgets_outlined),
                    if (c.isKit) ...[
                      for (final k in c.components)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          title: Text('${qty(k.quantity)} × ${k.name}${k.isActive ? '' : ' (archived)'}'),
                          trailing: Text(money.format(k.salesPrice * k.quantity)),
                        ),
                      Text(
                        'Components ${money.format(c.componentsPrice)} · kit ${money.format(c.salesPrice)}'
                        '${c.kitSaving > 0 ? ' · saves ${money.format(c.kitSaving)}' : ''}',
                        style: const TextStyle(color: AppColors.textSecondaryLight),
                      ),
                    ],
                    if (c.isCombo)
                      for (final g in c.groups) ...[
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text('${g.name} · ${g.ruleText}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                        for (final ch in g.choices)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            leading: Icon(ch.isDefault ? Icons.check_circle : Icons.circle_outlined, size: 18),
                            title: Text(ch.name),
                            trailing: Text(ch.extraPrice > 0 ? '+${money.format(ch.extraPrice)}' : ''),
                          ),
                      ],
                  ],
                ),
              ),
      ],
    );
  }
}
