import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/services/secure_storage_service.dart';
import 'package:humanitas_erp_mobile/features/products/models/price_models.dart';
import 'package:humanitas_erp_mobile/features/products/models/product_models.dart';
import 'package:humanitas_erp_mobile/features/products/providers/product_pager.dart';
import 'package:humanitas_erp_mobile/features/products/repositories/products_repository.dart';

Product _p(int i) => Product(id: 'p$i', name: 'Product $i', itemCode: 'P$i', uomId: 'u', uomName: 'Unit', purchaseUomId: 'u');

class _PagedRepo extends ProductsRepository {
  final int total;
  final List<ProductQuery> queries = [];
  bool failNext = false;

  _PagedRepo(this.total) : super(ApiClient(SecureStorageService()));

  @override
  Future<ProductPage> listProducts(ProductQuery query) async {
    queries.add(query);
    if (failNext) {
      failNext = false;
      throw const ProductsApiException('offline');
    }
    final start = (query.page - 1) * query.limit;
    final items = [for (var i = start; i < start + query.limit && i < total; i++) _p(i)];
    return ProductPage(items: items, page: query.page, limit: query.limit, total: total);
  }
}

void main() {
  test('loads 40 at a time and keeps going past 200', () async {
    final repo = _PagedRepo(250);
    final pager = ProductPager(repo, const ProductQuery());
    await Future<void>.delayed(Duration.zero);
    expect(pager.state.asData!.value.items, hasLength(kProductPageSize));
    for (var i = 0; i < 10; i++) {
      await pager.loadMore();
    }
    final page = pager.state.asData!.value;
    expect(page.items, hasLength(250));
    expect(page.hasMore, isFalse);
    expect(repo.queries.map((q) => q.page).toList(), [1, 2, 3, 4, 5, 6, 7]);
    expect(repo.queries.every((q) => q.limit == kProductPageSize), isTrue);
  });

  test('keeps what is loaded when the next page fails, then retries', () async {
    final repo = _PagedRepo(100);
    final pager = ProductPager(repo, const ProductQuery());
    await Future<void>.delayed(Duration.zero);
    repo.failNext = true;
    await pager.loadMore();
    expect(pager.state.asData!.value.items, hasLength(40));
    expect(pager.loadMoreError, isNotNull);
    await pager.loadMore();
    expect(pager.state.asData!.value.items, hasLength(80));
    expect(pager.loadMoreError, isNull);
  });

  test('reads variant details from the API', () {
    final v = Product.fromJson({
      'id': 'v1', 'name': 'T-shirt (Red, M)', 'item_code': 'P1', 'uom_id': 'u', 'uom_name': 'Unit', 'purchase_uom_id': 'u',
      'parent_id': 'p1', 'parent_name': 'T-shirt', 'variant_label': 'Red, M', 'price_extra': '10.00',
    });
    expect(v.isVariant, isTrue);
    expect(v.parentName, 'T-shirt');
    expect(v.variantLabel, 'Red, M');
    expect(v.priceExtra, 10);
    final parent = Product.fromJson({'id': 'p1', 'name': 'T-shirt', 'has_variants': true, 'variant_count': 6});
    expect(parent.hasVariants, isTrue);
    expect(parent.variantCount, 6);
    expect(parent.isVariant, isFalse);
  });

  test('reads a product price on each list', () {
    final prices = ProductPrices.fromJson({
      'product_id': 'p1',
      'quantity': 10,
      'lists': [
        {'id': 'l1', 'name': 'Retail', 'currency': 'ETB', 'is_default': true},
        {'id': 'l2', 'name': 'Wholesale', 'currency': 'ETB'},
      ],
      'rows': [
        {
          'product_id': 'p1',
          'name': 'Teff flour 1kg',
          'base_price': 120,
          'prices': {
            'l1': {'price': 120, 'source': 'base'},
            'l2': {'price': '110.00', 'source': 'rule'},
          },
        },
      ],
    });
    expect(prices.quantity, 10);
    expect(prices.lists.first.isDefault, isTrue);
    expect(prices.rows.single.prices['l2']!.price, 110);
    expect(prices.rows.single.prices['l2']!.fromRule, isTrue);
    expect(prices.rows.single.prices['l1']!.fromRule, isFalse);
  });
}
