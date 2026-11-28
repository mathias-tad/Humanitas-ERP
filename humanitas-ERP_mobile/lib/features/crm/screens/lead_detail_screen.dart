import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../../contacts/models/contact_models.dart';
import '../models/crm_models.dart';
import '../providers/crm_providers.dart';
import '../widgets/contact_picker.dart';
import '../widgets/crm_common.dart';
import 'crm_screen.dart' show CrmPerm;
import 'deal_detail_screen.dart';
import 'lead_form_screen.dart';

/// One lead: details and qualification, status, follow-ups and planned activities;
/// mark it lost or convert it into a customer and a deal.
class LeadDetailScreen extends ConsumerWidget {
  final String leadId;

  const LeadDetailScreen({super.key, required this.leadId});

  Future<void> _run(BuildContext context, WidgetRef ref, Future<void> Function() action, String done) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      invalidateCrm(ref);
      messenger.showSnackBar(SnackBar(content: Text(done)));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final async = ref.watch(leadDetailProvider(leadId));
    final l = async.asData?.value;
    final repo = ref.read(crmRepositoryProvider);
    final canEdit = l != null && l.isActive && l.status != 'converted' && auth.hasPermission(CrmPerm.editLeads);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(l?.code ?? 'Lead'),
          actions: [
            if (l != null && canEdit)
              IconButton(
                tooltip: 'Edit',
                icon: const Icon(Icons.edit_outlined),
                onPressed: () async {
                  final saved = await Navigator.of(context).push<Lead>(MaterialPageRoute(builder: (_) => LeadFormScreen(lead: l)));
                  if (saved != null) invalidateCrm(ref);
                },
              ),
            if (l != null && (l.isActive ? auth.hasPermission(CrmPerm.deleteLeads) : auth.hasPermission(CrmPerm.restoreLeads)))
              IconButton(
                tooltip: l.isActive ? 'Archive' : 'Restore',
                icon: Icon(l.isActive ? Icons.archive_outlined : Icons.unarchive_outlined),
                onPressed: () => _run(
                  context,
                  ref,
                  () => l.isActive ? repo.archiveLead(l.id) : repo.restoreLead(l.id),
                  l.isActive ? 'Lead archived' : 'Lead restored',
                ),
              ),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'Details'), Tab(text: 'Follow-ups')]),
        ),
        floatingActionButton: canEdit
            ? FloatingActionButton.extended(
                heroTag: 'lead-follow-up',
                onPressed: () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => FollowUpSheet(target: 'lead', id: l.id, title: l.title),
                ),
                icon: const Icon(Icons.add_comment_outlined),
                label: const Text('Log follow-up'),
              )
            : null,
        body: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => CrmErrorView(error: e, onRetry: () => ref.invalidate(leadDetailProvider(leadId))),
          data: (l) => TabBarView(children: [
            _Details(lead: l, canEdit: canEdit, run: (action, done) => _run(context, ref, action, done)),
            FollowUpsView(target: 'lead', id: l.id, canEdit: canEdit && auth.hasPermission(CrmPerm.editActivities)),
          ]),
        ),
      ),
    );
  }
}

class _Details extends ConsumerWidget {
  final Lead lead;
  final bool canEdit;
  final Future<void> Function(Future<void> Function() action, String done) run;

  const _Details({required this.lead, required this.canEdit, required this.run});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = lead;
    final repo = ref.read(crmRepositoryProvider);
    final phones = [l.phone, l.mobile].whereType<String>().toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        if (!l.isActive) const Text('This lead is archived: hidden from lists.', style: TextStyle(color: AppColors.warning)),
        Text(l.title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
          CrmTag(l.statusLabel, color: leadStatusColor(l.status)),
          if (l.sourceName != null) CrmTag(l.sourceName!, color: AppColors.textSecondaryLight),
          for (final t in l.tags) CrmTag(t, color: AppColors.primary),
        ]),
        if (canEdit && l.isOpen) ...[
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final s in leadStatusMoves(l.status))
              OutlinedButton(
                onPressed: () => run(() => repo.updateLead(l.id, {'status': s}), 'Lead is now ${leadStatusLabel[s]}'),
                child: Text('Mark ${leadStatusLabel[s]}'),
              ),
            FilledButton.icon(
              onPressed: () => showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => _ConvertSheet(lead: l)),
              icon: const Icon(Icons.handshake_outlined),
              label: const Text('Convert'),
            ),
            OutlinedButton(
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.error),
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => LoseSheet(
                  title: 'Lost: ${l.title}',
                  onLose: (reason, note) async {
                    await repo.loseLead(l.id, reasonId: reason, note: note);
                    invalidateCrm(ref);
                  },
                ),
              ),
              child: const Text('Mark as lost'),
            ),
          ]),
        ],
        if (canEdit && l.status == 'lost') ...[
          const SizedBox(height: 12),
          Wrap(spacing: 8, children: [
            for (final s in leadStatusMoves(l.status))
              OutlinedButton(onPressed: () => run(() => repo.updateLead(l.id, {'status': s}), 'Lead reopened as ${leadStatusLabel[s]}'), child: Text('Reopen as ${leadStatusLabel[s]}')),
          ]),
        ],
        if (l.status == 'lost') CrmRow('Lost because', [l.lostReasonName, l.lostNote].whereType<String>().join(' — ')),
        if (l.status == 'converted') ...[
          CrmRow('Customer', l.convertedContactName ?? '—'),
          if (l.convertedOpportunityId != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.trending_up),
              title: Text(l.convertedOpportunityName ?? 'The deal'),
              subtitle: const Text('Open the deal made from this lead'),
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DealDetailScreen(dealId: l.convertedOpportunityId!))),
            ),
        ],
        const CrmSectionTitle('Who'),
        CrmRow('Person', l.personName ?? '—'),
        CrmRow('Company', l.companyName ?? '—'),
        if (l.jobTitle != null) CrmRow('Job title', l.jobTitle!),
        CrmRow('Phone', phones.isEmpty ? '—' : phones.join(' · '), selectable: true),
        CrmRow('Email', l.email ?? '—', selectable: true),
        if (l.city != null) CrmRow('City', l.city!),
        CrmRow('Owner', l.ownerName ?? 'Nobody yet'),
        CrmRow('Last contact', lastContactText(l.lastContactAt, l.lastContactChannel)),
        if (l.nextActivityAt != null) CrmRow('Next step', crmWhen.format(l.nextActivityAt!)),
        if (phones.isNotEmpty)
          Wrap(spacing: 8, children: [
            for (final p in phones)
              ActionChip(
                avatar: const Icon(Icons.copy, size: 16),
                label: Text(p),
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: p));
                  if (context.mounted) crmSnack(context, 'Number copied');
                },
              ),
          ]),
        const CrmSectionTitle('Qualification'),
        CrmRow('Need', l.need ?? '—'),
        CrmRow('Budget', l.budget == null ? '—' : crmMoney(l.budget!)),
        CrmRow('Timeline', l.timeline ?? '—'),
        CrmRow('Decision maker', l.decisionMaker ?? '—'),
        CrmRow('Expected revenue', l.expectedRevenue == null ? '—' : crmMoney(l.expectedRevenue!)),
        if (l.notes != null) ...[const CrmSectionTitle('Notes'), Text(l.notes!)],
      ],
    );
  }
}

/// Convert a lead: a new customer from the lead (or an existing contact) and, by default, a deal.
class _ConvertSheet extends ConsumerStatefulWidget {
  final Lead lead;

  const _ConvertSheet({required this.lead});

  @override
  ConsumerState<_ConvertSheet> createState() => _ConvertSheetState();
}

class _ConvertSheetState extends ConsumerState<_ConvertSheet> {
  Contact? _existing;
  bool _makeDeal = true;
  late final _dealName = TextEditingController(text: widget.lead.title);
  late final _revenue = TextEditingController(
    text: widget.lead.expectedRevenue == null ? '' : widget.lead.expectedRevenue!.toStringAsFixed(widget.lead.expectedRevenue! % 1 == 0 ? 0 : 2),
  );
  DateTime? _close;
  bool _saving = false;

  @override
  void dispose() {
    _dealName.dispose();
    _revenue.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final revenue = _revenue.text.trim().isEmpty ? null : double.tryParse(_revenue.text.trim().replaceAll(',', ''));
    if (_makeDeal && _revenue.text.trim().isNotEmpty && (revenue == null || revenue < 0)) {
      crmSnack(context, 'Expected revenue is a number of 0 or more');
      return;
    }
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    try {
      final saved = await ref.read(crmRepositoryProvider).convertLead(
            widget.lead.id,
            contactId: _existing?.id,
            createDeal: _makeDeal,
            dealName: _dealName.text,
            expectedRevenue: revenue,
            expectedCloseDate: _close == null ? null : ymd(_close!),
          );
      invalidateCrm(ref);
      navigator.pop();
      messenger.showSnackBar(SnackBar(content: Text(_makeDeal ? 'Converted: customer and deal created' : 'Converted into a customer')));
      final dealId = saved.convertedOpportunityId;
      if (dealId != null) await navigator.push(MaterialPageRoute<void>(builder: (_) => DealDetailScreen(dealId: dealId)));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      crmSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.lead;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Convert ${l.code}', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              _existing == null
                  ? 'A new customer is made from the lead: ${l.companyName ?? l.personName ?? l.title}${l.companyName != null && l.personName != null ? ', with ${l.personName}' : ''}.'
                  : 'The customer is ${_existing!.label}.',
            ),
            TextButton.icon(
              onPressed: () async {
                final picked = await pickContact(context);
                if (picked != null) setState(() => _existing = picked);
              },
              icon: const Icon(Icons.person_search_outlined),
              label: Text(_existing == null ? 'Use an existing contact instead' : 'Choose another contact'),
            ),
            if (_existing != null) TextButton(onPressed: () => setState(() => _existing = null), child: const Text('Make a new customer instead')),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Create a deal'),
              value: _makeDeal,
              onChanged: (v) => setState(() => _makeDeal = v),
            ),
            if (_makeDeal) ...[
              TextField(controller: _dealName, decoration: const InputDecoration(labelText: 'Deal name', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(
                controller: _revenue,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Expected revenue (ETB)', border: OutlineInputBorder()),
              ),
              TextButton.icon(
                onPressed: () async {
                  final now = DateTime.now();
                  final d = await showDatePicker(context: context, initialDate: _close ?? now.add(const Duration(days: 30)), firstDate: now.subtract(const Duration(days: 30)), lastDate: now.add(const Duration(days: 3 * 365)));
                  if (d != null) setState(() => _close = d);
                },
                icon: const Icon(Icons.event_outlined),
                label: Text(_close == null ? 'Expected close date (optional)' : 'Closes ${ymd(_close!)}'),
              ),
            ],
            const SizedBox(height: 8),
            FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Converting…' : 'Convert')),
          ],
        ),
      ),
    );
  }
}
