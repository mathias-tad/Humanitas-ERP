import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/features/devices/models/device_model.dart';
import 'package:humanitas_erp_mobile/features/devices/providers/devices_provider.dart';
import 'package:humanitas_erp_mobile/features/devices/screens/devices_screen.dart';

void main() {
  group('DevicesScreen', () {
    Widget buildSubject({
      AsyncValue<List<DeviceModel>> devicesValue =
          const AsyncValue.loading(),
      AsyncValue<Map<String, dynamic>> serverInfoValue =
          const AsyncValue.data({}),
    }) {
      return ProviderScope(
        overrides: [
          devicesProvider.overrideWith((ref) async {
            if (devicesValue is AsyncData<List<DeviceModel>>) {
              return devicesValue.value;
            }
            if (devicesValue is AsyncError<List<DeviceModel>>) {
              throw devicesValue.error;
            }
            // Simulate loading by returning an incomplete future
            return Completer<List<DeviceModel>>().future;
          }),
          serverInfoProvider.overrideWith((ref) async => const {}),
        ],
        child: const MaterialApp(home: DevicesScreen()),
      );
    }

    testWidgets('shows loading indicator when loading', (tester) async {
      await tester.pumpWidget(buildSubject());
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows empty state when no devices', (tester) async {
      await tester.pumpWidget(
        buildSubject(devicesValue: const AsyncData([])),
      );
      await tester.pumpAndSettle();
      expect(find.text('No authorized devices yet'), findsOneWidget);
    });

    testWidgets('shows device cards for authorized devices', (tester) async {
      final device = DeviceModel(
        id: '1',
        serialNumber: 'SN001',
        alias: 'Main Gate',
        isAuthorized: true,
        isOnline: true,
      );
      await tester.pumpWidget(
        buildSubject(devicesValue: AsyncData([device])),
      );
      await tester.pumpAndSettle();
      expect(find.text('Main Gate'), findsOneWidget);
    });

    testWidgets('shows pending authorization section when devices pending',
        (tester) async {
      final device = DeviceModel(
        id: '2',
        serialNumber: 'SN002',
        alias: 'Lobby Terminal',
        isAuthorized: false,
        isOnline: false,
      );
      await tester.pumpWidget(
        buildSubject(devicesValue: AsyncData([device])),
      );
      await tester.pumpAndSettle();
      expect(find.text('Pending Authorization'), findsOneWidget);
      expect(find.text('Lobby Terminal'), findsOneWidget);
    });

    testWidgets('shows stats row with correct labels', (tester) async {
      await tester.pumpWidget(
        buildSubject(devicesValue: const AsyncData([])),
      );
      await tester.pumpAndSettle();
      expect(find.text('Total'), findsOneWidget);
      expect(find.text('Online'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
      expect(find.text('Offline'), findsOneWidget);
    });
  });
}
