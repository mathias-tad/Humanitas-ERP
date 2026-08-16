import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../models/event_model.dart';

class EventsRepository {
  final ApiClient _apiClient;
  EventsRepository(this._apiClient);

  Future<List<EventModel>> getEvents() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.events);
      if (res.data is List) {
        return (res.data as List)
            .map((item) => EventModel.fromJson(item))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<EventModel?> getEvent(String id) async {
    try {
      final res = await _apiClient.dio.get('${ApiConstants.events}/$id');
      return EventModel.fromJson(res.data);
    } catch (_) {
      return null;
    }
  }
}
