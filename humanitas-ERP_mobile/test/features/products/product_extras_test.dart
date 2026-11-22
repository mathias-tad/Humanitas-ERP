import 'package:flutter_test/flutter_test.dart';
import 'package:humanitas_erp_mobile/features/products/models/product_extras_models.dart';
import 'package:humanitas_erp_mobile/features/products/models/product_models.dart';

void main() {
  group('media and GS1 helpers', () {
    test('builds picture addresses from the API address', () {
      expect(resolveMediaUrl('https://api.example.com/api/v1', '/uploads/products/t1/img.jpg'), 'https://api.example.com/uploads/products/t1/img.jpg');
      expect(resolveMediaUrl('https://api.example.com/api/v1/', '/uploads/a.png'), 'https://api.example.com/uploads/a.png');
      expect(resolveMediaUrl('https://x', 'https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
      expect(resolveMediaUrl('https://x', null), '');
    });

    test('validates GTINs like the API', () {
      expect(isValidGtin('6291041500213'), isTrue);
      expect(isValidGtin('6291041500214'), isFalse);
      expect(isValidGtin('16291041500210'), isTrue);
    });

    test('checks order quantities and describes package scans', () {
      expect(quantityProblem(5, 10, null, unit: 'pc'), 'The minimum order is 10 pc');
      expect(quantityProblem(13, 12, 6), 'Sold in multiples of 6');
      expect(quantityProblem(18, 12, 6), isNull);
      expect(scannedQuantityText('Box of 12', 12, 'pc'), 'Box of 12 scanned: 12 pc');
      expect(scannedQuantityText(null, 1, 'pc'), isNull);
    });
  });

  group('product completion fields', () {
    final json = <String, dynamic>{
      'id': 'p1', 'name': 'Gift basket', 'item_code': 'P1', 'uom_id': 'pcs', 'uom_name': 'Units', 'uom_symbol': 'pc',
      'purchase_uom_id': 'pcs', 'sales_uom_id': 'box', 'sales_uom_name': 'Box', 'sales_uom_symbol': 'bx',
      'min_sale_qty': '2.0000', 'sale_qty_step': '2.0000', 'composition': 'kit', 'is_below_cost': true, 'media_count': 3,
      'image_url': '/uploads/products/t1/img.jpg',
      'packagings': [{'name': 'Case of 6', 'level': 'case', 'quantity': '6.0000', 'gtin': '16291041500210'}],
      'barcodes': [{'barcode': '2000000000428', 'is_primary': true, 'is_generated': true}],
    };

    test('reads units, order quantities, kit, pictures and packaging', () {
      final p = Product.fromJson(json);
      expect(p.salesUnitLabel, 'bx');
      expect(p.minSaleQty, 2);
      expect(p.saleQtyStep, 2);
      expect(p.compositionLabel, 'Kit');
      expect(p.isBelowCost, isTrue);
      expect(p.packagings.single.quantity, 6);
      expect(p.packagings.single.levelLabel, 'Case / box');
      expect(p.barcodes.single.isGenerated, isTrue);
    });

    test('the form sends the sales unit and quantities and keeps unchanged barcodes out', () {
      final p = Product.fromJson(json);
      final f = ProductFormData.fromProduct(p);
      final body = f.toJson();
      expect(body['sales_uom_id'], 'box');
      expect(body['min_sale_qty'], 2);
      expect(body['sale_qty_step'], 2);
      expect(f.barcodesChangedFrom(p), isFalse);
      f.barcodes.add(const ProductBarcode(barcode: '6291041500213'));
      expect(f.barcodesChangedFrom(p), isTrue);
      expect(ProductFormData(name: 'x', minSaleQty: '-1').validate().keys, contains('min_sale_qty'));
    });

    test('reads kit contents and the catalog report', () {
      final c = ProductComposition.fromJson({
        'composition': 'kit', 'components_price': 510, 'components_cost': 320, 'sales_price': 500,
        'components': [{'component_id': 'a', 'name': 'Coffee', 'quantity': '2', 'sales_price': '180'}],
      });
      expect(c.kitSaving, 10);
      expect(c.components.single.quantity, 2);
      const g = ComboGroup(name: 'Drink', minChoices: 0, maxChoices: 2);
      expect(g.ruleText, 'Up to 2');
      final r = CatalogReport.fromJson({
        'totals': {'products': 10, 'variants': 4, 'sellable': 12}, 'completeness': 75,
        'issues': [{'key': 'no_barcode', 'label': 'No barcode', 'count': 3}],
        'margins': {'avg_margin': '31.5', 'lowest': [{'name': 'Teff', 'margin': '-4.0'}]},
      });
      expect(r.completeness, 75);
      expect(r.issues.single.count, 3);
      expect(r.avgMargin, 31.5);
      expect(r.lowestMargins.single.margin, -4);
    });
  });
}
