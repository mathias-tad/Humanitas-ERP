import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/product_extras_models.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import '../repositories/products_repository.dart';
import 'products_common.dart';

/// Photos tab: the product's pictures (take one with the camera or pick from the gallery) and its attachments.
class ProductMediaView extends ConsumerStatefulWidget {
  final Product product;

  const ProductMediaView({super.key, required this.product});

  @override
  ConsumerState<ProductMediaView> createState() => _ProductMediaViewState();
}

class _ProductMediaViewState extends ConsumerState<ProductMediaView> {
  bool _uploading = false;

  Future<void> _add(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 85, maxWidth: 2000, maxHeight: 2000);
    if (picked == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      final name = picked.name.toLowerCase().endsWith('.png') ? picked.name : '${picked.name.split('.').first}.jpg';
      await ref.read(productsRepositoryProvider).uploadPicture(widget.product.id, picked.path, name);
      _refresh();
      if (!mounted) return;
      showProductsSnack(context, 'Picture added');
    } on ProductsApiException catch (e) {
      if (!mounted) return;
      showProductsSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _refresh() {
    ref.invalidate(productMediaProvider(widget.product.id));
    invalidateProducts(ref);
  }

  Future<void> _run(Future<void> Function() action, String ok) async {
    try {
      await action();
      _refresh();
      if (!mounted) return;
      showProductsSnack(context, ok);
    } on ProductsApiException catch (e) {
      if (!mounted) return;
      showProductsSnack(context, e.message, error: true);
    }
  }

  void _open(BuildContext context, ProductMedia m, String url, bool canEdit) {
    final repo = ref.read(productsRepositoryProvider);
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (ctx) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          title: Text(m.label, overflow: TextOverflow.ellipsis),
          actions: [
            if (canEdit && !m.isPrimary)
              IconButton(
                tooltip: 'Set as main picture',
                icon: const Icon(Icons.star_outline),
                onPressed: () {
                  Navigator.of(ctx).pop();
                  _run(() => repo.setMainPicture(widget.product.id, m.id), 'Main picture changed');
                },
              ),
            if (canEdit)
              IconButton(
                tooltip: 'Remove picture',
                icon: const Icon(Icons.delete_outline),
                onPressed: () {
                  Navigator.of(ctx).pop();
                  _run(() => repo.removeMedia(widget.product.id, m.id), 'Picture removed');
                },
              ),
          ],
        ),
        body: Center(child: InteractiveViewer(child: CachedNetworkImage(imageUrl: url))),
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final canEdit = auth.hasPermission('edit_products') && widget.product.isActive;
    final mediaAsync = ref.watch(productMediaProvider(widget.product.id));
    final repo = ref.read(productsRepositoryProvider);
    return mediaAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ProductsErrorView(error: e, onRetry: () => ref.invalidate(productMediaProvider(widget.product.id))),
      data: (all) {
        final images = all.where((m) => m.isImage).toList();
        final files = all.where((m) => !m.isImage).toList();
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (canEdit)
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _uploading ? null : () => _add(ImageSource.camera),
                      icon: const Icon(Icons.photo_camera_outlined),
                      label: const Text('Take photo'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _uploading ? null : () => _add(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library_outlined),
                      label: const Text('From gallery'),
                    ),
                  ),
                ],
              ),
            if (_uploading) const Padding(padding: EdgeInsets.only(top: 12), child: LinearProgressIndicator()),
            const ProductsSectionTitle('Pictures', icon: Icons.photo_outlined),
            if (images.isEmpty)
              Text(canEdit ? 'No pictures yet. The first one becomes the product picture in lists, POS and labels.' : 'No pictures.')
            else
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [
                  for (final m in images)
                    InkWell(
                      onTap: () => _open(context, m, repo.mediaUrl(m.filePath), canEdit),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: CachedNetworkImage(
                              imageUrl: repo.mediaUrl(m.filePath),
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => const Icon(Icons.broken_image_outlined),
                            ),
                          ),
                          if (m.isPrimary)
                            const Positioned(
                              left: 4,
                              top: 4,
                              child: Icon(Icons.star, color: Colors.amber, size: 20, semanticLabel: 'Main picture'),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            const ProductsSectionTitle('Attachments', icon: Icons.attach_file),
            if (files.isEmpty) const Text('No attachments. Spec sheets and certificates are added in the web app.'),
            for (final f in files)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.description_outlined),
                title: Text(f.label),
                subtitle: Text(f.sizeText, style: const TextStyle(color: AppColors.textSecondaryLight)),
                trailing: const Icon(Icons.link),
                onTap: () async {
                  await Clipboard.setData(ClipboardData(text: repo.mediaUrl(f.filePath)));
                  if (!context.mounted) return;
                  showProductsSnack(context, 'Link copied: open it in your browser');
                },
              ),
          ],
        );
      },
    );
  }
}
