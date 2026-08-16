import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/messaging_provider.dart';
import 'chat_screen.dart';

enum UserSearchMode { newChat, selectMembers }

class UserSearchScreen extends ConsumerStatefulWidget {
  final UserSearchMode mode;
  final Function(List<Map<String, dynamic>>)? onMembersSelected;

  const UserSearchScreen({
    super.key,
    this.mode = UserSearchMode.newChat,
    this.onMembersSelected,
  });

  @override
  ConsumerState<UserSearchScreen> createState() => _UserSearchScreenState();
}

class _UserSearchScreenState extends ConsumerState<UserSearchScreen> {
  final _searchController = TextEditingController();
  final Set<Map<String, dynamic>> _selectedUsers = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(userSearchProvider.notifier).search('');
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final resultsAsync = ref.watch(userSearchProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.mode == UserSearchMode.newChat ? 'New Message' : 'Select Members',
          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
        ),
        actions: [
          if (widget.mode == UserSearchMode.selectMembers && _selectedUsers.isNotEmpty)
            TextButton(
              onPressed: () {
                widget.onMembersSelected?.call(_selectedUsers.toList());
                Navigator.of(context).pop();
              },
              child: Text(
                'Done (${_selectedUsers.length})',
                style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.primary),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              onChanged: (q) => ref.read(userSearchProvider.notifier).search(q),
              decoration: InputDecoration(
                hintText: 'Search colleagues by name or email...',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded),
                        onPressed: () {
                          _searchController.clear();
                          ref.read(userSearchProvider.notifier).search('');
                        },
                      )
                    : null,
                filled: true,
                fillColor: isDark ? AppColors.surfaceDark : Colors.grey.shade100,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          if (_selectedUsers.isNotEmpty)
            SizedBox(
              height: 50,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: _selectedUsers.map((u) {
                  final name = u['full_name']?.toString() ?? 'User';
                  return Container(
                    margin: const EdgeInsets.only(right: 8),
                    child: Chip(
                      avatar: CircleAvatar(
                        child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'U'),
                      ),
                      label: Text(name),
                      onDeleted: () {
                        setState(() => _selectedUsers.remove(u));
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
          Expanded(
            child: resultsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error searching users: $e')),
              data: (users) {
                if (users.isEmpty) {
                  return Center(
                    child: Text(
                      'No colleagues found',
                      style: GoogleFonts.inter(color: isDark ? Colors.white54 : Colors.black54),
                    ),
                  );
                }

                return ListView.separated(
                  itemCount: users.length,
                  separatorBuilder: (_, _) => const Divider(height: 1, indent: 64),
                  itemBuilder: (context, i) {
                    final u = users[i];
                    final name = u['full_name']?.toString() ?? 'User';
                    final email = u['email']?.toString() ?? '';
                    final isSelected = _selectedUsers.contains(u);

                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                        child: Text(
                          name.isNotEmpty ? name[0].toUpperCase() : 'U',
                          style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ),
                      title: Text(name, style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                      subtitle: Text(email, style: GoogleFonts.inter(fontSize: 12)),
                      trailing: widget.mode == UserSearchMode.selectMembers
                          ? Checkbox(
                              value: isSelected,
                              onChanged: (val) {
                                setState(() {
                                  if (val == true) {
                                    _selectedUsers.add(u);
                                  } else {
                                    _selectedUsers.remove(u);
                                  }
                                });
                              },
                            )
                          : const Icon(Icons.chevron_right_rounded),
                      onTap: () async {
                        if (widget.mode == UserSearchMode.selectMembers) {
                          setState(() {
                            if (isSelected) {
                              _selectedUsers.remove(u);
                            } else {
                              _selectedUsers.add(u);
                            }
                          });
                        } else {
                          // Start direct conversation
                          try {
                            final conv = await ref.read(messagingRepositoryProvider).createConversation(
                              type: 'direct',
                              participantIds: [u['id'].toString()],
                            );
                            if (context.mounted) {
                              Navigator.of(context).pushReplacement(
                                MaterialPageRoute(builder: (_) => ChatScreen(conversation: conv)),
                              );
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Failed to start chat: $e')),
                              );
                            }
                          }
                        }
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
