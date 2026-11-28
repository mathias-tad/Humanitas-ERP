import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/features/inventory/models/stocktake_models.dart';

void main() {
  test('reads a stocktake with its progress', () {
    final c = Stocktake.fromJson({
      'id': 'k1', 'name': 'WH/CNT/00001', 'count_type': 'cycle', 'state': 'counting', 'warehouse_name': 'Main', 'location_code': 'A-01',
      'scheduled_date': '2026-12-01T00:00:00.000Z', 'totals': {'lines': 40, 'counted': 10, 'with_variance': 2, 'accuracy': 80},
    });
    expect(c.isOpenForCounting, isTrue);
    expect(c.where, 'Main · A-01 and below');
    expect(c.progressLabel, '10 of 40 counted');
    expect(c.progress, 0.25);
    expect(c.scheduledDate, '2026-12-01');
    expect(c.accuracy, 80);
    final listed = Stocktake.fromJson({'id': 'k2', 'name': 'N', 'state': 'review', 'line_count': 3, 'counted_count': 3});
    expect(listed.progressLabel, '3 of 3 counted');
    expect(const Stocktake(id: 'x', name: 'y').progressLabel, 'Nothing to count yet');
  });

  test('a blind line has no expected quantity and no difference', () {
    final blind = CountLine.fromJson({'id': 'x1', 'product_id': 'p1', 'product_name': 'Chair', 'location_id': 'l1', 'counted_qty': '3'});
    expect(blind.expected, isNull);
    expect(blind.variance, isNull);
    expect(blind.isCounted, isTrue);
    final open = CountLine.fromJson({'id': 'x2', 'product_id': 'p1', 'product_name': 'Chair', 'location_id': 'l1', 'expected_qty': '5', 'counted_qty': '3', 'variance': -2});
    expect(open.variance, -2);
    final uncounted = CountLine.fromJson({'id': 'x3', 'product_id': 'p1', 'product_name': 'Chair', 'location_id': 'l1', 'expected_qty': '5', 'counted_qty': null, 'variance': 0});
    expect(uncounted.isCounted, isFalse);
    expect(uncounted.variance, isNull);
  });

  test('writes differences and quantities plainly', () {
    expect(varianceText(-2), '−2');
    expect(varianceText(2.5), '+2.5');
    expect(varianceText(0), '0');
    expect(varianceText(null), '');
    expect(qtyText(3), '3');
    expect(qtyText(2.5), '2.5');
    expect(qtyText(null), '—');
  });

  test('a scan moves to a location or counts a line', () {
    final where = CountScanResult.fromJson({'kind': 'location', 'location': {'id': 'l1', 'code': 'A-01', 'name': 'Aisle 1'}});
    expect(where.isLocation, isTrue);
    expect(where.locationCode, 'A-01');
    final counted = CountScanResult.fromJson({'kind': 'line', 'line': {'id': 'x1', 'product_id': 'p1', 'product_name': 'Chair', 'location_id': 'l1', 'counted_qty': 4}});
    expect(counted.isLocation, isFalse);
    expect(counted.line?.counted, 4);
    final page = CountLinePage.fromJson({'data': [], 'meta': {'page': 1, 'limit': 100, 'total': 150}});
    expect(page.hasMore, isTrue);
  });
}
