import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/providers.dart';
import '../models/stocktake_models.dart';
import '../repositories/stocktake_repository.dart';

final stocktakeRepositoryProvider = Provider<StocktakeRepository>((ref) => StocktakeRepository(ref.watch(apiClientProvider)));

final openStocktakesProvider = FutureProvider.autoDispose<List<Stocktake>>((ref) => ref.watch(stocktakeRepositoryProvider).open());

final stocktakeProvider = FutureProvider.autoDispose.family<Stocktake, String>((ref, id) => ref.watch(stocktakeRepositoryProvider).get(id));

/// The lines of one count, at one location or all, filtered.
class CountLinesQuery {
  final String countId;
  final String? locationId;
  final String? filter;

  const CountLinesQuery(this.countId, {this.locationId, this.filter});

  @override
  bool operator ==(Object other) => other is CountLinesQuery && other.countId == countId && other.locationId == locationId && other.filter == filter;

  @override
  int get hashCode => Object.hash(countId, locationId, filter);
}

final countLinesProvider = FutureProvider.autoDispose.family<CountLinePage, CountLinesQuery>(
  (ref, q) => ref.watch(stocktakeRepositoryProvider).lines(q.countId, filter: q.filter, locationId: q.locationId),
);
