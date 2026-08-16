import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../models/announcement_model.dart';

class AnnouncementsRepository {
  final ApiClient _apiClient;
  AnnouncementsRepository(this._apiClient);

  Future<List<AnnouncementModel>> getAnnouncements() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.announcements);
      if (res.data is List) {
        return (res.data as List)
            .map((item) => AnnouncementModel.fromJson(item))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<AnnouncementModel?> getAnnouncement(String id) async {
    try {
      final res = await _apiClient.dio.get('${ApiConstants.announcements}/$id');
      return AnnouncementModel.fromJson(res.data);
    } catch (_) {
      return null;
    }
  }
}
