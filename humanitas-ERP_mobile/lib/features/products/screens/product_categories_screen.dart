import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import '../repositories/products_repository.dart';
import '../widgets/products_common.dart';

/// Product category tree. Products → menu → Categories.
class ProductCategoriesScreen extends ConsumerWidget {
  const ProductCategoriesScreen({super.key});

  Future<void> _edit(BuildContext context, WidgetRef ref, {ProductCategory? category, ProductCategory? parent}) async {
    final auth = ref.read(authProvider);
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _CategorySheet(
        category: category,
        parent: parent,
        canArchive: category != null && auth.hasPermission('delete_product_categories'),
      ),
    );
    if (saved == true) invalidateProducts(ref);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    if (!auth.hasPermission('view_product_categories')) {
      return const ProductsAccessDenied(
        title: 'Categories',
        message: 'You need the "view_product_categories" permission.',
      );
    }
    final canCreate = auth.hasPermission('create_product_categories');
    final canEdit = auth.hasPermission('edit_product_categories');
    final categories = ref.watch(productCategoriesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Categories')),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: () => _edit(context, ref),
              icon: const Icon(Icons.create_new_folder_outlined),
              label: const Text('New category'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(productCategoriesProvider.future),
        child: categories.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(
            children: [ProductsErrorView(error: e, onRetry: () => ref.invalidate(productCategoriesProvider))],
          ),
          data: (rows) => rows.isEmpty
              ? ListView(children: const [SizedBox(height: 120), Center(child: Text('No categories yet.'))])
              : ListView.builder(
                  padding: const EdgeInsets.only(bottom: 96),
                  itemCount: rows.length,
                  itemBuilder: (context, i) {
                    final c = rows[i];
                    return ListTile(
                      contentPadding: EdgeInsets.only(left: 16.0 + c.depth * 20, right: 8),
                      leading: const Icon(Icons.folder_outlined),
                      title: Text(c.name),
                      subtitle: Text([
                        if (c.code != null && c.code!.isNotEmpty) c.code!,
                        '${c.productCount} product${c.productCount == 1 ? '' : 's'}',
                        if (c.exciseRate > 0) 'Excise ${formatNumber(c.exciseRate)}%',
                      ].join(' · ')),
                      trailing: canCreate
                          ? IconButton(
                              tooltip: 'Add subcategory',
                              icon: const Icon(Icons.add),
                              onPressed: () => _edit(context, ref, parent: c),
                            )
                          : null,
                      onTap: canEdit ? () => _edit(context, ref, category: c) : null,
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class _CategorySheet extends ConsumerStatefulWidget {
  final ProductCategory? category;
  final ProductCategory? parent;
  final bool canArchive;

  const _CategorySheet({this.category, this.parent, this.canArchive = false});

  @override
  ConsumerState<_CategorySheet> createState() => _CategorySheetState();
}

class _CategorySheetState extends ConsumerState<_CategorySheet> {
  late final TextEditingController _name;
  late final TextEditingController _code;
  late final TextEditingController _excise;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final c = widget.category;
    _name = TextEditingController(text: c?.name ?? '');
    _code = TextEditingController(text: c?.code ?? '');
    _excise = TextEditingController(text: c == null || c.exciseRate == 0 ? '' : formatNumber(c.exciseRate));
  }

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    _excise.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function(ProductsRepository repo) action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action(ref.read(productsRepositoryProvider));
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ProductsApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  void _save() {
    final name = _name.text.trim();
    final exciseText = _excise.text.trim();
    final excise = exciseText.isEmpty ? 0.0 : double.tryParse(exciseText);
    if (name.isEmpty) {
      setState(() => _error = 'Name is required');
      return;
    }
    if (excise == null || excise < 0 || excise > 500) {
      setState(() => _error = 'Excise rate must be between 0 and 500');
      return;
    }
    final body = <String, dynamic>{
      'name': name,
      'code': _code.text.trim().isEmpty ? null : _code.text.trim(),
      'excise_rate': excise,
      if (widget.category == null && widget.parent != null) 'parent_id': widget.parent!.id,
    };
    final c = widget.category;
    _run((repo) async {
      if (c == null) {
        await repo.createCategory(body);
      } else {
        await repo.updateCategory(c.id, body);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.category;
    final title = c != null
        ? 'Edit category'
        : (widget.parent != null ? 'New subcategory of ${widget.parent!.name}' : 'New category');
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          TextField(
            controller: _name,
            autofocus: c == null,
            decoration: const InputDecoration(labelText: 'Name *', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _code,
            decoration: const InputDecoration(labelText: 'Code', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _excise,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Excise %',
              helperText: 'Used on e-invoices for products in this category unless a product sets its own rate.',
              border: OutlineInputBorder(),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: const TextStyle(color: AppColors.error)),
            ),
          const SizedBox(height: 16),
          Row(
            children: [
              if (c != null && c.isActive && widget.canArchive)
                TextButton.icon(
                  onPressed: _busy ? null : () => _run((repo) => repo.archiveCategory(c.id)),
                  icon: const Icon(Icons.archive_outlined),
                  label: const Text('Archive'),
                ),
              const Spacer(),
              TextButton(onPressed: _busy ? null : () => Navigator.of(context).pop(false), child: const Text('Cancel')),
              const SizedBox(width: 8),
              FilledButton(onPressed: _busy ? null : _save, child: Text(c == null ? 'Create' : 'Save')),
            ],
          ),
        ],
      ),
    );
  }
}
