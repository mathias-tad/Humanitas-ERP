import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/payslip_model.dart';
import '../../../core/providers/providers.dart';
import '../repositories/payroll_repository.dart';
import '../repositories/loan_repository.dart';
import '../repositories/per_diem_repository.dart';
import '../../../core/models/loan_model.dart';
import '../../../core/models/per_diem_model.dart';

// ── Repositories ──────────────────────────────────────────────────────────────
final payrollRepositoryProvider = Provider<PayrollRepository>((ref) {
  return PayrollRepository(ref.watch(apiClientProvider));
});

final loanRepositoryProvider = Provider<LoanRepository>((ref) {
  return LoanRepository(ref.watch(apiClientProvider));
});

final perDiemRepositoryProvider = Provider<PerDiemRepository>((ref) {
  return PerDiemRepository(ref.watch(apiClientProvider));
});

// ── Payslips ──────────────────────────────────────────────────────────────────
final payslipsProvider =
    StateNotifierProvider<PayslipsNotifier, AsyncValue<List<PayslipModel>>>((ref) {
  return PayslipsNotifier(ref.watch(payrollRepositoryProvider));
});

class PayslipsNotifier extends StateNotifier<AsyncValue<List<PayslipModel>>> {
  final PayrollRepository _repo;
  PayslipsNotifier(this._repo) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repo.getMyPayslips();
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

// ── Loans ─────────────────────────────────────────────────────────────────────
final loansProvider =
    StateNotifierProvider<LoansNotifier, AsyncValue<List<LoanModel>>>((ref) {
  return LoansNotifier(ref.watch(loanRepositoryProvider));
});

class LoansNotifier extends StateNotifier<AsyncValue<List<LoanModel>>> {
  final LoanRepository _repo;
  LoansNotifier(this._repo) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repo.getMyLoans();
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final loanConfigProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  return ref.watch(loanRepositoryProvider).getLoanConfig();
});

// ── Per Diem ──────────────────────────────────────────────────────────────────
final perDiemProvider =
    StateNotifierProvider<PerDiemNotifier, AsyncValue<List<PerDiemModel>>>((ref) {
  return PerDiemNotifier(ref.watch(perDiemRepositoryProvider));
});

class PerDiemNotifier extends StateNotifier<AsyncValue<List<PerDiemModel>>> {
  final PerDiemRepository _repo;
  PerDiemNotifier(this._repo) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch({int? year}) async {
    state = const AsyncValue.loading();
    try {
      final list = await _repo.getMyClaims(year: year);
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
