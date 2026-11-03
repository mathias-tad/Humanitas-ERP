import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:humanitas_erp_mobile/core/models/calendar_event_model.dart';
import 'package:humanitas_erp_mobile/features/calendar/providers/calendar_provider.dart';
import 'package:humanitas_erp_mobile/features/calendar/repositories/calendar_repository.dart';
import 'package:humanitas_erp_mobile/features/calendar/screens/calendar_screen.dart';

class _FakeCalendarRepository implements CalendarRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<List<Map<String, dynamic>>> getSources() async => [];

  @override
  Future<List<CalendarEventModel>> getEvents({
    required DateTime start,
    required DateTime end,
    List<String>? sources,
    String? companyId,
    String? branchId,
  }) async => [];
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  group('CalendarScreen', () {
    testWidgets('renders Unified Calendar screen with month navigation', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            calendarRepositoryProvider.overrideWithValue(_FakeCalendarRepository()),
          ],
          child: const MaterialApp(home: CalendarScreen()),
        ),
      );

      await tester.pump();
      expect(find.text('Unified Calendar'), findsOneWidget);
      expect(find.text('All Modules'), findsOneWidget);
      expect(find.byIcon(Icons.today), findsOneWidget);
    });
  });
}
