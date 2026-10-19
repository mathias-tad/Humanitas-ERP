import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/shift_model.dart';
import '../models/shift_pattern_model.dart';
import '../repositories/scheduling_repository.dart';

final schedulingRepositoryProvider = Provider<SchedulingRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return SchedulingRepository(client);
});

// ── Existing providers ────────────────────────────────────────────────────

final allShiftsProvider = FutureProvider<List<ShiftModel>>((ref) async {
  final repo = ref.watch(schedulingRepositoryProvider);
  return repo.getShifts();
});

final myScheduleProvider = FutureProvider<List<UserScheduleItem>>((ref) async {
  final repo = ref.watch(schedulingRepositoryProvider);
  final user = ref.watch(authProvider).user;
  if (user == null || user.id.isEmpty) return [];

  final now = DateTime.now();
  final start = now.subtract(const Duration(days: 7)).toIso8601String().split('T').first;
  final end = now.add(const Duration(days: 14)).toIso8601String().split('T').first;

  return repo.getUserSchedule(user.id, startDate: start, endDate: end);
});

// ── Admin Roster providers ────────────────────────────────────────────────

/// All shift patterns configured for the tenant.
final allPatternsProvider = FutureProvider<List<ShiftPatternModel>>((ref) async {
  return ref.watch(schedulingRepositoryProvider).getPatterns();
});

/// All users with their current shift assignment (for admin roster view).
final rosterUsersProvider = FutureProvider<List<UserWithAssignmentModel>>((ref) async {
  return ref.watch(schedulingRepositoryProvider).getUsersWithAssignments();
});
