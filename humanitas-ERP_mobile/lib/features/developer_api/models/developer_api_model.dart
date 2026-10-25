class ApiKeyModel {
  final String id;
  final String name;
  final String keyPrefix;
  final String status; // active, revoked
  final String? lastUsedAt;
  final String? expiresAt;
  final String createdAt;
  final String? rawToken; // only returned on creation

  const ApiKeyModel({
    required this.id,
    required this.name,
    required this.keyPrefix,
    required this.status,
    this.lastUsedAt,
    this.expiresAt,
    required this.createdAt,
    this.rawToken,
  });

  factory ApiKeyModel.fromJson(Map<String, dynamic> json) {
    return ApiKeyModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      keyPrefix: json['key_prefix']?.toString() ?? '',
      status: json['status']?.toString() ?? 'active',
      lastUsedAt: json['last_used_at']?.toString(),
      expiresAt: json['expires_at']?.toString(),
      createdAt: json['created_at']?.toString() ?? '',
      rawToken: json['raw_token']?.toString(),
    );
  }
}

class ApiKeyLogModel {
  final String id;
  final String apiKeyId;
  final String method;
  final String path;
  final int statusCode;
  final int? responseTimeMs;
  final String? ipAddress;
  final String createdAt;

  const ApiKeyLogModel({
    required this.id,
    required this.apiKeyId,
    required this.method,
    required this.path,
    required this.statusCode,
    this.responseTimeMs,
    this.ipAddress,
    required this.createdAt,
  });

  factory ApiKeyLogModel.fromJson(Map<String, dynamic> json) {
    return ApiKeyLogModel(
      id: json['id']?.toString() ?? '',
      apiKeyId: json['api_key_id']?.toString() ?? '',
      method: json['method']?.toString() ?? 'GET',
      path: json['path']?.toString() ?? '/',
      statusCode: int.tryParse(json['status_code']?.toString() ?? '200') ?? 200,
      responseTimeMs: int.tryParse(json['response_time_ms']?.toString() ?? ''),
      ipAddress: json['ip_address']?.toString(),
      createdAt: json['created_at']?.toString() ?? '',
    );
  }
}

class WebhookSubscriptionModel {
  final String id;
  final String name;
  final String url;
  final List<String> events;
  final bool isActive;
  final String? secret;
  final String createdAt;

  const WebhookSubscriptionModel({
    required this.id,
    required this.name,
    required this.url,
    required this.events,
    required this.isActive,
    this.secret,
    required this.createdAt,
  });

  factory WebhookSubscriptionModel.fromJson(Map<String, dynamic> json) {
    final eventsRaw = json['events'];
    List<String> events = [];
    if (eventsRaw is List) {
      events = eventsRaw.map((e) => e.toString()).toList();
    } else if (eventsRaw is String) {
      try {
        // Handle JSON-encoded string
        events = eventsRaw.replaceAll('[', '').replaceAll(']', '').replaceAll('"', '').split(',').where((e) => e.isNotEmpty).toList();
      } catch (_) {}
    }

    return WebhookSubscriptionModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      url: json['url']?.toString() ?? '',
      events: events,
      isActive: json['is_active'] == true || json['is_active'] == 1,
      secret: json['secret']?.toString(),
      createdAt: json['created_at']?.toString() ?? '',
    );
  }
}

class WebhookDeliveryModel {
  final String id;
  final String webhookId;
  final String eventType;
  final int statusCode;
  final bool success;
  final String? errorMessage;
  final int? attemptCount;
  final String createdAt;

  const WebhookDeliveryModel({
    required this.id,
    required this.webhookId,
    required this.eventType,
    required this.statusCode,
    required this.success,
    this.errorMessage,
    this.attemptCount,
    required this.createdAt,
  });

  factory WebhookDeliveryModel.fromJson(Map<String, dynamic> json) {
    return WebhookDeliveryModel(
      id: json['id']?.toString() ?? '',
      webhookId: json['webhook_id']?.toString() ?? '',
      eventType: json['event_type']?.toString() ?? '',
      statusCode: int.tryParse(json['status_code']?.toString() ?? '0') ?? 0,
      success: json['success'] == true || json['success'] == 1,
      errorMessage: json['error_message']?.toString(),
      attemptCount: int.tryParse(json['attempt_count']?.toString() ?? '1') ?? 1,
      createdAt: json['created_at']?.toString() ?? '',
    );
  }
}
