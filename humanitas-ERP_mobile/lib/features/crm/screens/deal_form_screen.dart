import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/auth_provider.dart';
import '../../contacts/models/contact_models.dart';
import '../models/crm_models.dart';
import '../providers/crm_providers.dart';
import '../widgets/contact_picker.dart';
import '../widgets/crm_common.dart';

/// Create or edit a deal: the customer, the pipeline stage, expected revenue, probability and close date.
class DealFormScreen extends ConsumerStatefulWidget {
  final Deal? deal;

  const DealFormScreen({super.key, this.deal});

  @override
  ConsumerState<DealFormScreen> createState() => _DealFormScreenState();
}

class _DealFormScreenState extends ConsumerState<DealFormScreen> {
  Deal? get _d => widget.deal;
  late final _name = TextEditingController(text: _d?.name ?? '');
  late final _revenue = TextEditingController(text: _d == null ? '' : _plain(_d!.expectedRevenue));
  late final _probability = TextEditingController(text: _d?.probability == null ? '' : _plain(_d!.probability!));
  late final _notes = TextEditingController(text: _d?.notes ?? '');
  late String? _contactId = _d?.contactId;
  late String? _personId = _d?.personId;
  late String? _customerLabel = _d?.customer.isNotEmpty == true ? _d!.customer : null;
  late String? _close = _d?.expectedCloseDate;
  String? _stageId;
  bool _saving = false;

  static String _plain(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  @override
  void dispose() {
    _name.dispose();
    _revenue.dispose();
    _probability.dispose();
    _notes.dispose();
    super.dispose();
  }

  void _useContact(Contact c) {
    setState(() {
      // A person at a company: the deal is with the company, through that person.
      if (!c.isCompany && c.parentId != null) {
        _contactId = c.parentId;
        _personId = c.id;
      } else {
        _contactId = c.id;
        _personId = null;
      }
      _customerLabel = c.label;
    });
  }

  Future<void> _save(Pipeline? pipeline) async {
    final problem = dealFormProblem(name: _name.text, expectedRevenue: _revenue.text, probability: _probability.text);
    if (problem != null) {
      crmSnack(context, problem);
      return;
    }
    final deal = _d;
    if (deal == null && pipeline == null) {
      crmSnack(context, 'No pipeline is set up yet (CRM -> Set-up on the web)');
      return;
    }
    setState(() => _saving = true);
    final body = dealBody(
      name: _name.text,
      contactId: _contactId,
      personId: _personId,
      expectedRevenue: _revenue.text,
      probability: _probability.text,
      expectedCloseDate: _close,
      notes: _notes.text,
      pipelineId: deal == null ? pipeline?.id : null,
      stageId: deal == null ? _stageId : null,
    );
    try {
      final repo = ref.read(crmRepositoryProvider);
      final saved = deal == null ? await repo.createDeal(body) : await repo.updateDeal(deal.id, body);
      invalidateCrm(ref);
      if (mounted) Navigator.of(context).pop(saved);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      crmSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final pipelines = ref.watch(pipelinesProvider);
    final pipeline = _d == null ? defaultPipeline(pipelines.asData?.value ?? const []) : null;
    final stages = pipeline?.movableStages.where((s) => !s.isWon).toList() ?? const <Stage>[];
    final canPickContact = auth.isModuleSubscribed('contacts') && auth.hasPermission('view_contacts');
    return Scaffold(
      appBar: AppBar(
        title: Text(_d == null ? 'New deal' : 'Edit ${_d?.code ?? ''}'),
        actions: [TextButton(onPressed: _saving ? null : () => _save(pipeline), child: Text(_saving ? 'Saving…' : 'Save'))],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Deal *', hintText: 'e.g. Office chairs for Bole branch', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.storefront_outlined),
            title: Text(_customerLabel ?? 'No customer yet'),
            subtitle: Text(canPickContact ? 'Tap to choose the customer' : 'You cannot open Contacts'),
            trailing: _contactId != null
                ? IconButton(
                    tooltip: 'Remove the customer',
                    icon: const Icon(Icons.close),
                    onPressed: () => setState(() {
                      _contactId = null;
                      _personId = null;
                      _customerLabel = null;
                    }),
                  )
                : null,
            onTap: canPickContact
                ? () async {
                    final c = await pickContact(context);
                    if (c != null) _useContact(c);
                  }
                : null,
          ),
          if (_d == null) ...[
            const SizedBox(height: 8),
            pipelines.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text(e.toString()),
              data: (_) => pipeline == null
                  ? const Text('No pipeline is set up yet (CRM -> Set-up on the web).')
                  : DropdownButtonFormField<String?>(
                      initialValue: stages.any((s) => s.id == _stageId) ? _stageId : null,
                      decoration: InputDecoration(labelText: 'Stage in ${pipeline.name}', border: const OutlineInputBorder()),
                      items: [
                        const DropdownMenuItem<String?>(value: null, child: Text('The first stage')),
                        for (final s in stages) DropdownMenuItem<String?>(value: s.id, child: Text('${s.name} (${s.probability.toStringAsFixed(0)}%)')),
                      ],
                      onChanged: (v) => setState(() => _stageId = v),
                    ),
            ),
          ],
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _revenue,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Expected revenue (ETB)', border: OutlineInputBorder()),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 130,
              child: TextField(
                controller: _probability,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Chance %', hintText: 'From stage', border: OutlineInputBorder()),
              ),
            ),
          ]),
          const SizedBox(height: 4),
          Row(children: [
            TextButton.icon(
              onPressed: () async {
                final now = DateTime.now();
                final initial = DateTime.tryParse(_close ?? '') ?? now.add(const Duration(days: 30));
                final d = await showDatePicker(context: context, initialDate: initial, firstDate: now.subtract(const Duration(days: 366)), lastDate: now.add(const Duration(days: 3 * 365)));
                if (d != null) setState(() => _close = ymd(d));
              },
              icon: const Icon(Icons.event_outlined),
              label: Text(_close == null ? 'Expected close date' : 'Closes $_close'),
            ),
            if (_close != null) IconButton(tooltip: 'No close date', icon: const Icon(Icons.close), onPressed: () => setState(() => _close = null)),
          ]),
          const SizedBox(height: 8),
          TextField(controller: _notes, maxLines: 3, decoration: const InputDecoration(labelText: 'Notes', border: OutlineInputBorder())),
        ],
      ),
    );
  }
}
