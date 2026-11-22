import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/providers.dart';
import '../models/product_models.dart';
import '../models/price_models.dart';
import '../models/product_extras_models.dart';
import '../repositories/products_repository.dart';
import 'product_pager.dart';

final productsRepositoryProvider = Provider<ProductsRepository>((ref) {
  return ProductsRepository(ref.watch(apiClientProvider));
});

/// One page of the product list for the given filters.
final productListProvider = FutureProvider.autoDispose.family<ProductPage, ProductQuery>((ref, query) {
  return ref.watch(productsRepositoryProvider).listProducts(query);
});

final productDetailProvider = FutureProvider.autoDispose.family<Product, String>((ref, id) {
  return ref.watch(productsRepositoryProvider).getProduct(id);
});

final productCategoriesProvider = FutureProvider.autoDispose<List<ProductCategory>>((ref) {
  return ref.watch(productsRepositoryProvider).listCategories();
});

final uomCategoriesProvider = FutureProvider.autoDispose<List<UomCategory>>((ref) {
  return ref.watch(productsRepositoryProvider).listUoms();
});

/// Refresh everything Products shows after a create, edit, archive or restore.
void invalidateProducts(WidgetRef ref) {
  ref.invalidate(productListProvider);
  ref.invalidate(productPagesProvider);
  ref.invalidate(productVariantsProvider);
  ref.invalidate(productPricesProvider);
  ref.invalidate(productDetailProvider);
  ref.invalidate(productCategoriesProvider);
  ref.invalidate(productMediaProvider);
  ref.invalidate(productCompositionProvider);
  ref.invalidate(catalogReportProvider);
}

/// A product's pictures and attachments.
final productMediaProvider = FutureProvider.autoDispose.family<List<ProductMedia>, String>((ref, id) {
  return ref.watch(productsRepositoryProvider).media(id);
});

/// A kit's components or a combo's choice groups.
final productCompositionProvider = FutureProvider.autoDispose.family<ProductComposition, String>((ref, id) {
  return ref.watch(productsRepositoryProvider).composition(id);
});

/// Catalog report (web: Product Reports).
final catalogReportProvider = FutureProvider.autoDispose<CatalogReport>((ref) {
  return ref.watch(productsRepositoryProvider).catalogReport();
});

/// The product list, page after page (40 at a time, more as it scrolls).
final productPagesProvider =
    StateNotifierProvider.autoDispose.family<ProductPager, AsyncValue<ProductPage>, ProductQuery>((ref, query) {
  return ProductPager(ref.watch(productsRepositoryProvider), query);
});

/// The variants of a product with variants.
final productVariantsProvider = FutureProvider.autoDispose.family<List<Product>, String>((ref, id) {
  return ref.watch(productsRepositoryProvider).variants(id);
});

/// A product's price on every active price list at a quantity: (product id, quantity).
final productPricesProvider = FutureProvider.autoDispose.family<ProductPrices, (String, double)>((ref, key) {
  return ref.watch(productsRepositoryProvider).prices(key.$1, quantity: key.$2);
});
