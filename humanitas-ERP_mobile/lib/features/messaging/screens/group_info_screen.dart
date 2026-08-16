import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/conversation_model.dart';
import '../../../core/widgets/full_screen_avatar_viewer.dart';
import '../providers/messaging_provider.dart';
import 'user_search_screen.dart';

class GroupInfoScreen extends ConsumerStatefulWidget {
  final ConversationModel conversation;
  const GroupInfoScreen({super.key, required this.conversation});

  @override
  ConsumerState<GroupInfoScreen> createState() => _GroupInfoScreenState();
}

class _GroupInfoScreenState extends ConsumerState<GroupInfoScreen> {
  late ConversationModel _conv;

  @override
  void initState() {
    super.initState();
    _conv = widget.conversation;
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final updated = await ref.read(messagingRepositoryProvider).getConversation(_conv.id);
      if (mounted) setState(() => _conv = updated);
    } catch (_) {}
  }

  void _handleAvatarChange() {
    showAvatarPickerSheet(
      context: context,
      currentAvatarUrl: _conv.resolvedAvatarUrl,
      name: _conv.displayName,
      onImagePicked: (bytes, filename, mime) async {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Uploading group photo...'), duration: Duration(seconds: 2)),
        );
        try {
          final updated = await ref.read(messagingRepositoryProvider).uploadGroupAvatar(_conv.id, bytes, filename, mime);
          if (mounted) {
            setState(() => _conv = updated);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Group photo updated!'), backgroundColor: AppColors.success),
            );
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Failed to update group photo: ${e.toString().replaceAll("Exception: ", "")}'), backgroundColor: AppColors.error),
            );
          }
        }
      },
      onDelete: _conv.resolvedAvatarUrl != null && _conv.resolvedAvatarUrl!.isNotEmpty ? _handleAvatarDelete : null,
    );
  }

  Future<void> _handleAvatarDelete() async {
    try {
      final updated = await ref.read(messagingRepositoryProvider).updateConversation(_conv.id, avatarUrl: '');
      if (mounted) {
        setState(() => _conv = updated);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Group photo removed'), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to remove group photo: ${e.toString().replaceAll("Exception: ", "")}'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(_conv.isChannel ? 'Channel Info' : 'Group Info', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [
          if (_conv.isAdmin)
            IconButton(
              icon: const Icon(Icons.edit_rounded),
              onPressed: _showEditDialog,
            ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 20),
            Stack(
              alignment: Alignment.bottomRight,
              children: [
                GestureDetector(
                  onTap: () {
                    if (_conv.resolvedAvatarUrl != null && _conv.resolvedAvatarUrl!.isNotEmpty) {
                      FullScreenAvatarViewer.show(
                        context,
                        avatarUrl: _conv.resolvedAvatarUrl,
                        title: _conv.displayName,
                        heroTag: 'conv_avatar_${_conv.id}',
                        onEditAvatar: _conv.isAdmin ? _handleAvatarChange : null,
                        onDeleteAvatar: _conv.isAdmin && _conv.resolvedAvatarUrl != null && _conv.resolvedAvatarUrl!.isNotEmpty
                            ? _handleAvatarDelete
                            : null,
                      );
                    } else if (_conv.isAdmin) {
                      _handleAvatarChange();
                    }
                  },
                  child: Hero(
                    tag: 'conv_avatar_${_conv.id}',
                    child: CircleAvatar(
                      radius: 46,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                      backgroundImage: _conv.resolvedAvatarUrl != null ? NetworkImage(_conv.resolvedAvatarUrl!) : null,
                      child: _conv.resolvedAvatarUrl == null
                          ? Text(
                              _conv.displayName.isNotEmpty ? _conv.displayName[0].toUpperCase() : 'G',
                              style: GoogleFonts.inter(fontSize: 32, fontWeight: FontWeight.bold, color: AppColors.primary),
                            )
                          : null,
                    ),
                  ),
                ),
                if (_conv.isAdmin)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: GestureDetector(
                      onTap: _handleAvatarChange,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                        child: const Icon(Icons.camera_alt, size: 14, color: Color(0xFF1A1200)),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(_conv.displayName, style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(
              '${_conv.memberCount} ${_conv.isChannel ? "subscribers" : "members"}',
              style: GoogleFonts.inter(color: isDark ? Colors.white54 : Colors.black54),
            ),
            if (_conv.description != null && _conv.description!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  _conv.description!,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(fontSize: 14, color: isDark ? Colors.white70 : Colors.black87),
                ),
              ),
            ],
            const SizedBox(height: 24),
            const Divider(height: 1),
            if (_conv.isAdmin)
              ListTile(
                leading: const Icon(Icons.person_add_rounded, color: AppColors.primary),
                title: Text('Add Member', style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: AppColors.primary)),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => UserSearchScreen(
                        mode: UserSearchMode.selectMembers,
                        onMembersSelected: (members) async {
                          final uIds = members.map((m) => m['id'].toString()).toList();
                          await ref.read(messagingRepositoryProvider).addMembers(_conv.id, uIds);
                          _refresh();
                        },
                      ),
                    ),
                  );
                },
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Members',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _conv.participants.length,
              separatorBuilder: (_, _) => const Divider(height: 1, indent: 64),
              itemBuilder: (context, i) {
                final p = _conv.participants[i];
                final u = p['user'] as Map<String, dynamic>?;
                final name = u?['full_name']?.toString() ?? 'User';
                final email = u?['email']?.toString() ?? '';
                final isAdmin = p['isAdmin'] == true;
                final userId = p['userId']?.toString();

                return ListTile(
                  leading: CircleAvatar(
                    child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'U'),
                  ),
                  title: Row(
                    children: [
                      Text(name, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                      if (isAdmin) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text('Admin', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.primary)),
                        ),
                      ],
                    ],
                  ),
                  subtitle: Text(email, style: GoogleFonts.inter(fontSize: 12)),
                  trailing: _conv.isAdmin
                      ? PopupMenuButton<String>(
                          onSelected: (val) async {
                            if (val == 'admin') {
                              await ref.read(messagingRepositoryProvider).updateMemberRole(_conv.id, userId!, isAdmin ? 'member' : 'admin');
                              _refresh();
                            } else if (val == 'remove') {
                              await ref.read(messagingRepositoryProvider).removeMember(_conv.id, userId!);
                              _refresh();
                            }
                          },
                          itemBuilder: (_) => [
                            PopupMenuItem(value: 'admin', child: Text(isAdmin ? 'Remove Admin' : 'Make Admin')),
                            const PopupMenuItem(value: 'remove', child: Text('Remove from Group', style: TextStyle(color: AppColors.error))),
                          ],
                        )
                      : null,
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showEditDialog() {
    final nameController = TextEditingController(text: _conv.name);
    final descController = TextEditingController(text: _conv.description);

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Edit Group Details'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: 12),
            TextField(controller: descController, decoration: const InputDecoration(labelText: 'Description')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await ref.read(messagingRepositoryProvider).updateConversation(
                _conv.id,
                name: nameController.text.trim(),
                description: descController.text.trim(),
              );
              _refresh();
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}
