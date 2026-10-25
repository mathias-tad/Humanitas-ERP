import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/constants/app_colors.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/import_export/models/import_export_model.dart';
import 'package:humanitas_erp_mobile/features/import_export/providers/import_export_provider.dart';

class ImportExportScreen extends ConsumerStatefulWidget {
  const ImportExportScreen({super.key});

  @override
  ConsumerState<ImportExportScreen> createState() => _ImportExportScreenState();
}

class _ImportExportScreenState extends ConsumerState<ImportExportScreen> with SingleTickerProviderStateMixin {
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
    final role = auth.user?.role?.toLowerCase() ?? '';
    if (role == 'owner' || role == 'admin' || role == 'administrator') return true;
    return auth.hasAnyPermission(['view_import_export', 'manage_import', 'manage_export']);
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'completed':
        return AppColors.success;
      case 'failed':
        return AppColors.error;
      case 'rolled_back':
        return Colors.purple;
      case 'validated':
      case 'validating':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  Widget _statusChip(String status) {
    final color = _statusColor(status);
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

  Widget _buildKPITile(String title, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, size: 16, color: color),
                Text(
                  value,
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(fontSize: 11, color: Colors.grey.shade600),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasPermission()) {
      return Scaffold(
        appBar: AppBar(title: Text('Import / Export', style: GoogleFonts.inter(fontWeight: FontWeight.w600))),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                'You do not have permission to view bulk import/export.',
                style: GoogleFonts.inter(fontSize: 14, color: Colors.grey.shade700),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final statsAsync = ref.watch(importExportStatsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Import / Export Engine', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(importExportStatsProvider);
              ref.invalidate(importExportJobsProvider);
              ref.invalidate(exportTemplatesProvider);
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: Colors.grey.shade600,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Audit Log'),
            Tab(text: 'Export Recipes'),
          ],
        ),
      ),
      body: Column(
        children: [
          // KPI Stats Header
          statsAsync.when(
            data: (stats) => Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  _buildKPITile('Imports', stats.totalImports.toString(), Icons.upload_file, Colors.blue),
                  const SizedBox(width: 8),
                  _buildKPITile('Exports', stats.totalExports.toString(), Icons.download, Colors.teal),
                  const SizedBox(width: 8),
                  _buildKPITile('Rows', stats.totalRowsProcessed.toString(), Icons.table_chart, Colors.purple),
                  const SizedBox(width: 8),
                  _buildKPITile('Success', '${stats.successRatePct}%', Icons.check_circle, Colors.green),
                ],
              ),
            ),
            loading: () => const SizedBox(height: 8),
            error: (_, __) => const SizedBox(height: 8),
          ),

          // Tabs Content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildAuditLogTab(),
                _buildRecipesTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAuditLogTab() {
    final jobsAsync = ref.watch(importExportJobsProvider);

    return jobsAsync.when(
      data: (jobs) {
        if (jobs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.history, size: 48, color: Colors.grey.shade400),
                const SizedBox(height: 8),
                Text('No import/export activity recorded yet', style: GoogleFonts.inter(color: Colors.grey.shade600)),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(importExportJobsProvider);
            await ref.read(importExportJobsProvider.future);
          },
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: jobs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final job = jobs[index];
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.02),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: job.jobType == 'import' ? Colors.blue.shade50 : Colors.teal.shade50,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                job.jobType.toUpperCase(),
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: job.jobType == 'import' ? Colors.blue.shade700 : Colors.teal.shade700,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              job.entityType.toUpperCase().replaceAll('_', ' '),
                              style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                            ),
                          ],
                        ),
                        _statusChip(job.status),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      job.fileName ?? 'Batch Job #${job.id.substring(0, 8)}',
                      style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade700),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text(
                          '${job.processedRows} of ${job.totalRows} rows (${job.format.toUpperCase()})',
                          style: GoogleFonts.inter(fontSize: 11, color: Colors.grey.shade600),
                        ),
                        if (job.errorRows > 0) ...[
                          const SizedBox(width: 6),
                          Text(
                            '• ${job.errorRows} errors',
                            style: GoogleFonts.inter(fontSize: 11, color: AppColors.error, fontWeight: FontWeight.bold),
                          ),
                        ],
                        const Spacer(),
                        if (job.isRollbackActive && job.jobType == 'import')
                          TextButton(
                            onPressed: () async {
                              try {
                                await ref.read(importExportRepositoryProvider).rollbackJob(job.id);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Import batch rolled back successfully.')),
                                );
                                ref.invalidate(importExportJobsProvider);
                              } catch (e) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Error: $e')),
                                );
                              }
                            },
                            child: Text(
                              'Rollback',
                              style: GoogleFonts.inter(fontSize: 12, color: Colors.purple, fontWeight: FontWeight.bold),
                            ),
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
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e', style: GoogleFonts.inter(color: AppColors.error))),
    );
  }

  Widget _buildRecipesTab() {
    final recipesAsync = ref.watch(exportTemplatesProvider);

    return recipesAsync.when(
      data: (recipes) {
        if (recipes.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.schedule, size: 48, color: Colors.grey.shade400),
                const SizedBox(height: 8),
                Text('No scheduled export recipes configured', style: GoogleFonts.inter(color: Colors.grey.shade600)),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(exportTemplatesProvider);
            await ref.read(exportTemplatesProvider.future);
          },
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: recipes.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final recipe = recipes[index];
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.02),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            recipe.name,
                            style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: recipe.isActive ? AppColors.success.withOpacity(0.12) : Colors.grey.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            recipe.isActive ? 'ACTIVE' : 'PAUSED',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: recipe.isActive ? AppColors.success : Colors.grey,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Entity: ${recipe.entityType.toUpperCase().replaceAll('_', ' ')}',
                      style: GoogleFonts.inter(fontSize: 12, color: Colors.grey.shade600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Schedule: ${recipe.scheduleCron ?? 'On-Demand'} • Email: ${recipe.deliveryEmail ?? 'Manual'}',
                      style: GoogleFonts.inter(fontSize: 11, color: Colors.grey.shade500),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e', style: GoogleFonts.inter(color: AppColors.error))),
    );
  }
}
