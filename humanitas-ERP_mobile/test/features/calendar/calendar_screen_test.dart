import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/features/calendar/models/calendar_day_model.dart';
import 'package:humanitas_erp_mobile/features/calendar/providers/calendar_provider.dart';
import 'package:humanitas_erp_mobile/features/calendar/screens/calendar_screen.dart';

MonthlyCalendarData _emptyCalendar(int month, int year) {
  return MonthlyCalendarData(
    month: month,
    year: year,
    holidays: [],
    attendance: [],
  );
}

Widget buildSubject({
  AsyncValue<MonthlyCalendarData>? calendarValue,
}) {
  final now = DateTime.now();
  final monthYear = (month: now.month, year: now.year);

  return ProviderScope(
    overrides: [
      monthlyCalendarProvider(monthYear).overrideWith((ref) async {
        final value =
            calendarValue ?? AsyncValue.data(_emptyCalendar(now.month, now.year));
        if (value is AsyncData<MonthlyCalendarData>) return value.value;
        if (value is AsyncError<MonthlyCalendarData>) throw value.error;
        return Completer<MonthlyCalendarData>().future;
      }),
    ],
    child: const MaterialApp(home: CalendarScreen()),
  );
}

void main() {
  group('CalendarScreen', () {
    testWidgets('shows loading indicator when calendar data is loading',
        (tester) async {
      await tester.pumpWidget(
          buildSubject(calendarValue: const AsyncValue.loading()));
      await tester.pump(); // one frame to start build
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows month navigation buttons', (tester) async {
      final now = DateTime.now();
      await tester.pumpWidget(buildSubject(
          calendarValue: AsyncValue.data(_emptyCalendar(now.month, now.year))));
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.chevron_left_rounded), findsOneWidget);
      expect(find.byIcon(Icons.chevron_right_rounded), findsOneWidget);
    });

    testWidgets('shows stats row with correct labels', (tester) async {
      final now = DateTime.now();
      await tester.pumpWidget(buildSubject(
          calendarValue: AsyncValue.data(_emptyCalendar(now.month, now.year))));
      await tester.pumpAndSettle();
      expect(find.text('Present'), findsOneWidget);
      expect(find.text('Absent'), findsOneWidget);
      expect(find.text('Late'), findsOneWidget);
      expect(find.text('Holidays'), findsOneWidget);
    });

    testWidgets('shows days-of-week header row', (tester) async {
      final now = DateTime.now();
      await tester.pumpWidget(buildSubject(
          calendarValue: AsyncValue.data(_emptyCalendar(now.month, now.year))));
      await tester.pumpAndSettle();
      expect(find.text('Mon'), findsOneWidget);
      expect(find.text('Sun'), findsOneWidget);
    });

    testWidgets('shows error message when calendar fails to load',
        (tester) async {
      await tester.pumpWidget(buildSubject(
          calendarValue:
              AsyncValue.error('Network error', StackTrace.empty)));
      await tester.pumpAndSettle();
      expect(find.textContaining('Failed'), findsOneWidget);
    });
  });
}
