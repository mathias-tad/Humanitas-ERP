import 'package:dio/dio.dart';
import 'api_constants.dart';
import 'auth_interceptor.dart';
import '../services/secure_storage_service.dart';

class ApiClient {
  late final Dio dio;
  final SecureStorageService storage;

  ApiClient(this.storage, {String? customBaseUrl}) {
    dio = Dio(
      BaseOptions(
        baseUrl: customBaseUrl ?? ApiConstants.defaultBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(AuthInterceptor(storage, dio));
  }

  void updateBaseUrl(String url) {
    dio.options.baseUrl = url;
  }
}
