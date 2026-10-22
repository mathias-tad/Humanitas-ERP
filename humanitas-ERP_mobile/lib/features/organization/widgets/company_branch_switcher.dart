import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/company_model.dart';
import '../models/branch_model.dart';
import '../providers/organization_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/constants/app_colors.dart';

class CompanyBranchSwitcher extends ConsumerWidget {
  const CompanyBranchSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final canViewAllCompanies = authState.hasAnyPermission(['view_all_companies', 'manage_companies']);
    final canViewAllBranches = authState.hasAnyPermission(['view_all_branches', 'manage_branches']);
    final isLocked = !canViewAllCompanies && !canViewAllBranches;

    if (isLocked) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline, size: 12, color: AppColors.primary),
            const SizedBox(width: 4),
            Text(
              'My Scope',
              style: GoogleFonts.inter(
                fontSize: 11,
                color: AppColors.primary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      );
    }

    final activeCompanyIds = ref.watch(activeCompanyIdsProvider);
    final activeBranchIds = ref.watch(activeBranchIdsProvider);
    final activeCompanyId = ref.watch(activeCompanyIdProvider);
    final companiesAsync = ref.watch(companiesProvider);
    final branchesAsync = ref.watch(branchesProvider(activeCompanyId));

    final companies = companiesAsync.maybeWhen(
      data: (data) => data,
      orElse: () => <CompanyModel>[],
    );
    final branches = branchesAsync.maybeWhen(
      data: (data) => data,
      orElse: () => <BranchModel>[],
    );

    String companyLabel;
    if (activeCompanyIds.isEmpty) {
      companyLabel = 'All Companies';
    } else if (activeCompanyIds.length == 1) {
      companyLabel = companies.where((c) => c.id == activeCompanyIds.first).firstOrNull?.name ?? '1 Company';
    } else if (activeCompanyIds.length == 2) {
      final c1 = companies.where((c) => c.id == activeCompanyIds[0]).firstOrNull?.name;
      final c2 = companies.where((c) => c.id == activeCompanyIds[1]).firstOrNull?.name;
      companyLabel = (c1 != null && c2 != null) ? '$c1 ∪ $c2' : '2 Companies (Union ∪)';
    } else {
      companyLabel = '${activeCompanyIds.length} Companies (Union ∪)';
    }

    String branchLabel;
    if (activeBranchIds.isEmpty) {
      branchLabel = 'All Branches';
    } else if (activeBranchIds.length == 1) {
      branchLabel = branches.where((b) => b.id == activeBranchIds.first).firstOrNull?.name ?? '1 Branch';
    } else if (activeBranchIds.length == 2) {
      final b1 = branches.where((b) => b.id == activeBranchIds[0]).firstOrNull?.name;
      final b2 = branches.where((b) => b.id == activeBranchIds[1]).firstOrNull?.name;
      branchLabel = (b1 != null && b2 != null) ? '$b1 ∪ $b2' : '2 Branches (Union ∪)';
    } else {
      branchLabel = '${activeBranchIds.length} Branches (Union ∪)';
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (canViewAllCompanies)
          _SwitcherButton(
            icon: Icons.business_outlined,
            label: companyLabel,
            badgeCount: activeCompanyIds.length > 1 ? activeCompanyIds.length : null,
            onTap: () => _showCompanySheet(context, ref, companies),
          ),
        if (canViewAllCompanies && canViewAllBranches) const SizedBox(width: 4),
        if (canViewAllBranches)
          _SwitcherButton(
            icon: Icons.account_tree_outlined,
            label: branchLabel,
            badgeCount: activeBranchIds.length > 1 ? activeBranchIds.length : null,
            onTap: () => _showBranchSheet(context, ref, branches),
          ),
      ],
    );
  }

  void _showCompanySheet(BuildContext context, WidgetRef ref, List<CompanyModel> companies) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Consumer(
        builder: (context, ref, _) {
          final activeIds = ref.watch(activeCompanyIdsProvider);
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Select Companies',
                        style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      if (activeIds.isNotEmpty)
                        TextButton(
                          onPressed: () {
                            ref.read(activeCompanyIdsProvider.notifier).state = [];
                            ref.read(activeBranchIdsProvider.notifier).state = [];
                          },
                          child: Text('Reset', style: GoogleFonts.inter(fontSize: 12, color: AppColors.primary)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.business_outlined),
                    title: Text('All Companies', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                    trailing: activeIds.isEmpty
                        ? const Icon(Icons.check_circle, color: Colors.green, size: 20)
                        : const Icon(Icons.radio_button_unchecked, color: Colors.grey, size: 20),
                    onTap: () {
                      ref.read(activeCompanyIdsProvider.notifier).state = [];
                      ref.read(activeBranchIdsProvider.notifier).state = [];
                    },
                  ),
                  const Divider(),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 300),
                    child: ListView(
                      shrinkWrap: true,
                      children: companies.map((c) {
                        final isSelected = activeIds.contains(c.id);
                        return CheckboxListTile(
                          dense: true,
                          value: isSelected,
                          activeColor: AppColors.primary,
                          title: Text(c.name, style: GoogleFonts.inter(fontSize: 13)),
                          subtitle: c.isDefault
                              ? Text('Default', style: GoogleFonts.inter(fontSize: 10, color: AppColors.primary))
                              : null,
                          onChanged: (_) {
                            final next = List<String>.from(activeIds);
                            if (isSelected) {
                              next.remove(c.id);
                            } else {
                              next.add(c.id);
                            }
                            ref.read(activeCompanyIdsProvider.notifier).state = next;
                            ref.read(activeBranchIdsProvider.notifier).state = [];
                          },
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => Navigator.pop(ctx),
                      child: Text('Done', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showBranchSheet(BuildContext context, WidgetRef ref, List<BranchModel> branches) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Consumer(
        builder: (context, ref, _) {
          final activeIds = ref.watch(activeBranchIdsProvider);
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Select Branches',
                        style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      if (activeIds.isNotEmpty)
                        TextButton(
                          onPressed: () {
                            ref.read(activeBranchIdsProvider.notifier).state = [];
                          },
                          child: Text('Reset', style: GoogleFonts.inter(fontSize: 12, color: AppColors.primary)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.account_tree_outlined),
                    title: Text('All Branches', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                    trailing: activeIds.isEmpty
                        ? const Icon(Icons.check_circle, color: Colors.green, size: 20)
                        : const Icon(Icons.radio_button_unchecked, color: Colors.grey, size: 20),
                    onTap: () {
                      ref.read(activeBranchIdsProvider.notifier).state = [];
                    },
                  ),
                  const Divider(),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 300),
                    child: ListView(
                      shrinkWrap: true,
                      children: branches.map((b) {
                        final isSelected = activeIds.contains(b.id);
                        return CheckboxListTile(
                          dense: true,
                          value: isSelected,
                          activeColor: AppColors.primary,
                          title: Text(b.name, style: GoogleFonts.inter(fontSize: 13)),
                          subtitle: b.isDefault
                              ? Text('Default', style: GoogleFonts.inter(fontSize: 10, color: AppColors.primary))
                              : null,
                          onChanged: (_) {
                            final next = List<String>.from(activeIds);
                            if (isSelected) {
                              next.remove(b.id);
                            } else {
                              next.add(b.id);
                            }
                            ref.read(activeBranchIdsProvider.notifier).state = next;
                          },
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => Navigator.pop(ctx),
                      child: Text('Done', style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SwitcherButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final int? badgeCount;
  final VoidCallback onTap;
  const _SwitcherButton({required this.icon, required this.label, this.badgeCount, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: AppColors.primary),
            const SizedBox(width: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 90),
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: AppColors.primary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (badgeCount != null) ...[
              const SizedBox(width: 3),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '∪ $badgeCount',
                  style: GoogleFonts.inter(fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
            ],
            const SizedBox(width: 2),
            Icon(Icons.keyboard_arrow_down, size: 12, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}
