import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:humanitas_erp_mobile/core/models/notification_model.dart';
import 'package:humanitas_erp_mobile/core/providers/providers.dart';
import 'package:humanitas_erp_mobile/features/notifications/models/notification_preference_model.dart';
import 'package:humanitas_erp_mobile/features/notifications/repositories/notification_repository.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return NotificationRepository(apiClient);
});

final notificationPreferencesProvider =
    FutureProvider.autoDispose<List<NotificationPreferenceModel>>((ref) async {
  final repo = ref.watch(notificationRepositoryProvider);
  return repo.getPreferences();
});

final notificationsProvider = StateNotifierProvider<NotificationsNotifier,
    AsyncValue<List<NotificationModel>>>((ref) {
  return NotificationsNotifier(ref.watch(notificationRepositoryProvider));
});

class NotificationsNotifier
    extends StateNotifier<AsyncValue<List<NotificationModel>>> {
  final NotificationRepository _repo;
  NotificationsNotifier(this._repo) : super(const AsyncValue.loading()) {
    fetch();
  }

  Future<void> fetch() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repo.getNotifications();
      state = AsyncValue.data(list);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> markAsRead(String id) async {
    await _repo.markAsRead(id);
    fetch();
  }

  Future<void> markAllAsRead() async {
    await _repo.markAllAsRead();
    fetch();
  }
}

final unreadNotificationsCountProvider = FutureProvider<int>((ref) async {
  return ref.watch(notificationRepositoryProvider).getUnreadCount();
});
