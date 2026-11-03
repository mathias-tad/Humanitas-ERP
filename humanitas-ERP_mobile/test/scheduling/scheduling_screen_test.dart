import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:humanitas_erp_mobile/core/providers/auth_provider.dart';
import 'package:humanitas_erp_mobile/features/auth/providers/auth_state.dart';
import 'package:humanitas_erp_mobile/features/auth/repositories/auth_repository.dart';
import 'package:humanitas_erp_mobile/features/attendance/providers/attendance_provider.dart' hide myScheduleProvider;
import 'package:humanitas_erp_mobile/features/attendance/models/attendance_record_model.dart';
import 'package:humanitas_erp_mobile/features/attendance/repositories/attendance_repository.dart';
import 'package:humanitas_erp_mobile/features/scheduling/providers/scheduling_provider.dart';
import 'package:humanitas_erp_mobile/features/scheduling/repositories/scheduling_repository.dart';
import 'package:humanitas_erp_mobile/features/scheduling/models/shift_model.dart';
import 'package:humanitas_erp_mobile/features/scheduling/screens/scheduling_screen.dart';

class _FakeAuthRepository implements AuthRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _TestAuthNotifier extends AuthNotifier {
  _TestAuthNotifier(AuthState initial) : super(_FakeAuthRepository()) {
    state = initial;
  }

  @override
  Future<void> checkAuthStatus() async {}
}

class _FakeAttendanceRepo implements AttendanceRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<List<AttendanceRecordModel>> getMyRecords({int? month, int? year}) async {
    final now = DateTime.now();
    final y = year ?? now.year;
    final m = (month ?? now.month).toString().padLeft(2, '0');
    return [
      AttendanceRecordModel(
        id: 'rec-1',
        userId: 'u1',
        date: '$y-$m-15',
        clockInTime: '09:00:00',
        clockOutTime: '17:30:00',
        status: 'present',
        workHours: 8.5,
      ),
      AttendanceRecordModel(
        id: 'rec-2',
        userId: 'u1',
        date: '$y-$m-16',
        clockInTime: '09:15:00',
        clockOutTime: null,
        status: 'missed_punch',
        workHours: null,
      ),
    ];
  }

  @override
  Future<Map<String, dynamic>> submitMissedPunch({
    required String date,
    required String punchType,
    required String requestedTime,
    required String reason,
  }) async {
    return {'success': true};
  }
}

class _FakeSchedulingRepo implements SchedulingRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  @override
  Future<List<UserScheduleItem>> getUserSchedule(String userId, {String? startDate, String? endDate}) async {
    return [
      UserScheduleItem(
        date: '2026-10-28',
        dayOfWeek: 'Wednesday',
        shift: const ShiftModel(
          id: 's1',
          name: 'Morning Shift',
          startTime: '08:00',
          endTime: '16:30',
          breakMinutes: 60,
        ),
      ),
    ];
  }

  @override
  Future<List<ShiftModel>> getShifts() async {
    return [
      const ShiftModel(
        id: 's1',
        name: 'Standard Day Shift',
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 60,
      ),
    ];
  }
}

Future<Uint8List> _transparentPng() async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawColor(Colors.transparent, BlendMode.src);
  final picture = recorder.endRecording();
  final img = await picture.toImage(1, 1);
  final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
  return byteData!.buffer.asUint8List();
}

ByteData _emptyAssetManifest() {
  const codec = StandardMessageCodec();
  return codec.encodeMessage(<String, dynamic>{})!;
}

String? _decodeAssetKey(ByteData? message) {
  if (message == null) return null;
  try {
    return utf8.decode(message.buffer.asUint8List(
      message.offsetInBytes,
      message.lengthInBytes,
    ));
  } catch (_) {
    return null;
  }
}

void main() {
  late Uint8List fakeImageBytes;

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    GoogleFonts.config.allowRuntimeFetching = false;
    fakeImageBytes = await _transparentPng();

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', (ByteData? message) async {
      final key = _decodeAssetKey(message);
      if (key == null || key == 'AssetManifest.bin' || key == 'AssetManifest.json') {
        return _emptyAssetManifest();
      }
      return fakeImageBytes.buffer.asByteData();
    });
  });

  Widget buildTestWidget() {
    return ProviderScope(
      overrides: [
        authProvider.overrideWith(
          (ref) => _TestAuthNotifier(
            AuthState(
              status: AuthStatus.authenticated,
              user: null,
              permissions: const ['view_my_attendance', 'view_attendance', 'view_roster'],
            ),
          ),
        ),
        attendanceRepositoryProvider.overrideWithValue(_FakeAttendanceRepo()),
        schedulingRepositoryProvider.overrideWithValue(_FakeSchedulingRepo()),
      ],
      child: const MaterialApp(
        home: SchedulingScreen(),
      ),
    );
  }

  testWidgets('SchedulingScreen renders Schedule header, tabs, calendar and legend', (tester) async {
    tester.view.physicalSize = const ui.Size(800, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(buildTestWidget());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    // Verify Title
    expect(find.text('Schedule'), findsOneWidget);

    // Verify Subtabs matching Amazon A to Z WorkForce
    expect(find.text('My Schedule'), findsOneWidget);
    expect(find.text('Timecard'), findsOneWidget);
    expect(find.text('Find Shifts'), findsOneWidget);
    expect(find.text('VTO >'), findsOneWidget);

    // Verify Calendar Weekday Headers
    expect(find.text('Sun'), findsOneWidget);
    expect(find.text('Mon'), findsOneWidget);
    expect(find.text('Tue'), findsOneWidget);
    expect(find.text('Wed'), findsOneWidget);
    expect(find.text('Thu'), findsOneWidget);
    expect(find.text('Fri'), findsOneWidget);
    expect(find.text('Sat'), findsOneWidget);

    // Verify Legend items
    expect(find.text('Punches'), findsOneWidget);
    expect(find.text('Attention'), findsOneWidget);
    expect(find.text('Scheduled shifts'), findsOneWidget);
    expect(find.text('Payday'), findsOneWidget);

    // Verify "Missed a punch?" button exists
    expect(find.text('Missed a punch?'), findsOneWidget);

    // Verify tapping "Missed a punch?" opens the bottom sheet dialog
    await tester.tap(find.text('Missed a punch?'));
    await tester.pumpAndSettle();

    expect(find.text('Punch Type'), findsOneWidget);
    expect(find.text('Requested Time'), findsOneWidget);
    expect(find.text('Submit Request'), findsOneWidget);
  });
}
