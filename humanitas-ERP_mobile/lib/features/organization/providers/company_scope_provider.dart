import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/scope_headers.dart';
import '../../../core/providers/providers.dart';
import '../models/company_scope.dart';
import 'organization_provider.dart';

/// The companies and branches this user may work in (AGENTS.md rule 16).
final companyScopeProvider = FutureProvider.autoDispose<CompanyScope>((ref) async {
  final res = await ref.watch(apiClientProvider).dio.get('/me/company-scope');
  final data = res.data;
  return CompanyScope.fromJson(data is Map<String, dynamic> ? data : const <String, dynamic>{});
});

/// The applied company/branch selection (empty: the user's default). Cleared on sign-out (router).
final scopeSelectionProvider = StateProvider<ScopeSelection>((ref) => ScopeSelection.none);

/// Goes up on every change of company or branch; the home screens re-open with it, so
/// everything they show loads again for the new selection.
final scopeEpochProvider = StateProvider<int>((ref) => 0);

/// Applies a new selection: every API call from now on carries it.
void applyScopeSelection(WidgetRef ref, ScopeSelection selection) {
  if (ref.read(scopeSelectionProvider) == selection) return;
  ScopeHeaders.set(selection.headers);
  ref.read(activeCompanyIdsProvider.notifier).state = selection.companyIds;
  ref.read(activeBranchIdsProvider.notifier).state = selection.branchIds;
  ref.read(scopeSelectionProvider.notifier).state = selection;
  ref.read(scopeEpochProvider.notifier).state++;
}
