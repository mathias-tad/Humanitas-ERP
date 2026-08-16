import 'dart:async';
import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/api/api_constants.dart';
import '../../../core/models/conversation_model.dart';
import '../../../core/models/chat_message_model.dart';
import '../../../core/providers/auth_provider.dart';
import '../providers/messaging_provider.dart';
import '../services/voice_player_service.dart';
import '../widgets/global_voice_player_banner.dart';
import 'group_info_screen.dart';
import 'chat_settings_screen.dart';
import 'user_profile_detail_screen.dart';

import '../services/messaging_socket_service.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final ConversationModel conversation;
  const ChatScreen({super.key, required this.conversation});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  final _focusNode = FocusNode();

  ChatMessageModel? _replyingTo;
  ChatMessageModel? _editingMessage;
  final Set<String> _selectedIds = {};
  bool _isSelecting = false;

  // ── Attachment state ───────────────────────────────────────────────
  File? _pendingAttachmentFile;
  String? _pendingAttachmentName;
  String? _pendingAttachmentType; // 'image' | 'video' | 'file'
  bool _isUploadingAttachment = false;

  // ── Voice recording state ──────────────────────────────────────────
  final AudioRecorder _audioRecorder = AudioRecorder();
  bool _isRecording = false;
  int _recordSeconds = 0;
  Timer? _recordTimer;
  String? _recordingPath;
  DateTime? _recordingStartTime;

  String get _currentUserId {
    final auth = ref.read(authProvider);
    return auth.user?.id ?? '';
  }

  bool get _isDirect => widget.conversation.isDirect;
  bool get _isGroupOrChannel => !_isDirect;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(messagingSocketProvider).joinConversation(widget.conversation.id);
      ref.read(messagingRepositoryProvider).markAsRead(widget.conversation.id);
      ref.read(conversationsProvider.notifier).clearUnread(widget.conversation.id);
    });
  }

  @override
  void dispose() {
    ref.read(messagingSocketProvider).leaveConversation(widget.conversation.id);
    _textController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    _recordTimer?.cancel();
    _audioRecorder.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ── Recording methods ──────────────────────────────────────────────

  Future<void> _startRecording() async {
    try {
      if (await _audioRecorder.hasPermission()) {
        final tempDir = await getTemporaryDirectory();
        final path = '${tempDir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
        _recordingPath = path;
        _recordingStartTime = DateTime.now();

        await _audioRecorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
        setState(() {
          _isRecording = true;
          _recordSeconds = 0;
        });

        _recordTimer?.cancel();
        _recordTimer = Timer.periodic(const Duration(seconds: 1), (t) {
          if (mounted) setState(() => _recordSeconds++);
        });
      } else {
        _showSnack('Microphone permission required for voice messages');
      }
    } catch (e) {
      _showSnack('Failed to start recording: $e');
    }
  }

  Future<void> _stopAndSendRecording() async {
    _recordTimer?.cancel();
    final path = await _audioRecorder.stop();
    final endTime = DateTime.now();
    setState(() { _isRecording = false; });

    if (path != null && File(path).existsSync()) {
      _showSnack('Uploading voice message...');
      try {
        // Calculate exact duration from DateTime start vs end
        int durationSeconds = _recordSeconds;
        if (_recordingStartTime != null) {
          final diff = endTime.difference(_recordingStartTime!).inSeconds;
          if (diff > 0) durationSeconds = diff;
        }
        if (durationSeconds <= 0) durationSeconds = 1;

        final url = await ref.read(messagingRepositoryProvider).uploadFile(path);
        final replyId = _replyingTo?.id;
        setState(() { _replyingTo = null; });

        final durStr = _formatRecordTime(durationSeconds);
        await ref.read(activeChatMessagesProvider(widget.conversation.id).notifier).sendMessage(
          content: '$url::dur:$durStr',
          messageType: 'voice',
          replyToId: replyId,
        );
        _scrollToBottom();
      } catch (e) {
        if (mounted) _showSnack('Failed to send voice message');
      }
    }
  }

  Future<void> _cancelRecording() async {
    _recordTimer?.cancel();
    await _audioRecorder.stop();
    setState(() {
      _isRecording = false;
      _recordSeconds = 0;
    });
    if (_recordingPath != null) {
      try { File(_recordingPath!).deleteSync(); } catch (_) {}
    }
  }

  String _formatRecordTime(int seconds) {
    final m = seconds ~/ 60;
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Future<void> _sendMessage() async {
    final text = _textController.text.trim();
    // Must have text OR a pending attachment
    if (text.isEmpty && _pendingAttachmentFile == null) return;

    _textController.clear();
    final replyId = _replyingTo?.id;
    setState(() { _replyingTo = null; });

    if (_editingMessage != null) {
      final editingId = _editingMessage!.id;
      setState(() { _editingMessage = null; });
      try {
        await ref.read(activeChatMessagesProvider(widget.conversation.id).notifier)
            .editMessage(editingId, text);
      } catch (e) {
        if (mounted) _showSnack('Failed to edit message');
      }
      return;
    }

    // ── Attachment send path ──────────────────────────────────────────
    if (_pendingAttachmentFile != null) {
      final attachFile = _pendingAttachmentFile!;
      final attachType = _pendingAttachmentType ?? 'file';
      setState(() {
        _pendingAttachmentFile = null;
        _pendingAttachmentName = null;
        _pendingAttachmentType = null;
        _isUploadingAttachment = true;
      });
      try {
        final repo = ref.read(messagingRepositoryProvider);
        final url = await repo.uploadFile(attachFile.path);
        await ref.read(activeChatMessagesProvider(widget.conversation.id).notifier)
            .sendMessage(
              content: text,         // caption (may be empty)
              messageType: attachType,
              attachmentUrl: url,
              replyToId: replyId,
            );
        _scrollToBottom();
      } catch (e) {
        if (mounted) _showSnack('Failed to send attachment');
      } finally {
        if (mounted) setState(() => _isUploadingAttachment = false);
      }
      return;
    }

    // ── Text-only send path ───────────────────────────────────────────
    try {
      await ref.read(activeChatMessagesProvider(widget.conversation.id).notifier)
          .sendMessage(content: text, replyToId: replyId);
      _scrollToBottom();
    } catch (e) {
      if (mounted) _showSnack('Failed to send message');
    }
  }

  // ── Attachment picker ─────────────────────────────────────────────

  void _showAttachmentPicker() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        margin: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A2433) : Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _AttachOption(
                      icon: Icons.camera_alt_rounded,
                      color: const Color(0xFF1E88E5),
                      label: 'Camera',
                      onTap: () async {
                        Navigator.pop(ctx);
                        final img = await ImagePicker().pickImage(
                          source: ImageSource.camera,
                          imageQuality: 80,
                        );
                        if (img != null) {
                          setState(() {
                            _pendingAttachmentFile = File(img.path);
                            _pendingAttachmentName = img.name;
                            _pendingAttachmentType = 'image';
                          });
                          _focusNode.requestFocus();
                        }
                      },
                    ),
                    _AttachOption(
                      icon: Icons.photo_library_rounded,
                      color: const Color(0xFF43A047),
                      label: 'Gallery',
                      onTap: () async {
                        Navigator.pop(ctx);
                        final img = await ImagePicker().pickImage(
                          source: ImageSource.gallery,
                          imageQuality: 80,
                        );
                        if (img != null) {
                          setState(() {
                            _pendingAttachmentFile = File(img.path);
                            _pendingAttachmentName = img.name;
                            _pendingAttachmentType = 'image';
                          });
                          _focusNode.requestFocus();
                        }
                      },
                    ),
                    _AttachOption(
                      icon: Icons.videocam_rounded,
                      color: const Color(0xFFE53935),
                      label: 'Video',
                      onTap: () async {
                        Navigator.pop(ctx);
                        final video = await ImagePicker().pickVideo(
                          source: ImageSource.gallery,
                        );
                        if (video != null) {
                          setState(() {
                            _pendingAttachmentFile = File(video.path);
                            _pendingAttachmentName = video.name;
                            _pendingAttachmentType = 'video';
                          });
                          _focusNode.requestFocus();
                        }
                      },
                    ),
                    _AttachOption(
                      icon: Icons.insert_drive_file_rounded,
                      color: const Color(0xFFFF7043),
                      label: 'File',
                      onTap: () async {
                        Navigator.pop(ctx);
                        final result = await FilePicker.platform.pickFiles(
                          type: FileType.any,
                          allowMultiple: false,
                        );
                        if (result != null && result.files.single.path != null) {
                          final pf = result.files.single;
                          setState(() {
                            _pendingAttachmentFile = File(pf.path!);
                            _pendingAttachmentName = pf.name;
                            _pendingAttachmentType = 'file';
                          });
                          _focusNode.requestFocus();
                        }
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _clearPendingAttachment() {
    setState(() {
      _pendingAttachmentFile = null;
      _pendingAttachmentName = null;
      _pendingAttachmentType = null;
    });
  }

  void _startEdit(ChatMessageModel msg) {
    setState(() {
      _editingMessage = msg;
      _replyingTo = null;
      _textController.text = msg.content;
    });
    _focusNode.requestFocus();
  }

  void _startReply(ChatMessageModel msg) {
    setState(() {
      _replyingTo = msg;
      _editingMessage = null;
    });
    _focusNode.requestFocus();
  }

  void _cancelCompose() {
    setState(() {
      _replyingTo = null;
      _editingMessage = null;
      _textController.clear();
    });
  }

  void _toggleSelect(String id) {
    setState(() {
      if (_selectedIds.contains(id)) {
        _selectedIds.remove(id);
        if (_selectedIds.isEmpty) _isSelecting = false;
      } else {
        _selectedIds.add(id);
      }
    });
  }

  void _clearSelection() {
    setState(() {
      _selectedIds.clear();
      _isSelecting = false;
    });
  }

  String? _highlightedMsgId;

  void _scrollToMessage(String targetId) {
    final messages = ref.read(activeChatMessagesProvider(widget.conversation.id)).asData?.value ?? [];
    final idx = messages.indexWhere((m) => m.id == targetId);
    if (idx >= 0 && _scrollController.hasClients) {
      final double maxScroll = _scrollController.position.maxScrollExtent;
      final double estimatedOffset = (idx / (messages.isNotEmpty ? messages.length : 1)) * maxScroll;
      _scrollController.animateTo(
        estimatedOffset.clamp(0.0, maxScroll),
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
      setState(() {
        _highlightedMsgId = targetId;
      });
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted && _highlightedMsgId == targetId) {
          setState(() {
            _highlightedMsgId = null;
          });
        }
      });
    } else {
      _showSnack('Original message not found in recent history');
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating),
    );
  }

  void _forwardSelected() {
    if (_selectedIds.isEmpty) return;
    final idsToForward = List<String>.from(_selectedIds);
    _clearSelection();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ForwardDialog(
        onForward: (targetConvIds) async {
          Navigator.pop(ctx);
          final repo = ref.read(messagingRepositoryProvider);
          try {
            for (final msgId in idsToForward) {
              await repo.forwardMessage(msgId, targetConvIds);
            }
            if (mounted) {
              _showSnack('Forwarded to ${targetConvIds.length} chat${targetConvIds.length > 1 ? "s" : ""}');
            }
          } catch (e) {
            if (mounted) _showSnack('Forward failed: ${_formatError(e)}');
          }
        },
      ),
    );
  }

  // ── Delete confirmation dialogs ────────────────────────────────────

  void _showDeleteDialog(ChatMessageModel msg) {
    Navigator.pop(context); // Close action sheet
    _confirmDeleteIds([msg.id]);
  }

  void _confirmDeleteIds(List<String> ids) {
    if (ids.isEmpty) return;
    final otherName = widget.conversation.displayName;

    if (_isDirect) {
      // Telegram personal chat delete dialog with checkbox
      showDialog(
        context: context,
        builder: (_) => _PersonalDeleteDialog(
          otherUserName: otherName,
          count: ids.length,
          onConfirm: (alsoForOther) async {
            final notifier = ref.read(activeChatMessagesProvider(widget.conversation.id).notifier);
            for (final id in ids) {
              try {
                if (alsoForOther) {
                  await notifier.deleteMessageForEveryone(id);
                } else {
                  await notifier.deleteMessageForMe(id);
                }
              } catch (e) {
                if (mounted) _showSnack('Failed to delete: ${_formatError(e)}');
              }
            }
            if (_isSelecting) _clearSelection();
          },
        ),
      );
    } else {
      // Group / Channel delete dialog
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(ids.length > 1 ? 'Delete ${ids.length} messages?' : 'Delete message?'),
          content: Text(widget.conversation.isAdmin
              ? 'Who should this message be deleted for?'
              : 'This will remove the message from your view only.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            TextButton(
              onPressed: () async {
                Navigator.pop(context);
                final notifier = ref.read(activeChatMessagesProvider(widget.conversation.id).notifier);
                for (final id in ids) {
                  try {
                    await notifier.deleteMessageForMe(id);
                  } catch (e) {
                    if (mounted) _showSnack('Failed to delete: ${_formatError(e)}');
                  }
                }
                if (_isSelecting) _clearSelection();
              },
              child: const Text('Delete for Me'),
            ),
            TextButton(
              style: TextButton.styleFrom(foregroundColor: Colors.red),
              onPressed: () async {
                Navigator.pop(context);
                final notifier = ref.read(activeChatMessagesProvider(widget.conversation.id).notifier);
                for (final id in ids) {
                  try {
                    await notifier.deleteMessageForEveryone(id);
                  } catch (e) {
                    if (mounted) _showSnack('Failed to delete: ${_formatError(e)}');
                  }
                }
                if (_isSelecting) _clearSelection();
              },
              child: const Text('Delete for Everyone'),
            ),
          ],
        ),
      );
    }
  }

  String _formatError(dynamic e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        final msg = data['message'];
        return msg is List ? msg.join(', ') : msg.toString();
      }
      if (data != null) return data.toString();
    }
    return e.toString();
  }

  void _showMessageActions(BuildContext context, ChatMessageModel msg) {
    final isMe = msg.senderId == _currentUserId;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: ['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) =>
                  GestureDetector(
                    onTap: () async {
                      Navigator.pop(context);
                      await ref.read(activeChatMessagesProvider(widget.conversation.id).notifier)
                          .reactToMessage(msg.id, emoji);
                    },
                    child: Text(emoji, style: const TextStyle(fontSize: 28)),
                  ),
                ).toList(),
              ),
            ),
            const Divider(height: 1),
            _ActionTile(Icons.reply_rounded, 'Reply', onTap: () {
              Navigator.pop(context); _startReply(msg);
            }),
            _ActionTile(Icons.copy_rounded, 'Copy', onTap: () {
              Navigator.pop(context);
              Clipboard.setData(ClipboardData(text: msg.content));
              _showSnack('Copied to clipboard');
            }),
            _ActionTile(Icons.forward_rounded, 'Forward', onTap: () {
              Navigator.pop(context); _forwardSelected();
            }),
            if (isMe && !msg.isDeleted && msg.messageType == 'text') _ActionTile(Icons.edit_rounded, 'Edit', onTap: () {
              Navigator.pop(context); _startEdit(msg);
            }),
            if (!msg.isDeleted)
              _ActionTile(Icons.delete_rounded, 'Delete',
                  isDestructive: true,
                  onTap: () => _showDeleteDialog(msg)),
            _ActionTile(Icons.select_all_rounded, 'Select', onTap: () {
              Navigator.pop(context);
              setState(() {
                _isSelecting = true;
                _selectedIds.add(msg.id);
              });
            }),
          ],
        ),
      ),
    );
  }

  void _openUserProfile(BuildContext context, Map<String, dynamic> participant) {
    final u = participant['user'] as Map<String, dynamic>? ?? participant;
    final name = u['full_name']?.toString() ?? u['name']?.toString() ?? 'User';
    final email = u['email']?.toString();
    final phone = u['phone']?.toString();
    final avatarUrl = u['avatar_url']?.toString() ?? u['avatarUrl']?.toString();
    final role = u['role']?.toString() ?? u['position']?.toString();
    final userId = u['id']?.toString() ?? participant['userId']?.toString() ?? '';

    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => UserProfileDetailScreen(
        userId: userId,
        name: name,
        email: email,
        phone: phone,
        avatarUrl: avatarUrl,
        role: role,
        onStartChat: () {
          _showSnack('Tap compose to start a new direct message');
        },
      ),
    ));
  }

  void _showEmojiPicker() {
    final emojis = [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
      '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
      '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
      '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
      '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅',
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '🔥', '✨', '🌟', '💫', '🎉', '🎊', '🎁', '🎈', '🏆', '🎯',
    ];

    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Container(
        height: 280,
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Select Emoji', style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16)),
                const Spacer(),
                IconButton(icon: const Icon(Icons.close_rounded, size: 20), onPressed: () => Navigator.pop(context)),
              ],
            ),
            const SizedBox(height: 8),
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7,
                  mainAxisSpacing: 6,
                  crossAxisSpacing: 6,
                ),
                itemCount: emojis.length,
                itemBuilder: (context, index) {
                  return InkWell(
                    onTap: () {
                      final text = _textController.text;
                      final sel = _textController.selection;
                      final emoji = emojis[index];
                      if (sel.isValid && sel.start >= 0) {
                        final newText = text.replaceRange(sel.start, sel.end, emoji);
                        _textController.value = TextEditingValue(
                          text: newText,
                          selection: TextSelection.collapsed(offset: sel.start + emoji.length),
                        );
                      } else {
                        _textController.text = text + emoji;
                      }
                    },
                    child: Center(child: Text(emojis[index], style: const TextStyle(fontSize: 24))),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final messagesAsync = ref.watch(activeChatMessagesProvider(widget.conversation.id));
    final conv = widget.conversation;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0E1621) : const Color(0xFFEFEFEF),
      appBar: _buildAppBar(isDark, conv),
      body: Column(
        children: [
          const GlobalVoicePlayerBanner(),
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (messages) {
                WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
                return _buildMessageList(messages, isDark);
              },
            ),
          ),
          if (_isSelecting) _buildSelectionBar(isDark),
          if (!_isSelecting) _buildInputArea(isDark, conv),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, ConversationModel conv) {
    if (_isSelecting) {
      return AppBar(
        backgroundColor: AppColors.primary,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.black),
          onPressed: _clearSelection,
        ),
        title: Text('${_selectedIds.length} selected',
            style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: Colors.black)),
        actions: [
          IconButton(icon: const Icon(Icons.forward_rounded, color: Colors.black), onPressed: _forwardSelected),
          IconButton(
            icon: const Icon(Icons.delete_rounded, color: Colors.black),
            onPressed: () => _confirmDeleteIds(List<String>.from(_selectedIds)),
          ),
        ],
      );
    }

    return AppBar(
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      elevation: 0,
      titleSpacing: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded),
        onPressed: () => Navigator.of(context).pop(),
      ),
      title: InkWell(
        onTap: () {
          if (conv.isDirect) {
            final participants = conv.participants;
            final other = participants.firstWhere(
              (p) => (p['userId']?.toString() ?? '') != _currentUserId,
              orElse: () => participants.isNotEmpty ? participants.first : {},
            );
            _openUserProfile(context, other);
          } else {
            Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => GroupInfoScreen(conversation: conv),
            ));
          }
        },
        child: Row(
          children: [
            _SmallAvatar(conv: conv, onTap: conv.isDirect
                ? null
                : () => _showFullScreenGroupAvatar(context, conv)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(conv.displayName,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16)),
                  Text(
                    conv.isDirect ? 'tap to view profile'
                        : '${conv.memberCount} members · tap to view info',
                    style: GoogleFonts.inter(
                        fontSize: 12,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        IconButton(icon: const Icon(Icons.call_rounded), onPressed: () => _showSnack('Voice call coming soon')),
        IconButton(icon: const Icon(Icons.videocam_rounded), onPressed: () => _showSnack('Video call coming soon')),
        IconButton(
          icon: const Icon(Icons.more_vert_rounded),
          onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => ChatSettingsScreen(conversation: conv))),
        ),
      ],
    );
  }

  void _showFullScreenGroupAvatar(BuildContext context, ConversationModel conv) {
    final url = conv.resolvedAvatarUrl;
    if (url == null) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(backgroundColor: Colors.black, iconTheme: const IconThemeData(color: Colors.white)),
        body: Center(child: InteractiveViewer(child: Image.network(url))),
      ),
    ));
  }

  Widget _buildMessageList(List<ChatMessageModel> messages, bool isDark) {
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      itemCount: messages.length,
      itemBuilder: (context, i) {
        final msg = messages[i];
        final showDate = i == 0 ||
            messages[i].dateLabel != messages[i - 1].dateLabel;

        return Column(
          children: [
            if (showDate) _DateLabel(label: msg.dateLabel),
            _SwipeableMessage(
              message: msg,
              isMe: msg.senderId == _currentUserId,
              isSelected: _selectedIds.contains(msg.id),
              isSelecting: _isSelecting,
              isGroup: !widget.conversation.isDirect,
              isHighlighted: _highlightedMsgId == msg.id,
              onReplyTap: (targetId) => _scrollToMessage(targetId),
              onSwipe: () => _startReply(msg),
              onLongPress: () {
                HapticFeedback.mediumImpact();
                if (_isSelecting) {
                  _toggleSelect(msg.id);
                } else {
                  setState(() { _isSelecting = true; _selectedIds.add(msg.id); });
                }
              },
              onTap: () {
                if (_isSelecting) {
                  _toggleSelect(msg.id);
                } else {
                  _showMessageActions(context, msg);
                }
              },
              onSenderAvatarTap: _isGroupOrChannel
                  ? () {
                      _openUserProfile(context, {
                        'userId': msg.senderId,
                        'user': {
                          'id': msg.senderId,
                          'full_name': msg.senderName ?? 'User',
                        },
                      });
                    }
                  : null,
            ),
          ],
        );
      },
    );
  }

  Widget _buildSelectionBar(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      child: Row(
        children: [
          Text('${_selectedIds.length} selected',
              style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
          const Spacer(),
          TextButton.icon(
            icon: const Icon(Icons.forward_rounded, size: 18),
            label: const Text('Forward'),
            onPressed: _forwardSelected,
          ),
          TextButton.icon(
            icon: const Icon(Icons.delete_rounded, size: 18, color: AppColors.error),
            label: const Text('Delete', style: TextStyle(color: AppColors.error)),
            onPressed: () => _confirmDeleteIds(List<String>.from(_selectedIds)),
          ),
        ],
      ),
    );
  }

  Widget _buildInputArea(bool isDark, ConversationModel conv) {
    final canSend = conv.canSendMessages;

    return Container(
      color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Upload progress indicator ──────────────────────────────
          if (_isUploadingAttachment)
            LinearProgressIndicator(
              backgroundColor: Colors.transparent,
              color: AppColors.primary,
              minHeight: 2,
            ),
          // ── Attachment preview bar ─────────────────────────────────
          if (_pendingAttachmentFile != null)
            _AttachmentPreviewBar(
              file: _pendingAttachmentFile!,
              name: _pendingAttachmentName ?? 'Attachment',
              type: _pendingAttachmentType ?? 'file',
              isDark: isDark,
              onRemove: _clearPendingAttachment,
            ),
          if (_replyingTo != null) _ReplyBanner(
            message: _replyingTo!,
            onCancel: _cancelCompose,
            isDark: isDark,
          ),
          if (_editingMessage != null) _EditBanner(
            message: _editingMessage!,
            onCancel: _cancelCompose,
            isDark: isDark,
          ),
          if (!canSend)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                conv.isChannel
                    ? 'Only admins can post in this channel'
                    : 'Only admins can post here',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                    fontSize: 13,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
              ),
            )
          else
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: _isRecording
                    ? _buildRecordingBar(isDark)
                    : Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Container(
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF1E2C3A) : Colors.white,
                                borderRadius: BorderRadius.circular(24),
                                border: Border.all(
                                  color: isDark ? AppColors.borderDark : AppColors.borderLight,
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  IconButton(
                                    icon: Icon(
                                      Icons.sentiment_satisfied_alt_rounded,
                                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                    ),
                                    onPressed: _showEmojiPicker,
                                  ),
                                  Expanded(
                                    child: TextField(
                                      controller: _textController,
                                      focusNode: _focusNode,
                                      maxLines: 5,
                                      minLines: 1,
                                      textCapitalization: TextCapitalization.sentences,
                                      decoration: InputDecoration(
                                        hintText: _pendingAttachmentFile != null
                                            ? 'Add a caption...'
                                            : (_editingMessage != null ? 'Edit message...' : 'Message'),
                                        hintStyle: GoogleFonts.inter(
                                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                            fontSize: 14),
                                        border: InputBorder.none,
                                        contentPadding: const EdgeInsets.symmetric(vertical: 12),
                                      ),
                                      style: GoogleFonts.inter(fontSize: 14),
                                    ),
                                  ),
                                  IconButton(
                                    icon: Icon(
                                      Icons.attach_file_rounded,
                                      color: _pendingAttachmentFile != null
                                          ? AppColors.primary
                                          : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                                    ),
                                    onPressed: _showAttachmentPicker,
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          ValueListenableBuilder<TextEditingValue>(
                            valueListenable: _textController,
                            builder: (_, val, _) {
                              final hasText = val.text.trim().isNotEmpty;
                              final canSendNow = hasText || _pendingAttachmentFile != null;
                              return AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                decoration: BoxDecoration(
                                  color: canSendNow ? AppColors.primary : (isDark ? const Color(0xFF1E2C3A) : Colors.grey.shade300),
                                  shape: BoxShape.circle,
                                ),
                                child: IconButton(
                                  icon: Icon(
                                    canSendNow ? (_editingMessage != null ? Icons.check_rounded : Icons.send_rounded) : Icons.mic_rounded,
                                    color: canSendNow ? Colors.black : (isDark ? Colors.white54 : Colors.grey),
                                    size: 20,
                                  ),
                                  onPressed: canSendNow ? _sendMessage : _startRecording,
                                ),
                              );
                            },
                          ),
                        ],
                      ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRecordingBar(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E2C3A) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.red.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, color: Colors.red),
            onPressed: _cancelRecording,
          ),
          const SizedBox(width: 4),
          const Icon(Icons.fiber_manual_record, color: Colors.red, size: 14),
          const SizedBox(width: 6),
          Text(
            _formatRecordTime(_recordSeconds),
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.red),
          ),
          const Spacer(),
          Text('Release/Tap to send',
              style: GoogleFonts.inter(fontSize: 12, color: isDark ? Colors.white54 : Colors.black45)),
          const SizedBox(width: 12),
          Container(
            decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            child: IconButton(
              icon: const Icon(Icons.send_rounded, color: Colors.black87, size: 18),
              onPressed: _stopAndSendRecording,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Telegram Personal Delete Dialog ─────────────────────────────────────────

class _PersonalDeleteDialog extends StatefulWidget {
  final String otherUserName;
  final int count;
  final ValueChanged<bool> onConfirm;

  const _PersonalDeleteDialog({
    required this.otherUserName,
    required this.count,
    required this.onConfirm,
  });

  @override
  State<_PersonalDeleteDialog> createState() => _PersonalDeleteDialogState();
}

class _PersonalDeleteDialogState extends State<_PersonalDeleteDialog> {
  bool _alsoDeleteForOther = true;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.count > 1 ? 'Delete ${widget.count} messages?' : 'Delete message?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.count > 1
              ? 'Are you sure you want to delete these messages?'
              : 'Are you sure you want to delete this message?'),
          const SizedBox(height: 12),
          CheckboxListTile(
            value: _alsoDeleteForOther,
            onChanged: (val) => setState(() => _alsoDeleteForOther = val ?? false),
            title: Text('Also delete for ${widget.otherUserName}',
                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w500)),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            activeColor: AppColors.primary,
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        TextButton(
          style: TextButton.styleFrom(foregroundColor: Colors.red),
          onPressed: () {
            Navigator.pop(context);
            widget.onConfirm(_alsoDeleteForOther);
          },
          child: const Text('Delete'),
        ),
      ],
    );
  }
}

// ── Swipeable Message Wrapper ─────────────────────────────────────────────────

class _SwipeableMessage extends StatefulWidget {
  final ChatMessageModel message;
  final bool isMe;
  final bool isSelected;
  final bool isSelecting;
  final bool isGroup;
  final bool isHighlighted;
  final VoidCallback onSwipe;
  final VoidCallback onLongPress;
  final VoidCallback onTap;
  final ValueChanged<String>? onReplyTap;
  final VoidCallback? onSenderAvatarTap;

  const _SwipeableMessage({
    required this.message,
    required this.isMe,
    required this.isSelected,
    required this.isSelecting,
    required this.isGroup,
    this.isHighlighted = false,
    required this.onSwipe,
    required this.onLongPress,
    required this.onTap,
    this.onReplyTap,
    this.onSenderAvatarTap,
  });

  @override
  State<_SwipeableMessage> createState() => _SwipeableMessageState();
}

class _SwipeableMessageState extends State<_SwipeableMessage>
    with SingleTickerProviderStateMixin {
  double _dragOffset = 0;
  bool _triggered = false;
  late AnimationController _replyIconController;

  @override
  void initState() {
    super.initState();
    _replyIconController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
  }

  @override
  void dispose() {
    _replyIconController.dispose();
    super.dispose();
  }

  void _onDragUpdate(DragUpdateDetails d) {
    final delta = widget.isMe ? -d.delta.dx : d.delta.dx;
    if (delta > 0) {
      setState(() {
        _dragOffset = (_dragOffset + delta).clamp(0.0, 72.0);
      });
      _replyIconController.value = (_dragOffset / 72.0).clamp(0.0, 1.0);

      if (_dragOffset > 52 && !_triggered) {
        _triggered = true;
        HapticFeedback.mediumImpact();
        widget.onSwipe();
      }
    }
  }

  void _onDragEnd(DragEndDetails _) {
    setState(() { _dragOffset = 0; _triggered = false; });
    _replyIconController.animateTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final replyIcon = FadeTransition(
      opacity: _replyIconController,
      child: ScaleTransition(
        scale: _replyIconController,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.15),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.reply_rounded, size: 18, color: AppColors.primary),
        ),
      ),
    );

    return GestureDetector(
      onLongPress: widget.onLongPress,
      onTap: widget.onTap,
      onHorizontalDragUpdate: _onDragUpdate,
      onHorizontalDragEnd: _onDragEnd,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        color: widget.isHighlighted
            ? AppColors.primary.withValues(alpha: 0.35)
            : (widget.isSelected ? AppColors.primary.withValues(alpha: 0.12) : Colors.transparent),
        padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (widget.isMe) ...[
              replyIcon,
              const Spacer(),
            ],
            if (!widget.isMe && widget.isGroup)
              GestureDetector(
                onTap: widget.onSenderAvatarTap,
                child: Padding(
                  padding: const EdgeInsets.only(right: 6, bottom: 4),
                  child: CircleAvatar(
                    radius: 14,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                    child: Text(
                      (widget.message.senderName ?? 'U').isNotEmpty
                          ? (widget.message.senderName ?? 'U')[0].toUpperCase()
                          : 'U',
                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                  ),
                ),
              ),
            Transform.translate(
              offset: Offset(widget.isMe ? -_dragOffset : _dragOffset, 0),
              child: _MessageBubble(
                message: widget.message,
                isMe: widget.isMe,
                isGroup: widget.isGroup,
                onReplyTap: widget.onReplyTap,
              ),
            ),
            if (!widget.isMe) ...[
              const Spacer(),
              replyIcon,
            ],
          ],
        ),
      ),
    );
  }
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final ChatMessageModel message;
  final bool isMe;
  final bool isGroup;
  final ValueChanged<String>? onReplyTap;

  const _MessageBubble({
    required this.message,
    required this.isMe,
    required this.isGroup,
    this.onReplyTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final msg = message;

    final bgColor = isMe
        ? AppColors.primary
        : (isDark ? const Color(0xFF182533) : Colors.white);
    final textColor = isMe ? Colors.black87 : (isDark ? Colors.white : Colors.black87);

    final Map<String, int> reactionCounts = {};
    for (final r in msg.reactions) {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
    }

    final isVoice = msg.messageType == 'voice';

    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
      child: Column(
        crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (!isMe && isGroup && msg.senderName != null)
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 2),
              child: Text(msg.senderName!,
                  style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
            ),
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                padding: EdgeInsets.fromLTRB(
                    12, 8, 12,
                    reactionCounts.isNotEmpty ? 20 : 8),
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(18),
                    topRight: const Radius.circular(18),
                    bottomLeft: Radius.circular(isMe ? 18 : 4),
                    bottomRight: Radius.circular(isMe ? 4 : 18),
                  ),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4, offset: const Offset(0, 2)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (msg.isForwarded)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.forward_rounded, size: 13, color: isMe ? Colors.black54 : AppColors.primary),
                            const SizedBox(width: 4),
                            Text('Forwarded',
                                style: GoogleFonts.inter(
                                    fontSize: 11,
                                    fontStyle: FontStyle.italic,
                                    color: isMe ? Colors.black54 : AppColors.primary)),
                          ],
                        ),
                      ),
                    if (msg.replyTo != null)
                      _ReplyPreview(
                        replyTo: msg.replyTo!,
                        isMe: isMe,
                        onTap: onReplyTap != null ? () => onReplyTap!(msg.replyTo!.id) : null,
                      ),
                    if (msg.isDeleted)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.block_rounded, size: 14, color: isMe ? Colors.black38 : Colors.grey),
                          const SizedBox(width: 4),
                          Text('This message was deleted',
                              style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontStyle: FontStyle.italic,
                                  color: isMe ? Colors.black38 : Colors.grey)),
                        ],
                      )
                    else if (isVoice)
                      _VoiceMessageBubble(message: msg, isMe: isMe)
                    else if (msg.messageType == 'image' && msg.attachmentUrl != null)
                      _ImageMessageBubble(message: msg, isMe: isMe, textColor: textColor)
                    else if (msg.messageType == 'video' && msg.attachmentUrl != null)
                      _VideoMessageBubble(message: msg, isMe: isMe, textColor: textColor)
                    else if (msg.messageType == 'file' && msg.attachmentUrl != null)
                      _FileMessageBubble(message: msg, isMe: isMe, textColor: textColor)
                    else if (_isOnlyEmoji(msg.content))
                      _AnimatedEmojiMessage(text: msg.content)
                    else
                      Text(msg.content, style: GoogleFonts.inter(fontSize: 14, color: textColor)),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (msg.isEdited)
                          Text('edited  ',
                              style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontStyle: FontStyle.italic,
                                  color: isMe ? Colors.black45 : Colors.grey)),
                        Text(msg.timeFormatted,
                            style: GoogleFonts.inter(
                                fontSize: 10,
                                color: isMe ? Colors.black45 : Colors.grey)),
                        if (isMe) ...[
                          const SizedBox(width: 4),
                          Icon(
                            msg.readReceipts.isNotEmpty ? Icons.done_all_rounded : Icons.done_rounded,
                            size: 14,
                            color: msg.readReceipts.isNotEmpty ? Colors.blue.shade700 : Colors.black38,
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              if (reactionCounts.isNotEmpty)
                Positioned(
                  bottom: -10,
                  left: isMe ? null : 8,
                  right: isMe ? 8 : null,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2A3A4A) : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: isDark ? AppColors.borderDark : Colors.grey.shade200),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4)
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: reactionCounts.entries.map((e) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: Text('${e.key} ${e.value}',
                            style: const TextStyle(fontSize: 12)),
                      )).toList(),
                    ),
                  ),
                ),
            ],
          ),
          if (reactionCounts.isNotEmpty) const SizedBox(height: 6),
        ],
      ),
    );
  }
}

// ── In-Bubble Voice Player Widget ─────────────────────────────────────────────

class _VoiceMessageBubble extends ConsumerWidget {
  final ChatMessageModel message;
  final bool isMe;
  const _VoiceMessageBubble({required this.message, required this.isMe});

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes;
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final voiceState = ref.watch(voicePlayerProvider);
    final notifier = ref.read(voicePlayerProvider.notifier);
    final isCurrent = voiceState.activeMessageId == message.id;

    final isPlaying = isCurrent && voiceState.isPlaying;
    final currentPos = isCurrent ? voiceState.position : Duration.zero;
    final totalDur = isCurrent ? voiceState.duration : Duration.zero;

    final progress = (isCurrent && totalDur.inMilliseconds > 0)
        ? (currentPos.inMilliseconds / totalDur.inMilliseconds).clamp(0.0, 1.0)
        : 0.0;

    // Extract audio URL and pre-recorded duration from content or attachmentUrl
    final rawSource = message.content.contains('::dur:')
        ? message.content
        : (message.attachmentUrl ?? message.content);
    final audioUrl = rawSource.split('::dur:').first;
    final staticDuration = _extractStaticDuration(message);

    // Duration label shown at bottom-right
    String durationLabel = staticDuration;
    if (isCurrent && totalDur.inSeconds > 0) {
      durationLabel = '${_formatDuration(currentPos)} / ${_formatDuration(totalDur)}';
    } else if (staticDuration == '0:00' && isCurrent && voiceState.duration.inSeconds > 0) {
      durationLabel = _formatDuration(voiceState.duration);
    }
    // Always show a duration — 0:00 is better than 'Voice Message'

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // Play / Pause button
              GestureDetector(
                onTap: () {
                  notifier.play(
                    messageId: message.id,
                    audioUrl: audioUrl,
                    title: message.senderName ?? 'Voice Message',
                  );
                },
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isMe
                        ? Colors.black.withValues(alpha: 0.15)
                        : AppColors.primary.withValues(alpha: 0.85),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    size: 24,
                    color: Colors.black87,
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Interactive waveform slider
              Expanded(
                child: SliderTheme(
                  data: SliderThemeData(
                    trackHeight: 3,
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                    overlayShape: const RoundSliderOverlayShape(overlayRadius: 10),
                    activeTrackColor: isMe ? Colors.black87 : AppColors.primary,
                    inactiveTrackColor: isMe ? Colors.black26 : Colors.grey.shade300,
                    thumbColor: isMe ? Colors.black87 : AppColors.primary,
                  ),
                  child: Slider(
                    value: progress,
                    onChanged: (val) {
                      if (isCurrent && totalDur.inMilliseconds > 0) {
                        final target = (val * totalDur.inMilliseconds).round();
                        notifier.seek(Duration(milliseconds: target));
                      }
                    },
                  ),
                ),
              ),
            ],
          ),

          // Duration label — shown at bottom-right of the voice bubble
          Padding(
            padding: const EdgeInsets.only(right: 4, bottom: 2),
            child: Align(
              alignment: Alignment.centerRight,
              child: Text(
                durationLabel,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isMe ? Colors.black54 : Colors.grey.shade700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Returns a pre-recorded duration string like '0:15', or '0:00' if not found.
  String _extractStaticDuration(ChatMessageModel msg) {
    // First check content for ::dur: metadata (mobile-sent voice messages)
    if (msg.content.contains('::dur:')) {
      final parts = msg.content.split('::dur:');
      if (parts.length > 1 && parts.last.isNotEmpty) {
        return parts.last.trim();
      }
    }
    // Fallback: check attachmentUrl for ::dur: metadata
    final url = msg.attachmentUrl ?? '';
    if (url.contains('::dur:')) {
      final parts = url.split('::dur:');
      if (parts.length > 1 && parts.last.isNotEmpty) {
        return parts.last.trim();
      }
    }
    // No duration metadata found — default to 0:00 (will update live when played)
    return '0:00';
  }
}

String _formatReplyContent(String content, [String? messageType]) {
  if (messageType == 'voice' ||
      content.startsWith('/uploads/') ||
      content.contains('::dur:') ||
      content.contains('.m4a') ||
      content.contains('.webm') ||
      content.contains('.ogg') ||
      content.contains('.mp3') ||
      content.contains('.wav') ||
      content == '🎤 Voice message') {
    return '🎤 Voice message';
  }
  if (messageType == 'image' || content.contains('.jpg') || content.contains('.png')) {
    return '📷 Photo';
  }
  if (messageType == 'video' || content.contains('.mp4')) {
    return '🎥 Video';
  }
  if (messageType == 'file') {
    return '📁 File';
  }
  return content.isEmpty ? 'Message' : content;
}

class _ReplyPreview extends StatelessWidget {
  final ReplyToModel replyTo;
  final bool isMe;
  final VoidCallback? onTap;
  const _ReplyPreview({required this.replyTo, required this.isMe, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isMe ? Colors.black.withValues(alpha: 0.12) : AppColors.primary.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border(left: BorderSide(color: AppColors.primary, width: 3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(replyTo.senderName ?? 'User',
                style: GoogleFonts.inter(
                    fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
            Text(_formatReplyContent(replyTo.content, replyTo.messageType),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(fontSize: 12, color: isMe ? Colors.black54 : Colors.grey.shade600)),
          ],
        ),
      ),
    );
  }
}

// ── Reply Banner ──────────────────────────────────────────────────────────────

class _ReplyBanner extends StatelessWidget {
  final ChatMessageModel message;
  final VoidCallback onCancel;
  final bool isDark;
  const _ReplyBanner({required this.message, required this.onCancel, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: AppColors.primary, width: 3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Replying to ${message.senderName ?? 'User'}',
                    style: GoogleFonts.inter(
                        fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                Text(_formatReplyContent(message.content, message.messageType),
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(fontSize: 12)),
              ],
            ),
          ),
          IconButton(icon: const Icon(Icons.close, size: 18), onPressed: onCancel),
        ],
      ),
    );
  }
}

class _EditBanner extends StatelessWidget {
  final ChatMessageModel message;
  final VoidCallback onCancel;
  final bool isDark;
  const _EditBanner({required this.message, required this.onCancel, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.orange.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: Colors.orange, width: 3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.edit_rounded, size: 16, color: Colors.orange),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Edit message',
                    style: GoogleFonts.inter(
                        fontSize: 12, fontWeight: FontWeight.w600, color: Colors.orange)),
                Text(message.content,
                    maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(fontSize: 12)),
              ],
            ),
          ),
          IconButton(icon: const Icon(Icons.close, size: 18), onPressed: onCancel),
        ],
      ),
    );
  }
}

// ── Date Label ────────────────────────────────────────────────────────────────

class _DateLabel extends StatelessWidget {
  final String label;
  const _DateLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(label,
              style: GoogleFonts.inter(
                  fontSize: 12, color: isDark ? Colors.white70 : Colors.black54)),
        ),
      ),
    );
  }
}

// ── Small Avatar ──────────────────────────────────────────────────────────────

class _SmallAvatar extends StatelessWidget {
  final ConversationModel conv;
  final VoidCallback? onTap;
  const _SmallAvatar({required this.conv, this.onTap});

  @override
  Widget build(BuildContext context) {
    final letter = conv.displayName.isNotEmpty ? conv.displayName[0].toUpperCase() : 'C';
    return GestureDetector(
      onTap: onTap,
      child: CircleAvatar(
        radius: 18,
        backgroundImage: conv.resolvedAvatarUrl != null ? NetworkImage(conv.resolvedAvatarUrl!) : null,
        backgroundColor: AppColors.primary.withValues(alpha: 0.15),
        child: conv.resolvedAvatarUrl == null
            ? Text(letter, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.primary))
            : null,
      ),
    );
  }
}

// ── Action Tile ───────────────────────────────────────────────────────────────

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isDestructive;
  const _ActionTile(this.icon, this.label, {required this.onTap, this.isDestructive = false});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: isDestructive ? AppColors.error : null),
      title: Text(label,
          style: GoogleFonts.inter(
              fontWeight: FontWeight.w500,
              color: isDestructive ? AppColors.error : null)),
      onTap: onTap,
    );
  }
}

// ── Telegram Forward Dialog ──────────────────────────────────────────────────

class _ForwardDialog extends ConsumerStatefulWidget {
  final Function(List<String> targetConversationIds) onForward;
  const _ForwardDialog({required this.onForward});

  @override
  ConsumerState<_ForwardDialog> createState() => _ForwardDialogState();
}

class _ForwardDialogState extends ConsumerState<_ForwardDialog> {
  final Set<String> _selectedConvIds = {};
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final conversationsAsync = ref.watch(conversationsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(top: 10, bottom: 8),
            decoration: BoxDecoration(
              color: Colors.grey.shade400,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Text(
                  'Forward to...',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: TextField(
              onChanged: (val) => setState(() => _searchQuery = val.trim().toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search chats...',
                prefixIcon: const Icon(Icons.search, size: 20),
                filled: true,
                fillColor: isDark ? Colors.grey.shade900 : Colors.grey.shade100,
                contentPadding: const EdgeInsets.symmetric(vertical: 8),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: conversationsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(child: Text('Error: $err')),
              data: (convs) {
                final filtered = convs.where((c) {
                  if (_searchQuery.isEmpty) return true;
                  return c.displayName.toLowerCase().contains(_searchQuery);
                }).toList();

                if (filtered.isEmpty) {
                  return const Center(child: Text('No chats found'));
                }

                return ListView.builder(
                  itemCount: filtered.length,
                  itemBuilder: (ctx, i) {
                    final conv = filtered[i];
                    final isSelected = _selectedConvIds.contains(conv.id);

                    return CheckboxListTile(
                      value: isSelected,
                      activeColor: AppColors.primary,
                      onChanged: (val) {
                        setState(() {
                          if (val == true) {
                            _selectedConvIds.add(conv.id);
                          } else {
                            _selectedConvIds.remove(conv.id);
                          }
                        });
                      },
                      title: Text(
                        conv.displayName,
                        style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        conv.isGroup ? 'Group' : 'Personal Chat',
                        style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                      ),
                      secondary: CircleAvatar(
                        backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                        child: Text(
                          conv.displayName.isNotEmpty ? conv.displayName[0].toUpperCase() : '?',
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          if (_selectedConvIds.isNotEmpty)
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.send_rounded, color: Colors.black),
                    label: Text(
                      'Send to ${_selectedConvIds.length} chat${_selectedConvIds.length > 1 ? "s" : ""}',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        color: Colors.black,
                        fontSize: 15,
                      ),
                    ),
                    onPressed: () => widget.onForward(_selectedConvIds.toList()),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Attachment Option Button ──────────────────────────────────────────────────

class _AttachOption extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  const _AttachOption({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(height: 8),
          Text(label,
              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// ── Attachment Preview Bar ────────────────────────────────────────────────────

class _AttachmentPreviewBar extends StatelessWidget {
  final File file;
  final String name;
  final String type;
  final bool isDark;
  final VoidCallback onRemove;

  const _AttachmentPreviewBar({
    required this.file,
    required this.name,
    required this.type,
    required this.isDark,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A2433) : Colors.grey.shade100,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
          ),
        ),
      ),
      child: Row(
        children: [
          // Thumbnail or icon
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: type == 'image'
                ? Image.file(file, width: 48, height: 48, fit: BoxFit.cover)
                : Container(
                    width: 48,
                    height: 48,
                    color: AppColors.primary.withValues(alpha: 0.12),
                    child: Icon(
                      type == 'video' ? Icons.videocam_rounded : Icons.insert_drive_file_rounded,
                      color: AppColors.primary,
                      size: 28,
                    ),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  type == 'image' ? 'Photo' : type == 'video' ? 'Video' : 'File',
                  style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary),
                ),
                Text(
                  name,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                      fontSize: 12,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.close_rounded,
                size: 20,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}

// ── Image Message Bubble ──────────────────────────────────────────────────────

class _ImageMessageBubble extends StatelessWidget {
  final ChatMessageModel message;
  final bool isMe;
  final Color textColor;

  const _ImageMessageBubble({
    required this.message,
    required this.isMe,
    required this.textColor,
  });

  String _resolveUrl(String raw) {
    if (raw.startsWith('http')) return raw;
    final base = ApiConstants.defaultBaseUrl.replaceAll('/api/v1', '');
    return '$base$raw';
  }

  @override
  Widget build(BuildContext context) {
    final url = _resolveUrl(message.attachmentUrl!);
    final caption = message.content;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Image — tap for full-screen viewer
        GestureDetector(
          onTap: () => _openFullScreen(context, url),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: CachedNetworkImage(
              imageUrl: url,
              width: 220,
              height: 180,
              fit: BoxFit.cover,
              placeholder: (ctx, url) => Container(
                width: 220,
                height: 180,
                color: Colors.grey.withValues(alpha: 0.2),
                child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
              ),
              errorWidget: (ctx, url, err) => Container(
                width: 220,
                height: 180,
                color: Colors.grey.withValues(alpha: 0.2),
                child: const Icon(Icons.broken_image_rounded, size: 40),
              ),
            ),
          ),
        ),
        if (caption.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(caption, style: GoogleFonts.inter(fontSize: 14, color: textColor)),
        ],
      ],
    );
  }

  void _openFullScreen(BuildContext context, String url) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          iconTheme: const IconThemeData(color: Colors.white),
        ),
        body: Center(
          child: InteractiveViewer(
            child: CachedNetworkImage(imageUrl: url),
          ),
        ),
      ),
    ));
  }
}

// ── Video Message Bubble ──────────────────────────────────────────────────────

class _VideoMessageBubble extends StatelessWidget {
  final ChatMessageModel message;
  final bool isMe;
  final Color textColor;

  const _VideoMessageBubble({
    required this.message,
    required this.isMe,
    required this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    final caption = message.content;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 220,
          height: 140,
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(Icons.videocam_rounded, color: Colors.white.withValues(alpha: 0.4), size: 48),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 32),
              ),
              Positioned(
                bottom: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text('Video',
                      style: GoogleFonts.inter(fontSize: 11, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
        if (caption.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(caption, style: GoogleFonts.inter(fontSize: 14, color: textColor)),
        ],
      ],
    );
  }
}

// ── File Message Bubble ───────────────────────────────────────────────────────

class _FileMessageBubble extends StatelessWidget {
  final ChatMessageModel message;
  final bool isMe;
  final Color textColor;

  const _FileMessageBubble({
    required this.message,
    required this.isMe,
    required this.textColor,
  });

  String _fileName() {
    final url = message.attachmentUrl ?? '';
    return url.split('/').last.split('?').first;
  }

  IconData _fileIcon(String name) {
    final ext = name.split('.').last.toLowerCase();
    if (['pdf'].contains(ext)) return Icons.picture_as_pdf_rounded;
    if (['xls', 'xlsx', 'csv'].contains(ext)) return Icons.table_chart_rounded;
    if (['doc', 'docx', 'txt'].contains(ext)) return Icons.description_rounded;
    if (['zip', 'rar', '7z', 'tar', 'gz'].contains(ext)) return Icons.folder_zip_rounded;
    return Icons.insert_drive_file_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final fileName = _fileName();
    final caption = message.content;
    final iconData = _fileIcon(fileName);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: isMe
                ? Colors.black.withValues(alpha: 0.15)
                : AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(iconData, color: AppColors.primary, size: 26),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      fileName,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 2,
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: textColor),
                    ),
                    Text(
                      'Tap to open',
                      style: GoogleFonts.inter(
                          fontSize: 11,
                          color: textColor.withValues(alpha: 0.6)),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.download_rounded,
                  size: 20, color: textColor.withValues(alpha: 0.6)),
            ],
          ),
        ),
        if (caption.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(caption, style: GoogleFonts.inter(fontSize: 14, color: textColor)),
        ],
      ],
    );
  }
}

// ── Emoji-only Animated Message ───────────────────────────────────────────────

bool _isOnlyEmoji(String text) {
  final s = text.trim();
  if (s.isEmpty) return false;
  final clean = s.replaceAll(RegExp(r'\s+'), '');
  if (clean.isEmpty) return false;
  final regex = RegExp(
    r'^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}]|[\u{2935}]|[\u{3297}]|[\u{3299}])+$',
    unicode: true,
  );
  if (!regex.hasMatch(clean)) return false;
  return clean.runes.length <= 6;
}

class _AnimatedEmojiMessage extends StatefulWidget {
  final String text;
  const _AnimatedEmojiMessage({required this.text});

  @override
  State<_AnimatedEmojiMessage> createState() => _AnimatedEmojiMessageState();
}

class _AnimatedEmojiMessageState extends State<_AnimatedEmojiMessage>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _scaleAnimation = Tween<double>(begin: 0.94, end: 1.08).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final clean = widget.text.trim();
    final count = clean.runes.length;
    final fontSize = count <= 2 ? 42.0 : (count <= 4 ? 36.0 : 30.0);

    return ScaleTransition(
      scale: _scaleAnimation,
      child: Text(
        clean,
        style: TextStyle(fontSize: fontSize),
      ),
    );
  }
}
