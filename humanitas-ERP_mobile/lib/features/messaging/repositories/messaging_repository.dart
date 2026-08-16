import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/conversation_model.dart';
import '../../../core/models/chat_message_model.dart';

class MessagingRepository {
  final ApiClient _apiClient;
  MessagingRepository(this._apiClient);

  // ── Conversations ──────────────────────────────────────────────

  Future<List<ConversationModel>> getConversations() async {
    final res = await _apiClient.dio.get(ApiConstants.messagingConversations);
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => ConversationModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<ConversationModel> getConversation(String id) async {
    final res = await _apiClient.dio.get('${ApiConstants.messagingConversations}/$id');
    return ConversationModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<ConversationModel> createConversation({
    required String type,
    List<String> participantIds = const [],
    String? name,
    String? description,
    String? avatarUrl,
    bool onlyAdminsCanPost = false,
  }) async {
    final res = await _apiClient.dio.post(
      ApiConstants.messagingConversations,
      data: {
        'type': type,
        'participantIds': participantIds,
        if (name != null && name.isNotEmpty) 'name': name,
        if (description != null && description.isNotEmpty) 'description': description,
        if (avatarUrl != null && avatarUrl.isNotEmpty) 'avatarUrl': avatarUrl,
        'onlyAdminsCanPost': onlyAdminsCanPost,
      },
    );
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return ConversationModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<ConversationModel> updateConversation(String id, {
    String? name,
    String? description,
    String? avatarUrl,
    bool? onlyAdminsCanPost,
  }) async {
    final res = await _apiClient.dio.patch(
      '${ApiConstants.messagingConversations}/$id',
      data: {
        'name': ?name,
        'description': ?description,
        'avatarUrl': ?avatarUrl,
        'onlyAdminsCanPost': ?onlyAdminsCanPost,
      },
    );
    return ConversationModel.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<ConversationModel> uploadGroupAvatar(String conversationId, List<int> bytes, String filename, String mime) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename, contentType: DioMediaType.parse(mime)),
    });
    final res = await _apiClient.dio.post(
      '${ApiConstants.messagingConversations}/$conversationId/avatar',
      data: formData,
      options: Options(headers: {'Content-Type': 'multipart/form-data'}),
    );
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return ConversationModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<void> addMembers(String conversationId, List<String> userIds) async {
    await _apiClient.dio.post(
      ApiConstants.messagingConvMembers(conversationId),
      data: {'userIds': userIds},
    );
  }

  Future<void> removeMember(String conversationId, String userId) async {
    await _apiClient.dio.delete(ApiConstants.messagingConvMember(conversationId, userId));
  }

  Future<void> updateMemberRole(String conversationId, String userId, String role) async {
    await _apiClient.dio.patch(
      ApiConstants.messagingConvMemberRole(conversationId, userId),
      data: {'role': role},
    );
  }

  Future<void> markAsRead(String conversationId) async {
    try {
      await _apiClient.dio.post(ApiConstants.messagingConvRead(conversationId));
    } catch (_) {}
  }

  // ── Messages ───────────────────────────────────────────────────

  Future<List<ChatMessageModel>> getMessages(String conversationId) async {
    final res = await _apiClient.dio.get(ApiConstants.messagingConvMessages(conversationId));
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => ChatMessageModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<ChatMessageModel> sendMessage({
    required String conversationId,
    required String content,
    String messageType = 'text',
    String? replyToId,
    String? forwardedFromId,
    String? attachmentUrl,
  }) async {
    final res = await _apiClient.dio.post(
      ApiConstants.messagingMessages,
      data: {
        'conversationId': conversationId,
        'content': content,
        'messageType': messageType,
        'replyToId': ?replyToId,
        'forwardedFromId': ?forwardedFromId,
        'attachmentUrl': ?attachmentUrl,
      },
    );
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return ChatMessageModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<ChatMessageModel> editMessage(String messageId, String content) async {
    final res = await _apiClient.dio.patch(
      ApiConstants.messagingMessageEdit(messageId),
      data: {'content': content},
    );
    dynamic raw = res.data;
    if (raw is List && raw.isNotEmpty) raw = raw.first;
    return ChatMessageModel.fromJson(Map<String, dynamic>.from(raw as Map));
  }

  Future<void> deleteMessage(String messageId, {bool forEveryone = true}) async {
    await _apiClient.dio.delete(
      ApiConstants.messagingMessageDelete(messageId),
      data: {},
      queryParameters: {'forEveryone': forEveryone.toString()},
    );
  }

  Future<List<ChatMessageModel>> forwardMessage(String messageId, List<String> conversationIds) async {
    final res = await _apiClient.dio.post(
      ApiConstants.messagingMessageForward(messageId),
      data: {'conversationIds': conversationIds},
    );
    final data = res.data;
    if (data is List) {
      return data
          .map((e) => ChatMessageModel.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    }
    return [];
  }

  Future<void> reactToMessage(String messageId, String emoji) async {
    await _apiClient.dio.post(
      ApiConstants.messagingMessageReact(messageId),
      data: {'emoji': emoji},
    );
  }

  // ── Upload ─────────────────────────────────────────────────────

  Future<String> uploadFile(String filePath) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(filePath),
    });
    final res = await _apiClient.dio.post('/messaging/upload', data: formData);
    final data = Map<String, dynamic>.from(res.data as Map);
    return data['url']?.toString() ?? '';
  }

  // ── Users Search ───────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> searchUsers(String query) async {
    final res = await _apiClient.dio.get(
      ApiConstants.messagingUsersSearch,
      queryParameters: {'q': query},
    );
    final data = res.data;
    if (data is List) return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return [];
  }

  // ── Settings ───────────────────────────────────────────────────

  Future<Map<String, dynamic>> getSettings() async {
    final res = await _apiClient.dio.get(ApiConstants.messagingSettings);
    return Map<String, dynamic>.from(res.data as Map);
  }

  Future<Map<String, dynamic>> updateSettings(Map<String, dynamic> updates) async {
    final res = await _apiClient.dio.patch(ApiConstants.messagingSettings, data: updates);
    return Map<String, dynamic>.from(res.data as Map);
  }
}
