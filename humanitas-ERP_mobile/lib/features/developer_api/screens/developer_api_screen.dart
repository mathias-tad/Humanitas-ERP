import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/constants/app_colors.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/developer_api/models/developer_api_model.dart';
import 'package:humanitas_erp_mobile/features/developer_api/providers/developer_api_provider.dart';

class DeveloperApiScreen extends ConsumerStatefulWidget {
  const DeveloperApiScreen({super.key});

  @override
  ConsumerState<DeveloperApiScreen> createState() => _DeveloperApiScreenState();
}

class _DeveloperApiScreenState extends ConsumerState<DeveloperApiScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  bool _hasViewPermission() {
    final auth = ref.read(authProvider);
    final role = auth.user?.role?.toLowerCase() ?? '';
    if (role == 'owner' || role == 'admin' || role == 'administrator') return true;
    return auth.hasAnyPermission(['view_developer_api', 'manage_developer_api']);
  }

  bool _hasManagePermission() {
    final auth = ref.read(authProvider);
    final role = auth.user?.role?.toLowerCase() ?? '';
    if (role == 'owner' || role == 'admin' || role == 'administrator') return true;
    return auth.hasAnyPermission(['manage_developer_api']);
  }

  Widget _statusChip(String status, {bool success = true}) {
    final color = success ? AppColors.success : AppColors.error;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        status.toUpperCase().replaceAll('_', ' '),
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  void _showCreateKeyDialog() {
    final nameCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Create API Key', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        content: TextField(
          controller: nameCtrl,
          decoration: InputDecoration(
            labelText: 'Key Name',
            hintText: 'e.g. Production Integration',
            border: const OutlineInputBorder(),
            labelStyle: GoogleFonts.inter(),
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: GoogleFonts.inter()),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () async {
              if (nameCtrl.text.trim().isEmpty) return;
              Navigator.pop(ctx);
              try {
                final key = await ref
                    .read(developerApiRepositoryProvider)
                    .createApiKey(name: nameCtrl.text.trim());
                ref.invalidate(apiKeysProvider);
                if (mounted) _showNewKeyDialog(key);
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
                  );
                }
              }
            },
            child: Text('Create', style: GoogleFonts.inter(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showNewKeyDialog(ApiKeyModel key) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text('API Key Created', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Copy this key now — it will never be shown again.',
              style: GoogleFonts.inter(fontSize: 13, color: Colors.orange.shade800),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: SelectableText(
                      key.rawToken ?? '${key.keyPrefix}...',
                      style: GoogleFonts.robotoMono(fontSize: 12),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy, size: 18),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: key.rawToken ?? ''));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Key copied to clipboard')),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            onPressed: () => Navigator.pop(ctx),
            child: Text('I\'ve saved it', style: GoogleFonts.inter(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showCreateWebhookDialog() {
    final nameCtrl = TextEditingController();
    final urlCtrl = TextEditingController();
    final selectedEvents = <String>[];
    final availableEvents = [
      'employee.created',
      'employee.updated',
      'employee.terminated',
      'leave.approved',
      'leave.rejected',
      'payroll.processed',
      'attendance.recorded',
      'onboarding.completed',
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => DraggableScrollableSheet(
          initialChildSize: 0.85,
          maxChildSize: 0.95,
          minChildSize: 0.5,
          builder: (_, scrollCtrl) => Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 10),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Text(
                    'Create Webhook',
                    style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                ),
                Expanded(
                  child: ListView(
                    controller: scrollCtrl,
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                    children: [
                      TextField(
                        controller: nameCtrl,
                        decoration: InputDecoration(
                          labelText: 'Webhook Name',
                          border: const OutlineInputBorder(),
                          labelStyle: GoogleFonts.inter(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: urlCtrl,
                        decoration: InputDecoration(
                          labelText: 'Endpoint URL',
                          hintText: 'https://your-server.com/webhook',
                          border: const OutlineInputBorder(),
                          labelStyle: GoogleFonts.inter(),
                        ),
                        keyboardType: TextInputType.url,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Events to Subscribe',
                        style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      const SizedBox(height: 8),
                      ...availableEvents.map((event) => CheckboxListTile(
                            dense: true,
                            title: Text(event, style: GoogleFonts.inter(fontSize: 13)),
                            value: selectedEvents.contains(event),
                            activeColor: AppColors.primary,
                            controlAffinity: ListTileControlAffinity.leading,
                            onChanged: (v) {
                              setModalState(() {
                                if (v == true) {
                                  selectedEvents.add(event);
                                } else {
                                  selectedEvents.remove(event);
                                }
                              });
                            },
                          )),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          minimumSize: const Size(double.infinity, 48),
                        ),
                        onPressed: () async {
                          if (nameCtrl.text.trim().isEmpty || urlCtrl.text.trim().isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Name and URL are required')),
                            );
                            return;
                          }
                          Navigator.pop(ctx);
                          try {
                            await ref.read(developerApiRepositoryProvider).createWebhook(
                                  name: nameCtrl.text.trim(),
                                  url: urlCtrl.text.trim(),
                                  events: selectedEvents,
                                );
                            ref.invalidate(webhooksProvider);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Webhook created successfully')),
                              );
                            }
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
                              );
                            }
                          }
                        },
                        child: Text('Create Webhook', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
                        onPressed: () => Navigator.pop(ctx),
                        child: Text('Cancel', style: GoogleFonts.inter()),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasViewPermission()) {
      return Scaffold(
        appBar: AppBar(
          title: Text('Developer API', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline, size: 56, color: Colors.grey),
              const SizedBox(height: 16),
              Text(
                'Access Restricted',
                style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                'You do not have permission to view Developer API settings.',
                style: GoogleFonts.inter(fontSize: 14, color: Colors.grey.shade600),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Developer API', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(apiKeysProvider);
              ref.invalidate(webhooksProvider);
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: Colors.grey.shade600,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(icon: Icon(Icons.key, size: 18), text: 'API Keys'),
            Tab(icon: Icon(Icons.webhook, size: 18), text: 'Webhooks'),
          ],
        ),
      ),
      floatingActionButton: _hasManagePermission()
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.primary,
              onPressed: () {
                if (_tabController.index == 0) {
                  _showCreateKeyDialog();
                } else {
                  _showCreateWebhookDialog();
                }
              },
              icon: const Icon(Icons.add, color: Colors.white),
              label: Text(
                _tabController.index == 0 ? 'New Key' : 'New Webhook',
                style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600),
              ),
            )
          : null,
      body: TabBarView(
        controller: _tabController,
        children: [
          _ApiKeysTab(hasManage: _hasManagePermission()),
          _WebhooksTab(hasManage: _hasManagePermission()),
        ],
      ),
    );
  }
}

// ── API Keys Tab ─────────────────────────────────────────────────────────────

class _ApiKeysTab extends ConsumerWidget {
  final bool hasManage;
  const _ApiKeysTab({required this.hasManage});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final keysAsync = ref.watch(apiKeysProvider);

    return keysAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Text('Error: $e', style: GoogleFonts.inter(color: AppColors.error)),
      ),
      data: (keys) {
        if (keys.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.vpn_key_off_outlined, size: 56, color: Colors.grey.shade400),
                const SizedBox(height: 12),
                Text(
                  'No API Keys yet',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
                ),
                const SizedBox(height: 4),
                Text(
                  'Create your first API key to get started.',
                  style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade500),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(apiKeysProvider);
            await ref.read(apiKeysProvider.future);
          },
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
            itemCount: keys.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final key = keys[index];
              final isRevoked = key.status == 'revoked';
              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isRevoked ? Colors.grey.shade200 : Colors.grey.shade200,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.vpn_key,
                          size: 18,
                          color: isRevoked ? Colors.grey : AppColors.primary,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            key.name,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                              color: isRevoked ? Colors.grey : Colors.black87,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isRevoked
                                ? Colors.grey.withOpacity(0.12)
                                : AppColors.success.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            isRevoked ? 'REVOKED' : 'ACTIVE',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isRevoked ? Colors.grey : AppColors.success,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Text(
                        '${key.keyPrefix}••••••••••••••••••••••••••••••••••••',
                        style: GoogleFonts.robotoMono(fontSize: 12, color: Colors.grey.shade700),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(Icons.access_time, size: 12, color: Colors.grey.shade500),
                        const SizedBox(width: 4),
                        Text(
                          key.lastUsedAt != null ? 'Last used: ${_fmtDate(key.lastUsedAt!)}' : 'Never used',
                          style: GoogleFonts.inter(fontSize: 11, color: Colors.grey.shade500),
                        ),
                        const Spacer(),
                        if (!isRevoked && hasManage)
                          TextButton(
                            style: TextButton.styleFrom(
                              foregroundColor: AppColors.error,
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                            ),
                            onPressed: () async {
                              final confirm = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: Text('Revoke Key', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                                  content: Text(
                                    'This action cannot be undone. Any integrations using "${key.name}" will stop working.',
                                    style: GoogleFonts.inter(),
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () => Navigator.pop(ctx, false),
                                      child: Text('Cancel', style: GoogleFonts.inter()),
                                    ),
                                    ElevatedButton(
                                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                                      onPressed: () => Navigator.pop(ctx, true),
                                      child: Text('Revoke', style: GoogleFonts.inter(color: Colors.white)),
                                    ),
                                  ],
                                ),
                              );
                              if (confirm == true) {
                                try {
                                  await ref.read(developerApiRepositoryProvider).revokeApiKey(key.id);
                                  ref.invalidate(apiKeysProvider);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('API key revoked')),
                                    );
                                  }
                                } catch (e) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
                                    );
                                  }
                                }
                              }
                            },
                            child: Text('Revoke', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600)),
                          ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  String _fmtDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}

// ── Webhooks Tab ─────────────────────────────────────────────────────────────

class _WebhooksTab extends ConsumerWidget {
  final bool hasManage;
  const _WebhooksTab({required this.hasManage});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final webhooksAsync = ref.watch(webhooksProvider);

    return webhooksAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Text('Error: $e', style: GoogleFonts.inter(color: AppColors.error)),
      ),
      data: (webhooks) {
        if (webhooks.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.webhook, size: 56, color: Colors.grey.shade400),
                const SizedBox(height: 12),
                Text(
                  'No Webhooks configured',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
                ),
                const SizedBox(height: 4),
                Text(
                  'Subscribe to events to get real-time notifications.',
                  style: GoogleFonts.inter(fontSize: 13, color: Colors.grey.shade500),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(webhooksProvider);
            await ref.read(webhooksProvider.future);
          },
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
            itemCount: webhooks.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final wh = webhooks[index];
              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            wh.name,
                            style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 15),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: wh.isActive
                                ? AppColors.success.withOpacity(0.12)
                                : Colors.grey.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            wh.isActive ? 'ACTIVE' : 'PAUSED',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: wh.isActive ? AppColors.success : Colors.grey,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      wh.url,
                      style: GoogleFonts.inter(fontSize: 12, color: Colors.blue.shade700),
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: wh.events.map((event) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          event,
                          style: GoogleFonts.inter(fontSize: 10, color: AppColors.primary, fontWeight: FontWeight.w600),
                        ),
                      )).toList(),
                    ),
                    if (hasManage) ...[
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton.icon(
                            onPressed: () async {
                              try {
                                await ref.read(developerApiRepositoryProvider).updateWebhook(
                                      wh.id,
                                      isActive: !wh.isActive,
                                    );
                                ref.invalidate(webhooksProvider);
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
                                  );
                                }
                              }
                            },
                            icon: Icon(wh.isActive ? Icons.pause : Icons.play_arrow, size: 16),
                            label: Text(wh.isActive ? 'Pause' : 'Resume', style: GoogleFonts.inter(fontSize: 12)),
                          ),
                          TextButton.icon(
                            style: TextButton.styleFrom(foregroundColor: AppColors.error),
                            onPressed: () async {
                              final confirm = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: Text('Delete Webhook', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                                  content: Text(
                                    'Delete "${wh.name}"? This cannot be undone.',
                                    style: GoogleFonts.inter(),
                                  ),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                    ElevatedButton(
                                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                                      onPressed: () => Navigator.pop(ctx, true),
                                      child: Text('Delete', style: GoogleFonts.inter(color: Colors.white)),
                                    ),
                                  ],
                                ),
                              );
                              if (confirm == true) {
                                try {
                                  await ref.read(developerApiRepositoryProvider).deleteWebhook(wh.id);
                                  ref.invalidate(webhooksProvider);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Webhook deleted')),
                                    );
                                  }
                                } catch (e) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
                                    );
                                  }
                                }
                              }
                            },
                            icon: const Icon(Icons.delete_outline, size: 16),
                            label: Text('Delete', style: GoogleFonts.inter(fontSize: 12)),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}
