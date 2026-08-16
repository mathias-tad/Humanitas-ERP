import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';

/// Mobile navigation context prepended to every user message so the AI
/// responds with mobile-specific instructions regardless of backend support.
const String _mobileSystemPrefix = '''[SYSTEM CONTEXT – Mobile App]
The user is on the Humanitas MOBILE APP (Android/iOS), not the web.
Always give navigation using the mobile bottom bar tabs, never mention web sidebar menus or URL routes.
Mobile bottom bar: (1) Home – dashboard & clock-in/out, (2) Requests – leave/loans/per diem, (3) Messages – chats, (4) Profile – settings/payslips/attendance/tasks/notifications.
Key paths: Leave request → Requests tab → Leave → "+"; Clock in → Home tab → Clock In button; Payslip → Profile tab → Payslips; Loan → Requests tab → Loans → New Request; Password change → Profile tab → Settings → Account & Security tab; Notifications → Profile tab → bell icon.
[USER MESSAGE]
''';

class AiRepository {
  final ApiClient _apiClient;
  AiRepository(this._apiClient);

  Future<Map<String, dynamic>> sendMessage({
    required String message,
    String? conversationId,
  }) async {
    final res = await _apiClient.dio.post(
      ApiConstants.aiChat,
      data: {
        'message': '$_mobileSystemPrefix$message',
        if (conversationId != null && conversationId.isNotEmpty)
          'conversationId': conversationId,
      },
    );
    if (res.data is Map) return Map<String, dynamic>.from(res.data as Map);
    return {'text': res.data?.toString() ?? 'No response'};
  }
}
