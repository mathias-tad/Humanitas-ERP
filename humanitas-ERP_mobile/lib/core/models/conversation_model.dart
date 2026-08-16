import '../api/api_constants.dart';

class ConversationModel {
  final String id;
  final String type; // direct | group | channel | broadcast
  final String? name;
  final String? avatarUrl;
  final String? description;
  final bool onlyAdminsCanPost;
  final bool isAdmin;
  final bool canSendMessages;
  final String? otherUserId;
  final String? createdById;
  final int memberCount;
  final int unreadCount;
  final Map<String, dynamic>? lastMessage;
  final String? lastMessageAt;
  final bool isArchived;
  final List<Map<String, dynamic>> participants;

  ConversationModel({
    required this.id,
    this.type = 'direct',
    this.name,
    this.avatarUrl,
    this.description,
    this.onlyAdminsCanPost = false,
    this.isAdmin = false,
    this.canSendMessages = true,
    this.otherUserId,
    this.createdById,
    this.memberCount = 0,
    this.unreadCount = 0,
    this.lastMessage,
    this.lastMessageAt,
    this.isArchived = false,
    this.participants = const [],
  });

  bool get isDirect => type == 'direct';
  bool get isGroup => type == 'group';
  bool get isChannel => type == 'channel';
  bool get isBroadcast => type == 'broadcast';

  String? get resolvedAvatarUrl {
    String? url = avatarUrl;
    if ((url == null || url.isEmpty) && isDirect && participants.isNotEmpty) {
      for (final p in participants) {
        final u = p['user'] as Map<String, dynamic>? ?? p;
        final uAvatar = u['avatar_url']?.toString() ?? u['avatarUrl']?.toString();
        if (uAvatar != null && uAvatar.isNotEmpty) {
          url = uAvatar;
          break;
        }
      }
    }
    if (url == null || url.trim().isEmpty) return null;
    final trimmed = url.trim();
    if (trimmed.startsWith('http')) return trimmed;
    final base = ApiConstants.defaultBaseUrl.replaceAll('/api/v1', '');
    return '$base$trimmed';
  }

  String get displayName {
    if (name != null && name!.isNotEmpty) return name!;
    if (participants.isNotEmpty) {
      final names = participants
          .map((p) => p['user']?['full_name']?.toString() ?? p['full_name']?.toString() ?? '')
          .where((n) => n.isNotEmpty)
          .join(', ');
      if (names.isNotEmpty) return names;
    }
    return 'Conversation';
  }

  String get lastMessageText {
    if (lastMessage == null) return 'No messages yet';
    final rawContent = lastMessage!['content']?.toString() ?? '';
    final msgType = lastMessage!['messageType']?.toString() ?? 'text';
    final sender = lastMessage!['senderName']?.toString();

    // Format special message types into clean readable previews
    String displayContent = rawContent;
    if (msgType == 'voice' ||
        rawContent.contains('::dur:') ||
        rawContent.startsWith('/uploads/') ||
        rawContent.contains('.m4a') ||
        rawContent.contains('.mp3') ||
        rawContent.contains('.ogg')) {
      displayContent = '🎤 Voice message';
    } else if (msgType == 'image' || rawContent.contains('.jpg') || rawContent.contains('.png') || rawContent.contains('.jpeg') || rawContent.contains('.gif') || rawContent.contains('.webp')) {
      displayContent = '📷 Photo';
    } else if (msgType == 'file') {
      displayContent = '📁 Document';
    } else if (msgType == 'video' || rawContent.contains('.mp4') || rawContent.contains('.mov')) {
      displayContent = '🎥 Video';
    }

    if (type != 'direct' && sender != null && sender.isNotEmpty) {
      return '$sender: $displayContent';
    }
    return displayContent;
  }

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> parseParts(dynamic raw) {
      if (raw is List) return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      return [];
    }

    Map<String, dynamic>? parseLastMsg(dynamic raw) {
      if (raw == null) return null;
      if (raw is String) return {'content': raw};
      if (raw is Map) return Map<String, dynamic>.from(raw);
      return null;
    }

    return ConversationModel(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? 'direct',
      name: json['name']?.toString(),
      avatarUrl: json['avatarUrl']?.toString() ?? json['avatar_url']?.toString(),
      description: json['description']?.toString(),
      onlyAdminsCanPost: json['onlyAdminsCanPost'] == true || json['only_admins_can_post'] == true,
      isAdmin: json['isAdmin'] == true || json['is_admin'] == true,
      canSendMessages: json['canSendMessages'] != false,
      otherUserId: json['otherUserId']?.toString(),
      createdById: json['createdById']?.toString() ?? json['created_by_id']?.toString(),
      memberCount: _toInt(json['memberCount'] ?? json['member_count']),
      unreadCount: _toInt(json['unreadCount'] ?? json['unread_count']),
      lastMessage: parseLastMsg(json['lastMessage'] ?? json['last_message']),
      lastMessageAt: json['lastMessageAt']?.toString() ?? json['last_message_at']?.toString() ?? json['updatedAt']?.toString(),
      isArchived: json['isArchived'] == true || json['is_archived'] == true,
      participants: parseParts(json['participants']),
    );
  }

  ConversationModel copyWith({
    String? name,
    String? avatarUrl,
    String? description,
    bool? onlyAdminsCanPost,
    bool? isAdmin,
    bool? canSendMessages,
    int? memberCount,
    int? unreadCount,
    Map<String, dynamic>? lastMessage,
    String? lastMessageAt,
    List<Map<String, dynamic>>? participants,
  }) {
    return ConversationModel(
      id: id,
      type: type,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      description: description ?? this.description,
      onlyAdminsCanPost: onlyAdminsCanPost ?? this.onlyAdminsCanPost,
      isAdmin: isAdmin ?? this.isAdmin,
      canSendMessages: canSendMessages ?? this.canSendMessages,
      otherUserId: otherUserId,
      createdById: createdById,
      memberCount: memberCount ?? this.memberCount,
      unreadCount: unreadCount ?? this.unreadCount,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      isArchived: isArchived,
      participants: participants ?? this.participants,
    );
  }

  static int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    return int.tryParse(v.toString()) ?? 0;
  }
}
