import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../core/api/api_constants.dart';
import '../../../core/providers/providers.dart';
import '../providers/devices_provider.dart';

final devicesSocketProvider = Provider<DevicesSocketService>((ref) {
  final service = DevicesSocketService(ref);
  ref.onDispose(() => service.disconnect());
  return service;
});

class DevicesSocketService {
  final Ref _ref;
  io.Socket? _socket;
  bool _isConnecting = false;
  final ValueNotifier<bool> isConnected = ValueNotifier<bool>(false);

  DevicesSocketService(this._ref);

  Future<void> initSocket() async {
    if (_socket != null && _socket!.connected) return;
    if (_isConnecting) return;
    _isConnecting = true;

    final token = await _ref.read(secureStorageProvider).getAccessToken();
    if (token == null || token.isEmpty) {
      _isConnecting = false;
      return;
    }

    final baseHost =
        ApiConstants.defaultBaseUrl.replaceAll(RegExp(r'/api/v1/?$'), '');
    final socketUrl = '$baseHost/devices';

    debugPrint('[DevicesSocket] Connecting to: $socketUrl');

    _socket = io.io(
      socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(10)
          .setReconnectionDelay(1000)
          .build(),
    );

    _socket!.onConnect((_) {
      _isConnecting = false;
      isConnected.value = true;
      debugPrint('[DevicesSocket] Connected successfully to /devices');
    });

    _socket!.onConnectError((err) {
      _isConnecting = false;
      isConnected.value = false;
      debugPrint('[DevicesSocket] Connection error: $err');
    });

    _socket!.onDisconnect((_) {
      _isConnecting = false;
      isConnected.value = false;
      debugPrint('[DevicesSocket] Disconnected from /devices');
    });

    // ── Incoming Real-time Events ──────────────────────────────────────────
    _socket!.on('device_registered', (data) {
      debugPrint('[DevicesSocket] device_registered: $data');
      _ref.invalidate(devicesProvider);
    });

    _socket!.on('device_status_changed', (data) {
      debugPrint('[DevicesSocket] device_status_changed: $data');
      _ref.invalidate(devicesProvider);
    });

    _socket!.on('device_authorized', (data) {
      debugPrint('[DevicesSocket] device_authorized: $data');
      _ref.invalidate(devicesProvider);
    });

    _socket!.on('device_revoked', (data) {
      debugPrint('[DevicesSocket] device_revoked: $data');
      _ref.invalidate(devicesProvider);
    });

    _socket!.on('device_deleted', (data) {
      debugPrint('[DevicesSocket] device_deleted: $data');
      _ref.invalidate(devicesProvider);
    });

    _socket!.on('device_sync', (data) {
      debugPrint('[DevicesSocket] device_sync: $data');
      _ref.invalidate(devicesProvider);
    });

    _socket!.on('biometric_enrolled', (data) {
      debugPrint('[DevicesSocket] biometric_enrolled: $data');
      _ref.invalidate(devicesProvider);
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    isConnected.value = false;
    _isConnecting = false;
  }
}
