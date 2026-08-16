import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../providers/messaging_provider.dart';
import 'chat_screen.dart';
import 'user_search_screen.dart';

class CreateChannelScreen extends ConsumerStatefulWidget {
  const CreateChannelScreen({super.key});

  @override
  ConsumerState<CreateChannelScreen> createState() => _CreateChannelScreenState();
}

class _CreateChannelScreenState extends ConsumerState<CreateChannelScreen> {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  List<Map<String, dynamic>> _selectedSubscribers = [];
  bool _onlyAdminsCanPost = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _createChannel() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a channel name')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final pIds = _selectedSubscribers.map((m) => m['id'].toString()).toList();
      final conv = await ref.read(messagingRepositoryProvider).createConversation(
        type: 'channel',
        name: name,
        description: _descController.text.trim(),
        participantIds: pIds,
        onlyAdminsCanPost: _onlyAdminsCanPost,
      );

      ref.read(conversationsProvider.notifier).fetch();

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => ChatScreen(conversation: conv)),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create channel: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('New Channel', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: _isLoading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check_rounded),
            onPressed: _isLoading ? null : _createChannel,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: CircleAvatar(
                radius: 40,
                backgroundColor: const Color(0xFF9C6FE4).withValues(alpha: 0.15),
                child: const Icon(Icons.campaign_rounded, size: 40, color: Color(0xFF9C6FE4)),
              ),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Channel Name',
                prefixIcon: Icon(Icons.campaign_outlined),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descController,
              decoration: const InputDecoration(
                labelText: 'Description (Optional)',
                prefixIcon: Icon(Icons.description_outlined),
              ),
            ),
            const SizedBox(height: 16),
            SwitchListTile(
              title: Text('Only Admins Can Post', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              subtitle: Text('Subscribers will only read messages', style: GoogleFonts.inter(fontSize: 12)),
              value: _onlyAdminsCanPost,
              onChanged: (val) => setState(() => _onlyAdminsCanPost = val),
              activeTrackColor: AppColors.primary,
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Initial Subscribers (${_selectedSubscribers.length})',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                TextButton.icon(
                  icon: const Icon(Icons.person_add_rounded),
                  label: const Text('Add Subscribers'),
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => UserSearchScreen(
                          mode: UserSearchMode.selectMembers,
                          onMembersSelected: (members) {
                            setState(() => _selectedSubscribers = members);
                          },
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
