import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/features/inventory/models/stock_models.dart';

void main() {
  test('reads a stock page, with or without the money columns', () {
    final page = StockPage.fromJson({
      'data': [
        {'id': 'q1', 'product_id': 'p1', 'product_name': 'Teff', 'location_id': 'l1', 'location_code': 'WH/STOCK', 'quantity': '12.5000', 'free_quantity': '10', 'stock_value': '125'},
        {'id': 'q2', 'product_id': 'p2', 'product_name': 'Oil', 'location_id': 'l1', 'location_code': 'WH/STOCK', 'quantity': '-2', 'free_quantity': '-2'},
      ],
      'meta': {'page': 1, 'limit': 40, 'total': 41},
    });
    expect(page.lines.length, 2);
    expect(page.lines.first.quantity, 12.5);
    expect(page.lines.first.value, 125);
    expect(page.lines.last.value, isNull);
    expect(page.hasMore, isTrue);
    expect(qtyText(12.5), '12.5');
    expect(qtyText(3), '3');
  });
}
