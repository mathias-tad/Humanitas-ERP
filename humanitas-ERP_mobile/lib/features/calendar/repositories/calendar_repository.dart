import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/calendar_event_model.dart';

class CalendarRepository {
  final ApiClient _apiClient;

  CalendarRepository(this._apiClient);

  Future<List<CalendarEventModel>> getEvents({
    required DateTime start,
    required DateTime end,
    List<String>? sources,
    String? companyId,
    String? branchId,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'start': start.toIso8601String(),
        'end': end.toIso8601String(),
      };
      if (sources != null && sources.isNotEmpty) {
        queryParams['sources[]'] = sources;
      }
      if (companyId != null && companyId.isNotEmpty) {
        queryParams['company_id'] = companyId;
      }
      if (branchId != null && branchId.isNotEmpty) {
        queryParams['branch_id'] = branchId;
      }

      final response = await _apiClient.dio.get(
        ApiConstants.calendarEvents,
        queryParameters: queryParams,
      );

      final dynamic data = response.data;
      final List<dynamic> list;
      if (data is List) {
        list = data;
      } else if (data is Map && data['data'] is List) {
        list = data['data'];
      } else {
        list = [];
      }

      return list
          .map((item) => CalendarEventModel.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Failed to load calendar events';
      throw Exception(msg);
    }
  }

  Future<List<Map<String, dynamic>>> getSources() async {
    try {
      final response = await _apiClient.dio.get(ApiConstants.calendarSources);
      final dynamic data = response.data;
      if (data is List) {
        return List<Map<String, dynamic>>.from(data);
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<CalendarEventModel> createEvent(Map<String, dynamic> data) async {
    try {
      final response = await _apiClient.dio.post(
        ApiConstants.calendarEvents,
        data: data,
      );
      final resData = response.data is Map && response.data['data'] != null
          ? response.data['data']
          : response.data;
      return CalendarEventModel.fromJson(resData as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Failed to create calendar event';
      throw Exception(msg);
    }
  }

  Future<CalendarEventModel> updateEvent(String id, Map<String, dynamic> data) async {
    try {
      final response = await _apiClient.dio.patch(
        '${ApiConstants.calendarEvents}/$id',
        data: data,
      );
      final resData = response.data is Map && response.data['data'] != null
          ? response.data['data']
          : response.data;
      return CalendarEventModel.fromJson(resData as Map<String, dynamic>);
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Failed to update calendar event';
      throw Exception(msg);
    }
  }

  Future<void> deleteEvent(String id) async {
    try {
      await _apiClient.dio.delete('${ApiConstants.calendarEvents}/$id');
    } on DioException catch (e) {
      final msg = e.response?.data?['message'] ?? 'Failed to delete calendar event';
      throw Exception(msg);
    }
  }
}
