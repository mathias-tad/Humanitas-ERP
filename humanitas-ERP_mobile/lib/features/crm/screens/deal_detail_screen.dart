import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/crm_models.dart';
import '../providers/crm_providers.dart';
import '../widgets/crm_common.dart';
import 'crm_screen.dart' show CrmPerm;
import 'deal_form_screen.dart';
import 'lead_detail_screen.dart';

/// One deal: stage (move it along), revenue and chance, won / lost / reopen, follow-ups and activities.
class DealDetailScreen extends ConsumerWidget {
  final String dealId;

  const DealDetailScreen({super.key, required this.dealId});

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
    final async = ref.watch(dealDetailProvider(dealId));
    final d = async.asData?.value;
    final canEdit = d != null && d.isActive && auth.hasPermission(CrmPerm.editDeals);
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(d?.code ?? 'Deal'),
          actions: [
            if (d != null && canEdit && d.isOpen)
              IconButton(
                tooltip: 'Edit',
                icon: const Icon(Icons.edit_outlined),
                onPressed: () async {
                  final saved = await Navigator.of(context).push<Deal>(MaterialPageRoute(builder: (_) => DealFormScreen(deal: d)));
                  if (saved != null) invalidateCrm(ref);
                },
              ),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'Details'), Tab(text: 'Follow-ups')]),
        ),
        floatingActionButton: canEdit
            ? FloatingActionButton.extended(
                heroTag: 'deal-follow-up',
                onPressed: () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => FollowUpSheet(target: 'opportunity', id: d.id, title: d.name),
                ),
                icon: const Icon(Icons.add_comment_outlined),
                label: const Text('Log follow-up'),
              )
            : null,
        body: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => CrmErrorView(error: e, onRetry: () => ref.invalidate(dealDetailProvider(dealId))),
          data: (d) => TabBarView(children: [
            _Details(deal: d, canEdit: canEdit, run: (action, done) => _run(context, ref, action, done)),
            FollowUpsView(target: 'opportunity', id: d.id, canEdit: canEdit && auth.hasPermission(CrmPerm.editActivities)),
          ]),
        ),
      ),
    );
  }
}

class _Details extends ConsumerWidget {
  final Deal deal;
  final bool canEdit;
  final Future<void> Function(Future<void> Function() action, String done) run;

  const _Details({required this.deal, required this.canEdit, required this.run});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = deal;
    final repo = ref.read(crmRepositoryProvider);
    final health = dealHealth(d);
    final pipeline = (ref.watch(pipelinesProvider).asData?.value ?? const <Pipeline>[]).where((p) => p.id == d.pipelineId).firstOrNull;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        if (!d.isActive) const Text('This deal is archived: hidden from lists.', style: TextStyle(color: AppColors.warning)),
        Text(d.name, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, children: [
          CrmTag(dealHealthLabel[health] ?? '', color: dealHealthColor(health)),
          if (d.stageName != null) CrmTag(d.stageName!, color: AppColors.primary),
          if (d.isStuck && d.isOpen) CrmTag('${d.daysInStage} days in this stage', color: AppColors.warning),
        ]),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Expanded(child: _Figure('Expected', crmMoney(d.expectedRevenue, d.currency))),
              Expanded(child: _Figure('Chance', '${d.effectiveProbability.toStringAsFixed(0)}%')),
              Expanded(child: _Figure('Weighted', crmMoney(d.weightedRevenue, d.currency))),
            ]),
          ),
        ),
        if (canEdit && d.isOpen && pipeline != null) ...[
          const CrmSectionTitle('Move to stage'),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final s in pipeline.movableStages.where((s) => !s.isWon))
              ChoiceChip(
                label: Text(s.name),
                selected: s.id == d.stageId,
                onSelected: s.id == d.stageId ? null : (_) => run(() => repo.moveStage(d.id, s.id), 'Moved to ${s.name}'),
              ),
          ]),
        ],
        if (canEdit) ...[
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            if (d.isOpen)
              FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: AppColors.success),
                onPressed: () => run(() => repo.markWon(d.id), 'Deal won'),
                icon: const Icon(Icons.emoji_events_outlined),
                label: const Text('Won'),
              ),
            if (d.isOpen)
              OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.error),
                onPressed: () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => LoseSheet(
                    title: 'Lost: ${d.name}',
                    onLose: (reason, note) async {
                      await repo.loseDeal(d.id, reasonId: reason, note: note);
                      invalidateCrm(ref);
                    },
                  ),
                ),
                child: const Text('Lost'),
              ),
            if (!d.isOpen) OutlinedButton.icon(onPressed: () => run(() => repo.reopenDeal(d.id), 'Deal reopened'), icon: const Icon(Icons.undo), label: const Text('Reopen')),
          ]),
        ],
        if (d.status == 'lost') CrmRow('Lost because', [d.lostReasonName, d.lostNote].whereType<String>().join(' — ')),
        const CrmSectionTitle('Details'),
        CrmRow('Customer', d.customer.isEmpty ? '—' : d.customer),
        CrmRow('Pipeline', d.pipelineName ?? '—'),
        CrmRow('Close date', d.expectedCloseDate ?? '—'),
        CrmRow('Owner', d.ownerName ?? '—'),
        if (d.sourceName != null) CrmRow('Source', d.sourceName!),
        CrmRow('Last contact', lastContactText(d.lastContactAt, d.lastContactChannel)),
        if (d.nextActivityAt != null) CrmRow('Next step', crmWhen.format(d.nextActivityAt!)),
        if (d.leadId != null)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.flag_outlined),
            title: Text('From lead ${d.leadCode ?? ''}'),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LeadDetailScreen(leadId: d.leadId!))),
          ),
        if (d.notes != null) ...[const CrmSectionTitle('Notes'), Text(d.notes!)],
      ],
    );
  }
}

class _Figure extends StatelessWidget {
  final String label;
  final String value;

  const _Figure(this.label, this.value);

  @override
  Widget build(BuildContext context) => Column(children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
        const SizedBox(height: 4),
        Text(value, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700)),
      ]);
}
