import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../../products/models/product_models.dart' show TimelineEvent;
import '../../products/widgets/products_common.dart' show ProductsErrorView, ProductsSectionTitle;
import '../models/contact_models.dart';
import '../providers/contacts_providers.dart';
import '../repositories/contacts_repository.dart';
import 'contact_form_screen.dart';

/// One contact: details, the people at a company, and the full history with logged calls and notes.
class ContactDetailScreen extends ConsumerWidget {
  final String contactId;

  const ContactDetailScreen({super.key, required this.contactId});

  Future<void> _toggleArchive(BuildContext context, WidgetRef ref, Contact c) async {
    final repo = ref.read(contactsRepositoryProvider);
    try {
      c.isActive ? await repo.archive(c.id) : await repo.restore(c.id);
      invalidateContacts(ref);
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(c.isActive ? 'Contact archived' : 'Contact restored')));
    } on ContactsApiException catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final async = ref.watch(contactDetailProvider(contactId));
    final c = async.asData?.value;
    final tabs = <Tab>[const Tab(text: 'Details'), if (c != null && c.isCompany) const Tab(text: 'People'), const Tab(text: 'History')];
    return DefaultTabController(
      key: ValueKey(tabs.length),
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: Text(c?.name ?? 'Contact'),
          actions: [
            if (c != null && auth.hasPermission('edit_contacts'))
              IconButton(
                tooltip: 'Edit',
                icon: const Icon(Icons.edit_outlined),
                onPressed: () async {
                  final saved = await Navigator.of(context).push<Contact>(MaterialPageRoute(builder: (_) => ContactFormScreen(contact: c)));
                  if (saved != null) invalidateContacts(ref);
                },
              ),
            if (c != null && (c.isActive ? auth.hasPermission('delete_contacts') : auth.hasPermission('restore_contacts')))
              IconButton(
                tooltip: c.isActive ? 'Archive' : 'Restore',
                icon: Icon(c.isActive ? Icons.archive_outlined : Icons.unarchive_outlined),
                onPressed: () => _toggleArchive(context, ref, c),
              ),
          ],
          bottom: TabBar(tabs: tabs),
        ),
        floatingActionButton: c != null && auth.hasPermission('edit_contacts')
            ? FloatingActionButton.extended(
                onPressed: () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => LogInteractionSheet(contact: c),
                ),
                icon: const Icon(Icons.add_comment_outlined),
                label: const Text('Log call / note'),
              )
            : null,
        body: async.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ProductsErrorView(error: e, onRetry: () => ref.invalidate(contactDetailProvider(contactId))),
          data: (c) => TabBarView(children: [
            _Details(contact: c),
            if (c.isCompany) _People(company: c, canCreate: auth.hasPermission('create_contacts')),
            ContactTimelineView(contactId: c.id),
          ]),
        ),
      ),
    );
  }
}

class _Details extends StatelessWidget {
  final Contact contact;

  const _Details({required this.contact});

  @override
  Widget build(BuildContext context) {
    final c = contact;
    final money = NumberFormat('#,##0.00');
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      children: [
        if (!c.isActive) const Text('This contact is archived: hidden from lists and pickers.', style: TextStyle(color: AppColors.warning)),
        Wrap(spacing: 6, children: [
          Chip(label: Text(c.isCompany ? 'Company' : 'Person')),
          if (c.isCustomer) const Chip(label: Text('Customer')),
          if (c.isVendor) const Chip(label: Text('Vendor')),
          for (final t in c.tags) Chip(label: Text(t)),
        ]),
        _Row('Code', c.code),
        if (!c.isCompany) _Row('Works at', [c.jobTitle, c.parentName].whereType<String>().join(' at ').ifEmpty('—')),
        if (c.legalName != null) _Row('Legal name', c.legalName!),
        _Row('TIN', c.tin ?? '—'),
        if (c.vatNumber != null) _Row('VAT number', c.vatNumber!),
        _Row('Phone', [c.phone, c.mobile].whereType<String>().join(' · ').ifEmpty('—'), selectable: true),
        _Row('Email', c.email ?? '—', selectable: true),
        if (c.website != null) _Row('Website', c.website!, selectable: true),
        _Row('Address', c.address.ifEmpty('—')),
        _Row('Category', c.categoryName ?? '—'),
        if (c.isCustomer) ...[
          const ProductsSectionTitle('As a customer', icon: Icons.storefront_outlined),
          _Row('Price list', c.priceListName ?? 'From the category, else the default'),
          _Row('Credit limit', c.creditLimit == null ? 'No limit' : '${money.format(c.creditLimit)} ETB'),
          _Row('Payment terms', c.paymentTermsDays == 0 ? 'Immediate' : '${c.paymentTermsDays} days'),
          if (c.accountManagerName != null) _Row('Account manager', c.accountManagerName!),
        ],
        if (c.notes != null) ...[const ProductsSectionTitle('Notes'), Text(c.notes!)],
      ],
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final bool selectable;

  const _Row(this.label, this.value, {this.selectable = false});

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

class _People extends ConsumerWidget {
  final Contact company;
  final bool canCreate;

  const _People({required this.company, required this.canCreate});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 96),
      children: [
        if (canCreate)
          ListTile(
            leading: const Icon(Icons.person_add_alt_outlined),
            title: const Text('Add a person'),
            onTap: () async {
              final saved = await Navigator.of(context).push<Contact>(MaterialPageRoute(builder: (_) => ContactFormScreen(parent: company)));
              if (saved != null) invalidateContacts(ref);
            },
          ),
        if (company.people.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No people yet.')),
        for (final p in company.people)
          ListTile(
            leading: Icon(p.isPrimaryContact ? Icons.star : Icons.person_outline),
            title: Text(p.name),
            subtitle: Text([p.jobTitle, p.phone ?? p.mobile, p.email].whereType<String>().join(' · ')),
            onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ContactDetailScreen(contactId: p.id))),
          ),
      ],
    );
  }
}

/// History: every change and every logged call, meeting, email, visit and note, newest first.
class ContactTimelineView extends ConsumerStatefulWidget {
  final String contactId;

  const ContactTimelineView({super.key, required this.contactId});

  @override
  ConsumerState<ContactTimelineView> createState() => _ContactTimelineViewState();
}

class _ContactTimelineViewState extends ConsumerState<ContactTimelineView> {
  final List<TimelineEvent> _events = [];
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
      final page = await ref.read(contactsRepositoryProvider).timeline(widget.contactId, before: _cursor);
      if (!mounted) return;
      setState(() {
        _events.addAll(page.events);
        _cursor = page.nextCursor;
        _done = page.nextCursor == null;
        _loading = false;
      });
    } on ContactsApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(contactDetailProvider(widget.contactId), (_, _) => _load(reset: true));
    if (_events.isEmpty && _error != null) return ProductsErrorView(error: _error!, onRetry: _load);
    if (_events.isEmpty && _loading) return const Center(child: CircularProgressIndicator());
    if (_events.isEmpty) return const Center(child: Text('No history yet'));
    final when = DateFormat('d MMM y, HH:mm');
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      itemCount: _events.length + 1,
      itemBuilder: (context, i) {
        if (i == _events.length) {
          if (_done) return const SizedBox(height: 24);
          return Center(child: TextButton(onPressed: _loading ? null : _load, child: Text(_loading ? 'Loading…' : 'Load older')));
        }
        final e = _events[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(e.summary ?? e.eventType, style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(
                  [e.createdByName ?? 'System', if (e.occurredAt != null) when.format(e.occurredAt!), e.clientLabel].join(' · '),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Log a call, meeting, email, visit or note on the contact's history.
class LogInteractionSheet extends ConsumerStatefulWidget {
  final Contact contact;

  const LogInteractionSheet({super.key, required this.contact});

  @override
  ConsumerState<LogInteractionSheet> createState() => _LogInteractionSheetState();
}

class _LogInteractionSheetState extends ConsumerState<LogInteractionSheet> {
  String _kind = 'call';
  String _direction = 'outbound';
  String? _personId;
  final _summary = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _summary.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final text = _summary.text.trim();
    if (text.isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref.read(contactsRepositoryProvider).logInteraction(widget.contact.id, kind: _kind, summary: text, direction: _direction, personId: _personId);
      ref.invalidate(contactDetailProvider(widget.contact.id));
      if (mounted) Navigator.pop(context);
    } on ContactsApiException catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const kinds = [
      ('call', 'Call'), ('meeting', 'Meeting'), ('email', 'Email'), ('visit', 'Visit'),
      ('telegram', 'Telegram'), ('whatsapp', 'WhatsApp'), ('sms', 'SMS'), ('note', 'Note'),
    ];
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Log on ${widget.contact.name}', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(spacing: 6, children: [
            for (final k in kinds) ChoiceChip(label: Text(k.$2), selected: _kind == k.$1, onSelected: (_) => setState(() => _kind = k.$1)),
          ]),
          if (_kind != 'note')
            Wrap(spacing: 6, children: [
              ChoiceChip(label: const Text('We contacted them'), selected: _direction == 'outbound', onSelected: (_) => setState(() => _direction = 'outbound')),
              ChoiceChip(label: const Text('They contacted us'), selected: _direction == 'inbound', onSelected: (_) => setState(() => _direction = 'inbound')),
            ]),
          if (widget.contact.people.isNotEmpty)
            DropdownButtonFormField<String?>(
              initialValue: _personId,
              decoration: const InputDecoration(labelText: 'With'),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('The company')),
                for (final p in widget.contact.people) DropdownMenuItem<String?>(value: p.id, child: Text(p.name)),
              ],
              onChanged: (v) => setState(() => _personId = v),
            ),
          TextField(controller: _summary, maxLines: 3, maxLength: 2000, decoration: const InputDecoration(labelText: 'What was said or agreed')),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : 'Log')),
          ),
        ],
      ),
    );
  }
}
