import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/ai_message_model.dart';
import '../providers/ai_provider.dart';

class AiChatScreen extends ConsumerStatefulWidget {
  const AiChatScreen({super.key});

  @override
  ConsumerState<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends ConsumerState<AiChatScreen> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();

  final List<String> _quickPrompts = [
    'How do I request leave on mobile?',
    'How do I clock in?',
    'Where can I view my payslip?',
    'How do I apply for a loan?',
    'Where are my notifications?',
    'How do I change my password?',
  ];

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent + 60,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _send(String text) {
    if (text.trim().isEmpty) return;
    _textController.clear();
    ref.read(aiChatProvider.notifier).sendUserMessage(text);
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(aiChatProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.smart_toy_rounded, color: Colors.black87, size: 18),
            ),
            const SizedBox(width: 10),
            Text(
              'AI HR Assistant',
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.green.withValues(alpha: 0.4)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.phone_android, size: 10, color: Colors.green),
                  const SizedBox(width: 3),
                  Text('Mobile', style: GoogleFonts.inter(fontSize: 10, color: Colors.green, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.cleaning_services_outlined),
            tooltip: 'Clear chat',
            onPressed: () => ref.read(aiChatProvider.notifier).clearChat(),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Quick Prompt Chips ──────────────────────────────────────
          if (state.messages.length <= 2)
            Container(
              height: 44,
              margin: const EdgeInsets.only(top: 8, bottom: 4),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: _quickPrompts.length,
                separatorBuilder: (_, index) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  return ActionChip(
                    label: Text(_quickPrompts[i], style: GoogleFonts.inter(fontSize: 12)),
                    backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                    side: BorderSide(color: AppColors.primary.withValues(alpha: 0.3)),
                    onPressed: () => _send(_quickPrompts[i]),
                  );
                },
              ),
            ),

          // ── Messages List ───────────────────────────────────────────
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: state.messages.length,
              itemBuilder: (context, i) {
                final msg = state.messages[i];
                return _AiBubble(msg: msg, isDark: isDark);
              },
            ),
          ),

          // ── Thinking indicator ──────────────────────────────────────
          if (state.isThinking)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'AI is thinking...',
                    style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600], fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),

          // ── Input Bar ───────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
              border: Border(top: BorderSide(color: isDark ? AppColors.borderDark : AppColors.borderLight)),
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        hintText: 'Ask your HR question...',
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      onSubmitted: (v) => _send(v),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.send_rounded, color: AppColors.primary),
                    onPressed: state.isThinking ? null : () => _send(_textController.text),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AiBubble extends StatelessWidget {
  final AiMessageModel msg;
  final bool isDark;
  const _AiBubble({required this.msg, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final isUser = msg.isUser;
    final timeStr = DateFormat('h:mm a').format(msg.timestamp);

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isUser
              ? AppColors.primary
              : (isDark ? AppColors.cardDark : AppColors.cardLight),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isUser ? 16 : 2),
            bottomRight: Radius.circular(isUser ? 2 : 16),
          ),
          border: isUser ? null : Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        child: Column(
          crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!isUser) ...[
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.smart_toy_rounded, size: 14, color: AppColors.primary),
                  const SizedBox(width: 4),
                  Text(
                    'AI Assistant',
                    style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                ],
              ),
              const SizedBox(height: 4),
            ],
            Text(
              msg.text,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: isUser ? Colors.black87 : null,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              timeStr,
              style: GoogleFonts.inter(
                fontSize: 10,
                color: isUser ? Colors.black54 : Colors.grey[500],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
