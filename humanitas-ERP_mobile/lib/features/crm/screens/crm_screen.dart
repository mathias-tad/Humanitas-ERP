import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/crm_models.dart';
import '../providers/crm_providers.dart';
import '../widgets/crm_common.dart';
import 'deal_detail_screen.dart';
import 'deal_form_screen.dart';
import 'lead_detail_screen.dart';
import 'lead_form_screen.dart';

/// CRM permissions (the server's crm.permissions.ts).
abstract final class CrmPerm {
  static const viewLeads = 'view_crm_leads';
  static const createLeads = 'create_crm_leads';
  static const editLeads = 'edit_crm_leads';
  static const deleteLeads = 'delete_crm_leads';
  static const restoreLeads = 'restore_crm_leads';
  static const viewDeals = 'view_crm_opportunities';
  static const createDeals = 'create_crm_opportunities';
  static const editDeals = 'edit_crm_opportunities';
  static const viewActivities = 'view_crm_activities';
  static const createActivities = 'create_crm_activities';
  static const editActivities = 'edit_crm_activities';
  static const viewSetup = 'view_crm_setup';
}

/// CRM on mobile (Home -> Quick Actions -> CRM): my day (activities), leads and deals.
class CrmScreen extends ConsumerWidget {
  const CrmScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final canActivities = auth.hasPermission(CrmPerm.viewActivities);
    final canLeads = auth.hasPermission(CrmPerm.viewLeads);
    final canDeals = auth.hasPermission(CrmPerm.viewDeals);
    if (!auth.isModuleSubscribed('crm') || !(canActivities || canLeads || canDeals)) {
      return Scaffold(appBar: AppBar(title: const Text('CRM')), body: const Center(child: Text('Access denied')));
    }
    final tabs = <(Tab, Widget)>[
      if (canActivities) (const Tab(text: 'My day'), const _MyDay()),
      if (canLeads) (const Tab(text: 'Leads'), const _Leads()),
      if (canDeals) (const Tab(text: 'Deals'), const _Deals()),
    ];
    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(title: const Text('CRM'), bottom: TabBar(tabs: [for (final t in tabs) t.$1])),
        body: TabBarView(children: [for (final t in tabs) t.$2]),
      ),
    );
  }
}

// ── My day ──────────────────────────────────────────────────────────────────

class _MyDay extends ConsumerStatefulWidget {
  const _MyDay();

  @override
  ConsumerState<_MyDay> createState() => _MyDayState();
}

class _MyDayState extends ConsumerState<_MyDay> {
  String _when = 'open';

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final query = ActivityQuery(when: _when);
    final summary = ref.watch(activitySummaryProvider).asData?.value;
    final list = ref.watch(activityPagesProvider(query));
    final canEdit = auth.hasPermission(CrmPerm.editActivities);
    String label(String text, int? n) => n == null ? text : '$text ($n)';
    return Scaffold(
      floatingActionButton: auth.hasPermission(CrmPerm.createActivities)
          ? FloatingActionButton.extended(
              heroTag: 'crm-activity',
              onPressed: () => showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => const ActivitySheet()),
              icon: const Icon(Icons.add_task),
              label: const Text('Plan'),
            )
          : null,
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
            child: Row(children: [
              for (final w in [
                ('open', 'All open', null),
                ('overdue', 'Overdue', summary?.overdue),
                ('today', 'Today', summary?.today),
                ('upcoming', 'Upcoming', summary?.upcoming),
                ('done', 'Done', null),
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ChoiceChip(
                    label: Text(label(w.$2, w.$3)),
                    selected: _when == w.$1,
                    selectedColor: w.$1 == 'overdue' && (summary?.overdue ?? 0) > 0 ? AppColors.error.withValues(alpha: 0.2) : null,
                    onSelected: (_) => setState(() => _when = w.$1),
                  ),
                ),
            ]),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(activitySummaryProvider);
                await ref.read(activityPagesProvider(query).notifier).refresh();
              },
              child: list.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [CrmErrorView(error: e, onRetry: () => ref.invalidate(activityPagesProvider(query)))]),
                data: (page) {
                  if (page.items.isEmpty) {
                    return ListView(children: [
                      const SizedBox(height: 80),
                      Center(child: Text(_when == 'done' ? 'Nothing done yet.' : 'Nothing planned here. Enjoy the quiet.')),
                    ]);
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.only(bottom: 96),
                    itemCount: page.items.length + 1,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) => i == page.items.length
                        ? CrmListFooter(
                            hasMore: page.hasMore,
                            shown: page.items.length,
                            total: page.total,
                            noun: 'activity',
                            onLoadMore: () => ref.read(activityPagesProvider(query).notifier).loadMore(),
                          )
                        : _openRelated(context, page.items[i], canEdit),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// An activity, with a link to the lead or deal it is about.
  Widget _openRelated(BuildContext context, CrmActivity a, bool canEdit) {
    final opens = a.relatedId != null && (a.relatedType == 'lead' || a.relatedType == 'opportunity');
    return Row(children: [
      Expanded(child: ActivityTile(activity: a, canEdit: canEdit)),
      if (opens)
        IconButton(
          tooltip: a.relatedType == 'lead' ? 'Open the lead' : 'Open the deal',
          icon: const Icon(Icons.open_in_new, size: 20),
          onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
            builder: (_) => a.relatedType == 'lead' ? LeadDetailScreen(leadId: a.relatedId!) : DealDetailScreen(dealId: a.relatedId!),
          )),
        ),
    ]);
  }
}

// ── Leads ───────────────────────────────────────────────────────────────────

class _Leads extends ConsumerStatefulWidget {
  const _Leads();

  @override
  ConsumerState<_Leads> createState() => _LeadsState();
}

class _LeadsState extends ConsumerState<_Leads> {
  LeadQuery _query = const LeadQuery();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearch(String text) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = _query.copyWith(q: text));
    });
  }

  Future<void> _create() async {
    final created = await Navigator.of(context).push<Lead>(MaterialPageRoute(builder: (_) => const LeadFormScreen()));
    if (created == null || !mounted) return;
    invalidateCrm(ref);
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LeadDetailScreen(leadId: created.id)));
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final list = ref.watch(leadPagesProvider(_query));
    final counts = list.asData?.value.counts ?? const <String, int>{};
    final open = (counts['new'] ?? 0) + (counts['contacted'] ?? 0) + (counts['qualified'] ?? 0);
    return Scaffold(
      floatingActionButton: auth.hasPermission(CrmPerm.createLeads)
          ? FloatingActionButton.extended(heroTag: 'crm-lead', onPressed: _create, icon: const Icon(Icons.add), label: const Text('New lead'))
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Title, code, person, company, phone or email', border: OutlineInputBorder(), isDense: true),
              onChanged: _onSearch,
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: FilterChip(
                  label: const Text('Mine'),
                  selected: _query.mine,
                  onSelected: (v) => setState(() => _query = _query.copyWith(mine: v)),
                ),
              ),
              for (final s in [
                ('open', 'Open', counts.isEmpty ? null : open),
                ('new', 'New', counts['new']),
                ('contacted', 'Contacted', counts['contacted']),
                ('qualified', 'Qualified', counts['qualified']),
                ('converted', 'Converted', counts['converted']),
                ('lost', 'Lost', counts['lost']),
                (null, 'All', null),
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ChoiceChip(
                    label: Text(s.$3 == null ? s.$2 : '${s.$2} (${s.$3})'),
                    selected: _query.status == s.$1,
                    onSelected: (_) => setState(() => _query = s.$1 == null ? _query.copyWith(clearStatus: true) : _query.copyWith(status: s.$1)),
                  ),
                ),
            ]),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(leadPagesProvider(_query).notifier).refresh(),
              child: list.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [CrmErrorView(error: e, onRetry: () => ref.invalidate(leadPagesProvider(_query)))]),
                data: (page) {
                  if (page.items.isEmpty) return ListView(children: const [SizedBox(height: 80), Center(child: Text('No leads here.'))]);
                  return ListView.separated(
                    padding: const EdgeInsets.only(bottom: 96),
                    itemCount: page.items.length + 1,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      if (i == page.items.length) {
                        return CrmListFooter(
                          hasMore: page.hasMore,
                          shown: page.items.length,
                          total: page.total,
                          noun: 'lead',
                          onLoadMore: () => ref.read(leadPagesProvider(_query).notifier).loadMore(),
                        );
                      }
                      final l = page.items[i];
                      return ListTile(
                        title: Text(l.title, overflow: TextOverflow.ellipsis),
                        subtitle: Text([
                          l.code,
                          l.who,
                          if (l.ownerName != null) l.ownerName!,
                          if (l.isOpen) lastContactText(l.lastContactAt, l.lastContactChannel),
                          if (!l.isActive) 'Archived',
                        ].join(' · ')),
                        trailing: CrmTag(l.statusLabel, color: leadStatusColor(l.status)),
                        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LeadDetailScreen(leadId: l.id))),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Deals ───────────────────────────────────────────────────────────────────

class _Deals extends ConsumerStatefulWidget {
  const _Deals();

  @override
  ConsumerState<_Deals> createState() => _DealsState();
}

class _DealsState extends ConsumerState<_Deals> {
  DealQuery _query = const DealQuery();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearch(String text) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = _query.copyWith(q: text));
    });
  }

  Future<void> _create() async {
    final created = await Navigator.of(context).push<Deal>(MaterialPageRoute(builder: (_) => const DealFormScreen()));
    if (created == null || !mounted) return;
    invalidateCrm(ref);
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DealDetailScreen(dealId: created.id)));
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final list = ref.watch(dealPagesProvider(_query));
    return Scaffold(
      floatingActionButton: auth.hasPermission(CrmPerm.createDeals)
          ? FloatingActionButton.extended(heroTag: 'crm-deal', onPressed: _create, icon: const Icon(Icons.add), label: const Text('New deal'))
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Deal, code or customer', border: OutlineInputBorder(), isDense: true),
              onChanged: _onSearch,
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: FilterChip(label: const Text('Mine'), selected: _query.mine, onSelected: (v) => setState(() => _query = _query.copyWith(mine: v))),
              ),
              for (final s in [('open', 'Open'), ('won', 'Won'), ('lost', 'Lost'), (null, 'All')])
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ChoiceChip(
                    label: Text(s.$2),
                    selected: _query.status == s.$1 && _query.attention == null,
                    onSelected: (_) => setState(() => _query = (s.$1 == null ? _query.copyWith(clearStatus: true) : _query.copyWith(status: s.$1)).copyWith(clearAttention: true)),
                  ),
                ),
              for (final a in [('overdue', 'Past close date'), ('no_activity', 'No next step'), ('stuck', 'Stuck')])
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: ChoiceChip(
                    label: Text(a.$2),
                    selected: _query.attention == a.$1,
                    onSelected: (_) => setState(() => _query = _query.copyWith(status: 'open', attention: a.$1)),
                  ),
                ),
            ]),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(dealPagesProvider(_query).notifier).refresh(),
              child: list.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [CrmErrorView(error: e, onRetry: () => ref.invalidate(dealPagesProvider(_query)))]),
                data: (page) {
                  if (page.items.isEmpty) return ListView(children: const [SizedBox(height: 80), Center(child: Text('No deals here.'))]);
                  return ListView.separated(
                    padding: const EdgeInsets.only(bottom: 96),
                    itemCount: page.items.length + 1,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      if (i == page.items.length) {
                        return CrmListFooter(
                          hasMore: page.hasMore,
                          shown: page.items.length,
                          total: page.total,
                          noun: 'deal',
                          onLoadMore: () => ref.read(dealPagesProvider(_query).notifier).loadMore(),
                        );
                      }
                      final d = page.items[i];
                      final health = dealHealth(d);
                      return ListTile(
                        leading: Container(width: 6, height: 40, decoration: BoxDecoration(color: dealHealthColor(health), borderRadius: BorderRadius.circular(3))),
                        title: Text(d.name, overflow: TextOverflow.ellipsis),
                        subtitle: Text([
                          if (d.customer.isNotEmpty) d.customer,
                          d.stageName ?? '',
                          if (d.expectedCloseDate != null) 'closes ${d.expectedCloseDate}',
                          dealHealthLabel[health] ?? '',
                        ].where((s) => s.isNotEmpty).join(' · ')),
                        trailing: Text(crmMoney(d.expectedRevenue, d.currency), style: const TextStyle(fontWeight: FontWeight.w600)),
                        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => DealDetailScreen(dealId: d.id))),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
