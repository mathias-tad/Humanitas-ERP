import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../models/company_scope.dart';
import '../providers/company_scope_provider.dart';

/// Company and branch switcher (AGENTS.md rule 16). It offers only the companies and branches
/// this user may use; the choice is sent with every API call and the server checks it.
/// Nothing picked: the user's default company and branch (every company for users who see all).
class CompanyBranchSwitcher extends ConsumerWidget {
  const CompanyBranchSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scope = ref.watch(companyScopeProvider).asData?.value;
    if (scope == null || scope.companies.isEmpty) return const SizedBox.shrink();
    final selection = scope.sanitize(ref.watch(scopeSelectionProvider));
    final label = scope.label(selection);
    if (!scope.canSwitch) {
      return _ScopeChip(icon: Icons.lock_outline, label: label, tooltip: 'You work in $label');
    }
    return _ScopeChip(
      icon: Icons.business_outlined,
      label: label,
      tooltip: 'Change company or branch',
      onTap: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        builder: (_) => ScopePickerSheet(
          scope: scope,
          initial: selection,
          onApply: (s) => applyScopeSelection(ref, s),
        ),
      ),
    );
  }
}

class _ScopeChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String tooltip;
  final VoidCallback? onTap;

  const _ScopeChip({required this.icon, required this.label, required this.tooltip, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: AppColors.primary),
              const SizedBox(width: 4),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 200),
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w500),
                ),
              ),
              if (onTap != null) const Icon(Icons.arrow_drop_down, size: 16, color: AppColors.primary),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet: tick companies (and branches), then Apply.
class ScopePickerSheet extends StatefulWidget {
  final CompanyScope scope;
  final ScopeSelection initial;
  final ValueChanged<ScopeSelection> onApply;

  const ScopePickerSheet({super.key, required this.scope, required this.initial, required this.onApply});

  @override
  State<ScopePickerSheet> createState() => _ScopePickerSheetState();
}

class _ScopePickerSheetState extends State<ScopePickerSheet> {
  late List<String> _companies = [...widget.initial.companyIds];
  late List<String> _branches = [...widget.initial.branchIds];

  CompanyScope get scope => widget.scope;

  void _toggleCompany(String id) {
    setState(() {
      _companies.contains(id) ? _companies.remove(id) : _companies.add(id);
      final allowed = scope.branchesFor(_companies).map((b) => b.id).toSet();
      _branches = _branches.where(allowed.contains).toList();
    });
  }

  void _toggleBranch(String id) => setState(() => _branches.contains(id) ? _branches.remove(id) : _branches.add(id));

  @override
  Widget build(BuildContext context) {
    final branches = scope.branchesFor(_companies);
    final noCompanyText = scope.allCompanies
        ? 'Nothing ticked: all companies.'
        : 'Nothing ticked: your default company, ${scope.defaultCompany?.name ?? ''}.';
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Company and branch', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(noCompanyText, style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    if (scope.companies.length > 1)
                      for (final c in scope.companies)
                        CheckboxListTile(
                          dense: true,
                          value: _companies.contains(c.id),
                          title: Text(c.name),
                          subtitle: c.isDefault ? const Text('Your default') : null,
                          onChanged: (_) => _toggleCompany(c.id),
                        ),
                    if (branches.length > 1) ...[
                      const Divider(),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 4),
                        child: Text('Branches (nothing ticked: all you may use)',
                            style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
                      ),
                      for (final b in branches)
                        CheckboxListTile(
                          dense: true,
                          value: _branches.contains(b.id),
                          title: Text(b.name),
                          subtitle: b.isDefault ? const Text('Default branch') : null,
                          onChanged: (_) => _toggleBranch(b.id),
                        ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  TextButton(
                    onPressed: () => setState(() {
                      _companies = [];
                      _branches = [];
                    }),
                    child: const Text('Clear'),
                  ),
                  const Spacer(),
                  TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: () {
                      widget.onApply(scope.sanitize(ScopeSelection(companyIds: _companies, branchIds: _branches)));
                      Navigator.pop(context);
                    },
                    child: const Text('Apply'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
