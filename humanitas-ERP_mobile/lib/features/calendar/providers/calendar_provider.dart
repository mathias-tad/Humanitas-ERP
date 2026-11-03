import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/calendar_event_model.dart';
import '../../../core/providers/providers.dart';
import '../repositories/calendar_repository.dart';

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return CalendarRepository(apiClient);
});

class CalendarState {
  final List<CalendarEventModel> events;
  final List<Map<String, dynamic>> sources;
  final DateTime selectedDate;
  final DateTime focusedMonth;
  final String activeCategory;
  final List<String> activeSources;
  final bool isLoading;
  final String? errorMessage;

  CalendarState({
    this.events = const [],
    this.sources = const [],
    DateTime? selectedDate,
    DateTime? focusedMonth,
    this.activeCategory = 'all',
    this.activeSources = const [],
    this.isLoading = false,
    this.errorMessage,
  })  : selectedDate = selectedDate ?? DateTime.now(),
        focusedMonth = focusedMonth ?? DateTime(DateTime.now().year, DateTime.now().month, 1);

  CalendarState copyWith({
    List<CalendarEventModel>? events,
    List<Map<String, dynamic>>? sources,
    DateTime? selectedDate,
    DateTime? focusedMonth,
    String? activeCategory,
    List<String>? activeSources,
    bool? isLoading,
    String? errorMessage,
  }) {
    return CalendarState(
      events: events ?? this.events,
      sources: sources ?? this.sources,
      selectedDate: selectedDate ?? this.selectedDate,
      focusedMonth: focusedMonth ?? this.focusedMonth,
      activeCategory: activeCategory ?? this.activeCategory,
      activeSources: activeSources ?? this.activeSources,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }

  List<CalendarEventModel> get filteredEvents {
    return events.filter((ev) {
      if (activeCategory != 'all' && ev.category != activeCategory) {
        return false;
      }
      return true;
    }).toList();
  }

  List<CalendarEventModel> getEventsForDay(DateTime day) {
    return filteredEvents.where((ev) {
      final evStart = DateTime(ev.start.year, ev.start.month, ev.start.day);
      final evEnd = ev.end != null
          ? DateTime(ev.end!.year, ev.end!.month, ev.end!.day)
          : evStart;
      final target = DateTime(day.year, day.month, day.day);
      return !target.isBefore(evStart) && !target.isAfter(evEnd);
    }).toList();
  }
}

extension on List<CalendarEventModel> {
  Iterable<CalendarEventModel> filter(bool Function(CalendarEventModel) test) sync* {
    for (final element in this) {
      if (test(element)) yield element;
    }
  }
}

class CalendarNotifier extends StateNotifier<CalendarState> {
  final CalendarRepository _repository;

  CalendarNotifier(this._repository) : super(CalendarState()) {
    init();
  }

  Future<void> init() async {
    await loadSources();
    await loadEvents();
  }

  Future<void> loadSources() async {
    try {
      final sources = await _repository.getSources();
      state = state.copyWith(sources: sources);
    } catch (_) {}
  }

  Future<void> loadEvents() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final month = state.focusedMonth;
      final start = DateTime(month.year, month.month - 1, 1);
      final end = DateTime(month.year, month.month + 2, 0);

      final events = await _repository.getEvents(
        start: start,
        end: end,
        sources: state.activeSources.isNotEmpty ? state.activeSources : null,
      );

      state = state.copyWith(events: events, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  void selectDate(DateTime date) {
    state = state.copyWith(selectedDate: date);
  }

  void nextMonth() {
    final cur = state.focusedMonth;
    final next = DateTime(cur.year, cur.month + 1, 1);
    state = state.copyWith(focusedMonth: next);
    loadEvents();
  }

  void prevMonth() {
    final cur = state.focusedMonth;
    final prev = DateTime(cur.year, cur.month - 1, 1);
    state = state.copyWith(focusedMonth: prev);
    loadEvents();
  }

  void goToToday() {
    final now = DateTime.now();
    state = state.copyWith(
      focusedMonth: DateTime(now.year, now.month, 1),
      selectedDate: now,
    );
    loadEvents();
  }

  void setCategory(String category) {
    state = state.copyWith(activeCategory: category);
  }

  void toggleSource(String sourceId) {
    final current = List<String>.from(state.activeSources);
    if (current.contains(sourceId)) {
      current.remove(sourceId);
    } else {
      current.add(sourceId);
    }
    state = state.copyWith(activeSources: current);
    loadEvents();
  }

  Future<bool> createEvent(Map<String, dynamic> data) async {
    try {
      await _repository.createEvent(data);
      await loadEvents();
      return true;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString().replaceAll('Exception: ', ''));
      return false;
    }
  }

  Future<bool> deleteEvent(String id) async {
    try {
      await _repository.deleteEvent(id);
      await loadEvents();
      return true;
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString().replaceAll('Exception: ', ''));
      return false;
    }
  }
}

final calendarProvider = StateNotifierProvider<CalendarNotifier, CalendarState>((ref) {
  final repo = ref.watch(calendarRepositoryProvider);
  return CalendarNotifier(repo);
});
