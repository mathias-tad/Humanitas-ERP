import 'package:dio/dio.dart';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';
import 'package:humanitas_erp_mobile/core/api/api_constants.dart';
import 'package:humanitas_erp_mobile/core/models/notification_model.dart';
import 'package:humanitas_erp_mobile/features/notifications/models/notification_preference_model.dart';

class NotificationRepository {
  final ApiClient _apiClient;

  NotificationRepository(this._apiClient);

  Future<List<NotificationModel>> getNotifications() async {
    final res = await _apiClient.dio.get(ApiConstants.notifications);
    final data = res.data;
    if (data is List) {
      return data
          .map((e) =>
              NotificationModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<int> getUnreadCount() async {
    try {
      final res =
          await _apiClient.dio.get(ApiConstants.unreadNotificationsCount);
      if (res.data is Map) {
        final count = res.data['count'];
        if (count is int) return count;
        return int.tryParse(count.toString()) ?? 0;
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }

  Future<void> markAsRead(String id) async {
    await _apiClient.dio.post('${ApiConstants.notifications}/$id/read');
  }

  Future<void> markAllAsRead() async {
    await _apiClient.dio.post('${ApiConstants.notifications}/read-all');
  }

  Future<List<NotificationPreferenceModel>> getPreferences() async {
    try {
      final response = await _apiClient.dio.get('/notifications/preferences');
      final dynamic data = response.data;
      final List<dynamic> items = data is List
          ? data
          : (data is Map && data['data'] is List ? data['data'] : []);

      return items
          .map((e) => NotificationPreferenceModel.fromJson(
              Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ??
          'Failed to load notification preferences');
    }
  }

  Future<void> bulkUpdatePreferences(
      List<Map<String, String>> preferences) async {
    try {
      await _apiClient.dio.put(
        '/notifications/preferences/bulk',
        data: {'preferences': preferences},
      );
    } on DioException catch (e) {
      throw Exception(e.response?.data?['message'] ??
          'Failed to update notification preferences');
    }
  }
}
