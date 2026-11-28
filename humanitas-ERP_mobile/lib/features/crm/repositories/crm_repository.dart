import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../models/crm_models.dart';

/// A failed CRM API call, with the server's message when it sent one.
class CrmApiException implements Exception {
  final String message;
  final int? statusCode;

  const CrmApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

/// CRM API (tenant backend, /crm). Errors are thrown so screens can show them.
class CrmRepository {
  final ApiClient _apiClient;

  CrmRepository(this._apiClient);

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
      throw CrmApiException(message, statusCode: e.response?.statusCode);
    }
  }

  Map<String, dynamic> _map(dynamic data) => data is Map<String, dynamic> ? data : <String, dynamic>{};

  List<Map<String, dynamic>> _list(dynamic data) => data is List ? data.whereType<Map<String, dynamic>>().toList() : const [];

  // ── Leads ─────────────────────────────────────────────────────────────────
  Future<CrmPage<Lead>> leads(LeadQuery query, {int page = 1, int limit = 40}) => _call(() async {
        final res = await _dio.get('/crm/leads', queryParameters: query.toParams(page, limit));
        return CrmPage.fromJson(_map(res.data), Lead.fromJson);
      }, 'Could not load leads');

  Future<Lead> lead(String id) => _call(() async {
        final res = await _dio.get('/crm/leads/$id');
        return Lead.fromJson(_map(res.data));
      }, 'Could not load the lead');

  Future<Lead> createLead(Map<String, dynamic> body) => _call(() async {
        final res = await _dio.post('/crm/leads', data: body);
        return Lead.fromJson(_map(res.data));
      }, 'Could not create the lead');

  Future<Lead> updateLead(String id, Map<String, dynamic> body) => _call(() async {
        final res = await _dio.patch('/crm/leads/$id', data: body);
        return Lead.fromJson(_map(res.data));
      }, 'Could not save the lead');

  Future<Lead> loseLead(String id, {required String reasonId, String note = ''}) => _call(() async {
        final res = await _dio.post('/crm/leads/$id/lose', data: {'lost_reason_id': reasonId, 'note': note.trim().isEmpty ? null : note.trim()});
        return Lead.fromJson(_map(res.data));
      }, 'Could not mark the lead as lost');

  /// Converts into a customer contact (an existing one, or a new one from the lead) and, unless told not to, a deal.
  Future<Lead> convertLead(String id, {String? contactId, bool createDeal = true, String dealName = '', double? expectedRevenue, String? expectedCloseDate}) =>
      _call(() async {
        final res = await _dio.post('/crm/leads/$id/convert', data: {
          'contact_id': ?contactId,
          'create_opportunity': createDeal,
          if (createDeal && dealName.trim().isNotEmpty) 'opportunity_name': dealName.trim(),
          if (createDeal && expectedRevenue != null) 'expected_revenue': expectedRevenue,
          if (createDeal && expectedCloseDate != null) 'expected_close_date': expectedCloseDate,
        });
        return Lead.fromJson(_map(res.data));
      }, 'Could not convert the lead');

  Future<void> archiveLead(String id) => _call(() async {
        await _dio.delete('/crm/leads/$id');
      }, 'Could not archive the lead');

  Future<void> restoreLead(String id) => _call(() async {
        await _dio.post('/crm/leads/$id/restore');
      }, 'Could not restore the lead');

  // ── Deals ─────────────────────────────────────────────────────────────────
  Future<CrmPage<Deal>> deals(DealQuery query, {int page = 1, int limit = 40}) => _call(() async {
        final res = await _dio.get('/crm/opportunities', queryParameters: query.toParams(page, limit));
        return CrmPage.fromJson(_map(res.data), Deal.fromJson);
      }, 'Could not load deals');

  Future<Deal> deal(String id) => _call(() async {
        final res = await _dio.get('/crm/opportunities/$id');
        return Deal.fromJson(_map(res.data));
      }, 'Could not load the deal');

  Future<Deal> createDeal(Map<String, dynamic> body) => _call(() async {
        final res = await _dio.post('/crm/opportunities', data: body);
        return Deal.fromJson(_map(res.data));
      }, 'Could not create the deal');

  Future<Deal> updateDeal(String id, Map<String, dynamic> body) => _call(() async {
        final res = await _dio.patch('/crm/opportunities/$id', data: body);
        return Deal.fromJson(_map(res.data));
      }, 'Could not save the deal');

  Future<Deal> moveStage(String id, String stageId) => _call(() async {
        final res = await _dio.post('/crm/opportunities/$id/stage', data: {'stage_id': stageId});
        return Deal.fromJson(_map(res.data));
      }, 'Could not move the deal');

  Future<Deal> markWon(String id) => _call(() async {
        final res = await _dio.post('/crm/opportunities/$id/won');
        return Deal.fromJson(_map(res.data));
      }, 'Could not mark the deal as won');

  Future<Deal> loseDeal(String id, {required String reasonId, String note = ''}) => _call(() async {
        final res = await _dio.post('/crm/opportunities/$id/lose', data: {'lost_reason_id': reasonId, 'note': note.trim().isEmpty ? null : note.trim()});
        return Deal.fromJson(_map(res.data));
      }, 'Could not mark the deal as lost');

  Future<Deal> reopenDeal(String id) => _call(() async {
        final res = await _dio.post('/crm/opportunities/$id/reopen');
        return Deal.fromJson(_map(res.data));
      }, 'Could not reopen the deal');

  // ── Activities ────────────────────────────────────────────────────────────
  Future<CrmPage<CrmActivity>> activities(ActivityQuery query, {int page = 1, int limit = 40}) => _call(() async {
        final res = await _dio.get('/crm/activities', queryParameters: query.toParams(page, limit));
        return CrmPage.fromJson(_map(res.data), CrmActivity.fromJson);
      }, 'Could not load activities');

  Future<ActivitySummary> activitySummary() => _call(() async {
        final res = await _dio.get('/crm/activities/summary');
        return ActivitySummary.fromJson(_map(res.data));
      }, 'Could not load your activities');

  Future<void> saveActivity(Map<String, dynamic> body, {String? id}) => _call(() async {
        if (id == null) {
          await _dio.post('/crm/activities', data: body);
        } else {
          await _dio.patch('/crm/activities/$id', data: body);
        }
      }, 'Could not save the activity');

  Future<void> completeActivity(String id, {String outcome = ''}) => _call(() async {
        await _dio.post('/crm/activities/$id/done', data: {'outcome': outcome.trim().isEmpty ? null : outcome.trim()});
      }, 'Could not mark it done');

  Future<void> removeActivity(String id) => _call(() async {
        await _dio.delete('/crm/activities/$id');
      }, 'Could not remove the activity');

  // ── Follow-ups ────────────────────────────────────────────────────────────
  String _followUps(String target, String id) => '/crm/${target == 'lead' ? 'leads' : 'opportunities'}/$id/follow-ups';

  /// [target] is 'lead' or 'opportunity'.
  Future<FollowUpPage> followUps(String target, String id, {String? before}) => _call(() async {
        final res = await _dio.get(_followUps(target, id), queryParameters: {'limit': 30, 'before': ?before});
        return FollowUpPage.fromJson(_map(res.data));
      }, 'Could not load the follow-ups');

  /// Logs a contact that already happened (and optionally plans the next step); returns its number (1st, 2nd…).
  Future<int?> logFollowUp(String target, String id, Map<String, dynamic> body) => _call(() async {
        final res = await _dio.post(_followUps(target, id), data: body);
        final seq = _map(res.data)['sequence'];
        return seq is num ? seq.toInt() : null;
      }, 'Could not log the follow-up');

  // ── Set-up ────────────────────────────────────────────────────────────────
  Future<List<Pipeline>> pipelines() => _call(() async {
        final res = await _dio.get('/crm/setup/pipelines');
        return _list(res.data).map(Pipeline.fromJson).toList();
      }, 'Could not load the pipelines');

  Future<List<CrmListItem>> sources() => _call(() async {
        final res = await _dio.get('/crm/setup/sources');
        return _list(res.data).map(CrmListItem.fromJson).toList();
      }, 'Could not load the lead sources');

  Future<List<CrmListItem>> lostReasons() => _call(() async {
        final res = await _dio.get('/crm/setup/lost-reasons');
        return _list(res.data).map(CrmListItem.fromJson).toList();
      }, 'Could not load the lost reasons');
}
