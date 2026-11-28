import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../models/crm_models.dart';
import '../providers/crm_providers.dart';

final _money = NumberFormat('#,##0.00');

/// "12,500.00 ETB"
String crmMoney(double v, [String currency = 'ETB']) => '${_money.format(v)} $currency';

final crmWhen = DateFormat('EEE d MMM, HH:mm');

void crmSnack(BuildContext context, String message) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));

/// Error message with a retry button.
class CrmErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;

  const CrmErrorView({super.key, required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 40, color: AppColors.error),
            const SizedBox(height: 12),
            Text(error.toString(), textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}

/// Loads the next page as soon as the end of a list comes into view.
class CrmAutoLoad extends StatefulWidget {
  final VoidCallback onLoadMore;
  final String label;

  const CrmAutoLoad({super.key, required this.onLoadMore, required this.label});

  @override
  State<CrmAutoLoad> createState() => _CrmAutoLoadState();
}

class _CrmAutoLoadState extends State<CrmAutoLoad> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onLoadMore();
    });
  }

  @override
  Widget build(BuildContext context) => TextButton(onPressed: widget.onLoadMore, child: Text(widget.label));
}

/// The end of a paged list: loads more, or says how many there are.
class CrmListFooter extends StatelessWidget {
  final bool hasMore;
  final int shown;
  final int total;
  final String noun;
  final VoidCallback onLoadMore;

  const CrmListFooter({super.key, required this.hasMore, required this.shown, required this.total, required this.noun, required this.onLoadMore});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(12),
        child: Center(
          child: hasMore
              ? CrmAutoLoad(onLoadMore: onLoadMore, label: 'Loading more ($shown of $total)…')
              : Text('$total $noun${total == 1 ? '' : 's'}', style: const TextStyle(color: AppColors.textSecondaryLight)),
        ),
      );
}

Color dealHealthColor(DealHealth h) => switch (h) {
      DealHealth.onTrack => AppColors.success,
      DealHealth.attention => AppColors.warning,
      DealHealth.late => AppColors.error,
      DealHealth.won => AppColors.success,
      DealHealth.lost => AppColors.textSecondaryLight,
    };

Color leadStatusColor(String status) => switch (status) {
      'new' => AppColors.info,
      'contacted' => AppColors.primary,
      'qualified' => AppColors.teal,
      'converted' => AppColors.success,
      _ => AppColors.textSecondaryLight,
    };

/// A small coloured label.
class CrmTag extends StatelessWidget {
  final String text;
  final Color color;

  const CrmTag(this.text, {super.key, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
        child: Text(text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
      );
}

/// A label and its value on a detail page.
class CrmRow extends StatelessWidget {
  final String label;
  final String value;
  final bool selectable;

  const CrmRow(this.label, this.value, {super.key, this.selectable = false});

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(fontWeight: FontWeight.w500);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 130, child: Text(label, style: const TextStyle(color: AppColors.textSecondaryLight))),
          Expanded(child: selectable ? SelectableText(value, style: style) : Text(value, style: style)),
        ],
      ),
    );
  }
}

class CrmSectionTitle extends StatelessWidget {
  final String text;

  const CrmSectionTitle(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 18, bottom: 6),
        child: Text(text, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
      );
}

IconData activityIcon(String type) => switch (type) {
      'call' => Icons.call_outlined,
      'meeting' => Icons.groups_outlined,
      'email' => Icons.mail_outline,
      'visit' => Icons.place_outlined,
      _ => Icons.check_box_outlined,
    };

IconData channelIcon(String? channel) => switch (channel) {
      'call' => Icons.call_outlined,
      'meeting' => Icons.groups_outlined,
      'visit' => Icons.place_outlined,
      'email' => Icons.mail_outline,
      'telegram' => Icons.send_outlined,
      'whatsapp' => Icons.chat_outlined,
      'sms' => Icons.sms_outlined,
      _ => Icons.sticky_note_2_outlined,
    };

/// One activity: what, when and for whom; tap to mark it done (with the outcome).
class ActivityTile extends ConsumerWidget {
  final CrmActivity activity;
  final bool canEdit;
  final bool showRelated;

  const ActivityTile({super.key, required this.activity, this.canEdit = false, this.showRelated = true});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = activity;
    final state = activityState(a);
    final color = switch (state) {
      'overdue' => AppColors.error,
      'today' => AppColors.warning,
      'done' => AppColors.success,
      _ => AppColors.textSecondaryLight,
    };
    return ListTile(
      leading: Icon(activityIcon(a.activityType), color: color),
      title: Text(a.subject, style: a.doneAt != null ? const TextStyle(decoration: TextDecoration.lineThrough) : null),
      subtitle: Text([
        activityTypeLabel(a.activityType),
        crmWhen.format(a.dueAt),
        if (state == 'overdue') 'Overdue',
        if (showRelated && a.relatedName != null) a.relatedName!,
        if (a.assignedToName != null) a.assignedToName!,
        if (a.outcome != null) 'Outcome: ${a.outcome}',
      ].join(' · ')),
      trailing: a.doneAt == null && canEdit
          ? IconButton(
              tooltip: 'Mark done',
              icon: const Icon(Icons.check_circle_outline),
              onPressed: () => showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => CompleteActivitySheet(activity: a)),
            )
          : null,
      onTap: a.doneAt == null && canEdit
          ? () => showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => ActivitySheet(activity: a))
          : null,
    );
  }
}

/// Mark an activity done and say how it went.
class CompleteActivitySheet extends ConsumerStatefulWidget {
  final CrmActivity activity;

  const CompleteActivitySheet({super.key, required this.activity});

  @override
  ConsumerState<CompleteActivitySheet> createState() => _CompleteActivitySheetState();
}

class _CompleteActivitySheetState extends ConsumerState<CompleteActivitySheet> {
  final _outcome = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _outcome.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(crmRepositoryProvider).completeActivity(widget.activity.id, outcome: _outcome.text);
      invalidateCrm(ref);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      crmSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Done: ${widget.activity.subject}', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            TextField(
              controller: _outcome,
              autofocus: true,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'How did it go? (optional)', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: const Icon(Icons.check),
              label: Text(_saving ? 'Saving…' : 'Mark done'),
            ),
          ],
        ),
      );
}

/// Pick a date and a time.
Future<DateTime?> pickDateTime(BuildContext context, DateTime initial) async {
  final now = DateTime.now();
  final date = await showDatePicker(
    context: context,
    initialDate: initial,
    firstDate: now.subtract(const Duration(days: 366)),
    lastDate: now.add(const Duration(days: 3 * 365)),
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(initial));
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}

/// Tomorrow at 9:00.
DateTime tomorrowMorning() {
  final n = DateTime.now().add(const Duration(days: 1));
  return DateTime(n.year, n.month, n.day, 9);
}

/// Plan an activity (call, meeting, email, visit, to-do) for yourself, or edit one.
class ActivitySheet extends ConsumerStatefulWidget {
  final CrmActivity? activity;

  /// 'lead', 'opportunity' or 'contact', with [relatedId], for a new activity on a record.
  final String? relatedType;
  final String? relatedId;

  const ActivitySheet({super.key, this.activity, this.relatedType, this.relatedId});

  @override
  ConsumerState<ActivitySheet> createState() => _ActivitySheetState();
}

class _ActivitySheetState extends ConsumerState<ActivitySheet> {
  late String _type = widget.activity?.activityType ?? 'call';
  late final _subject = TextEditingController(text: widget.activity?.subject ?? '');
  late final _notes = TextEditingController(text: widget.activity?.notes ?? '');
  late DateTime _due = widget.activity?.dueAt ?? tomorrowMorning();
  bool _saving = false;

  @override
  void dispose() {
    _subject.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_subject.text.trim().isEmpty) {
      crmSnack(context, 'Write what the activity is about');
      return;
    }
    setState(() => _saving = true);
    try {
      final body = activityBody(
        activityType: _type,
        subject: _subject.text,
        dueAt: _due,
        notes: _notes.text,
        relatedType: widget.activity == null ? widget.relatedType : null,
        relatedId: widget.activity == null ? widget.relatedId : null,
      );
      await ref.read(crmRepositoryProvider).saveActivity(body, id: widget.activity?.id);
      invalidateCrm(ref);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      crmSnack(context, e.toString());
    }
  }

  Future<void> _remove() async {
    final a = widget.activity;
    if (a == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(crmRepositoryProvider).removeActivity(a.id);
      invalidateCrm(ref);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      crmSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(widget.activity == null ? 'Plan an activity' : 'Edit the activity', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final t in activityTypes)
                  ChoiceChip(
                    avatar: Icon(activityIcon(t.$1), size: 18),
                    label: Text(t.$2),
                    selected: _type == t.$1,
                    onSelected: (_) => setState(() => _type = t.$1),
                  ),
              ]),
              const SizedBox(height: 12),
              TextField(controller: _subject, decoration: const InputDecoration(labelText: 'What *', hintText: 'e.g. Send the quote', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () async {
                  final picked = await pickDateTime(context, _due);
                  if (picked != null) setState(() => _due = picked);
                },
                icon: const Icon(Icons.event_outlined),
                label: Text('When: ${crmWhen.format(_due)}'),
              ),
              const SizedBox(height: 12),
              TextField(controller: _notes, maxLines: 2, decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : (widget.activity == null ? 'Plan it' : 'Save'))),
              if (widget.activity != null) TextButton(onPressed: _saving ? null : _remove, child: const Text('Remove this activity')),
            ],
          ),
        ),
      );
}

/// Mark a lead or a deal as lost: the reason is required, a note is optional.
class LoseSheet extends ConsumerStatefulWidget {
  final String title;
  final Future<void> Function(String reasonId, String note) onLose;

  const LoseSheet({super.key, required this.title, required this.onLose});

  @override
  ConsumerState<LoseSheet> createState() => _LoseSheetState();
}

class _LoseSheetState extends ConsumerState<LoseSheet> {
  String? _reasonId;
  final _note = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final reason = _reasonId;
    if (reason == null) {
      crmSnack(context, 'Choose why it was lost');
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.onLose(reason, _note.text);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      crmSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final reasons = ref.watch(lostReasonsProvider);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          reasons.when(
            loading: () => const LinearProgressIndicator(),
            error: (e, _) => Text(e.toString(), style: const TextStyle(color: AppColors.error)),
            data: (list) => list.isEmpty
                ? const Text('No lost reasons are set up yet (CRM -> Set-up on the web).')
                : DropdownButtonFormField<String>(
                    initialValue: _reasonId,
                    decoration: const InputDecoration(labelText: 'Why was it lost? *', border: OutlineInputBorder()),
                    items: [for (final r in list) DropdownMenuItem(value: r.id, child: Text(r.name))],
                    onChanged: (v) => setState(() => _reasonId = v),
                  ),
          ),
          const SizedBox(height: 12),
          TextField(controller: _note, maxLines: 2, decoration: const InputDecoration(labelText: 'Note', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Saving…' : 'Mark as lost'),
          ),
        ],
      ),
    );
  }
}

/// Log a contact that already happened with a lead or a deal, and optionally plan the next step.
class FollowUpSheet extends ConsumerStatefulWidget {
  /// 'lead' or 'opportunity'.
  final String target;
  final String id;
  final String title;

  const FollowUpSheet({super.key, required this.target, required this.id, required this.title});

  @override
  ConsumerState<FollowUpSheet> createState() => _FollowUpSheetState();
}

class _FollowUpSheetState extends ConsumerState<FollowUpSheet> {
  String _channel = 'call';
  String _direction = 'outbound';
  final _outcome = TextEditingController();
  final _duration = TextEditingController();
  final _withWhom = TextEditingController();
  DateTime _when = DateTime.now();
  bool _planNext = true;
  String _nextType = 'call';
  final _nextSubject = TextEditingController();
  DateTime _nextDue = tomorrowMorning();
  bool _saving = false;

  @override
  void dispose() {
    _outcome.dispose();
    _duration.dispose();
    _withWhom.dispose();
    _nextSubject.dispose();
    super.dispose();
  }

  bool get _isNote => _channel == 'note';

  Future<void> _save() async {
    final next = _planNext && !_isNote ? NextStep(activityType: _nextType, subject: _nextSubject.text, dueAt: _nextDue) : null;
    final problem = followUpProblem(channel: _channel, outcome: _outcome.text, occurredAt: _when, next: next);
    if (problem != null) {
      crmSnack(context, problem);
      return;
    }
    setState(() => _saving = true);
    try {
      final body = followUpBody(
        channel: _channel,
        outcome: _outcome.text,
        direction: _direction,
        duration: _duration.text,
        withWhom: _withWhom.text,
        occurredAt: _when,
        next: next,
      );
      final messenger = ScaffoldMessenger.of(context);
      final seq = await ref.read(crmRepositoryProvider).logFollowUp(widget.target, widget.id, body);
      invalidateCrm(ref);
      if (!mounted) return;
      Navigator.pop(context);
      messenger.showSnackBar(SnackBar(content: Text(seq == null ? 'Note saved' : 'Contact no. $seq logged${next != null ? ', next step planned' : ''}')));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      crmSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Log on ${widget.title}', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final c in followUpChannels)
                  ChoiceChip(
                    avatar: Icon(channelIcon(c.$1), size: 18),
                    label: Text(c.$2),
                    selected: _channel == c.$1,
                    onSelected: (_) => setState(() => _channel = c.$1),
                  ),
              ]),
              if (!_isNote) ...[
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'outbound', label: Text('We contacted them'), icon: Icon(Icons.call_made)),
                    ButtonSegment(value: 'inbound', label: Text('They contacted us'), icon: Icon(Icons.call_received)),
                  ],
                  selected: {_direction},
                  onSelectionChanged: (s) => setState(() => _direction = s.first),
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: _withWhom,
                      decoration: const InputDecoration(labelText: 'With whom', border: OutlineInputBorder(), isDense: true),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 110,
                    child: TextField(
                      controller: _duration,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Minutes', border: OutlineInputBorder(), isDense: true),
                    ),
                  ),
                ]),
              ],
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () async {
                  final picked = await pickDateTime(context, _when);
                  if (picked != null) setState(() => _when = picked);
                },
                icon: const Icon(Icons.schedule),
                label: Text('When: ${crmWhen.format(_when)}'),
              ),
              TextField(
                controller: _outcome,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: _isNote ? 'Note *' : 'Outcome *',
                  hintText: _isNote ? null : 'e.g. Wants a quote by Friday',
                  border: const OutlineInputBorder(),
                ),
              ),
              if (!_isNote) ...[
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Plan the next step'),
                  value: _planNext,
                  onChanged: (v) => setState(() => _planNext = v),
                ),
                if (_planNext) ...[
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final t in activityTypes)
                      ChoiceChip(label: Text(t.$2), selected: _nextType == t.$1, onSelected: (_) => setState(() => _nextType = t.$1)),
                  ]),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nextSubject,
                    decoration: const InputDecoration(labelText: 'Next step', hintText: 'e.g. Send the quote', border: OutlineInputBorder(), isDense: true),
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      final picked = await pickDateTime(context, _nextDue);
                      if (picked != null) setState(() => _nextDue = picked);
                    },
                    icon: const Icon(Icons.event_outlined),
                    label: Text('Due: ${crmWhen.format(_nextDue)}'),
                  ),
                ],
              ],
              const SizedBox(height: 8),
              FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : 'Log it')),
            ],
          ),
        ),
      );
}

/// The follow-ups of a lead or a deal: the planned next steps, then every contact, numbered, newest first.
class FollowUpsView extends ConsumerStatefulWidget {
  /// 'lead' or 'opportunity'.
  final String target;
  final String id;
  final bool canEdit;

  const FollowUpsView({super.key, required this.target, required this.id, this.canEdit = false});

  @override
  ConsumerState<FollowUpsView> createState() => _FollowUpsViewState();
}

class _FollowUpsViewState extends ConsumerState<FollowUpsView> {
  final List<FollowUpEvent> _events = [];
  String? _cursor;
  bool _loading = false;
  bool _done = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading || (_done && !reset)) return;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _events.clear();
        _cursor = null;
        _done = false;
      }
    });
    try {
      final page = await ref.read(crmRepositoryProvider).followUps(widget.target, widget.id, before: _cursor);
      if (!mounted) return;
      setState(() {
        _events.addAll(page.events);
        _cursor = page.nextCursor;
        _done = page.nextCursor == null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Reload when the record changes (a follow-up was logged, an activity done).
    if (widget.target == 'lead') {
      ref.listen(leadDetailProvider(widget.id), (_, _) => _load(reset: true));
    } else {
      ref.listen(dealDetailProvider(widget.id), (_, _) => _load(reset: true));
    }
    final planned = ref.watch(activityPagesProvider(ActivityQuery(when: 'open', assignedTo: 'all', relatedType: widget.target, relatedId: widget.id)));
    final when = DateFormat('EEE d MMM y, HH:mm');
    return ListView(
      padding: const EdgeInsets.fromLTRB(0, 8, 0, 96),
      children: [
        const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: CrmSectionTitle('Planned')),
        planned.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator()),
          error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: Text(e.toString())),
          data: (page) => page.items.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text('Nothing planned. Plan the next step when you log a follow-up.', style: TextStyle(color: AppColors.warning)),
                )
              : Column(children: [for (final a in page.items) ActivityTile(activity: a, canEdit: widget.canEdit, showRelated: false)]),
        ),
        if (widget.canEdit)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                builder: (_) => ActivitySheet(relatedType: widget.target, relatedId: widget.id),
              ),
              icon: const Icon(Icons.add_task),
              label: const Text('Plan an activity'),
            ),
          ),
        const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: CrmSectionTitle('Contacts and notes')),
        if (_events.isEmpty && _error != null) CrmErrorView(error: _error!, onRetry: _load),
        if (_events.isEmpty && _loading) const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator())),
        if (_events.isEmpty && !_loading && _error == null)
          const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Text('No follow-ups yet.')),
        for (final e in _events)
          Card(
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Icon(channelIcon(e.channel), size: 18),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        [
                          if (e.sequence != null) 'Contact no. ${e.sequence}',
                          channelLabel(e.channel),
                          if (e.direction == 'inbound') 'from them',
                          if (e.direction == 'outbound') 'by us',
                          if (e.durationMinutes != null) '${e.durationMinutes} min',
                        ].where((s) => s.isNotEmpty).join(' · '),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 6),
                  Text(e.outcome ?? e.summary ?? ''),
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (e.occurredAt != null) when.format(e.occurredAt!),
                      if (e.withWhom != null) 'with ${e.withWhom}',
                      if (e.createdByName != null) e.createdByName!,
                    ].join(' · '),
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                  ),
                ],
              ),
            ),
          ),
        if (_events.isNotEmpty && !_done)
          Center(child: TextButton(onPressed: _loading ? null : _load, child: Text(_loading ? 'Loading…' : 'Load older'))),
      ],
    );
  }
}
