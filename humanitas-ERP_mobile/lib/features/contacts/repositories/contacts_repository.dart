import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../../products/models/product_models.dart' show TimelinePage;
import '../models/contact_models.dart';

/// A failed Contacts API call, with the server's message when it sent one.
class ContactsApiException implements Exception {
  final String message;
  final int? statusCode;

  const ContactsApiException(this.message, {this.statusCode});

  bool get isConflict => statusCode == 409;

  @override
  String toString() => message;
}

/// Contacts API (tenant backend). Errors are thrown so screens can show them.
class ContactsRepository {
  final ApiClient _apiClient;

  ContactsRepository(this._apiClient);

  Dio get _dio => _apiClient.dio;

  Future<T> _call<T>(Future<T> Function() run, String fallback) async {
    try {
      return await run();
    } on DioException catch (e) {
      final data = e.response?.data;
      var message = fallback;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        message = m is List ? m.join('\n') : m.toString();
      } else if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
        message = 'No connection to the server. Check your internet and try again.';
      }
      throw ContactsApiException(message, statusCode: e.response?.statusCode);
    }
  }

  Map<String, dynamic> _map(dynamic data) => data is Map<String, dynamic> ? data : <String, dynamic>{};

  Future<ContactPage> list(ContactQuery query, {int page = 1, int limit = 40}) => _call(() async {
        final res = await _dio.get('/contacts', queryParameters: query.toParams(page, limit));
        return ContactPage.fromJson(_map(res.data));
      }, 'Could not load contacts');

  Future<Contact> get(String id) => _call(() async {
        final res = await _dio.get('/contacts/$id');
        return Contact.fromJson(_map(res.data));
      }, 'Could not load the contact');

  Future<List<DuplicateContact>> duplicates({String? tin, String? phone, String? mobile, String? email, String? excludeId}) => _call(() async {
        final res = await _dio.get('/contacts/duplicates', queryParameters: {
          if (tin != null && tin.isNotEmpty) 'tin': tin,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
          if (mobile != null && mobile.isNotEmpty) 'mobile': mobile,
          if (email != null && email.isNotEmpty) 'email': email,
          if (excludeId != null) 'exclude_id': excludeId,
        });
        final data = res.data;
        return data is List ? data.whereType<Map<String, dynamic>>().map(DuplicateContact.fromJson).toList() : <DuplicateContact>[];
      }, 'Could not check for duplicates');

  Future<Contact> create(Map<String, dynamic> body) => _call(() async {
        final res = await _dio.post('/contacts', data: body);
        return Contact.fromJson(_map(res.data));
      }, 'Could not create the contact');

  Future<Contact> update(String id, Map<String, dynamic> body) => _call(() async {
        final res = await _dio.patch('/contacts/$id', data: body);
        return Contact.fromJson(_map(res.data));
      }, 'Could not save the contact');

  Future<void> archive(String id) => _call(() async {
        await _dio.delete('/contacts/$id');
      }, 'Could not archive the contact');

  Future<void> restore(String id) => _call(() async {
        await _dio.post('/contacts/$id/restore');
      }, 'Could not restore the contact');

  Future<TimelinePage> timeline(String id, {String? before}) => _call(() async {
        final res = await _dio.get('/contacts/$id/timeline', queryParameters: {if (before != null && before.isNotEmpty) 'before': before});
        return TimelinePage.fromJson(_map(res.data));
      }, 'Could not load the history');

  Future<void> logInteraction(String id, {required String kind, required String summary, String? direction, String? personId}) => _call(() async {
        await _dio.post('/contacts/$id/interactions', data: {
          'kind': kind,
          'summary': summary,
          if (direction != null && kind != 'note') 'direction': direction,
          if (personId != null) 'person_id': personId,
        });
      }, 'Could not log it');

  Future<List<ContactCategory>> categories() => _call(() async {
        final res = await _dio.get('/contact-categories');
        final data = res.data;
        return data is List ? data.whereType<Map<String, dynamic>>().map(ContactCategory.fromJson).toList() : <ContactCategory>[];
      }, 'Could not load categories');
}
