import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/constants/app_colors.dart';
import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/documents/models/document_model.dart';
import 'package:humanitas_erp_mobile/features/documents/providers/documents_provider.dart';

class DocumentVaultScreen extends ConsumerStatefulWidget {
  final List<EmployeeDocumentModel>? initialDocuments;
  final ExpiringDocumentsSummaryModel? initialExpiring;

  const DocumentVaultScreen({
    super.key,
    this.initialDocuments,
    this.initialExpiring,
  });

  @override
  ConsumerState<DocumentVaultScreen> createState() => _DocumentVaultScreenState();
}

class _DocumentVaultScreenState extends ConsumerState<DocumentVaultScreen> {
  int _selectedTab = 0; // 0 = Documents, 1 = Compliance & Expirations

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;

    final bool isOwnerOrAdmin = user?.role == 'owner' ||
        user?.role == 'admin' ||
        user?.role == 'administrator';
    final bool hasPermission = isOwnerOrAdmin ||
        (user != null &&
            authState.hasAnyPermission([
              'view_employee_documents',
              'view_my_documents',
              'manage_employee_documents',
            ]));

    if (!hasPermission) {
      return Scaffold(
        appBar: AppBar(
          title: Text(
            'Document Vault',
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lock_outline, size: 54, color: AppColors.textSecondaryLight),
                const SizedBox(height: 16),
                Text(
                  'Access Denied',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                    color: AppColors.textPrimaryLight,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'You do not have permission to view employee documents.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(color: AppColors.textSecondaryLight, fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final docsAsync = ref.watch(documentsListProvider);
    final expiringAsync = ref.watch(expiringSummaryProvider);

    final List<EmployeeDocumentModel> docs = widget.initialDocuments ??
        docsAsync.maybeWhen(
          data: (data) => data,
          orElse: () => [],
        );

    final ExpiringDocumentsSummaryModel? expiring = widget.initialExpiring ??
        expiringAsync.maybeWhen(
          data: (data) => data,
          orElse: () => null,
        );

    final bool isLoading = widget.initialDocuments == null &&
        (docsAsync.isLoading || expiringAsync.isLoading);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Document Vault',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(documentsListProvider);
              ref.invalidate(expiringSummaryProvider);
            },
          ),
        ],
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(documentsListProvider);
                ref.invalidate(expiringSummaryProvider);
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // KPI Row
                    _buildKPICards(docs, expiring),
                    const SizedBox(height: 16),

                    // Tab Switcher
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.cardLight,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.borderLight),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: _buildTabButton(
                              label: 'Documents (${docs.length})',
                              index: 0,
                            ),
                          ),
                          Expanded(
                            child: _buildTabButton(
                              label: 'Expirations (${expiring?.expiring90Days ?? 0})',
                              index: 1,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Active Tab View
                    if (_selectedTab == 0) _buildDocumentsTab(docs),
                    if (_selectedTab == 1) _buildExpirationsTab(expiring),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildKPICards(List<EmployeeDocumentModel> docs, ExpiringDocumentsSummaryModel? expiring) {
    final verified = docs.where((d) => d.verificationStatus == 'verified').length;
    final pending = docs.where((d) => d.verificationStatus == 'pending').length;

    return Row(
      children: [
        Expanded(
          child: _buildMetricTile(
            title: 'Total Files',
            value: docs.length.toString(),
            color: AppColors.primary,
            icon: Icons.folder_outlined,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildMetricTile(
            title: 'Verified',
            value: verified.toString(),
            color: AppColors.success,
            icon: Icons.verified_outlined,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildMetricTile(
            title: 'Expiring 90d',
            value: (expiring?.expiring90Days ?? 0).toString(),
            color: AppColors.warning,
            icon: Icons.warning_amber_rounded,
          ),
        ),
      ],
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 11,
              color: AppColors.textSecondaryLight,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabButton({required String label, required int index}) {
    final isSelected = _selectedTab == index;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = index),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Center(
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : AppColors.textSecondaryLight,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDocumentsTab(List<EmployeeDocumentModel> docs) {
    if (docs.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        alignment: Alignment.center,
        child: Column(
          children: [
            const Icon(Icons.description_outlined, size: 48, color: AppColors.textSecondaryLight),
            const SizedBox(height: 12),
            Text(
              'No Documents Found',
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              'No employee documents have been registered in the vault yet.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: AppColors.textSecondaryLight, fontSize: 12),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: docs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final doc = docs[index];
        final isVerified = doc.verificationStatus == 'verified';

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.cardLight,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.borderLight),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.insert_drive_file_outlined, color: AppColors.primary, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      doc.title,
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: AppColors.textPrimaryLight,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${doc.employeeFullName} • ${doc.category.toUpperCase()}',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.textSecondaryLight,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: isVerified
                                ? AppColors.success.withOpacity(0.1)
                                : AppColors.warning.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            isVerified ? 'VERIFIED' : 'PENDING REVIEW',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: isVerified ? AppColors.success : AppColors.warning,
                            ),
                          ),
                        ),
                        if (doc.expiryStatus == 'expiring_soon' && doc.daysUntilExpiry != null) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.warning.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'Expiring in ${doc.daysUntilExpiry}d',
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: AppColors.warning,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildExpirationsTab(ExpiringDocumentsSummaryModel? expiring) {
    final items = expiring?.upcomingExpiringDocuments ?? [];
    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        alignment: Alignment.center,
        child: Column(
          children: [
            const Icon(Icons.shield_outlined, size: 48, color: AppColors.success),
            const SizedBox(height: 12),
            Text(
              'All Credentials Compliant',
              style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              'No employee credentials, visas, or certifications are expiring within the next 90 days.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: AppColors.textSecondaryLight, fontSize: 12),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final item = items[index];
        final days = item.daysUntilExpiry ?? 0;
        final isUrgent = days <= 30;

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.cardLight,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isUrgent ? AppColors.error.withOpacity(0.3) : AppColors.borderLight,
            ),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isUrgent ? AppColors.error.withOpacity(0.1) : AppColors.warning.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.warning_amber_rounded,
                  color: isUrgent ? AppColors.error : AppColors.warning,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: AppColors.textPrimaryLight,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${item.employeeFullName} (${item.department ?? "General"})',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                days <= 0 ? 'Expired' : '${days}d left',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  color: isUrgent ? AppColors.error : AppColors.warning,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
