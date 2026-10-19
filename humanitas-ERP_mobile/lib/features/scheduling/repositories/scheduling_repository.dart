import '../../../core/api/api_client.dart';
import '../models/shift_model.dart';
import '../models/shift_pattern_model.dart';

class SchedulingRepository {
  final ApiClient _apiClient;

  SchedulingRepository(this._apiClient);

  // ── Existing methods ──────────────────────────────────────────────────────

  Future<List<ShiftModel>> getShifts() async {
    try {
      final response = await _apiClient.dio.get('/scheduling/shifts');
      final data = response.data;
      if (data is List) {
        return data.map((e) => ShiftModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<List<UserScheduleItem>> getUserSchedule(String userId, {String? startDate, String? endDate}) async {
    try {
      final query = <String, dynamic>{};
      if (startDate != null) query['startDate'] = startDate;
      if (endDate != null) query['endDate'] = endDate;

      final response = await _apiClient.dio.get(
        '/scheduling/user-schedule/$userId',
        queryParameters: query,
      );
      final data = response.data;
      if (data is List) {
        return data.map((e) => UserScheduleItem.fromJson(e as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // ── Admin Roster methods ──────────────────────────────────────────────────

  /// GET /scheduling/patterns → list of shift patterns defined for the tenant.
  Future<List<ShiftPatternModel>> getPatterns() async {
    try {
      final response = await _apiClient.dio.get('/scheduling/patterns');
      final data = response.data;
      if (data is List) {
        return data
            .map((e) => ShiftPatternModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      // Support wrapped response: { "data": [...] }
      if (data is Map && data['data'] is List) {
        return (data['data'] as List)
            .map((e) => ShiftPatternModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception('Failed to load patterns: $e');
    }
  }

  /// GET /attendance/assignments → users with their current assignment info.
  Future<List<UserWithAssignmentModel>> getUsersWithAssignments() async {
    try {
      final response = await _apiClient.dio.get('/attendance/assignments');
      final data = response.data;
      if (data is List) {
        return data
            .map((e) => UserWithAssignmentModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      if (data is Map && data['data'] is List) {
        return (data['data'] as List)
            .map((e) => UserWithAssignmentModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception('Failed to load roster: $e');
    }
  }

  /// POST /attendance/assignments — assign (or update) a pattern for a user.
  ///
  /// Pass [patternId] as `null` to reset to Standard Schedule.
  Future<void> assignPattern({
    required String userId,
    String? patternId,
    required String startDate,
    required int currentWeekInRotation,
    required List<int> dayOffDays,
    required bool autoRotateDayoff,
  }) async {
    try {
      await _apiClient.dio.post(
        '/attendance/assignments',
        data: {
          'user_id': userId,
          'pattern_id': patternId, // null → backend treats as Standard
          'start_date': startDate,
          'current_week_in_rotation': currentWeekInRotation,
          'day_off_days': dayOffDays,
          'auto_rotate_dayoff': autoRotateDayoff,
        },
      );
    } catch (e) {
      throw Exception('Failed to assign pattern: $e');
    }
  }

  /// DELETE /attendance/assignments/:userId — remove any existing assignment.
  Future<void> removeAssignment(String userId) async {
    try {
      await _apiClient.dio.delete('/attendance/assignments/$userId');
    } catch (e) {
      throw Exception('Failed to remove assignment: $e');
    }
  }
}
