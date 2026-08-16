enum AiMessageSender { user, ai }

class AiMessageModel {
  final String id;
  final AiMessageSender sender;
  final String text;
  final DateTime timestamp;
  final String? conversationId;

  AiMessageModel({
    required this.id,
    required this.sender,
    required this.text,
    required this.timestamp,
    this.conversationId,
  });

  bool get isUser => sender == AiMessageSender.user;
}
