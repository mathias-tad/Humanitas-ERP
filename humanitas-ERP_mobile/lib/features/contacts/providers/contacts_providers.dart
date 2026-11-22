import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/providers.dart';
import '../models/contact_models.dart';
import '../repositories/contacts_repository.dart';

final contactsRepositoryProvider = Provider<ContactsRepository>((ref) => ContactsRepository(ref.watch(apiClientProvider)));

/// Contacts load this many at a time; more load as the list is scrolled (AGENTS.md rule 24 item 21).
const int kContactPageSize = 40;

/// The contact list for one set of filters, page after page.
class ContactPager extends StateNotifier<AsyncValue<ContactPage>> {
  final ContactsRepository _repo;
  final ContactQuery _query;
  bool _loadingMore = false;
  Object? loadMoreError;

  ContactPager(this._repo, this._query) : super(const AsyncValue.loading()) {
    refresh();
  }

  Future<void> refresh() async {
    loadMoreError = null;
    final next = await AsyncValue.guard(() => _repo.list(_query, page: 1, limit: kContactPageSize));
    if (mounted) state = next;
  }

  Future<void> loadMore() async {
    final current = state.asData?.value;
    if (current == null || !current.hasMore || _loadingMore) return;
    _loadingMore = true;
    loadMoreError = null;
    try {
      final next = await _repo.list(_query, page: current.page + 1, limit: kContactPageSize);
      if (mounted) state = AsyncValue.data(current.append(next));
    } catch (e) {
      loadMoreError = e;
    } finally {
      _loadingMore = false;
    }
  }
}

final contactPagesProvider =
    StateNotifierProvider.autoDispose.family<ContactPager, AsyncValue<ContactPage>, ContactQuery>((ref, query) {
  return ContactPager(ref.watch(contactsRepositoryProvider), query);
});

final contactDetailProvider = FutureProvider.autoDispose.family<Contact, String>((ref, id) {
  return ref.watch(contactsRepositoryProvider).get(id);
});

final contactCategoriesProvider = FutureProvider.autoDispose<List<ContactCategory>>((ref) {
  return ref.watch(contactsRepositoryProvider).categories();
});

/// Refresh what Contacts shows after a create, edit, archive or restore.
void invalidateContacts(WidgetRef ref) {
  ref.invalidate(contactPagesProvider);
  ref.invalidate(contactDetailProvider);
}
