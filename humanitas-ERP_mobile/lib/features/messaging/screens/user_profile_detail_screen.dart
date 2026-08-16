import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/conversation_model.dart';
import '../../../core/widgets/full_screen_avatar_viewer.dart';

/// Shows a user's profile detail — tapping avatar shows full-screen image.
/// Used when tapping a DM chat header or a sender avatar in a group.
class UserProfileDetailScreen extends StatelessWidget {
  final String userId;
  final String name;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final String? role;
  /// If non-null, shows a "Message" button to open this conversation.
  final ConversationModel? existingConversation;
  /// Callback when "Message" tapped and no existing conversation.
  final VoidCallback? onStartChat;

  const UserProfileDetailScreen({
    super.key,
    required this.userId,
    required this.name,
    this.email,
    this.phone,
    this.avatarUrl,
    this.role,
    this.existingConversation,
    this.onStartChat,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final initials = name.isNotEmpty ? name[0].toUpperCase() : 'U';

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.backgroundLight,
      body: CustomScrollView(
        slivers: [
          // ── Collapsing header ──────────────────────────────────────────
          SliverAppBar(
            expandedHeight: 260,
            pinned: true,
            backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.8),
                      isDark ? const Color(0xFF1A1A2E) : const Color(0xFFF5F5F5),
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 40),
                    // Tappable avatar → full-screen viewer
                    GestureDetector(
                      onTap: avatarUrl != null
                          ? () => _showFullScreenAvatar(context)
                          : null,
                      child: Hero(
                        tag: 'avatar_$userId',
                        child: CircleAvatar(
                          radius: 52,
                          backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl!) : null,
                          backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                          child: avatarUrl == null
                              ? Text(initials,
                                  style: GoogleFonts.inter(
                                      fontSize: 38,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.primary))
                              : null,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(name,
                        style: GoogleFonts.inter(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: isDark ? Colors.white : Colors.black87)),
                    if (role != null && role!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(role!,
                          style: GoogleFonts.inter(
                              fontSize: 13,
                              color: isDark ? Colors.white60 : Colors.black54)),
                    ],
                  ],
                ),
              ),
            ),
          ),

          // ── Info cards ─────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if (email != null && email!.isNotEmpty)
                    _InfoTile(
                      icon: Icons.email_outlined,
                      label: 'Email',
                      value: email!,
                      isDark: isDark,
                    ),
                  if (phone != null && phone!.isNotEmpty)
                    _InfoTile(
                      icon: Icons.phone_outlined,
                      label: 'Phone',
                      value: phone!,
                      isDark: isDark,
                    ),

                  const SizedBox(height: 24),

                  // ── Message button ──────────────────────────────────
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.message_rounded, color: Colors.black87),
                      label: Text('Send Message',
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: Colors.black87)),
                      onPressed: () {
                        if (existingConversation != null) {
                          // Pop detail screen and the caller will open the chat
                          Navigator.of(context).pop(existingConversation);
                        } else {
                          Navigator.of(context).pop();
                          onStartChat?.call();
                        }
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showFullScreenAvatar(BuildContext context) {
    FullScreenAvatarViewer.show(
      context,
      avatarUrl: avatarUrl,
      title: name,
      heroTag: 'avatar_$userId',
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final bool isDark;
  const _InfoTile({required this.icon, required this.label, required this.value, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 20),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: GoogleFonts.inter(
                      fontSize: 11,
                      color: isDark ? Colors.white54 : Colors.black45)),
              Text(value,
                  style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: isDark ? Colors.white : Colors.black87)),
            ],
          ),
        ],
      ),
    );
  }
}
