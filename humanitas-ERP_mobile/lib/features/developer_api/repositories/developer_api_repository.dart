import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/features/developer_api/models/developer_api_model.dart';

class DeveloperApiRepository {
  final ApiClient _apiClient;

  DeveloperApiRepository(this._apiClient);

  Future<List<ApiKeyModel>> getApiKeys() async {
    try {
      final response = await _apiClient.dio.get('/developer-api/keys');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => ApiKeyModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load API keys');
    }
  }

  Future<ApiKeyModel> createApiKey({required String name, String? expiresAt}) async {
    try {
      final response = await _apiClient.dio.post('/developer-api/keys', data: {
        'name': name,
        if (expiresAt != null) 'expires_at': expiresAt,
      });
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? (data['data'] is Map ? data['data'] as Map<String, dynamic> : data)
          : <String, dynamic>{};
      return ApiKeyModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to create API key');
    }
  }

  Future<void> revokeApiKey(String keyId) async {
    try {
      await _apiClient.dio.delete('/developer-api/keys/$keyId');
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to revoke API key');
    }
  }

  Future<List<ApiKeyLogModel>> getApiKeyLogs(String keyId) async {
    try {
      final response = await _apiClient.dio.get('/developer-api/keys/$keyId/logs');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => ApiKeyLogModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load API key logs');
    }
  }

  Future<List<WebhookSubscriptionModel>> getWebhooks() async {
    try {
      final response = await _apiClient.dio.get('/developer-api/webhooks');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => WebhookSubscriptionModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load webhooks');
    }
  }

  Future<WebhookSubscriptionModel> createWebhook({
    required String name,
    required String url,
    required List<String> events,
    String? secret,
  }) async {
    try {
      final response = await _apiClient.dio.post('/developer-api/webhooks', data: {
        'name': name,
        'url': url,
        'events': events,
        if (secret != null && secret.isNotEmpty) 'secret': secret,
      });
      final dynamic data = response.data;
      final Map<String, dynamic> json = data is Map<String, dynamic>
          ? (data['data'] is Map ? data['data'] as Map<String, dynamic> : data)
          : <String, dynamic>{};
      return WebhookSubscriptionModel.fromJson(json);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to create webhook');
    }
  }

  Future<void> updateWebhook(String webhookId, {bool? isActive}) async {
    try {
      await _apiClient.dio.put('/developer-api/webhooks/$webhookId', data: {
        if (isActive != null) 'is_active': isActive,
      });
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to update webhook');
    }
  }

  Future<void> deleteWebhook(String webhookId) async {
    try {
      await _apiClient.dio.delete('/developer-api/webhooks/$webhookId');
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to delete webhook');
    }
  }

  Future<List<WebhookDeliveryModel>> getWebhookDeliveries(String webhookId) async {
    try {
      final response = await _apiClient.dio.get('/developer-api/webhooks/$webhookId/deliveries');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);
      return items.map((e) => WebhookDeliveryModel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to load webhook deliveries');
    }
  }

  Future<void> retryDelivery(String deliveryId) async {
    try {
      await _apiClient.dio.post('/developer-api/deliveries/$deliveryId/retry');
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ?? 'Failed to retry delivery');
    }
  }
}
