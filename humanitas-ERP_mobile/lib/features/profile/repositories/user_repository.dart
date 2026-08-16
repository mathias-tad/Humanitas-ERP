import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/user_model.dart';

class UserRepository {
  final ApiClient _apiClient;
  UserRepository(this._apiClient);

  Future<UserModel> getProfile() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.userProfile);
      final data = (res.data is Map && res.data['user'] != null) ? res.data['user'] : res.data;
      return UserModel.fromJson(Map<String, dynamic>.from(data));
    } catch (_) {
      // Fallback to /auth/me identity endpoint
      final res = await _apiClient.dio.get(ApiConstants.me);
      final data = (res.data is Map && res.data['user'] != null) ? res.data['user'] : res.data;
      return UserModel.fromJson(Map<String, dynamic>.from(data));
    }
  }

  Future<UserModel> updateProfile(Map<String, dynamic> data) async {
    final res = await _apiClient.dio.patch(ApiConstants.userProfile, data: data);

    // The backend SQL RETURNING clause may give back an array of rows.
    // Normalise: List → first element, {user: ...} wrapper → unwrap, Map → use directly.
    dynamic raw = res.data;
    if (raw is List) {
      if (raw.isEmpty) throw Exception('Profile update returned empty response');
      raw = raw.first;
    }
    if (raw is Map && raw['user'] != null) {
      raw = raw['user'];
    }
    if (raw is! Map) throw Exception('Unexpected profile update response format');

    return UserModel.fromJson(Map<String, dynamic>.from(raw));
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    // Backend DTO uses exactly: current_password + new_password
    try {
      await _apiClient.dio.post(
        ApiConstants.changePassword,
        data: {
          'current_password': currentPassword,
          'new_password': newPassword,
        },
      );
    } on DioException catch (e) {
      final data = e.response?.data;
      String msg = 'Failed to change password';
      if (data is Map) {
        final serverMsg = data['message'];
        if (serverMsg is List && serverMsg.isNotEmpty) {
          msg = serverMsg.first.toString();
        } else if (serverMsg != null && serverMsg.toString().isNotEmpty) {
          msg = serverMsg.toString();
        }
      }
      // Provide a friendly message for wrong current password
      if (msg.toLowerCase().contains('incorrect') ||
          msg.toLowerCase().contains('invalid') ||
          e.response?.statusCode == 400) {
        msg = 'Incorrect current password. Please try again.';
      }
      // ignore: avoid_print
      print('[CHANGE_PASSWORD] Error ${e.response?.statusCode}: $msg | Response: $data');
      throw Exception(msg);
    }
  }

  Future<String?> uploadAvatar(List<int> bytes, String filename, String mime) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename, contentType: DioMediaType.parse(mime)),
    });
    final res = await _apiClient.dio.post(
      ApiConstants.uploadAvatar,
      data: formData,
      options: Options(headers: {'Content-Type': 'multipart/form-data'}),
    );
    dynamic raw = res.data;
    if (raw is Map) {
      return raw['avatar_url'] ?? raw['avatarUrl'] ?? raw['url'];
    }
    return null;
  }

  Future<void> deleteAvatar() async {
    await _apiClient.dio.delete(ApiConstants.deleteAvatar);
  }

  Future<Map<String, dynamic>> getHomeDashboard() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.homeDashboard);
      return Map<String, dynamic>.from(res.data);
    } catch (_) {
      return {};
    }
  }

  Future<List<String>> getPermissions() async {
    try {
      final res = await _apiClient.dio.get(ApiConstants.userPermissions);
      if (res.data is List) return List<String>.from(res.data);
      if (res.data is Map && res.data['permissions'] != null) {
        return List<String>.from(res.data['permissions']);
      }
      return [];
    } catch (_) {
      return [];
    }
  }
}
