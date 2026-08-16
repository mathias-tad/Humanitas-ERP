import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/notification_model.dart';
import '../../../core/providers/providers.dart';
import '../repositories/notification_repository.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return NotificationRepository(ref.watch(apiClientProvider));
});

final notificationsProvider =
    StateNotifierProvider<NotificationsNotifier, AsyncValue<List<NotificationModel>>>((ref) {
  return NotificationsNotifier(ref.watch(notificationRepositoryProvider));
});

class NotificationsNotifier extends StateNotifier<AsyncValue<List<NotificationModel>>> {
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
