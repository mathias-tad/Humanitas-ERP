import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/assets/models/asset_model.dart';
import 'package:humanitas_erp_mobile/features/assets/repositories/asset_repository.dart';

final assetRepositoryProvider = Provider<AssetRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AssetRepository(apiClient);
});

final assetCategoriesProvider = FutureProvider.autoDispose<List<AssetCategoryModel>>((ref) async {
  return ref.watch(assetRepositoryProvider).getCategories();
});

final allAssetsProvider = FutureProvider.autoDispose<List<CompanyAssetModel>>((ref) async {
  return ref.watch(assetRepositoryProvider).getAssets();
});

final myAssetsProvider = FutureProvider.autoDispose<List<CompanyAssetModel>>((ref) async {
  return ref.watch(assetRepositoryProvider).getMyAssets();
});

final assetAnalyticsProvider = FutureProvider.autoDispose<AssetAnalyticsModel>((ref) async {
  return ref.watch(assetRepositoryProvider).getAnalytics();
});
