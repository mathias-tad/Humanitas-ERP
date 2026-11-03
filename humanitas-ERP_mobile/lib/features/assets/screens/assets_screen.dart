import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/constants/app_colors.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/assets/providers/asset_provider.dart';

class AssetsScreen extends ConsumerStatefulWidget {
  const AssetsScreen({super.key});

  @override
  ConsumerState<AssetsScreen> createState() => _AssetsScreenState();
}

class _AssetsScreenState extends ConsumerState<AssetsScreen> with SingleTickerProviderStateMixin {
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

  bool _hasPermission() {
    final auth = ref.read(authProvider);
    final role = auth.user?.role.toLowerCase() ?? '';
    if (role == 'owner' || role == 'admin' || role == 'administrator') return true;
    return auth.hasAnyPermission(['view_assets', 'view_my_assets']);
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'available':
        return AppColors.success;
      case 'assigned':
        return Colors.blue;
      case 'maintenance':
      case 'repair':
        return Colors.orange;
      case 'retired':
      case 'lost':
        return AppColors.error;
      default:
        return Colors.grey;
    }
  }

  Widget _statusChip(String status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _statusColor(status).withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _statusColor(status).withOpacity(0.4)),
      ),
      child: Text(
        status.replaceAll('_', ' ').toUpperCase(),
        style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: _statusColor(status)),
      ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.25)),
        ),
        child: Column(
          children: [
            Text(value, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: color)),
            const SizedBox(height: 2),
            Text(label, style: GoogleFonts.inter(fontSize: 9, color: Colors.grey[600]), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasPermission()) {
      return Scaffold(
        appBar: AppBar(title: Text('Asset Tracking', style: GoogleFonts.inter(fontWeight: FontWeight.w600))),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline, size: 64, color: Colors.grey),
              const SizedBox(height: 16),
              Text(
                'You do not have permission to view assets.',
                style: GoogleFonts.inter(color: Colors.grey[600]),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final analyticsAsync = ref.watch(assetAnalyticsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Asset Tracking', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(allAssetsProvider);
              ref.invalidate(myAssetsProvider);
              ref.invalidate(assetAnalyticsProvider);
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'All Assets'),
            Tab(text: 'My Assets'),
          ],
        ),
      ),
      body: Column(
        children: [
          analyticsAsync.when(
            data: (analytics) => Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  _statCard('Total', analytics.totalAssets.toString(), AppColors.primary),
                  _statCard('Available', analytics.availableCount.toString(), AppColors.success),
                  _statCard('In Custody', analytics.assignedCount.toString(), Colors.blue),
                  _statCard('Service', analytics.maintenanceCount.toString(), Colors.orange),
                ],
              ),
            ),
            loading: () => const SizedBox(height: 72, child: Center(child: CircularProgressIndicator())),
            error: (_, __) => const SizedBox(height: 12),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _AllAssetsTab(statusChip: _statusChip),
                _MyAssetsTab(statusChip: _statusChip),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AllAssetsTab extends ConsumerWidget {
  final Widget Function(String) statusChip;
  const _AllAssetsTab({required this.statusChip});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assetsAsync = ref.watch(allAssetsProvider);

    return assetsAsync.when(
      data: (assets) => assets.isEmpty
          ? Center(child: Text('No company assets found.', style: GoogleFonts.inter(color: Colors.grey[500])))
          : RefreshIndicator(
              onRefresh: () async => ref.invalidate(allAssetsProvider),
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                itemCount: assets.length,
                itemBuilder: (_, i) {
                  final asset = assets[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(asset.assetTag, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[500], fontWeight: FontWeight.w600)),
                              statusChip(asset.status),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(asset.name, style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14)),
                          if (asset.model != null)
                            Text(asset.model!, style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600])),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                asset.assignedUserName.isNotEmpty ? 'Assigned: ${asset.assignedUserName}' : 'Unassigned',
                                style: GoogleFonts.inter(fontSize: 11, color: asset.assignedUserName.isNotEmpty ? Colors.blue[700] : Colors.grey[500]),
                              ),
                              Text('Condition: ${asset.currentCondition}', style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[600])),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e', style: GoogleFonts.inter(color: Colors.red))),
    );
  }
}

class _MyAssetsTab extends ConsumerWidget {
  final Widget Function(String) statusChip;
  const _MyAssetsTab({required this.statusChip});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assetsAsync = ref.watch(myAssetsProvider);

    return assetsAsync.when(
      data: (assets) => assets.isEmpty
          ? Center(child: Text('No assets assigned to you.', style: GoogleFonts.inter(color: Colors.grey[500])))
          : RefreshIndicator(
              onRefresh: () async => ref.invalidate(myAssetsProvider),
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                itemCount: assets.length,
                itemBuilder: (_, i) {
                  final asset = assets[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(asset.assetTag, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey[500], fontWeight: FontWeight.w600)),
                              statusChip(asset.status),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(asset.name, style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14)),
                          const SizedBox(height: 4),
                          Text('Assigned Date: ${asset.assignedDate ?? 'N/A'}', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600])),
                          const SizedBox(height: 8),
                          if (asset.acknowledgedAt == null && asset.assignmentId != null)
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                onPressed: () async {
                                  try {
                                    await ref.read(assetRepositoryProvider).acknowledgeAsset(asset.assignmentId!);
                                    ref.invalidate(myAssetsProvider);
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Custody acknowledged successfully'), backgroundColor: Colors.green),
                                      );
                                    }
                                  } catch (e) {
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                                      );
                                    }
                                  }
                                },
                                icon: const Icon(Icons.check, size: 16),
                                label: const Text('Acknowledge Custody'),
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e', style: GoogleFonts.inter(color: Colors.red))),
    );
  }
}
