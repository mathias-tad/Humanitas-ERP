import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/developer_api/models/developer_api_model.dart';
import 'package:humanitas_erp_mobile/features/developer_api/repositories/developer_api_repository.dart';

final developerApiRepositoryProvider = Provider<DeveloperApiRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return DeveloperApiRepository(apiClient);
});

final apiKeysProvider = FutureProvider.autoDispose<List<ApiKeyModel>>((ref) async {
  return ref.watch(developerApiRepositoryProvider).getApiKeys();
});

final webhooksProvider = FutureProvider.autoDispose<List<WebhookSubscriptionModel>>((ref) async {
  return ref.watch(developerApiRepositoryProvider).getWebhooks();
});

// Family provider for per-webhook deliveries
final webhookDeliveriesProvider = FutureProvider.autoDispose.family<List<WebhookDeliveryModel>, String>(
  (ref, webhookId) async {
    return ref.watch(developerApiRepositoryProvider).getWebhookDeliveries(webhookId);
  },
);

// Family provider for per-key logs
final apiKeyLogsProvider = FutureProvider.autoDispose.family<List<ApiKeyLogModel>, String>(
  (ref, keyId) async {
    return ref.watch(developerApiRepositoryProvider).getApiKeyLogs(keyId);
  },
);
