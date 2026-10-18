import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/constants/app_colors.dart';
import '../providers/devices_provider.dart';
import '../models/device_model.dart';
import '../repositories/devices_repository.dart';

import '../services/devices_socket_service.dart';

class DevicesScreen extends ConsumerStatefulWidget {
  const DevicesScreen({super.key});

  @override
  ConsumerState<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends ConsumerState<DevicesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(devicesSocketProvider).initSocket();
    });
  }

  @override
  Widget build(BuildContext context) {
    final devicesAsync = ref.watch(devicesProvider);
    final serverInfoAsync = ref.watch(serverInfoProvider);
    final socketService = ref.watch(devicesSocketProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Biometric Devices',
              style: GoogleFonts.inter(fontWeight: FontWeight.w600),
            ),
            const SizedBox(width: 8),
            ValueListenableBuilder<bool>(
              valueListenable: socketService.isConnected,
              builder: (context, connected, _) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: connected
                        ? AppColors.success.withValues(alpha: 0.15)
                        : Colors.grey.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: connected
                          ? AppColors.success.withValues(alpha: 0.5)
                          : Colors.grey.withValues(alpha: 0.4),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: connected ? AppColors.success : Colors.grey,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        connected ? 'LIVE' : 'SYNC',
                        style: GoogleFonts.inter(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: connected ? AppColors.success : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () {
              ref.invalidate(devicesProvider);
              ref.invalidate(serverInfoProvider);
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(devicesProvider);
          ref.invalidate(serverInfoProvider);
        },
        child: devicesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                const SizedBox(height: 12),
                Text(
                  'Failed to load devices',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => ref.invalidate(devicesProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (devices) {
            final pending = devices.where((d) => !d.isAuthorized).toList();
            final authorized = devices.where((d) => d.isAuthorized).toList();
            final online = authorized.where((d) => d.isOnline).length;
            final offline = authorized.where((d) => !d.isOnline).length;

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Server Info Banner
                serverInfoAsync.when(
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (info) => _ServerInfoBanner(info: info, isDark: isDark),
                ),
                const SizedBox(height: 16),

                // Stats Row
                Row(
                  children: [
                    _StatCard(
                      label: 'Total',
                      value: '${devices.length}',
                      color: AppColors.primary,
                      icon: Icons.devices_rounded,
                    ),
                    const SizedBox(width: 8),
                    _StatCard(
                      label: 'Online',
                      value: '$online',
                      color: AppColors.success,
                      icon: Icons.wifi_rounded,
                    ),
                    const SizedBox(width: 8),
                    _StatCard(
                      label: 'Pending',
                      value: '${pending.length}',
                      color: AppColors.warning,
                      icon: Icons.pending_outlined,
                    ),
                    const SizedBox(width: 8),
                    _StatCard(
                      label: 'Offline',
                      value: '$offline',
                      color: Colors.grey,
                      icon: Icons.wifi_off_rounded,
                    ),
                  ],
                ),

                // Pending Section
                if (pending.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _PendingSection(devices: pending),
                ],

                // Authorized Devices Section
                const SizedBox(height: 16),
                Text(
                  'Authorized Terminals',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                if (authorized.isEmpty)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Center(
                        child: Column(
                          children: [
                            const Icon(
                              Icons.devices_outlined,
                              size: 40,
                              color: Colors.grey,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'No authorized devices yet',
                              style: GoogleFonts.inter(color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  ...authorized.map((d) => _DeviceCard(device: d)),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ── Server Info Banner ────────────────────────────────────────────────────────

class _ServerInfoBanner extends StatelessWidget {
  final Map<String, dynamic> info;
  final bool isDark;

  const _ServerInfoBanner({required this.info, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final admsUrl = info['server_url']?.toString() ??
        info['adms_push_url']?.toString() ??
        info['subdomain']?.toString() ??
        'Configure API URL';
    final port = (info['port'] ?? info['adms_port'] ?? 80).toString();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.teal.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.teal.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.dns_rounded, color: Colors.teal, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Biometric Terminal Cloud Connection',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    color: Colors.teal,
                    fontSize: 13,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.teal.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'Port 80',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.teal,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Configure physical terminals (ZKTeco, Hikvision) with this tenant address to auto-register:',
            style: GoogleFonts.inter(
              fontSize: 11,
              color: isDark ? Colors.white70 : Colors.black54,
            ),
          ),
          const SizedBox(height: 10),

          // Server Address Field
          Row(
            children: [
              Expanded(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.black26 : Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isDark ? Colors.white12 : Colors.black12,
                    ),
                  ),
                  child: Row(
                    children: [
                      Text(
                        'SERVER: ',
                        style: GoogleFonts.inter(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                        ),
                      ),
                      Expanded(
                        child: Text(
                          admsUrl,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.copy_rounded, color: Colors.teal, size: 18),
                tooltip: 'Copy Server URL',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: admsUrl));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Server Address copied to clipboard'),
                      backgroundColor: Colors.teal,
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),
            ],
          ),

          const SizedBox(height: 6),

          // Port Field
          Row(
            children: [
              Expanded(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.black26 : Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isDark ? Colors.white12 : Colors.black12,
                    ),
                  ),
                  child: Row(
                    children: [
                      Text(
                        'PORT: ',
                        style: GoogleFonts.inter(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                        ),
                      ),
                      Text(
                        port,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '(HTTP / ADMS)',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.copy_rounded, color: Colors.teal, size: 18),
                tooltip: 'Copy Port',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: port));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Port copied to clipboard'),
                      backgroundColor: Colors.teal,
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Quick 3-Step Setup Guide
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isDark ? Colors.black12 : Colors.white60,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Terminal Setup Steps:',
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: isDark ? Colors.white70 : Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '1. Open Menu ➔ Comm. ➔ Cloud Server / ADMS on device',
                  style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[600]),
                ),
                Text(
                  '2. Set Enable Domain Name = ON and Server Port = 80',
                  style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[600]),
                ),
                Text(
                  '3. Enter Server Address above & reboot to auto-discover',
                  style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;

  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
          child: Column(
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(height: 4),
              Text(
                value,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
              Text(
                label,
                style: GoogleFonts.inter(fontSize: 10, color: Colors.grey),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Pending Authorization Section ─────────────────────────────────────────────

class _PendingSection extends ConsumerWidget {
  final List<DeviceModel> devices;

  const _PendingSection({required this.devices});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.pending_outlined,
                color: AppColors.warning, size: 18),
            const SizedBox(width: 8),
            Text(
              'Pending Authorization',
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.warning,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ...devices.map(
          (device) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                  color: AppColors.warning.withValues(alpha: 0.4), width: 1),
            ),
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.warning,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          device.alias ??
                              device.serialNumber ??
                              'Unknown Device',
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w600, fontSize: 14),
                        ),
                        if (device.ipAddress != null)
                          Text(
                            device.ipAddress!,
                            style: GoogleFonts.inter(
                                fontSize: 12, color: Colors.grey),
                          ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.warning,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 8),
                      textStyle: GoogleFonts.inter(
                          fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                    onPressed: () async {
                      try {
                        await ref
                            .read(devicesRepositoryProvider)
                            .authorizeDevice(device.id);
                        ref.invalidate(devicesProvider);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Device authorized successfully'),
                              backgroundColor: AppColors.success,
                            ),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('Failed to authorize: $e'),
                              backgroundColor: AppColors.error,
                            ),
                          );
                        }
                      }
                    },
                    child: const Text('Authorize'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Authorized Device Card ────────────────────────────────────────────────────

class _DeviceCard extends ConsumerWidget {
  final DeviceModel device;

  const _DeviceCard({required this.device});

  Future<bool?> _confirm(
    BuildContext context,
    String title,
    String content,
  ) {
    return showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title, style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        content: Text(content, style: GoogleFonts.inter()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final title = device.alias ?? device.serialNumber ?? 'Unknown Device';
    final subtitleParts = <String>[
      if (device.ipAddress != null) 'IP: ${device.ipAddress}',
      if (device.firmwareVersion != null) 'FW: ${device.firmwareVersion}',
      if (device.lastSeen != null) 'Last seen: ${device.lastSeen}',
    ];

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: device.isOnline ? AppColors.success : Colors.grey,
              ),
            ),
          ],
        ),
        title: Text(
          title,
          style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        subtitle: subtitleParts.isNotEmpty
            ? Text(
                subtitleParts.join('  •  '),
                style: GoogleFonts.inter(fontSize: 11, color: Colors.grey),
              )
            : null,
        trailing: PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert),
          onSelected: (action) async {
            final repo = ref.read(devicesRepositoryProvider);
            switch (action) {
              case 'sync':
                try {
                  await repo.syncUsers(device.id);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('User sync triggered successfully'),
                        backgroundColor: AppColors.success,
                      ),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Sync failed: $e'),
                        backgroundColor: AppColors.error,
                      ),
                    );
                  }
                }
                break;

              case 'revoke':
                final ok = await _confirm(
                  context,
                  'Revoke Authorization',
                  'Are you sure you want to revoke authorization for "${device.alias ?? device.serialNumber}"?',
                );
                if (ok == true) {
                  try {
                    await repo.revokeDevice(device.id);
                    ref.invalidate(devicesProvider);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Device authorization revoked'),
                          backgroundColor: AppColors.warning,
                        ),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Revoke failed: $e'),
                          backgroundColor: AppColors.error,
                        ),
                      );
                    }
                  }
                }
                break;

              case 'delete':
                final ok = await _confirm(
                  context,
                  'Delete Device',
                  'This will permanently delete "${device.alias ?? device.serialNumber}". This cannot be undone.',
                );
                if (ok == true) {
                  try {
                    await repo.deleteDevice(device.id);
                    ref.invalidate(devicesProvider);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Device deleted'),
                          backgroundColor: AppColors.error,
                        ),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Delete failed: $e'),
                          backgroundColor: AppColors.error,
                        ),
                      );
                    }
                  }
                }
                break;
            }
          },
          itemBuilder: (_) => const [
            PopupMenuItem(
              value: 'sync',
              child: Row(
                children: [
                  Icon(Icons.sync_rounded, size: 18),
                  SizedBox(width: 8),
                  Text('Sync Users'),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'revoke',
              child: Row(
                children: [
                  Icon(Icons.block_rounded, size: 18, color: AppColors.warning),
                  SizedBox(width: 8),
                  Text('Revoke Authorization'),
                ],
              ),
            ),
            PopupMenuItem(
              value: 'delete',
              child: Row(
                children: [
                  Icon(Icons.delete_outline, size: 18, color: AppColors.error),
                  SizedBox(width: 8),
                  Text(
                    'Delete Device',
                    style: TextStyle(color: AppColors.error),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
