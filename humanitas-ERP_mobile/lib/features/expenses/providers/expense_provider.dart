import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/expenses/models/expense_model.dart';
import 'package:humanitas_erp_mobile/features/expenses/repositories/expense_repository.dart';

final expenseRepositoryProvider = Provider<ExpenseRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return ExpenseRepository(apiClient);
});

final expenseCategoriesProvider =
    FutureProvider.autoDispose<List<ExpenseCategoryModel>>((ref) async {
  return ref.watch(expenseRepositoryProvider).getCategories();
});

final myExpenseReportsProvider =
    FutureProvider.autoDispose<List<ExpenseReportModel>>((ref) async {
  return ref.watch(expenseRepositoryProvider).getMyReports();
});

final allExpenseReportsProvider =
    FutureProvider.autoDispose<List<ExpenseReportModel>>((ref) async {
  return ref.watch(expenseRepositoryProvider).getReports();
});

final expenseAnalyticsProvider =
    FutureProvider.autoDispose<ExpenseAnalyticsModel>((ref) async {
  return ref.watch(expenseRepositoryProvider).getAnalytics();
});
