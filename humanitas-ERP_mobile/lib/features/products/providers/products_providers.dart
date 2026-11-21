import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/providers.dart';
import '../models/product_models.dart';
import '../repositories/products_repository.dart';

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
  ref.invalidate(productDetailProvider);
  ref.invalidate(productCategoriesProvider);
}
