import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../../products/widgets/products_common.dart' show ProductsErrorView;
import '../models/contact_models.dart';
import '../providers/contacts_providers.dart';
import 'contact_detail_screen.dart';
import 'contact_form_screen.dart';

/// Contacts on mobile: companies and people, customers and vendors (Home -> Quick Actions -> Contacts).
class ContactsScreen extends ConsumerStatefulWidget {
  const ContactsScreen({super.key});

  @override
  ConsumerState<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends ConsumerState<ContactsScreen> {
  ContactQuery _query = const ContactQuery();
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
    final created = await Navigator.of(context).push<Contact>(
      MaterialPageRoute(builder: (_) => ContactFormScreen(asCustomer: _query.role == 'customer', asVendor: _query.role == 'vendor')),
    );
    if (created != null && mounted) {
      invalidateContacts(ref);
      await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ContactDetailScreen(contactId: created.id)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    if (!auth.isModuleSubscribed('contacts') || !auth.hasPermission('view_contacts')) {
      return Scaffold(appBar: AppBar(title: const Text('Contacts')), body: const Center(child: Text('Access denied')));
    }
    final listAsync = ref.watch(contactPagesProvider(_query));
    return Scaffold(
      appBar: AppBar(title: const Text('Contacts')),
      floatingActionButton: auth.hasPermission('create_contacts')
          ? FloatingActionButton.extended(onPressed: _create, icon: const Icon(Icons.add), label: Text(_query.role == 'customer' ? 'New customer' : 'New contact'))
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Name, code, TIN, phone, email or person', border: OutlineInputBorder(), isDense: true),
              onChanged: _onSearch,
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                for (final r in const [(null, 'All'), ('customer', 'Customers'), ('vendor', 'Vendors')])
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: ChoiceChip(
                      label: Text(r.$2),
                      selected: _query.role == r.$1,
                      onSelected: (_) => setState(() => _query = r.$1 == null ? _query.copyWith(clearRole: true) : _query.copyWith(role: r.$1)),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(contactPagesProvider(_query).notifier).refresh(),
              child: listAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ListView(children: [ProductsErrorView(error: e, onRetry: () => ref.invalidate(contactPagesProvider(_query)))]),
                data: (page) => _ContactList(page: page, onLoadMore: () => ref.read(contactPagesProvider(_query).notifier).loadMore()),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactList extends StatelessWidget {
  final ContactPage page;
  final VoidCallback onLoadMore;

  const _ContactList({required this.page, required this.onLoadMore});

  @override
  Widget build(BuildContext context) {
    if (page.items.isEmpty) {
      return ListView(children: const [SizedBox(height: 80), Center(child: Text('No contacts here yet.'))]);
    }
    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 96),
      itemCount: page.items.length + 1,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, i) {
        if (i == page.items.length) {
          return Padding(
            padding: const EdgeInsets.all(12),
            child: Center(
              child: page.hasMore
                  ? _AutoLoad(onLoadMore: onLoadMore, label: 'Loading more (${page.items.length} of ${page.total})…')
                  : Text('${page.total} contact${page.total == 1 ? '' : 's'}', style: const TextStyle(color: AppColors.textSecondaryLight)),
            ),
          );
        }
        final c = page.items[i];
        return ListTile(
          leading: Icon(c.isCompany ? Icons.business_outlined : Icons.person_outline),
          title: Text(c.name, overflow: TextOverflow.ellipsis),
          subtitle: Text([
            c.code,
            if (!c.isCompany && c.parentName != null) [c.jobTitle, c.parentName].whereType<String>().join(' at '),
            if (c.phone ?? c.mobile case final p?) p,
            if (c.isCustomer) 'Customer',
            if (c.isVendor) 'Vendor',
            if (!c.isActive) 'Archived',
          ].join(' · ')),
          onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ContactDetailScreen(contactId: c.id))),
        );
      },
    );
  }
}

/// Loads the next page as soon as the end of the list comes into view.
class _AutoLoad extends StatefulWidget {
  final VoidCallback onLoadMore;
  final String label;

  const _AutoLoad({required this.onLoadMore, required this.label});

  @override
  State<_AutoLoad> createState() => _AutoLoadState();
}

class _AutoLoadState extends State<_AutoLoad> {
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
