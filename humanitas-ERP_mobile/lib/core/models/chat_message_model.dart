import 'package:intl/intl.dart';

class ReplyToModel {
  final String id;
  final String content;
  final String? senderId;
  final String? senderName;
  final String? messageType;

  ReplyToModel({
    required this.id,
    required this.content,
    this.senderId,
    this.senderName,
    this.messageType,
  });

  factory ReplyToModel.fromJson(Map<String, dynamic> json) {
    return ReplyToModel(
      id: json['id']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      senderId: json['senderId']?.toString(),
      senderName: json['senderName']?.toString(),
      messageType: json['messageType']?.toString(),
    );
  }
}

class MessageReaction {
  final String id;
  final String emoji;
  final String userId;
  final String? userName;

  MessageReaction({
    required this.id,
    required this.emoji,
    required this.userId,
    this.userName,
  });

  factory MessageReaction.fromJson(Map<String, dynamic> json) {
    return MessageReaction(
      id: json['id']?.toString() ?? '',
      emoji: json['emoji']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      userName: json['userName']?.toString(),
    );
  }
}

class ChatMessageModel {
  final String id;
  final String conversationId;
  final String senderId;
  final String? senderName;
  final String? senderAvatar;
  final String content;
  final String messageType; // text | image | file | voice | video | sticker | system
  final String? attachmentUrl;
  final DateTime? sentAt;
  final bool isDeleted;
  final bool isEdited;
  final String? replyToId;
  final ReplyToModel? replyTo;
  final String? forwardedFromId;
  final List<MessageReaction> reactions;
  final List<String> readReceipts; // list of userIds who read

  ChatMessageModel({
    required this.id,
    required this.conversationId,
    required this.senderId,
    this.senderName,
    this.senderAvatar,
    required this.content,
    this.messageType = 'text',
    this.attachmentUrl,
    this.sentAt,
    this.isDeleted = false,
    this.isEdited = false,
    this.replyToId,
    this.replyTo,
    this.forwardedFromId,
    this.reactions = const [],
    this.readReceipts = const [],
  });

  bool get isForwarded => forwardedFromId != null;

  String get timeFormatted {
    if (sentAt == null) return '';
    try {
      // sentAt is already in local time (server sends local timezone)
      return DateFormat('h:mm a').format(sentAt!);
    } catch (_) {
      return '';
    }
  }

  String get dateLabel {
    if (sentAt == null) return '';
    try {
      // sentAt is already in local time
      final now = DateTime.now();
      final isToday = sentAt!.year == now.year && sentAt!.month == now.month && sentAt!.day == now.day;
      final yesterday = now.subtract(const Duration(days: 1));
      final isYesterday = sentAt!.year == yesterday.year && sentAt!.month == yesterday.month && sentAt!.day == yesterday.day;
      if (isToday) return 'Today';
      if (isYesterday) return 'Yesterday';
      return DateFormat('MMMM d, y').format(sentAt!);
    } catch (_) {
      return '';
    }
  }

  ChatMessageModel copyWith({
    String? content,
    bool? isDeleted,
    bool? isEdited,
    List<MessageReaction>? reactions,
    List<String>? readReceipts,
  }) {
    return ChatMessageModel(
      id: id,
      conversationId: conversationId,
      senderId: senderId,
      senderName: senderName,
      senderAvatar: senderAvatar,
      content: content ?? this.content,
      messageType: messageType,
      attachmentUrl: attachmentUrl,
      sentAt: sentAt,
      isDeleted: isDeleted ?? this.isDeleted,
      isEdited: isEdited ?? this.isEdited,
      replyToId: replyToId,
      replyTo: replyTo,
      forwardedFromId: forwardedFromId,
      reactions: reactions ?? this.reactions,
      readReceipts: readReceipts ?? this.readReceipts,
    );
  }

  factory ChatMessageModel.fromJson(Map<String, dynamic> json) {
    List<MessageReaction> parseReactions(dynamic raw) {
      if (raw is List) {
        return raw.map((e) => MessageReaction.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      }
      return [];
    }

    List<String> parseReadReceipts(dynamic raw) {
      if (raw is List) return raw.map((e) => e.toString()).toList();
      return [];
    }

    ReplyToModel? parseReplyTo(dynamic raw) {
      if (raw == null) return null;
      if (raw is Map) return ReplyToModel.fromJson(Map<String, dynamic>.from(raw));
      return null;
    }

    return ChatMessageModel(
      id: json['id']?.toString() ?? '',
      conversationId: json['conversationId']?.toString() ?? json['conversation_id']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? json['sender_id']?.toString() ?? '',
      senderName: json['senderName']?.toString() ?? json['sender']?['full_name']?.toString(),
      senderAvatar: json['senderAvatar']?.toString() ?? json['sender']?['avatar_url']?.toString(),
      content: json['content']?.toString() ?? '',
      messageType: json['messageType']?.toString() ?? json['message_type']?.toString() ?? 'text',
      attachmentUrl: json['attachmentUrl']?.toString() ?? json['attachment_url']?.toString(),
      sentAt: _parseSentAt(json['sentAt'] ?? json['sent_at'] ?? json['createdAt']),
      isDeleted: json['isDeleted'] == true || json['deleted_for_everyone'] == true,
      isEdited: json['isEdited'] == true || json['is_edited'] == true,
      replyToId: json['replyToId']?.toString() ?? json['reply_to_id']?.toString(),
      replyTo: parseReplyTo(json['replyTo']),
      forwardedFromId: json['forwardedFromId']?.toString() ?? json['forwarded_from_id']?.toString(),
      reactions: parseReactions(json['reactions']),
      readReceipts: parseReadReceipts(json['readReceipts'] ?? json['read_receipts']),
    );
  }
}

/// Parses a sentAt value from the server into a local DateTime for display.
///
/// The PostgreSQL server is configured in UTC+3 (Africa/Addis_Ababa) and
/// stores LOCAL time, but TypeORM/pg serialises it with a 'Z' suffix, making
/// it look like UTC. e.g. server stores "21:40 local" → JSON sends
/// "2026-08-05T21:40:08.965Z". If we call toLocal() we'd add 3 more hours
/// and show "00:40" instead of "21:40".
///
/// Fix: parse the string, then throw away the timezone and reconstruct a
/// plain local DateTime from the raw wall-clock numbers.
DateTime? _parseSentAt(dynamic raw) {
  if (raw == null) return null;
  if (raw is DateTime) {
    // Use the wall-clock numbers directly as local time
    return DateTime(raw.year, raw.month, raw.day, raw.hour, raw.minute, raw.second, raw.millisecond);
  }
  final str = raw.toString().trim();
  if (str.isEmpty) return null;
  try {
    // Parse the string (handles Z, +hh:mm, or bare ISO)
    final dt = DateTime.parse(str);
    // Reconstruct as local — ignore whatever timezone the server attached
    return DateTime(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second, dt.millisecond);
  } catch (_) {
    return null;
  }
}
