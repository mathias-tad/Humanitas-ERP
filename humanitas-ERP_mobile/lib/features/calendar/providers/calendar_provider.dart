import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/calendar_day_model.dart';
import '../repositories/calendar_repository.dart';

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return CalendarRepository(apiClient);
});

typedef MonthYear = ({int month, int year});

final monthlyCalendarProvider =
    FutureProvider.family<MonthlyCalendarData, MonthYear>((ref, param) async {
  final repo = ref.watch(calendarRepositoryProvider);
  return repo.getMonthlyCalendarData(param.month, param.year);
});
