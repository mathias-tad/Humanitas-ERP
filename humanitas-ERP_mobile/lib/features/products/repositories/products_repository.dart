import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../models/price_models.dart';
import '../models/product_extras_models.dart';
import '../models/product_models.dart';

/// A failed Products API call, with the server's message when it sent one.
class ProductsApiException implements Exception {
  final String message;
  final int? statusCode;

  const ProductsApiException(this.message, {this.statusCode});

  bool get isNotFound => statusCode == 404;

  @override
  String toString() => message;
}

/// Products & Catalog API (tenant backend). Errors are thrown, never hidden, so screens can show them.
class ProductsRepository {
  final ApiClient _apiClient;

  ProductsRepository(this._apiClient);

  Dio get _dio => _apiClient.dio;

  Future<T> _call<T>(Future<T> Function() run, String fallback) async {
    try {
      return await run();
    } on DioException catch (e) {
      final data = e.response?.data;
      var message = fallback;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        message = m is List ? m.join('\n') : m.toString();
      } else if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
        message = 'No connection to the server. Check your internet and try again.';
      }
      throw ProductsApiException(message, statusCode: e.response?.statusCode);
    }
  }

  Map<String, dynamic> _map(dynamic data) => data is Map<String, dynamic> ? data : <String, dynamic>{};

  List<Map<String, dynamic>> _list(dynamic data) =>
      data is List ? data.whereType<Map<String, dynamic>>().toList() : const [];

  // ── Products ────────────────────────────────────────────────────────────────
  Future<ProductPage> listProducts(ProductQuery query) => _call(() async {
        final res = await _dio.get('/products', queryParameters: query.toParams());
        return ProductPage.fromJson(_map(res.data));
      }, 'Could not load products');

  Future<Product> getProduct(String id) => _call(() async {
        final res = await _dio.get('/products/$id');
        return Product.fromJson(_map(res.data));
      }, 'Could not load the product');

  /// Finds an active product by barcode, item code or SKU. Returns null when nothing matches.
  Future<Product?> lookup(String code) async {
    try {
      return await _call(() async {
        final res = await _dio.get('/products/lookup', queryParameters: {'code': code});
        return Product.fromJson(_map(res.data));
      }, 'Could not look up the code');
    } on ProductsApiException catch (e) {
      if (e.isNotFound) return null;
      rethrow;
    }
  }

  Future<Product> createProduct(Map<String, dynamic> body) => _call(() async {
        final res = await _dio.post('/products', data: body);
        return Product.fromJson(_map(res.data));
      }, 'Could not create the product');

  Future<Product> updateProduct(String id, Map<String, dynamic> body) => _call(() async {
        final res = await _dio.patch('/products/$id', data: body);
        return Product.fromJson(_map(res.data));
      }, 'Could not save the product');

  Future<Product> archiveProduct(String id) => _call(() async {
        final res = await _dio.delete('/products/$id');
        return Product.fromJson(_map(res.data));
      }, 'Could not archive the product');

  Future<Product> restoreProduct(String id) => _call(() async {
        final res = await _dio.post('/products/$id/restore');
        return Product.fromJson(_map(res.data));
      }, 'Could not restore the product');

  Future<TimelinePage> productTimeline(String id, {String? before}) => _call(() async {
        final res = await _dio.get(
          '/products/$id/timeline',
          queryParameters: {if (before != null && before.isNotEmpty) 'before': before},
        );
        return TimelinePage.fromJson(_map(res.data));
      }, 'Could not load the history');

  /// The variants of a product with variants (set up in the web app).
  Future<List<Product>> variants(String productId) => _call(() async {
        final res = await _dio.get('/products/$productId/variants');
        final list = _map(res.data)['variants'];
        return list is List ? list.whereType<Map<String, dynamic>>().map(Product.fromJson).toList() : <Product>[];
      }, 'Could not load the variants');

  /// The product's price on every active price list at [quantity].
  Future<ProductPrices> prices(String productId, {double quantity = 1}) => _call(() async {
        final res = await _dio.get('/price-lists/for-product/$productId', queryParameters: {'quantity': quantity.toString()});
        return ProductPrices.fromJson(_map(res.data));
      }, 'Could not load the prices');

  // ── Pictures, contents, catalog report ─────────────────────────────────────
  /// The full address of a stored picture or attachment.
  String mediaUrl(String? path) => resolveMediaUrl(_dio.options.baseUrl, path);

  Future<List<ProductMedia>> media(String productId) => _call(() async {
        final res = await _dio.get('/products/$productId/media');
        return _list(res.data).map(ProductMedia.fromJson).toList();
      }, 'Could not load the pictures');

  /// Uploads a photo from the camera or gallery (JPEG or PNG, up to 5 MB).
  Future<ProductMedia> uploadPicture(String productId, String filePath, String fileName) => _call(() async {
        final form = FormData.fromMap({
          'kind': 'image',
          'file': await MultipartFile.fromFile(filePath, filename: fileName),
        });
        final res = await _dio.post('/products/$productId/media', data: form);
        return ProductMedia.fromJson(_map(res.data));
      }, 'Could not upload the picture');

  Future<void> setMainPicture(String productId, String mediaId) => _call(() async {
        await _dio.patch('/products/$productId/media/$mediaId', data: {'is_primary': true});
      }, 'Could not change the main picture');

  Future<void> removeMedia(String productId, String mediaId) => _call(() async {
        await _dio.delete('/products/$productId/media/$mediaId');
      }, 'Could not remove the picture');

  Future<ProductComposition> composition(String productId) => _call(() async {
        final res = await _dio.get('/products/$productId/composition');
        return ProductComposition.fromJson(_map(res.data));
      }, 'Could not load the contents');

  Future<CatalogReport> catalogReport() => _call(() async {
        final res = await _dio.get('/product-reports/summary');
        return CatalogReport.fromJson(_map(res.data));
      }, 'Could not load the catalog report');

  // ── Categories ──────────────────────────────────────────────────────────────
  Future<List<ProductCategory>> listCategories({bool includeArchived = false}) => _call(() async {
        final res = await _dio.get(
          '/product-categories',
          queryParameters: {if (includeArchived) 'include_archived': 'true'},
        );
        return _list(res.data).map(ProductCategory.fromJson).toList();
      }, 'Could not load categories');

  Future<ProductCategory> createCategory(Map<String, dynamic> body) => _call(() async {
        final res = await _dio.post('/product-categories', data: body);
        return ProductCategory.fromJson(_map(res.data));
      }, 'Could not create the category');

  Future<ProductCategory> updateCategory(String id, Map<String, dynamic> body) => _call(() async {
        final res = await _dio.patch('/product-categories/$id', data: body);
        return ProductCategory.fromJson(_map(res.data));
      }, 'Could not save the category');

  Future<void> archiveCategory(String id) => _call(() async {
        await _dio.delete('/product-categories/$id');
      }, 'Could not archive the category');

  // ── Units of measure ────────────────────────────────────────────────────────
  Future<List<UomCategory>> listUoms() => _call(() async {
        final res = await _dio.get('/uoms');
        return _list(res.data).map(UomCategory.fromJson).toList();
      }, 'Could not load units');

  Future<List<MorUnitCode>> morUnitCodes() => _call(() async {
        final res = await _dio.get('/uoms/mor-codes');
        return _list(res.data).map(MorUnitCode.fromJson).toList();
      }, 'Could not load MoR unit codes');

  Future<void> setUnitMorCode(String uomId, String? morCode) => _call(() async {
        await _dio.patch('/uoms/$uomId', data: {'mor_code': morCode});
      }, 'Could not save the MoR unit code');
}
