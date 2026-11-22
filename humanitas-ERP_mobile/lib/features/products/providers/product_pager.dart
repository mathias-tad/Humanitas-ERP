import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/product_models.dart';
import '../repositories/products_repository.dart';

/// Products load this many at a time; more load as the list is scrolled (AGENTS.md rule 24 item 21).
const int kProductPageSize = 40;

/// The product list for one set of filters, page after page.
class ProductPager extends StateNotifier<AsyncValue<ProductPage>> {
  final ProductsRepository _repo;
  final ProductQuery _query;
  bool _loadingMore = false;

  /// Set when loading the next page failed; the list offers to try again.
  Object? loadMoreError;

  ProductPager(this._repo, this._query) : super(const AsyncValue.loading()) {
    refresh();
  }

  bool get isLoadingMore => _loadingMore;

  Future<void> refresh() async {
    loadMoreError = null;
    final next = await AsyncValue.guard(() => _repo.listProducts(_query.copyWith(page: 1, limit: kProductPageSize)));
    if (mounted) state = next;
  }

  Future<void> loadMore() async {
    final current = state.asData?.value;
    if (current == null || !current.hasMore || _loadingMore) return;
    _loadingMore = true;
    loadMoreError = null;
    try {
      final next = await _repo.listProducts(_query.copyWith(page: current.page + 1, limit: kProductPageSize));
      if (mounted) state = AsyncValue.data(current.append(next));
    } catch (e) {
      loadMoreError = e;
    } finally {
      _loadingMore = false;
    }
  }
}
