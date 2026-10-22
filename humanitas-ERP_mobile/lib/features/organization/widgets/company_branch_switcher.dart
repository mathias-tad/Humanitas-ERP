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

    final activeCompanyId = ref.watch(activeCompanyIdProvider);
    final activeBranchId = ref.watch(activeBranchIdProvider);
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

    final activeCompany = companies.where((c) => c.id == activeCompanyId).firstOrNull;
    final activeBranch = branches.where((b) => b.id == activeBranchId).firstOrNull;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (canViewAllCompanies)
          _SwitcherButton(
            icon: Icons.business_outlined,
            label: activeCompany?.name ?? 'All Companies',
            onTap: () => _showCompanySheet(context, ref, companies),
          ),
        if (canViewAllCompanies && canViewAllBranches) const SizedBox(width: 4),
        if (canViewAllBranches)
          _SwitcherButton(
            icon: Icons.account_tree_outlined,
            label: activeBranch?.name ?? 'All Branches',
            onTap: () => _showBranchSheet(context, ref, branches),
          ),
      ],
    );
  }

  void _showCompanySheet(BuildContext context, WidgetRef ref, List<CompanyModel> companies) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Switch Company Scope',
                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 12),
              ListTile(
                dense: true,
                leading: const Icon(Icons.business_outlined),
                title: Text('All Companies (Consolidated)', style: GoogleFonts.inter(fontSize: 13)),
                trailing: ref.watch(activeCompanyIdProvider) == null
                    ? const Icon(Icons.check, color: Colors.green, size: 18)
                    : null,
                onTap: () {
                  ref.read(activeCompanyIdProvider.notifier).state = null;
                  ref.read(activeBranchIdProvider.notifier).state = null;
                  Navigator.pop(ctx);
                },
              ),
              ...companies.map((c) => ListTile(
                    dense: true,
                    leading: const Icon(Icons.business),
                    title: Text(c.name, style: GoogleFonts.inter(fontSize: 13)),
                    subtitle: c.isDefault
                        ? Text('Default', style: GoogleFonts.inter(fontSize: 10, color: AppColors.primary))
                        : null,
                    trailing: ref.watch(activeCompanyIdProvider) == c.id
                        ? const Icon(Icons.check, color: Colors.green, size: 18)
                        : null,
                    onTap: () {
                      ref.read(activeCompanyIdProvider.notifier).state = c.id;
                      ref.read(activeBranchIdProvider.notifier).state = null;
                      Navigator.pop(ctx);
                    },
                  )),
            ],
          ),
        ),
      ),
    );
  }

  void _showBranchSheet(BuildContext context, WidgetRef ref, List<BranchModel> branches) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Switch Branch Scope',
                style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 12),
              ListTile(
                dense: true,
                leading: const Icon(Icons.account_tree_outlined),
                title: Text('All Branches', style: GoogleFonts.inter(fontSize: 13)),
                trailing: ref.watch(activeBranchIdProvider) == null
                    ? const Icon(Icons.check, color: Colors.green, size: 18)
                    : null,
                onTap: () {
                  ref.read(activeBranchIdProvider.notifier).state = null;
                  Navigator.pop(ctx);
                },
              ),
              ...branches.map((b) => ListTile(
                    dense: true,
                    leading: const Icon(Icons.account_tree),
                    title: Text(b.name, style: GoogleFonts.inter(fontSize: 13)),
                    subtitle: b.isDefault
                        ? Text('Default', style: GoogleFonts.inter(fontSize: 10, color: AppColors.primary))
                        : null,
                    trailing: ref.watch(activeBranchIdProvider) == b.id
                        ? const Icon(Icons.check, color: Colors.green, size: 18)
                        : null,
                    onTap: () {
                      ref.read(activeBranchIdProvider.notifier).state = b.id;
                      Navigator.pop(ctx);
                    },
                  )),
            ],
          ),
        ),
      ),
    );
  }
}

class _SwitcherButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _SwitcherButton({required this.icon, required this.label, required this.onTap});

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
              constraints: const BoxConstraints(maxWidth: 80),
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
            const SizedBox(width: 2),
            Icon(Icons.keyboard_arrow_down, size: 12, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}
