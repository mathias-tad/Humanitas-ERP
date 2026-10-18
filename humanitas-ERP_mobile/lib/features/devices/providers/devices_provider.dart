import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/device_model.dart';
import '../repositories/devices_repository.dart';

final devicesRepositoryProvider = Provider<DevicesRepository>((ref) {
  return DevicesRepository(ref.watch(apiClientProvider));
});

final devicesProvider = FutureProvider<List<DeviceModel>>((ref) async {
  return ref.watch(devicesRepositoryProvider).getDevices();
});

final serverInfoProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  return ref.watch(devicesRepositoryProvider).getServerInfo();
});
