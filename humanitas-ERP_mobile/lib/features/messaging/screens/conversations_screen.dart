import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/conversation_model.dart';
import '../providers/messaging_provider.dart';
import '../widgets/global_voice_player_banner.dart';
import 'chat_screen.dart';
import 'create_group_screen.dart';
import 'create_channel_screen.dart';
import 'user_search_screen.dart';

import '../../../core/providers/providers.dart';
import '../services/messaging_socket_service.dart';

// ── Pin state provider (persisted via SharedPreferences) ──────────────────────

class PinnedChatsNotifier extends StateNotifier<Set<String>> {
  static const _key = 'pinned_chats';

  PinnedChatsNotifier() : super({}) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_key) ?? [];
    state = Set.from(list);
  }

  Future<void> toggle(String id) async {
    final next = Set<String>.from(state);
    if (next.contains(id)) {
      next.remove(id);
    } else {
      next.add(id);
    }
    state = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key, next.toList());
  }

  bool isPinned(String id) => state.contains(id);
}

final pinnedChatsProvider =
    StateNotifierProvider<PinnedChatsNotifier, Set<String>>((ref) {
  return PinnedChatsNotifier();
});

// ── Conversations Screen ──────────────────────────────────────────────────────

class ConversationsScreen extends ConsumerStatefulWidget {
  const ConversationsScreen({super.key});

  @override
  ConsumerState<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends ConsumerState<ConversationsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final _tabItems = const [
    (label: 'All', icon: Icons.chat_bubble_outline_rounded),
    (label: 'Personal', icon: Icons.person_outline_rounded),
    (label: 'Groups', icon: Icons.group_outlined),
    (label: 'Channels', icon: Icons.campaign_outlined),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabItems.length, vsync: this);
    _tabController.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) => _initSocket());
  }

  Future<void> _initSocket() async {
    final token = await ref.read(secureStorageProvider).getAccessToken();
    if (token != null) {
      ref.read(messagingSocketProvider).initSocket(token);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  List<ConversationModel> _filterByTab(List<ConversationModel> all, int tabIndex) {
    switch (tabIndex) {
      case 1: return all.where((c) => c.isDirect).toList();
      case 2: return all.where((c) => c.isGroup).toList();
      case 3: return all.where((c) => c.isChannel || c.isBroadcast).toList();
      default: return all;
    }
  }

  /// Sorts list so pinned items appear at top.
  List<ConversationModel> _sortWithPins(
      List<ConversationModel> items, Set<String> pinned) {
    final p = items.where((c) => pinned.contains(c.id)).toList();
    final u = items.where((c) => !pinned.contains(c.id)).toList();
    return [...p, ...u];
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final conversationsAsync = ref.watch(conversationsProvider);
    final allConversations = conversationsAsync.asData?.value ?? [];

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      appBar: _buildAppBar(isDark, allConversations),
      body: Column(
        children: [
          const GlobalVoicePlayerBanner(),
          Expanded(
            child: conversationsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _buildError(e, isDark),
              data: (all) => TabBarView(
                controller: _tabController,
                children: List.generate(_tabItems.length, (i) {
                  final filtered = _filterByTab(all, i);
                  return _buildList(filtered, isDark);
                }),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: _buildFAB(),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark, List<ConversationModel> allConversations) {
    return AppBar(
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      elevation: 0,
      scrolledUnderElevation: 0,
      title: Text(
        'Messages',
        style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 22, letterSpacing: -0.5),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.search_rounded),
          tooltip: 'Search Colleagues & Chats',
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const UserSearchScreen(mode: UserSearchMode.newChat)),
            );
          },
        ),
        IconButton(
          icon: const Icon(Icons.refresh_rounded),
          tooltip: 'Refresh',
          onPressed: () => ref.read(conversationsProvider.notifier).fetch(),
        ),
        const SizedBox(width: 4),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(52),
        child: _buildSmoothTabs(isDark, allConversations),
      ),
    );
  }

  /// Telegram-style smooth tab indicator: reads fractional animation value
  /// so the active pill glides with the swipe gesture.
  Widget _buildSmoothTabs(bool isDark, List<ConversationModel> allConversations) {
    return AnimatedBuilder(
      animation: _tabController.animation!,
      builder: (context, _) {
        final animValue = _tabController.animation!.value; // e.g. 1.7 when between tab 1 & 2

        return Container(
          height: 52,
          padding: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isDark
                    ? AppColors.borderDark
                    : AppColors.borderLight.withValues(alpha: 0.5),
                width: 1,
              ),
            ),
          ),
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _tabItems.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              // Compute proximity: 1.0 = fully selected, 0.0 = not selected
              final proximity = (1.0 - (animValue - i).abs()).clamp(0.0, 1.0);
              final item = _tabItems[i];
              final unread = _getUnreadForTab(allConversations, i);
              final isActive = _tabController.index == i;

              // Interpolate colors based on proximity
              final bg = Color.lerp(
                isDark ? Colors.white.withValues(alpha: 0.08) : Colors.grey.shade100,
                AppColors.primary,
                proximity,
              )!;
              final textColor = Color.lerp(
                isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
                const Color(0xFF1A1200),
                proximity,
              )!;

              return GestureDetector(
                onTap: () => _tabController.animateTo(i),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Color.lerp(
                        isDark ? Colors.white12 : Colors.grey.shade300,
                        AppColors.primary,
                        proximity,
                      )!,
                      width: 1,
                    ),
                    boxShadow: proximity > 0.5
                        ? [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.3 * proximity),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            )
                          ]
                        : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(item.icon, size: 15, color: textColor),
                      const SizedBox(width: 6),
                      Text(
                        item.label,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                          color: textColor,
                        ),
                      ),
                      if (unread > 0) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                          decoration: BoxDecoration(
                            color: proximity > 0.5
                                ? const Color(0xFF1A1200)
                                : AppColors.primary,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          constraints: const BoxConstraints(minWidth: 18, minHeight: 16),
                          child: Text(
                            unread > 99 ? '99+' : '$unread',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: proximity > 0.5 ? AppColors.primary : const Color(0xFF1A1200),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  int _getUnreadForTab(List<ConversationModel> all, int index) {
    switch (index) {
      case 0: return all.fold(0, (sum, c) => sum + c.unreadCount);
      case 1: return all.where((c) => c.isDirect).fold(0, (sum, c) => sum + c.unreadCount);
      case 2: return all.where((c) => c.isGroup).fold(0, (sum, c) => sum + c.unreadCount);
      case 3: return all.where((c) => c.isChannel || c.isBroadcast).fold(0, (sum, c) => sum + c.unreadCount);
      default: return 0;
    }
  }

  Widget _buildError(Object e, bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 48),
            const SizedBox(height: 12),
            Text(e.toString().replaceAll('Exception: ', ''),
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 14)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
              onPressed: () => ref.read(conversationsProvider.notifier).fetch(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(List<ConversationModel> items, bool isDark) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline_rounded,
                size: 72,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
            const SizedBox(height: 16),
            Text('Nothing here yet',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text('Start a new conversation using the + button',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                    fontSize: 13,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight)),
          ],
        ),
      );
    }

    final pinned = ref.watch(pinnedChatsProvider);
    final sorted = _sortWithPins(items, pinned);

    return RefreshIndicator(
      onRefresh: () => ref.read(conversationsProvider.notifier).fetch(),
      child: ListView.separated(
        padding: EdgeInsets.only(top: 8, bottom: 16 + MediaQuery.of(context).padding.bottom),
        itemCount: sorted.length,
        separatorBuilder: (_, _) => Divider(
          height: 1,
          indent: 74,
          color: isDark ? AppColors.borderDark : AppColors.borderLight,
        ),
        itemBuilder: (context, i) {
          final conv = sorted[i];
          return _ConvTile(
            conv: conv,
            isPinned: pinned.contains(conv.id),
            onPin: () => ref.read(pinnedChatsProvider.notifier).toggle(conv.id),
          );
        },
      ),
    );
  }

  Widget _buildFAB() {
    return FloatingActionButton(
      backgroundColor: AppColors.primary,
      onPressed: _showNewConversationMenu,
      child: const Icon(Icons.edit_rounded, color: Colors.black),
    );
  }

  void _showNewConversationMenu() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _NewChatMenu(
        onNewChat: () {
          Navigator.pop(context);
          Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const UserSearchScreen(mode: UserSearchMode.newChat)));
        },
        onNewGroup: () {
          Navigator.pop(context);
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CreateGroupScreen()));
        },
        onNewChannel: () {
          Navigator.pop(context);
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CreateChannelScreen()));
        },
      ),
    );
  }
}

// ── Conversation Tile ─────────────────────────────────────────────────────────

class _ConvTile extends ConsumerWidget {
  final ConversationModel conv;
  final bool isPinned;
  final VoidCallback onPin;
  const _ConvTile({required this.conv, required this.isPinned, required this.onPin});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasUnread = conv.unreadCount > 0;

    return InkWell(
      onTap: () {
        ref.read(conversationsProvider.notifier).clearUnread(conv.id);
        Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => ChatScreen(conversation: conv),
        ));
      },
      onLongPress: () => _showContextMenu(context),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            _ConvAvatar(conv: conv),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Row(
                          children: [
                            if (isPinned)
                              const Padding(
                                padding: EdgeInsets.only(right: 4),
                                child: Icon(Icons.push_pin_rounded, size: 12, color: AppColors.primary),
                              ),
                            if (conv.isChannel)
                              const Padding(
                                padding: EdgeInsets.only(right: 4),
                                child: Icon(Icons.campaign_rounded, size: 14, color: AppColors.primary),
                              ),
                            if (conv.isGroup || conv.isBroadcast)
                              const Padding(
                                padding: EdgeInsets.only(right: 4),
                                child: Icon(Icons.group_rounded, size: 14, color: AppColors.primary),
                              ),
                            Flexible(
                              child: Text(
                                conv.displayName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.inter(
                                  fontSize: 15,
                                  fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _timeLabel(conv.lastMessageAt),
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: hasUnread
                              ? AppColors.primary
                              : (isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight),
                          fontWeight: hasUnread ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          conv.lastMessageText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: hasUnread ? FontWeight.w500 : FontWeight.w400,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      ),
                      if (hasUnread)
                        Container(
                          margin: const EdgeInsets.only(left: 6),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                          constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                          child: Text(
                            conv.unreadCount > 99 ? '99+' : '${conv.unreadCount}',
                            style: GoogleFonts.inter(
                                fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black87),
                            textAlign: TextAlign.center,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showContextMenu(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      backgroundColor: isDark ? AppColors.surfaceDark : Colors.white,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36, height: 4,
              margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.borderDark : AppColors.borderLight,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ListTile(
              leading: Icon(
                isPinned ? Icons.push_pin_outlined : Icons.push_pin_rounded,
                color: AppColors.primary,
              ),
              title: Text(
                isPinned ? 'Unpin Chat' : 'Pin Chat',
                style: GoogleFonts.inter(fontWeight: FontWeight.w600),
              ),
              onTap: () {
                Navigator.pop(context);
                onPin();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String _timeLabel(String? raw) {
    if (raw == null) return '';
    try {
      final dt = DateTime.parse(raw).toLocal();
      final now = DateTime.now();
      final diff = now.difference(dt);
      if (diff.inDays == 0) return DateFormat('h:mm a').format(dt);
      if (diff.inDays == 1) return 'Yesterday';
      if (diff.inDays < 7) return DateFormat('EEE').format(dt);
      return DateFormat('d/M/yy').format(dt);
    } catch (_) {
      return '';
    }
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

class _ConvAvatar extends StatelessWidget {
  final ConversationModel conv;
  const _ConvAvatar({required this.conv});

  @override
  Widget build(BuildContext context) {
    final letter = conv.displayName.isNotEmpty ? conv.displayName[0].toUpperCase() : 'C';
    final color = _colorFor(conv.id);

    return Stack(
      children: [
        CircleAvatar(
          radius: 26,
          backgroundColor: color.withValues(alpha: 0.15),
          backgroundImage: conv.resolvedAvatarUrl != null ? NetworkImage(conv.resolvedAvatarUrl!) : null,
          child: conv.resolvedAvatarUrl == null
              ? Text(letter, style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18, color: color))
              : null,
        ),
        if (conv.isChannel)
          Positioned(
            bottom: 0, right: 0,
            child: Container(
              width: 16, height: 16,
              decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
              child: const Icon(Icons.campaign_rounded, size: 10, color: Colors.black),
            ),
          ),
        if (conv.isGroup || conv.isBroadcast)
          Positioned(
            bottom: 0, right: 0,
            child: Container(
              width: 16, height: 16,
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.9), shape: BoxShape.circle),
              child: const Icon(Icons.group_rounded, size: 10, color: Colors.black),
            ),
          ),
      ],
    );
  }

  Color _colorFor(String id) {
    final colors = [
      const Color(0xFF4E9AF1),
      const Color(0xFF5CCA8B),
      const Color(0xFFFF7043),
      const Color(0xFF9C6FE4),
      const Color(0xFFFF9800),
      const Color(0xFF26C6DA),
      const Color(0xFFEC407A),
    ];
    return colors[id.hashCode.abs() % colors.length];
  }
}

// ── New Chat Menu ─────────────────────────────────────────────────────────────

class _NewChatMenu extends StatelessWidget {
  final VoidCallback onNewChat;
  final VoidCallback onNewGroup;
  final VoidCallback onNewChannel;
  const _NewChatMenu({required this.onNewChat, required this.onNewGroup, required this.onNewChannel});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: isDark ? AppColors.borderDark : AppColors.borderLight,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            _MenuItem(icon: Icons.person_add_rounded, label: 'New Chat', color: AppColors.primary, onTap: onNewChat),
            _MenuItem(icon: Icons.group_add_rounded, label: 'New Group', color: const Color(0xFF5CCA8B), onTap: onNewGroup),
            _MenuItem(icon: Icons.campaign_rounded, label: 'New Channel', color: const Color(0xFF9C6FE4), onTap: onNewChannel),
          ],
        ),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _MenuItem({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        width: 44, height: 44,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), shape: BoxShape.circle),
        child: Icon(icon, color: color),
      ),
      title: Text(label, style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 15)),
      onTap: onTap,
    );
  }
}
