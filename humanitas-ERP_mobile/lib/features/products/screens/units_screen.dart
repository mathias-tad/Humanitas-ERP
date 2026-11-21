import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import '../repositories/products_repository.dart';
import '../widgets/products_common.dart';

/// Units of measure grouped by kind, with their MoR unit codes. Products → menu → Units of measure.
/// Users with `edit_uoms` tap a unit to set the code e-invoices send for it (AGENTS.md rule 28).
class UnitsScreen extends ConsumerWidget {
  const UnitsScreen({super.key});

  Future<void> _pickMorCode(BuildContext context, WidgetRef ref, Uom unit) async {
    List<MorUnitCode> codes;
    try {
      codes = await ref.read(productsRepositoryProvider).morUnitCodes();
    } on ProductsApiException catch (e) {
      if (!context.mounted) return;
      showProductsSnack(context, e.message, error: true);
      return;
    }
    if (!context.mounted) return;
    // '' = remove the code; null = sheet dismissed.
    final picked = await showModalBottomSheet<String>(
      context: context,
      useSafeArea: true,
      builder: (ctx) => ListView(
        shrinkWrap: true,
        children: [
          ListTile(
            title: Text('MoR unit code for ${unit.name}', style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          ListTile(
            leading: const Icon(Icons.block),
            title: const Text('No MoR code'),
            onTap: () => Navigator.of(ctx).pop(''),
          ),
          for (final c in codes)
            ListTile(
              leading: const Icon(Icons.tag),
              title: Text('${c.code} · ${c.name}'),
              trailing: c.code == unit.morCode ? const Icon(Icons.check) : null,
              onTap: () => Navigator.of(ctx).pop(c.code),
            ),
        ],
      ),
    );
    if (picked == null) return;
    try {
      await ref.read(productsRepositoryProvider).setUnitMorCode(unit.id, picked.isEmpty ? null : picked);
      ref.invalidate(uomCategoriesProvider);
      ref.invalidate(productListProvider);
      if (!context.mounted) return;
      showProductsSnack(
        context,
        picked.isEmpty ? 'MoR code removed from ${unit.name}' : '${unit.name} sends $picked on e-invoices',
      );
    } on ProductsApiException catch (e) {
      if (!context.mounted) return;
      showProductsSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    if (!auth.hasPermission('view_uoms')) {
      return const ProductsAccessDenied(title: 'Units of measure', message: 'You need the "view_uoms" permission.');
    }
    final canEdit = auth.hasPermission('edit_uoms');
    final groups = ref.watch(uomCategoriesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Units of measure')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(uomCategoriesProvider.future),
        child: groups.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            children: [ProductsErrorView(error: e, onRetry: () => ref.invalidate(uomCategoriesProvider))],
          ),
          data: (cats) => ListView(
            padding: const EdgeInsets.only(bottom: 32),
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Text(
                  'Units used on e-invoices need a MoR unit code. To add units, use the web app.',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                ),
              ),
              for (final cat in cats) ...[
                ProductsSectionTitleInset(cat.name),
                for (final u in cat.units.where((u) => u.isActive))
                  ListTile(
                    title: Text(u.label),
                    subtitle: Text(ratioText(u, cat.reference)),
                    trailing: u.morCode == null
                        ? const Text('no MoR code', style: TextStyle(fontSize: 12, color: AppColors.warning))
                        : Chip(label: Text(u.morCode!), visualDensity: VisualDensity.compact),
                    onTap: canEdit ? () => _pickMorCode(context, ref, u) : null,
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Section title with list padding.
class ProductsSectionTitleInset extends StatelessWidget {
  final String text;

  const ProductsSectionTitleInset(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: ProductsSectionTitle(text, icon: Icons.straighten),
    );
  }
}
