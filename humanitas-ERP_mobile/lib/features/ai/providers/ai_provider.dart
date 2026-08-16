import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/ai_message_model.dart';
import '../../../core/providers/providers.dart';
import '../repositories/ai_repository.dart';

final aiRepositoryProvider = Provider<AiRepository>((ref) {
  return AiRepository(ref.watch(apiClientProvider));
});

final aiChatProvider = StateNotifierProvider<AiChatNotifier, AiChatState>((ref) {
  return AiChatNotifier(ref.watch(aiRepositoryProvider));
});

class AiChatState {
  final List<AiMessageModel> messages;
  final bool isThinking;
  final String? conversationId;

  AiChatState({
    this.messages = const [],
    this.isThinking = false,
    this.conversationId,
  });

  AiChatState copyWith({
    List<AiMessageModel>? messages,
    bool? isThinking,
    String? conversationId,
  }) {
    return AiChatState(
      messages: messages ?? this.messages,
      isThinking: isThinking ?? this.isThinking,
      conversationId: conversationId ?? this.conversationId,
    );
  }
}

class AiChatNotifier extends StateNotifier<AiChatState> {
  final AiRepository _repo;

  AiChatNotifier(this._repo)
      : super(AiChatState(messages: [
          AiMessageModel(
            id: 'welcome',
            sender: AiMessageSender.ai,
            text: "Hello! I'm your Humanitas AI HR assistant 📱\n\nI know you're on the mobile app, so I'll give you step-by-step instructions using the bottom navigation bar and mobile screens.\n\nHow can I help you today?",
            timestamp: DateTime.now(),
          ),
        ]));

  Future<void> sendUserMessage(String text) async {
    if (text.trim().isEmpty || state.isThinking) return;

    final userMsg = AiMessageModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      sender: AiMessageSender.user,
      text: text.trim(),
      timestamp: DateTime.now(),
    );

    state = state.copyWith(
      messages: [...state.messages, userMsg],
      isThinking: true,
    );

    try {
      final res = await _repo.sendMessage(
        message: text.trim(),
        conversationId: state.conversationId,
      );

      final replyText = (res['reply'] ?? res['response'] ?? res['message'] ?? res['text'] ?? res['content'])?.toString() ?? 'Response received';
      final newConvId = res['conversationId']?.toString() ?? res['conversation_id']?.toString() ?? state.conversationId;

      final aiMsg = AiMessageModel(
        id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
        sender: AiMessageSender.ai,
        text: replyText,
        timestamp: DateTime.now(),
        conversationId: newConvId,
      );

      state = state.copyWith(
        messages: [...state.messages, aiMsg],
        isThinking: false,
        conversationId: newConvId,
      );
    } catch (e) {
      final errorMsg = AiMessageModel(
        id: (DateTime.now().millisecondsSinceEpoch + 1).toString(),
        sender: AiMessageSender.ai,
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: DateTime.now(),
      );

      state = state.copyWith(
        messages: [...state.messages, errorMsg],
        isThinking: false,
      );
    }
  }

  void clearChat() {
    state = AiChatState(messages: [
      AiMessageModel(
        id: 'welcome',
        sender: AiMessageSender.ai,
        text: "Hello! I'm your Humanitas AI HR assistant 📱\n\nI know you're on the mobile app, so I'll give you step-by-step instructions using the bottom navigation bar and mobile screens.\n\nHow can I help you today?",
        timestamp: DateTime.now(),
      ),
    ]);
  }
}
