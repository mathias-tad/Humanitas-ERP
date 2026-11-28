import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../contacts/models/contact_models.dart';
import '../../contacts/providers/contacts_providers.dart';

/// Pick a contact (CRM depends on Contacts, rule 30): search by name, code, phone or email.
Future<Contact?> pickContact(BuildContext context, {bool customersOnly = false}) => showModalBottomSheet<Contact>(
      context: context,
      isScrollControlled: true,
      builder: (_) => FractionallySizedBox(heightFactor: 0.85, child: _ContactPicker(customersOnly: customersOnly)),
    );

class _ContactPicker extends ConsumerStatefulWidget {
  final bool customersOnly;

  const _ContactPicker({required this.customersOnly});

  @override
  ConsumerState<_ContactPicker> createState() => _ContactPickerState();
}

class _ContactPickerState extends ConsumerState<_ContactPicker> {
  late ContactQuery _query = ContactQuery(role: widget.customersOnly ? 'customer' : null);
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = ref.watch(contactPagesProvider(_query));
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: TextField(
            autofocus: true,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Name, code, phone or email', border: OutlineInputBorder(), isDense: true),
            onChanged: (text) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 300), () {
                if (mounted) setState(() => _query = _query.copyWith(q: text));
              });
            },
          ),
        ),
        Expanded(
          child: list.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text(e.toString(), style: const TextStyle(color: AppColors.error))),
            data: (page) => page.items.isEmpty
                ? const Center(child: Text('No contact found'))
                : ListView.builder(
                    itemCount: page.items.length + (page.hasMore ? 1 : 0),
                    itemBuilder: (context, i) {
                      if (i == page.items.length) {
                        return TextButton(
                          onPressed: () => ref.read(contactPagesProvider(_query).notifier).loadMore(),
                          child: Text('Show more (${page.items.length} of ${page.total})'),
                        );
                      }
                      final c = page.items[i];
                      return ListTile(
                        leading: Icon(c.isCompany ? Icons.business_outlined : Icons.person_outline),
                        title: Text(c.label),
                        subtitle: Text([c.code, ?(c.phone ?? c.mobile), if (c.isCustomer) 'Customer'].join(' · ')),
                        onTap: () => Navigator.pop(context, c),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}
