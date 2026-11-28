import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/providers.dart';
import '../models/crm_models.dart';
import '../repositories/crm_repository.dart';

final crmRepositoryProvider = Provider<CrmRepository>((ref) => CrmRepository(ref.watch(apiClientProvider)));

/// CRM lists load this many at a time; more load as the list is scrolled (AGENTS.md rule 24 item 21).
const int kCrmPageSize = 40;

/// One CRM list (leads, deals or activities) for one set of filters, page after page.
class CrmPager<T> extends StateNotifier<AsyncValue<CrmPage<T>>> {
  final Future<CrmPage<T>> Function(int page, int limit) _fetch;
  bool _loadingMore = false;
  Object? loadMoreError;

  CrmPager(this._fetch) : super(const AsyncValue.loading()) {
    refresh();
  }

  Future<void> refresh() async {
    loadMoreError = null;
    final next = await AsyncValue.guard(() => _fetch(1, kCrmPageSize));
    if (mounted) state = next;
  }

  Future<void> loadMore() async {
    final current = state.asData?.value;
    if (current == null || !current.hasMore || _loadingMore) return;
    _loadingMore = true;
    loadMoreError = null;
    try {
      final next = await _fetch(current.page + 1, kCrmPageSize);
      if (mounted) state = AsyncValue.data(current.append(next));
    } catch (e) {
      loadMoreError = e;
    } finally {
      _loadingMore = false;
    }
  }
}

final leadPagesProvider = StateNotifierProvider.autoDispose.family<CrmPager<Lead>, AsyncValue<CrmPage<Lead>>, LeadQuery>((ref, query) {
  final repo = ref.watch(crmRepositoryProvider);
  return CrmPager<Lead>((page, limit) => repo.leads(query, page: page, limit: limit));
});

final dealPagesProvider = StateNotifierProvider.autoDispose.family<CrmPager<Deal>, AsyncValue<CrmPage<Deal>>, DealQuery>((ref, query) {
  final repo = ref.watch(crmRepositoryProvider);
  return CrmPager<Deal>((page, limit) => repo.deals(query, page: page, limit: limit));
});

final activityPagesProvider =
    StateNotifierProvider.autoDispose.family<CrmPager<CrmActivity>, AsyncValue<CrmPage<CrmActivity>>, ActivityQuery>((ref, query) {
  final repo = ref.watch(crmRepositoryProvider);
  return CrmPager<CrmActivity>((page, limit) => repo.activities(query, page: page, limit: limit));
});

final leadDetailProvider = FutureProvider.autoDispose.family<Lead, String>((ref, id) => ref.watch(crmRepositoryProvider).lead(id));

final dealDetailProvider = FutureProvider.autoDispose.family<Deal, String>((ref, id) => ref.watch(crmRepositoryProvider).deal(id));

final activitySummaryProvider = FutureProvider.autoDispose<ActivitySummary>((ref) => ref.watch(crmRepositoryProvider).activitySummary());

final pipelinesProvider = FutureProvider.autoDispose<List<Pipeline>>((ref) => ref.watch(crmRepositoryProvider).pipelines());

final leadSourcesProvider = FutureProvider.autoDispose<List<CrmListItem>>((ref) => ref.watch(crmRepositoryProvider).sources());

final lostReasonsProvider = FutureProvider.autoDispose<List<CrmListItem>>((ref) => ref.watch(crmRepositoryProvider).lostReasons());

/// Refresh what CRM shows after any change (lists, details and the activity counts).
void invalidateCrm(WidgetRef ref) {
  ref.invalidate(leadPagesProvider);
  ref.invalidate(dealPagesProvider);
  ref.invalidate(activityPagesProvider);
  ref.invalidate(leadDetailProvider);
  ref.invalidate(dealDetailProvider);
  ref.invalidate(activitySummaryProvider);
}
