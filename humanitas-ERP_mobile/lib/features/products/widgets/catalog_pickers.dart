import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import '../repositories/products_repository.dart';
import 'products_common.dart';

/// Result of the category picker: a category, or "no category" when [category] is null.
class CategoryChoice {
  final ProductCategory? category;

  const CategoryChoice(this.category);
}

/// Search categories and, with `create_product_categories`, create a missing one on the spot
/// without leaving the product form (featureslist §29).
Future<CategoryChoice?> showCategoryPicker(BuildContext context) {
  return showModalBottomSheet<CategoryChoice>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _CategoryPickerSheet(),
  );
}

class _CategoryPickerSheet extends ConsumerStatefulWidget {
  const _CategoryPickerSheet();

  @override
  ConsumerState<_CategoryPickerSheet> createState() => _CategoryPickerSheetState();
}

class _CategoryPickerSheetState extends ConsumerState<_CategoryPickerSheet> {
  String _text = '';
  bool _creating = false;

  Future<void> _create(String name) async {
    setState(() => _creating = true);
    try {
      final created = await ref.read(productsRepositoryProvider).createCategory({'name': name});
      ref.invalidate(productCategoriesProvider);
      if (!mounted) return;
      Navigator.of(context).pop(CategoryChoice(created));
    } on ProductsApiException catch (e) {
      if (!mounted) return;
      setState(() => _creating = false);
      showProductsSnack(context, e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final canCreate = auth.hasPermission('create_product_categories');
    final categories = ref.watch(productCategoriesProvider);
    final term = _text.trim().toLowerCase();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: TextField(
                autofocus: true,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search or type a new category',
                  border: OutlineInputBorder(),
                ),
                onChanged: (v) => setState(() => _text = v),
              ),
            ),
            Expanded(
              child: categories.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ProductsErrorView(error: e, onRetry: () => ref.invalidate(productCategoriesProvider)),
                data: (all) {
                  final matches = all.where((c) => term.isEmpty || c.fullPath.toLowerCase().contains(term)).toList();
                  final exact = all.any((c) => c.name.toLowerCase() == term || c.fullPath.toLowerCase() == term);
                  final typed = _text.trim();
                  return ListView(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.block),
                        title: const Text('No category'),
                        onTap: () => Navigator.of(context).pop(const CategoryChoice(null)),
                      ),
                      for (final c in matches)
                        ListTile(
                          leading: const Icon(Icons.folder_outlined),
                          title: Text(c.fullPath),
                          onTap: () => Navigator.of(context).pop(CategoryChoice(c)),
                        ),
                      if (typed.isNotEmpty && !exact && canCreate)
                        ListTile(
                          leading: _creating
                              ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.add_circle_outline),
                          title: Text('Create "$typed"'),
                          onTap: _creating ? null : () => _create(typed),
                        ),
                      if (typed.isNotEmpty && !exact && !canCreate)
                        const ListTile(
                          leading: Icon(Icons.info_outline),
                          title: Text("You can't create a new category."),
                          subtitle: Text('Ask someone with "create_product_categories".'),
                        ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pick a unit, optionally only from the same kind as [sameKindAs] (purchase unit must match the sales unit).
Future<Uom?> showUnitPicker(BuildContext context, List<UomCategory> groups, {String? sameKindAs}) {
  final visible = sameKindAs == null
      ? groups
      : groups.where((g) => g.units.any((u) => u.id == sameKindAs)).toList();
  return showModalBottomSheet<Uom>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (ctx) => SizedBox(
      height: MediaQuery.of(ctx).size.height * 0.7,
      child: ListView(
        children: [
          for (final g in visible) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Text(g.name, style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
            for (final u in g.units.where((u) => u.isActive))
              ListTile(
                title: Text(u.label),
                subtitle: Text(u.morCode == null ? 'No MoR unit code' : 'MoR code ${u.morCode}'),
                onTap: () => Navigator.of(ctx).pop(u),
              ),
          ],
        ],
      ),
    ),
  );
}

/// Pick a MoR line tax code.
Future<String?> showTaxCodePicker(BuildContext context, String current) {
  return showModalBottomSheet<String>(
    context: context,
    useSafeArea: true,
    builder: (ctx) => ListView(
      shrinkWrap: true,
      children: [
        for (final code in kEimsTaxCodes)
          ListTile(
            title: Text(kEimsTaxCodeLabels[code] ?? code),
            subtitle: Text(code),
            trailing: code == current ? const Icon(Icons.check) : null,
            onTap: () => Navigator.of(ctx).pop(code),
          ),
      ],
    ),
  );
}
