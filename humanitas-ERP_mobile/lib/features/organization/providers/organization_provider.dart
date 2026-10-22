import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/company_model.dart';
import '../models/branch_model.dart';
import '../repositories/organization_repository.dart';

final organizationRepositoryProvider = Provider<OrganizationRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return OrganizationRepository(apiClient: apiClient);
});

final companiesProvider = FutureProvider<List<CompanyModel>>((ref) async {
  return ref.watch(organizationRepositoryProvider).getCompanies();
});

final branchesProvider = FutureProvider.family<List<BranchModel>, String?>((ref, companyId) async {
  return ref.watch(organizationRepositoryProvider).getBranches(companyId: companyId);
});

final activeCompanyIdsProvider = StateProvider<List<String>>((ref) => []);
final activeBranchIdsProvider = StateProvider<List<String>>((ref) => []);

final activeCompanyIdProvider = Provider<String?>((ref) {
  final ids = ref.watch(activeCompanyIdsProvider);
  return ids.isEmpty ? null : ids.join(',');
});

final activeBranchIdProvider = Provider<String?>((ref) {
  final ids = ref.watch(activeBranchIdsProvider);
  return ids.isEmpty ? null : ids.join(',');
});
