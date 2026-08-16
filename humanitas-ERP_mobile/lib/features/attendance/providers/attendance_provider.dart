import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/attendance_record_model.dart';
import '../models/schedule_model.dart';
import '../repositories/attendance_repository.dart';

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AttendanceRepository(apiClient);
});

final myRecordsProvider = FutureProvider.family<List<AttendanceRecordModel>, ({int? month, int? year})>(
  (ref, arg) async {
    final repo = ref.watch(attendanceRepositoryProvider);
    return await repo.getMyRecords(month: arg.month, year: arg.year);
  },
);

final myScheduleProvider = FutureProvider<ScheduleModel>((ref) async {
  final repo = ref.watch(attendanceRepositoryProvider);
  return await repo.getMySchedule();
});
