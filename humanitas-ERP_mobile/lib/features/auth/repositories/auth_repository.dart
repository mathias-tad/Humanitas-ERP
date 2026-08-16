import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/user_model.dart';
import '../../../core/services/secure_storage_service.dart';

class AuthRepository {
  final ApiClient _apiClient;
  final SecureStorageService _storage;

  AuthRepository(this._apiClient, this._storage);

  Future<Map<String, dynamic>> login({
    required String tenantSlug,
    required String email,
    required String password,
  }) async {
    // Save tenant slug first so header interceptor can pick it up
    await _storage.saveTenantSlug(tenantSlug);

    try {
      final response = await _apiClient.dio.post(
        ApiConstants.login,
        data: {
          'email': email,
          'password': password,
          'tenant_slug': tenantSlug,
        },
      );

      final data = response.data;
      final accessToken = data['access_token'] ??
          data['accessToken'] ??
          data['token'] ??
          data['data']?['access_token'] ??
          data['data']?['accessToken'];
          
      final refreshToken = data['refresh_token'] ??
          data['refreshToken'] ??
          data['data']?['refresh_token'] ??
          data['data']?['refreshToken'];

      // ignore: avoid_print
      print('[AUTH] Login response keys: ${data is Map ? data.keys : data} | accessToken found: ${accessToken != null}');

      if (accessToken != null) {
        final cleanToken = accessToken.toString().replaceAll('"', '').trim();
        await _storage.saveAccessToken(cleanToken);
      }
      if (refreshToken != null) {
        final cleanRefresh = refreshToken.toString().replaceAll('"', '').trim();
        await _storage.saveRefreshToken(cleanRefresh);
      }

      final user = UserModel.fromJson(data['user'] ?? {});
      return {
        'user': user,
        'requires_setup': data['requires_setup'] ?? false,
      };
    } on DioException catch (e) {
      final data = e.response?.data;
      String msg = 'Login failed';
      if (data is Map) {
        // NestJS sometimes returns {message: ['err1', 'err2']}
        if (data['message'] is List && (data['message'] as List).isNotEmpty) {
          msg = (data['message'] as List).first.toString();
        } else {
          msg = data['message']?.toString() ??
                data['error']?.toString() ??
                e.message ??
                'Login failed';
        }
      } else if (e.type == DioExceptionType.connectionError ||
                 e.type == DioExceptionType.connectionTimeout ||
                 e.type == DioExceptionType.sendTimeout) {
        msg = 'Cannot reach server. Check your connection.';
      } else {
        msg = e.message ?? 'Login failed';
      }
      // ignore: avoid_print
      print('[AUTH] Login error ${e.response?.statusCode}: $msg | data: $data');
      throw Exception(msg);
    }
  }

  Future<UserModel> getCurrentUser() async {
    try {
      final response = await _apiClient.dio.get(ApiConstants.me);
      return UserModel.fromJson(response.data);
    } on DioException catch (e) {
      final msg = e.response?.data['message'] ?? 'Failed to load user profile';
      throw Exception(msg);
    }
  }

  Future<List<String>> getPermissions() async {
    try {
      final response = await _apiClient.dio.get(ApiConstants.userPermissions);
      if (response.data is List) {
        return List<String>.from(response.data);
      } else if (response.data is Map && response.data['permissions'] != null) {
        return List<String>.from(response.data['permissions']);
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  Future<void> logout() async {
    try {
      await _apiClient.dio.post(ApiConstants.logout);
    } catch (_) {}
    await _storage.clearAuthTokens();
  }

  Future<bool> completeUserSetup({
    required String token,
    required String email,
    required String password,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        ApiConstants.completeUserSetup,
        data: {
          'token': token,
          'email': email,
          'password': password,
        },
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      final msg = e.response?.data['message'] ?? 'Account setup failed';
      throw Exception(msg);
    }
  }
}
