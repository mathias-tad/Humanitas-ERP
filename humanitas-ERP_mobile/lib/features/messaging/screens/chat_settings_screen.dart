import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/models/conversation_model.dart';
import '../providers/messaging_provider.dart';
import 'direct_chat_requests_screen.dart';

class ChatSettingsScreen extends ConsumerStatefulWidget {
  final ConversationModel conversation;
  const ChatSettingsScreen({super.key, required this.conversation});

  @override
  ConsumerState<ChatSettingsScreen> createState() => _ChatSettingsScreenState();
}

class _ChatSettingsScreenState extends ConsumerState<ChatSettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(messagingSettingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Chat Settings', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
      ),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error loading settings: $e')),
        data: (settings) {
          final notifyDirect = settings['notify_on_direct_messages'] ?? true;
          final notifyGroup = settings['notify_on_group_messages'] ?? true;
          final notifyCalls = settings['notify_on_calls'] ?? true;
          final enableSound = settings['enable_sound'] ?? true;
          final privacyMode = settings['privacy_mode_enabled'] ?? false;
          final readReceipts = settings['show_read_receipts'] ?? true;

          return ListView(
            children: [
              _SectionHeader('Notifications'),
              SwitchListTile(
                title: const Text('Direct Messages Notifications'),
                subtitle: const Text('Receive notifications for 1-on-1 chats'),
                value: notifyDirect,
                onChanged: (val) => ref.read(messagingSettingsProvider.notifier).update({'notify_on_direct_messages': val}),
              ),
              SwitchListTile(
                title: const Text('Group Messages Notifications'),
                subtitle: const Text('Receive notifications for group chats & channels'),
                value: notifyGroup,
                onChanged: (val) => ref.read(messagingSettingsProvider.notifier).update({'notify_on_group_messages': val}),
              ),
              SwitchListTile(
                title: const Text('Call Notifications'),
                subtitle: const Text('Receive voice & video call alerts'),
                value: notifyCalls,
                onChanged: (val) => ref.read(messagingSettingsProvider.notifier).update({'notify_on_calls': val}),
              ),
              SwitchListTile(
                title: const Text('Sound Effects'),
                value: enableSound,
                onChanged: (val) => ref.read(messagingSettingsProvider.notifier).update({'enable_sound': val}),
              ),
              const Divider(),
              _SectionHeader('Privacy & Security'),
              SwitchListTile(
                title: const Text('Privacy Mode'),
                subtitle: const Text('Hide message previews on lock screen'),
                value: privacyMode,
                onChanged: (val) => ref.read(messagingSettingsProvider.notifier).update({'privacy_mode_enabled': val}),
              ),
              SwitchListTile(
                title: const Text('Read Receipts'),
                subtitle: const Text('Send double blue check marks when you read messages'),
                value: readReceipts,
                onChanged: (val) => ref.read(messagingSettingsProvider.notifier).update({'show_read_receipts': val}),
              ),
              const Divider(),
              _SectionHeader('Role Restrictions & Permissions'),
              ListTile(
                leading: const Icon(Icons.shield_outlined, color: AppColors.primary),
                title: const Text('Direct Chat Access & Override'),
                subtitle: const Text('Manage incoming 1-on-1 requests & role restrictions'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const DirectChatRequestsScreen()),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary),
      ),
    );
  }
}
