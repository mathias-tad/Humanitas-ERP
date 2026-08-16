import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/providers.dart';
import '../models/event_model.dart';
import '../repositories/events_repository.dart';

final eventsRepositoryProvider = Provider<EventsRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return EventsRepository(apiClient);
});

final eventsProvider = FutureProvider<List<EventModel>>((ref) async {
  final repo = ref.watch(eventsRepositoryProvider);
  return await repo.getEvents();
});
