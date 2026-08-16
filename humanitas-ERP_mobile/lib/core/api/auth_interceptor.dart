import 'package:dio/dio.dart';
import '../services/secure_storage_service.dart';
import 'api_constants.dart';

class AuthInterceptor extends Interceptor {
  final SecureStorageService _storage;
  final Dio _dio;
  bool _isRefreshing = false;

  AuthInterceptor(this._storage, this._dio);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.getAccessToken();
    final tenantSlug = await _storage.getTenantSlug();

    // ── IMPORTANT ───────────────────────────────────────────────────────────
    // The backend JWT strategy reads ONLY from the HttpOnly cookie
    // "access_token". It does NOT check the Authorization header.
    // We must send the token as Cookie: access_token=<jwt>
    // ────────────────────────────────────────────────────────────────────────
    if (token != null && token.isNotEmpty) {
      final cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
      options.headers['Cookie'] = 'access_token=$cleanToken';
    }

    if (tenantSlug != null && tenantSlug.isNotEmpty) {
      options.headers['x-tenant-slug'] = tenantSlug;
    }

    // ignore: avoid_print
    print('[API] ${options.method} ${options.path} | HasToken: ${token != null && token.isNotEmpty} | Slug: $tenantSlug');

    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final path = err.requestOptions.path;
    final isAuthEndpoint = path.contains(ApiConstants.login) ||
                           path.contains(ApiConstants.refresh);

    if (err.response?.statusCode == 401 && !_isRefreshing && !isAuthEndpoint) {
      _isRefreshing = true;
      try {
        final refreshToken = await _storage.getRefreshToken();
        final tenantSlug = await _storage.getTenantSlug();

        if (refreshToken == null || refreshToken.isEmpty) {
          _isRefreshing = false;
          return handler.next(err);
        }

        final baseUrl = err.requestOptions.baseUrl;
        final refreshDio = Dio(BaseOptions(baseUrl: baseUrl));

        // Refresh endpoint reads refresh_token from cookie
        final Map<String, String> refreshHeaders = {
          'Cookie': 'refresh_token=$refreshToken',
          'Content-Type': 'application/json',
        };
        if (tenantSlug != null && tenantSlug.isNotEmpty) {
          refreshHeaders['x-tenant-slug'] = tenantSlug;
        }

        final response = await refreshDio.post(
          ApiConstants.refresh,
          options: Options(headers: refreshHeaders),
        );

        if (response.statusCode == 200 || response.statusCode == 201) {
          final data = response.data;
          final newAccessToken = (data is Map
              ? (data['access_token'] ??
                 data['accessToken'] ??
                 data['token'] ??
                 data['data']?['access_token'])
              : null)?.toString();

          final newRefreshToken = (data is Map
              ? (data['refresh_token'] ??
                 data['refreshToken'] ??
                 data['data']?['refresh_token'])
              : null)?.toString();

          // Also check Set-Cookie response headers for the new tokens
          String? cookieAccess;
          String? cookieRefresh;
          final setCookies = response.headers.map['set-cookie'] ?? [];
          for (final cookie in setCookies) {
            if (cookie.startsWith('access_token=')) {
              cookieAccess = cookie.split(';').first.substring('access_token='.length);
            }
            if (cookie.startsWith('refresh_token=')) {
              cookieRefresh = cookie.split(';').first.substring('refresh_token='.length);
            }
          }

          final finalAccess = newAccessToken ?? cookieAccess;
          final finalRefresh = newRefreshToken ?? cookieRefresh;

          if (finalAccess != null && finalAccess.isNotEmpty) {
            final clean = finalAccess.replaceAll('"', '').trim();
            await _storage.saveAccessToken(clean);
          }
          if (finalRefresh != null && finalRefresh.isNotEmpty) {
            final clean = finalRefresh.replaceAll('"', '').trim();
            await _storage.saveRefreshToken(clean);
          }

          _isRefreshing = false;

          // Retry original request with the new token sent as cookie
          final opts = err.requestOptions;
          final currentToken = await _storage.getAccessToken();
          if (currentToken != null) {
            final cleanToken = currentToken.startsWith('Bearer ') ? currentToken.substring(7) : currentToken;
            opts.headers['Cookie'] = 'access_token=$cleanToken';
          }

          final cloneReq = await _dio.request(
            opts.path,
            options: Options(
              method: opts.method,
              headers: opts.headers,
            ),
            data: opts.data,
            queryParameters: opts.queryParameters,
          );

          return handler.resolve(cloneReq);
        }
      } on DioException catch (refreshErr) {
        _isRefreshing = false;
        if (refreshErr.response?.statusCode == 401 || refreshErr.response?.statusCode == 403) {
          await _storage.clearAuthTokens();
        }
      } catch (e) {
        _isRefreshing = false;
      }
    }

    return handler.next(err);
  }
}
