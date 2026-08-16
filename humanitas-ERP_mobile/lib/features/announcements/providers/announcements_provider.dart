import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/announcement_model.dart';
import '../repositories/announcements_repository.dart';

final announcementsRepositoryProvider = Provider<AnnouncementsRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AnnouncementsRepository(apiClient);
});

final announcementsProvider = FutureProvider<List<AnnouncementModel>>((ref) async {
  final repo = ref.watch(announcementsRepositoryProvider);
  return await repo.getAnnouncements();
});
