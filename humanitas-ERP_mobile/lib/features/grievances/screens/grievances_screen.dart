import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/constants/app_colors.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/grievances/models/grievance_model.dart';
import 'package:humanitas_erp_mobile/features/grievances/providers/grievance_provider.dart';

class GrievancesScreen extends ConsumerStatefulWidget {
  final List<GrievanceModel>? initialGrievances;
  final GrievanceStatsModel? initialStats;

  const GrievancesScreen({
    super.key,
    this.initialGrievances,
    this.initialStats,
  });

  @override
  ConsumerState<GrievancesScreen> createState() => _GrievancesScreenState();
}

class _GrievancesScreenState extends ConsumerState<GrievancesScreen> {
  String _selectedStatus = 'all';

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    final bool isOwnerOrAdmin = user?.role == 'owner' ||
        user?.role == 'admin' ||
        user?.role == 'administrator';
    final bool hasAccess = isOwnerOrAdmin ||
        (user != null &&
            authState.hasAnyPermission([
              'view_grievances',
              'manage_grievances',
              'file_grievance',
            ]));

    if (!hasAccess) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'Grievances & Whistleblower',
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
          ),
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 64, color: AppColors.error),
              const SizedBox(height: 16),
              Text(
                'Access Denied',
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimaryLight,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You do not have permission to view grievances.',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final statsAsync = ref.watch(grievanceStatsProvider);
    final grievancesAsync = ref.watch(grievancesListProvider);

    final stats = widget.initialStats ?? statsAsync.valueOrNull ?? const GrievanceStatsModel();
    final grievancesList = widget.initialGrievances ?? grievancesAsync.valueOrNull ?? [];

    final filteredGrievances = grievancesList.where((g) {
      if (_selectedStatus == 'all') return true;
      return g.status == _selectedStatus;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Grievances & Whistleblower',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(grievancesListProvider);
              ref.invalidate(grievanceStatsProvider);
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text(
          'File Report',
          style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600),
        ),
        onPressed: () => _showFileComplaintSheet(context),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(grievancesListProvider);
          ref.invalidate(grievanceStatsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Safe Whistleblower Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primary.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.shield_outlined, color: AppColors.primary, size: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Strict Zero-Retaliation Protection',
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: AppColors.textPrimaryLight,
                          ),
                        ),
                        Text(
                          'All reports are treated confidentially with encrypted records.',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // KPI Summary Cards
            Row(
              children: [
                Expanded(
                  child: _buildKpiCard('Total Cases', stats.totalCases.toString(), Icons.folder_outlined, Colors.blue),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildKpiCard('Active', stats.openCases.toString(), Icons.pending_actions, Colors.orange),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildKpiCard('Resolved', stats.closedCases.toString(), Icons.check_circle_outline, Colors.green),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildKpiCard('SLA Breached', stats.slaBreachedCases.toString(), Icons.warning_amber_rounded, Colors.red),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Status Filter Chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('All', 'all'),
                  _buildFilterChip('Filed', 'filed'),
                  _buildFilterChip('Acknowledged', 'acknowledged'),
                  _buildFilterChip('Investigating', 'investigating'),
                  _buildFilterChip('Proposed', 'resolution_proposed'),
                  _buildFilterChip('Closed', 'closed'),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Cases List
            if (grievancesAsync.isLoading && widget.initialGrievances == null)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (filteredGrievances.isEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    children: [
                      const Icon(Icons.inbox_outlined, size: 48, color: Colors.grey),
                      const SizedBox(height: 8),
                      Text(
                        'No grievances found',
                        style: GoogleFonts.inter(color: AppColors.textSecondaryLight),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...filteredGrievances.map((g) => _buildGrievanceCard(context, g)),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimaryLight,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.inter(fontSize: 10, color: AppColors.textSecondaryLight),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _selectedStatus == value;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        label: Text(label, style: GoogleFonts.inter(fontSize: 12)),
        selected: isSelected,
        onSelected: (_) {
          setState(() => _selectedStatus = value);
        },
      ),
    );
  }

  Widget _buildGrievanceCard(BuildContext context, GrievanceModel g) {
    Color statusColor;
    switch (g.status) {
      case 'closed':
        statusColor = Colors.green;
        break;
      case 'investigating':
        statusColor = Colors.indigo;
        break;
      case 'resolution_proposed':
        statusColor = Colors.purple;
        break;
      case 'acknowledged':
        statusColor = Colors.blue;
        break;
      default:
        statusColor = Colors.orange;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _showGrievanceDetails(context, g),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    g.ticketNumber,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      g.status.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                g.subject,
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimaryLight,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                g.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: AppColors.textSecondaryLight,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(
                    g.isAnonymous ? Icons.visibility_off_outlined : Icons.person_outline,
                    size: 14,
                    color: Colors.grey,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    g.isAnonymous ? 'Anonymous' : (g.submitterName ?? 'Staff'),
                    style: GoogleFonts.inter(fontSize: 11, color: AppColors.textSecondaryLight),
                  ),
                  const Spacer(),
                  if (g.isSlaBreached)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'SLA Breached',
                        style: GoogleFonts.inter(fontSize: 10, color: Colors.red, fontWeight: FontWeight.bold),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showGrievanceDetails(BuildContext context, GrievanceModel g) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          minChildSize: 0.4,
          maxChildSize: 0.95,
          expand: false,
          builder: (_, scrollController) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: ListView(
                controller: scrollController,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    g.ticketNumber,
                    style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primary),
                  ),
                  Text(
                    g.subject,
                    style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimaryLight),
                  ),
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 8),
                  Text(
                    'Full Incident Description',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    g.description,
                    style: GoogleFonts.inter(fontSize: 14, color: AppColors.textPrimaryLight),
                  ),
                  const SizedBox(height: 16),
                  if (g.resolutionSummary != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.purple.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Resolution Outcome',
                            style: GoogleFonts.inter(fontWeight: FontWeight.bold, color: Colors.purple.shade900),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            g.resolutionSummary!,
                            style: GoogleFonts.inter(fontSize: 13, color: Colors.purple.shade800),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Text(
                    'Case Details',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
                  ),
                  const SizedBox(height: 6),
                  _buildDetailRow('Category', g.category),
                  _buildDetailRow('Priority', g.priority.toUpperCase()),
                  _buildDetailRow('Status', g.status.toUpperCase()),
                  _buildDetailRow('Investigator', g.investigatorName ?? 'Unassigned'),
                  if (g.incidentLocation != null) _buildDetailRow('Location', g.incidentLocation!),
                  if (g.accusedParties != null) _buildDetailRow('Accused Parties', g.accusedParties!),
                  const SizedBox(height: 24),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 13, color: AppColors.textSecondaryLight)),
          Text(value, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimaryLight)),
        ],
      ),
    );
  }

  void _showFileComplaintSheet(BuildContext context) {
    final subjectCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String category = 'workplace_conflict';
    bool isAnonymous = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 20,
                top: 20,
                left: 20,
                right: 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'File Grievance / Report',
                      style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        'Submit Anonymously',
                        style: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                      subtitle: Text(
                        'Mask your identity from non-authorized personnel',
                        style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                      ),
                      value: isAnonymous,
                      onChanged: (val) {
                        setModalState(() => isAnonymous = val);
                      },
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: category,
                      decoration: const InputDecoration(labelText: 'Category'),
                      items: const [
                        DropdownMenuItem(value: 'harassment', child: Text('Harassment')),
                        DropdownMenuItem(value: 'discrimination', child: Text('Discrimination')),
                        DropdownMenuItem(value: 'safety', child: Text('Workplace Safety')),
                        DropdownMenuItem(value: 'policy_violation', child: Text('Policy Violation')),
                        DropdownMenuItem(value: 'workplace_conflict', child: Text('Workplace Conflict')),
                        DropdownMenuItem(value: 'compensation_dispute', child: Text('Compensation Dispute')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (val) {
                        if (val != null) setModalState(() => category = val);
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: subjectCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Subject *',
                        hintText: 'Brief summary of the issue',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: descCtrl,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Detailed Narrative *',
                        hintText: 'Describe dates, facts, and events...',
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                        onPressed: () async {
                          if (subjectCtrl.text.trim().isEmpty || descCtrl.text.trim().isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please fill all required fields')),
                            );
                            return;
                          }
                          try {
                            final repo = ref.read(grievanceRepositoryProvider);
                            await repo.fileGrievance(
                              category: category,
                              subject: subjectCtrl.text.trim(),
                              description: descCtrl.text.trim(),
                              isAnonymous: isAnonymous,
                            );
                            if (context.mounted) {
                              Navigator.pop(ctx);
                              ref.invalidate(grievancesListProvider);
                              ref.invalidate(grievanceStatsProvider);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Report submitted successfully')),
                              );
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(e.toString())),
                              );
                            }
                          }
                        },
                        child: Text(
                          'Submit Report',
                          style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
