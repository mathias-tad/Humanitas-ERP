import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../models/contact_models.dart';
import '../providers/contacts_providers.dart';
import '../repositories/contacts_repository.dart';

/// Create or edit a contact: a company, or a person (optionally at [parent]).
class ContactFormScreen extends ConsumerStatefulWidget {
  final Contact? contact;
  final Contact? parent;
  final bool asCustomer;
  final bool asVendor;

  const ContactFormScreen({super.key, this.contact, this.parent, this.asCustomer = false, this.asVendor = false});

  @override
  ConsumerState<ContactFormScreen> createState() => _ContactFormScreenState();
}

class _ContactFormScreenState extends ConsumerState<ContactFormScreen> {
  final _form = GlobalKey<FormState>();
  late String _type;
  late bool _customer;
  late bool _vendor;
  String? _categoryId;
  late final Map<String, TextEditingController> _c;
  List<DuplicateContact> _dupes = [];
  Timer? _debounce;
  bool _saving = false;
  bool _confirmTin = false;

  static const _fields = [
    'name', 'legal_name', 'job_title', 'tin', 'vat_number', 'phone', 'mobile', 'email', 'website', 'region', 'city', 'subcity',
    'woreda', 'street', 'tags', 'credit_limit', 'payment_terms_days', 'notes',
  ];

  @override
  void initState() {
    super.initState();
    final c = widget.contact;
    _type = c?.contactType ?? (widget.parent != null ? 'person' : 'company');
    _customer = c?.isCustomer ?? widget.asCustomer;
    _vendor = c?.isVendor ?? widget.asVendor;
    _categoryId = c?.categoryId;
    final initial = <String, String?>{
      'name': c?.name, 'legal_name': c?.legalName, 'job_title': c?.jobTitle, 'tin': c?.tin, 'vat_number': c?.vatNumber, 'phone': c?.phone,
      'mobile': c?.mobile, 'email': c?.email, 'website': c?.website, 'region': c?.region, 'city': c?.city, 'subcity': c?.subcity,
      'woreda': c?.woreda, 'street': c?.street, 'tags': c?.tags.join(', '), 'credit_limit': c?.creditLimit?.toStringAsFixed(2),
      'payment_terms_days': c == null ? '0' : '${c.paymentTermsDays}', 'notes': c?.notes,
    };
    _c = {for (final f in _fields) f: TextEditingController(text: initial[f] ?? '')};
    for (final f in const ['tin', 'phone', 'mobile', 'email']) {
      _c[f]!.addListener(_checkDuplicates);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  String _t(String f) => _c[f]!.text.trim();

  void _checkDuplicates() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if ([_t('tin'), _t('phone'), _t('mobile'), _t('email')].every((v) => v.isEmpty)) {
        if (mounted) setState(() => _dupes = []);
        return;
      }
      try {
        final found = await ref.read(contactsRepositoryProvider).duplicates(
              tin: _t('tin'), phone: _t('phone'), mobile: _t('mobile'), email: _t('email'), excludeId: widget.contact?.id);
        if (mounted) setState(() => _dupes = found);
      } on ContactsApiException {
        // A failed check never blocks saving.
      }
    });
  }

  Map<String, dynamic> _body({bool allowDuplicate = false}) {
    String? text(String f) => _t(f).isEmpty ? null : _t(f);
    final isCompany = _type == 'company';
    return {
      'contact_type': _type,
      'name': _t('name'),
      if (widget.parent != null) 'parent_id': widget.parent!.id,
      'legal_name': isCompany ? text('legal_name') : null,
      'job_title': isCompany ? null : text('job_title'),
      'tin': text('tin'),
      'vat_number': text('vat_number'),
      'phone': text('phone'),
      'mobile': text('mobile'),
      'email': text('email'),
      'website': text('website'),
      'region': text('region'),
      'city': text('city'),
      'subcity': text('subcity'),
      'woreda': text('woreda'),
      'street': text('street'),
      'category_id': _categoryId,
      'tags': _t('tags').split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList(),
      'is_customer': _customer,
      'is_vendor': _vendor,
      if (_customer) 'credit_limit': _t('credit_limit').isEmpty ? null : double.tryParse(_t('credit_limit')),
      if (_customer) 'payment_terms_days': int.tryParse(_t('payment_terms_days')) ?? 0,
      'notes': text('notes'),
      if (allowDuplicate) 'allow_duplicate': true,
    };
  }

  Future<void> _save({bool allowDuplicate = false}) async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    final repo = ref.read(contactsRepositoryProvider);
    try {
      final saved = widget.contact == null
          ? await repo.create(_body(allowDuplicate: allowDuplicate))
          : await repo.update(widget.contact!.id, _body(allowDuplicate: allowDuplicate));
      invalidateContacts(ref);
      if (mounted) Navigator.pop(context, saved);
    } on ContactsApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _confirmTin = e.isConflict;
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Widget _field(String f, String label, {TextInputType? keyboard, String? Function(String?)? validator, int maxLines = 1}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextFormField(
          controller: _c[f],
          keyboardType: keyboard,
          maxLines: maxLines,
          validator: validator,
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder(), isDense: true),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(contactCategoriesProvider).asData?.value ?? const <ContactCategory>[];
    final isCompany = _type == 'company';
    final editing = widget.contact != null;
    return Scaffold(
      appBar: AppBar(title: Text(editing ? 'Edit ${widget.contact!.name}' : widget.parent != null ? 'Person at ${widget.parent!.name}' : 'New contact')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (widget.parent == null && !(editing && widget.contact!.parentId != null))
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'company', label: Text('Company'), icon: Icon(Icons.business_outlined)),
                    ButtonSegment(value: 'person', label: Text('Person'), icon: Icon(Icons.person_outline)),
                  ],
                  selected: {_type},
                  onSelectionChanged: (s) => setState(() => _type = s.first),
                ),
              ),
            _field('name', isCompany ? 'Company name' : 'Full name', validator: (v) => (v ?? '').trim().isEmpty ? 'Enter a name' : null),
            if (isCompany) _field('legal_name', 'Legal name (as registered)') else _field('job_title', 'Job title'),
            Row(children: [
              Expanded(child: SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Customer'), value: _customer, onChanged: (v) => setState(() => _customer = v))),
              Expanded(child: SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Vendor'), value: _vendor, onChanged: (v) => setState(() => _vendor = v))),
            ]),
            _field('tin', 'TIN (10 digits)', keyboard: TextInputType.number, validator: (v) => tinProblem(v ?? '')),
            _field('vat_number', 'VAT registration number'),
            _field('phone', 'Phone', keyboard: TextInputType.phone),
            _field('mobile', 'Mobile', keyboard: TextInputType.phone),
            _field('email', 'Email', keyboard: TextInputType.emailAddress),
            if (_dupes.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('This may already be a contact:', style: TextStyle(fontWeight: FontWeight.w600)),
                    for (final d in _dupes) Text('${d.name} (${d.code}) — ${d.reason}'),
                  ],
                ),
              ),
            _field('website', 'Website', keyboard: TextInputType.url),
            _field('region', 'Region'),
            _field('city', 'City'),
            _field('subcity', 'Sub-city'),
            _field('woreda', 'Woreda'),
            _field('street', 'Street / house number'),
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: DropdownButtonFormField<String?>(
                initialValue: categories.any((k) => k.id == _categoryId) ? _categoryId : null,
                decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder(), isDense: true),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('No category')),
                  for (final k in categories) DropdownMenuItem<String?>(value: k.id, child: Text(k.name)),
                ],
                onChanged: (v) => setState(() => _categoryId = v),
              ),
            ),
            _field('tags', 'Tags (comma separated)'),
            if (_customer) ...[
              _field('credit_limit', 'Credit limit (ETB, empty = no limit)', keyboard: const TextInputType.numberWithOptions(decimal: true)),
              _field('payment_terms_days', 'Payment terms (days)', keyboard: TextInputType.number),
              const Padding(
                padding: EdgeInsets.only(bottom: 10),
                child: Text('The customer\'s price list is set in the web app.', style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
              ),
            ],
            _field('notes', 'Notes', maxLines: 3),
            if (_confirmTin)
              OutlinedButton(onPressed: _saving ? null : () => _save(allowDuplicate: true), child: const Text('Another contact has this TIN: save anyway')),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving ? 'Saving…' : editing ? 'Save' : _customer ? 'Create customer' : 'Create contact'),
            ),
          ],
        ),
      ),
    );
  }
}
