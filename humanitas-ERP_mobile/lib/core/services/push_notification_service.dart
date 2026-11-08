import 'dart:convert';
import 'package:humanitas_erp_mobile/core/api/api_client.dart';

// Decoupled push notification service with pluggable Firebase stubs
// to allow headless CI and environments without native Firebase setup.

class RemoteNotification {
  final String? title;
  final String? body;
  const RemoteNotification({this.title, this.body});
}

class RemoteMessage {
  final Map<String, dynamic> data;
  final RemoteNotification? notification;
  const RemoteMessage({this.data = const {}, this.notification});
}

class FirebaseMessaging {
  static final FirebaseMessaging instance = FirebaseMessaging();
  static final Stream<RemoteMessage> onMessage = const Stream.empty();
  static final Stream<RemoteMessage> onMessageOpenedApp = const Stream.empty();
  final Stream<String> onTokenRefresh = const Stream.empty();

  Future<void> requestPermission({
    bool alert = true,
    bool badge = true,
    bool sound = true,
    bool provisional = false,
  }) async {}

  Future<String?> getToken() async => null;
}

class PushNotificationAction {
  final String action;
  final String title;
  final String? icon;

  const PushNotificationAction({
    required this.action,
    required this.title,
    this.icon,
  });

  factory PushNotificationAction.fromJson(Map<String, dynamic> json) {
    return PushNotificationAction(
      action: json['action']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      icon: json['icon']?.toString(),
    );
  }
}

class PushNotificationPayload {
  final String title;
  final String body;
  final String? deepLink;
  final String? category;
  final String? referenceId;
  final List<PushNotificationAction> actions;

  const PushNotificationPayload({
    required this.title,
    required this.body,
    this.deepLink,
    this.category,
    this.referenceId,
    this.actions = const [],
  });

  factory PushNotificationPayload.fromRemoteMessage(RemoteMessage message) {
    final data = message.data;
    List<PushNotificationAction> parsedActions = [];
    if (data['actions'] != null) {
      try {
        final decoded = jsonDecode(data['actions'].toString());
        if (decoded is List) {
          parsedActions = decoded
              .map((a) => PushNotificationAction.fromJson(Map<String, dynamic>.from(a)))
              .toList();
        }
      } catch (_) {}
    }

    return PushNotificationPayload(
      title: message.notification?.title ?? data['title']?.toString() ?? '',
      body: message.notification?.body ?? data['body']?.toString() ?? '',
      deepLink: data['deep_link']?.toString(),
      category: data['category']?.toString(),
      referenceId: data['reference_id']?.toString(),
      actions: parsedActions,
    );
  }
}

class PushNotificationService {
  final ApiClient _apiClient;
  void Function(PushNotificationPayload)? onNotificationReceived;
  void Function(PushNotificationPayload, PushNotificationAction)? onActionTapped;

  PushNotificationService(this._apiClient);

  Future<void> initialize() async {
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    final token = await messaging.getToken();
    if (token != null) {
      await _registerToken(token, 'android');
    }
    messaging.onTokenRefresh.listen((newToken) => _registerToken(newToken, 'android'));

    // Handle messages while the app is in the foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final payload = PushNotificationPayload.fromRemoteMessage(message);
      onNotificationReceived?.call(payload);
    });

    // Handle user tapping the notification when app opened from background
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      final payload = PushNotificationPayload.fromRemoteMessage(message);
      if (payload.deepLink != null && payload.deepLink!.isNotEmpty) {
        // Handled via router or deep-link handler
      }
    });
  }

  Future<void> _registerToken(String token, String platform) async {
    try {
      await _apiClient.dio.post('/notifications/push/register', data: {
        'token': token,
        'platform': platform,
      });
    } catch (_) {}
  }

  Future<bool> executeQuickAction(String action, String? referenceId) async {
    try {
      switch (action) {
        case 'approve_leave':
          if (referenceId != null) {
            await _apiClient.dio.put('/hrms/leave/$referenceId/status', data: {'status': 'approved'});
            return true;
          }
          break;
        case 'reject_leave':
          if (referenceId != null) {
            await _apiClient.dio.put('/hrms/leave/$referenceId/status', data: {'status': 'rejected'});
            return true;
          }
          break;
        case 'approve_expense':
          if (referenceId != null) {
            await _apiClient.dio.put('/hrms/expenses/$referenceId/status', data: {'status': 'approved'});
            return true;
          }
          break;
        case 'reject_expense':
          if (referenceId != null) {
            await _apiClient.dio.put('/hrms/expenses/$referenceId/status', data: {'status': 'rejected'});
            return true;
          }
          break;
        case 'approve_request':
          if (referenceId != null) {
            await _apiClient.dio.post('/approvals/requests/$referenceId/decide', data: {'action': 'approved'});
            return true;
          }
          break;
        case 'reject_request':
          if (referenceId != null) {
            await _apiClient.dio.post('/approvals/requests/$referenceId/decide', data: {'action': 'rejected'});
            return true;
          }
          break;
        case 'dismiss_missed_clock_in_alarm':
          if (referenceId != null) {
            await _apiClient.dio.post('/attendance/dismiss-alarm', data: {'shift_id': referenceId});
            return true;
          }
          break;
      }
    } catch (_) {
      return false;
    }
    return false;
  }

  // Ringing alarm support for missed clock-in during grace period
  bool _isAlarmRinging = false;
  bool get isAlarmRinging => _isAlarmRinging;
  void Function(bool isRinging)? onAlarmStateChanged;

  void triggerMissedClockInAlarm(String shiftId) {
    _isAlarmRinging = true;
    onAlarmStateChanged?.call(true);
  }

  Future<void> dismissAlarm(String shiftId) async {
    _isAlarmRinging = false;
    onAlarmStateChanged?.call(false);
    await executeQuickAction('dismiss_missed_clock_in_alarm', shiftId);
  }
}
