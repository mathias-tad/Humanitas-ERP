import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/notification_model.dart';

class NotificationRepository {
  final ApiClient _apiClient;
  NotificationRepository(this._apiClient);

  Future<List<NotificationModel>> getNotifications() async {
    final res = await _apiClient.dio.get(ApiConstants.notifications);
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => NotificationModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<int> getUnreadCount() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.unreadNotificationsCount);
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
}
