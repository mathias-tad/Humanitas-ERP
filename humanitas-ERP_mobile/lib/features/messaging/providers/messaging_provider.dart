import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/conversation_model.dart';
import '../../../core/models/chat_message_model.dart';
import '../../../core/providers/providers.dart';
import '../repositories/messaging_repository.dart';

// ── Repository Provider ────────────────────────────────────────────────────────

final messagingRepositoryProvider = Provider<MessagingRepository>((ref) {
  return MessagingRepository(ref.watch(apiClientProvider));
});

// ── Conversations ──────────────────────────────────────────────────────────────

final conversationsProvider =
    StateNotifierProvider<ConversationsNotifier, AsyncValue<List<ConversationModel>>>((ref) {
  return ConversationsNotifier(ref.watch(messagingRepositoryProvider));
});

class ConversationsNotifier extends StateNotifier<AsyncValue<List<ConversationModel>>> {
  final MessagingRepository _repo;

  ConversationsNotifier(this._repo) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repo.getConversations();
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void upsertConversation(ConversationModel conv) {
    final current = state.asData?.value ?? [];
    final idx = current.indexWhere((c) => c.id == conv.id);
    if (idx >= 0) {
      final updated = [...current];
      updated[idx] = conv;
      state = AsyncValue.data(updated);
    } else {
      state = AsyncValue.data([conv, ...current]);
    }
  }

  void updateLastMessage(String conversationId, Map<String, dynamic> lastMsg) {
    final current = state.asData?.value ?? [];
    final idx = current.indexWhere((c) => c.id == conversationId);
    if (idx >= 0) {
      final updated = [...current];
      updated[idx] = updated[idx].copyWith(lastMessage: lastMsg);
      // Move to top
      final conv = updated.removeAt(idx);
      updated.insert(0, conv);
      state = AsyncValue.data(updated);
    }
  }

  void incrementUnread(String conversationId) {
    final current = state.asData?.value ?? [];
    final idx = current.indexWhere((c) => c.id == conversationId);
    if (idx >= 0) {
      final updated = [...current];
      updated[idx] = updated[idx].copyWith(unreadCount: updated[idx].unreadCount + 1);
      state = AsyncValue.data(updated);
    }
  }

  void clearUnread(String conversationId) {
    final current = state.asData?.value ?? [];
    final idx = current.indexWhere((c) => c.id == conversationId);
    if (idx >= 0) {
      final updated = [...current];
      updated[idx] = updated[idx].copyWith(unreadCount: 0);
      state = AsyncValue.data(updated);
    }
  }
}

// ── Active Chat ────────────────────────────────────────────────────────────────

final activeChatMessagesProvider = StateNotifierProvider.family
    .autoDispose<ActiveChatNotifier, AsyncValue<List<ChatMessageModel>>, String>(
        (ref, conversationId) {
  return ActiveChatNotifier(ref.watch(messagingRepositoryProvider), conversationId);
});

class ActiveChatNotifier extends StateNotifier<AsyncValue<List<ChatMessageModel>>> {
  final MessagingRepository _repo;
  final String conversationId;

  ActiveChatNotifier(this._repo, this.conversationId)
      : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    try {
      final list = await _repo.getMessages(conversationId);
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void addMessage(ChatMessageModel msg) {
    final current = state.asData?.value ?? [];
    // Avoid duplicates
    if (current.any((m) => m.id == msg.id)) return;
    state = AsyncValue.data([...current, msg]);
  }

  void updateMessage(ChatMessageModel updated) {
    final current = state.asData?.value ?? [];
    state = AsyncValue.data(
      current.map((m) => m.id == updated.id ? updated : m).toList(),
    );
  }

  void deleteMessage(String messageId) {
    final current = state.asData?.value ?? [];
    state = AsyncValue.data(
      current.map((m) => m.id == messageId ? m.copyWith(isDeleted: true, content: 'This message was deleted') : m).toList(),
    );
  }

  void updateReactions(String messageId, List<MessageReaction> reactions) {
    final current = state.asData?.value ?? [];
    state = AsyncValue.data(
      current.map((m) => m.id == messageId ? m.copyWith(reactions: reactions) : m).toList(),
    );
  }

  Future<void> sendMessage({
    required String content,
    String messageType = 'text',
    String? replyToId,
    String? forwardedFromId,
    String? attachmentUrl,
  }) async {
    try {
      final msg = await _repo.sendMessage(
        conversationId: conversationId,
        content: content,
        messageType: messageType,
        replyToId: replyToId,
        forwardedFromId: forwardedFromId,
        attachmentUrl: attachmentUrl,
      );
      addMessage(msg);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> editMessage(String messageId, String content) async {
    final updated = await _repo.editMessage(messageId, content);
    updateMessage(updated);
  }

  void removeMessageLocally(String messageId) {
    final current = state.asData?.value ?? [];
    state = AsyncValue.data(current.where((m) => m.id != messageId).toList());
  }

  Future<void> deleteMessageForEveryone(String messageId) async {
    await _repo.deleteMessage(messageId, forEveryone: true);
    deleteMessage(messageId);
  }

  Future<void> deleteMessageForMe(String messageId) async {
    await _repo.deleteMessage(messageId, forEveryone: false);
    removeMessageLocally(messageId);
  }

  Future<void> reactToMessage(String messageId, String emoji) async {
    await _repo.reactToMessage(messageId, emoji);
  }
}

// ── User Search ────────────────────────────────────────────────────────────────

final userSearchProvider =
    StateNotifierProvider<UserSearchNotifier, AsyncValue<List<Map<String, dynamic>>>>((ref) {
  return UserSearchNotifier(ref.watch(messagingRepositoryProvider));
});

class UserSearchNotifier extends StateNotifier<AsyncValue<List<Map<String, dynamic>>>> {
  final MessagingRepository _repo;
  UserSearchNotifier(this._repo) : super(const AsyncValue.data([]));

  Future<void> search(String query) async {
    state = const AsyncValue.loading();
    try {
      final results = await _repo.searchUsers(query);
      state = AsyncValue.data(results);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void clear() => state = const AsyncValue.data([]);
}

// ── Messaging Settings ────────────────────────────────────────────────────────

final messagingSettingsProvider =
    StateNotifierProvider<MessagingSettingsNotifier, AsyncValue<Map<String, dynamic>>>((ref) {
  return MessagingSettingsNotifier(ref.watch(messagingRepositoryProvider));
});

class MessagingSettingsNotifier extends StateNotifier<AsyncValue<Map<String, dynamic>>> {
  final MessagingRepository _repo;
  MessagingSettingsNotifier(this._repo) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    try {
      final settings = await _repo.getSettings();
      state = AsyncValue.data(settings);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> update(Map<String, dynamic> updates) async {
    try {
      final updated = await _repo.updateSettings(updates);
      state = AsyncValue.data(updated);
    } catch (e) {
      rethrow;
    }
  }
}
