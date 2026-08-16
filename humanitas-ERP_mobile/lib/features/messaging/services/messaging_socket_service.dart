import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../core/api/api_constants.dart';
import '../../../core/models/chat_message_model.dart';
import '../providers/messaging_provider.dart';

final messagingSocketProvider = Provider<MessagingSocketService>((ref) {
  final service = MessagingSocketService(ref);
  ref.onDispose(() => service.disconnect());
  return service;
});

class MessagingSocketService {
  final Ref _ref;
  io.Socket? _socket;
  bool _isConnecting = false;

  MessagingSocketService(this._ref);

  void initSocket(String token) {
    if (_socket != null && _socket!.connected) return;
    if (_isConnecting) return;
    _isConnecting = true;

    // Build socket URL matching namespace '/messaging'
    final baseHost = ApiConstants.defaultBaseUrl.replaceAll(RegExp(r'/api/v1/?$'), '');
    final socketUrl = '$baseHost/messaging';

    debugPrint('[MessagingSocket] Connecting to: $socketUrl');

    _socket = io.io(
      socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(1000)
          .build(),
    );

    _socket!.onConnect((_) {
      _isConnecting = false;
      debugPrint('[MessagingSocket] Connected successfully to /messaging');
    });

    _socket!.onConnectError((err) {
      _isConnecting = false;
      debugPrint('[MessagingSocket] Connection error: $err');
    });

    _socket!.onDisconnect((_) {
      _isConnecting = false;
      debugPrint('[MessagingSocket] Disconnected');
    });

    // ── Incoming Socket Events ───────────────────────────────────────────────

    _socket!.on('newMessage', (data) {
      debugPrint('[MessagingSocket] Event: newMessage -> $data');
      if (data is Map) {
        try {
          final msg = ChatMessageModel.fromJson(Map<String, dynamic>.from(data));
          // 1. Instantly push to active chat screen
          _ref.read(activeChatMessagesProvider(msg.conversationId).notifier).addMessage(msg);
          // 2. Update conversation last message in list
          _ref.read(conversationsProvider.notifier).updateLastMessage(
            msg.conversationId,
            {
              'content': msg.content,
              'sentAt': msg.sentAt,
              'senderName': msg.senderName,
              'messageType': msg.messageType,
            },
          );
        } catch (e) {
          debugPrint('[MessagingSocket] Error parsing newMessage: $e');
        }
      }
    });

    _socket!.on('messageEdited', (data) {
      debugPrint('[MessagingSocket] Event: messageEdited -> $data');
      if (data is Map) {
        try {
          final msg = ChatMessageModel.fromJson(Map<String, dynamic>.from(data));
          _ref.read(activeChatMessagesProvider(msg.conversationId).notifier).updateMessage(msg);
        } catch (e) {
          debugPrint('[MessagingSocket] Error parsing messageEdited: $e');
        }
      }
    });

    _socket!.on('messageDeleted', (data) {
      debugPrint('[MessagingSocket] Event: messageDeleted -> $data');
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        final convId = map['conversationId']?.toString();
        final msgId = map['messageId']?.toString();
        final forEveryone = map['forEveryone'] == true;

        if (convId != null && msgId != null) {
          if (forEveryone) {
            _ref.read(activeChatMessagesProvider(convId).notifier).deleteMessage(msgId);
          } else {
            _ref.read(activeChatMessagesProvider(convId).notifier).removeMessageLocally(msgId);
          }
        }
      }
    });

    _socket!.on('reactionUpdated', (data) {
      debugPrint('[MessagingSocket] Event: reactionUpdated -> $data');
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        final convId = map['conversationId']?.toString();
        final msgId = map['messageId']?.toString();
        final rawReactions = map['reactions'];

        if (convId != null && msgId != null && rawReactions is List) {
          final list = rawReactions
              .map((r) => MessageReaction.fromJson(Map<String, dynamic>.from(r as Map)))
              .toList();
          _ref.read(activeChatMessagesProvider(convId).notifier).updateReactions(msgId, list);
        }
      }
    });

    _socket!.on('messagesRead', (data) {
      debugPrint('[MessagingSocket] Event: messagesRead -> $data');
      if (data is Map) {
        final map = Map<String, dynamic>.from(data);
        final convId = map['conversationId']?.toString();
        if (convId != null) {
          _ref.read(conversationsProvider.notifier).clearUnread(convId);
        }
      }
    });

    _socket!.on('conversationUpdated', (data) {
      debugPrint('[MessagingSocket] Event: conversationUpdated');
      _ref.read(conversationsProvider.notifier).fetch();
    });
  }

  // ── Emit Methods ───────────────────────────────────────────────────────────

  void joinConversation(String conversationId) {
    _socket?.emit('joinConversation', {'conversationId': conversationId});
  }

  void leaveConversation(String conversationId) {
    _socket?.emit('leaveConversation', {'conversationId': conversationId});
  }

  void sendTyping(String conversationId, bool isTyping) {
    _socket?.emit('typing', {
      'conversationId': conversationId,
      'isTyping': isTyping,
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnecting = false;
  }
}
