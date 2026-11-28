import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../models/crm_models.dart';
import '../providers/crm_providers.dart';
import '../widgets/crm_common.dart';
import 'crm_screen.dart' show CrmPerm;

/// Create or edit a lead: what they want, who they are, how to reach them and how qualified they are.
/// The lead goes to the company and branch picked in the switcher; the owner is the person creating it.
class LeadFormScreen extends ConsumerStatefulWidget {
  final Lead? lead;

  const LeadFormScreen({super.key, this.lead});

  @override
  ConsumerState<LeadFormScreen> createState() => _LeadFormScreenState();
}

class _LeadFormScreenState extends ConsumerState<LeadFormScreen> {
  Lead? get _l => widget.lead;
  late final _title = TextEditingController(text: _l?.title ?? '');
  late final _person = TextEditingController(text: _l?.personName ?? '');
  late final _company = TextEditingController(text: _l?.companyName ?? '');
  late final _jobTitle = TextEditingController(text: _l?.jobTitle ?? '');
  late final _phone = TextEditingController(text: _l?.phone ?? '');
  late final _mobile = TextEditingController(text: _l?.mobile ?? '');
  late final _email = TextEditingController(text: _l?.email ?? '');
  late final _city = TextEditingController(text: _l?.city ?? '');
  late final _need = TextEditingController(text: _l?.need ?? '');
  late final _budget = TextEditingController(text: _amount(_l?.budget));
  late final _timeline = TextEditingController(text: _l?.timeline ?? '');
  late final _decisionMaker = TextEditingController(text: _l?.decisionMaker ?? '');
  late final _revenue = TextEditingController(text: _amount(_l?.expectedRevenue));
  late final _notes = TextEditingController(text: _l?.notes ?? '');
  late String? _sourceId = _l?.sourceId;
  bool _saving = false;

  static String _amount(double? v) => v == null ? '' : (v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString());

  List<TextEditingController> get _all =>
      [_title, _person, _company, _jobTitle, _phone, _mobile, _email, _city, _need, _budget, _timeline, _decisionMaker, _revenue, _notes];

  @override
  void dispose() {
    for (final c in _all) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final problem = leadFormProblem(title: _title.text, email: _email.text, budget: _budget.text, expectedRevenue: _revenue.text);
    if (problem != null) {
      crmSnack(context, problem);
      return;
    }
    setState(() => _saving = true);
    final body = leadBody(
      title: _title.text,
      personName: _person.text,
      companyName: _company.text,
      jobTitle: _jobTitle.text,
      phone: _phone.text,
      mobile: _mobile.text,
      email: _email.text,
      city: _city.text,
      sourceId: _sourceId,
      need: _need.text,
      budget: _budget.text,
      timeline: _timeline.text,
      decisionMaker: _decisionMaker.text,
      expectedRevenue: _revenue.text,
      notes: _notes.text,
    );
    try {
      final repo = ref.read(crmRepositoryProvider);
      final lead = _l;
      final saved = lead == null ? await repo.createLead(body) : await repo.updateLead(lead.id, body);
      invalidateCrm(ref);
      if (mounted) Navigator.of(context).pop(saved);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      crmSnack(context, e.toString());
    }
  }

  Widget _field(TextEditingController c, String label, {TextInputType? keyboard, int lines = 1, String? hint}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextField(
          controller: c,
          keyboardType: keyboard,
          maxLines: lines,
          decoration: InputDecoration(labelText: label, hintText: hint, border: const OutlineInputBorder()),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final sources = auth.hasPermission(CrmPerm.viewSetup) ? ref.watch(leadSourcesProvider).asData?.value ?? const <CrmListItem>[] : const <CrmListItem>[];
    return Scaffold(
      appBar: AppBar(
        title: Text(_l == null ? 'New lead' : 'Edit ${_l?.code ?? ''}'),
        actions: [TextButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : 'Save'))],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _field(_title, 'What do they want? *', hint: 'e.g. 20 office chairs for the new branch'),
          const CrmSectionTitle('Who'),
          _field(_person, 'Person'),
          _field(_company, 'Company'),
          _field(_jobTitle, 'Job title'),
          Row(children: [
            Expanded(child: _field(_phone, 'Phone', keyboard: TextInputType.phone)),
            const SizedBox(width: 8),
            Expanded(child: _field(_mobile, 'Mobile', keyboard: TextInputType.phone)),
          ]),
          _field(_email, 'Email', keyboard: TextInputType.emailAddress),
          _field(_city, 'City'),
          if (sources.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: DropdownButtonFormField<String?>(
                initialValue: sources.any((s) => s.id == _sourceId) ? _sourceId : null,
                decoration: const InputDecoration(labelText: 'Source', border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('Not known')),
                  for (final s in sources) DropdownMenuItem<String?>(value: s.id, child: Text(s.name)),
                ],
                onChanged: (v) => setState(() => _sourceId = v),
              ),
            ),
          const CrmSectionTitle('Qualification'),
          _field(_need, 'Need', lines: 2),
          Row(children: [
            Expanded(child: _field(_budget, 'Budget (ETB)', keyboard: const TextInputType.numberWithOptions(decimal: true))),
            const SizedBox(width: 8),
            Expanded(child: _field(_revenue, 'Expected revenue', keyboard: const TextInputType.numberWithOptions(decimal: true))),
          ]),
          _field(_timeline, 'Timeline', hint: 'e.g. Before the end of the quarter'),
          _field(_decisionMaker, 'Decision maker'),
          _field(_notes, 'Notes', lines: 3),
        ],
      ),
    );
  }
}
