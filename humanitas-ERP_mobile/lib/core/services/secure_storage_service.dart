import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _tenantSlugKey = 'tenant_slug';
  static const String _baseUrlKey = 'base_url';

  // Static in-memory cache shared across all provider instances
  static String? _memAccessToken;
  static String? _memRefreshToken;
  static String? _memTenantSlug;

  // Access Token
  Future<void> saveAccessToken(String token) async {
    _memAccessToken = token;
    await _storage.write(key: _accessTokenKey, value: token);
  }

  Future<String?> getAccessToken() async {
    if (_memAccessToken != null && _memAccessToken!.isNotEmpty) {
      return _memAccessToken;
    }
    _memAccessToken = await _storage.read(key: _accessTokenKey);
    return _memAccessToken;
  }

  // Refresh Token
  Future<void> saveRefreshToken(String token) async {
    _memRefreshToken = token;
    await _storage.write(key: _refreshTokenKey, value: token);
  }

  Future<String?> getRefreshToken() async {
    if (_memRefreshToken != null && _memRefreshToken!.isNotEmpty) {
      return _memRefreshToken;
    }
    _memRefreshToken = await _storage.read(key: _refreshTokenKey);
    return _memRefreshToken;
  }

  // Tenant Slug — PERSISTENT (asked once on install, never cleared on logout)
  Future<void> saveTenantSlug(String slug) async {
    _memTenantSlug = slug;
    await _storage.write(key: _tenantSlugKey, value: slug);
  }

  Future<String?> getTenantSlug() async {
    if (_memTenantSlug != null && _memTenantSlug!.isNotEmpty) {
      return _memTenantSlug;
    }
    _memTenantSlug = await _storage.read(key: _tenantSlugKey);
    return _memTenantSlug;
  }

  // Base URL override
  Future<void> saveBaseUrl(String url) async {
    await _storage.write(key: _baseUrlKey, value: url);
  }

  Future<String?> getBaseUrl() async {
    return await _storage.read(key: _baseUrlKey);
  }

  // Clear ONLY auth tokens (preserves tenant_slug on logout/token expiry)
  Future<void> clearAuthTokens() async {
    _memAccessToken = null;
    _memRefreshToken = null;
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  // Clear everything (only when user explicitly resets organization)
  Future<void> clearAll() async {
    _memAccessToken = null;
    _memRefreshToken = null;
    _memTenantSlug = null;
    await _storage.deleteAll();
  }
}
