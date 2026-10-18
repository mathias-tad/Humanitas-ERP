import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/attendance_record_model.dart';
import '../repositories/admin_attendance_repository.dart';

final adminAttendanceRepositoryProvider = Provider<AdminAttendanceRepository>((ref) {
  return AdminAttendanceRepository(ref.watch(apiClientProvider));
});

final allRecordsProvider = FutureProvider.family<List<AttendanceRecordModel>, ({int month, int year})>(
  (ref, arg) async {
    final repo = ref.watch(adminAttendanceRepositoryProvider);
    return repo.getAllRecords(month: arg.month, year: arg.year);
  },
);
