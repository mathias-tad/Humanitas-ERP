import 'package:flutter_test/flutter_test.dart';

import 'package:humanitas_erp_mobile/features/products/models/product_models.dart';

void main() {
  final productJson = <String, dynamic>{
    'id': 'p1',
    'name': 'Teff flour 1kg',
    'sku': 'TEFF-1',
    'item_code': 'P0000001',
    'product_type': 'storable',
    'category_id': 'c1',
    'category_name': 'Food / Grains',
    'uom_id': 'kg',
    'uom_name': 'kg',
    'uom_symbol': 'kg',
    'uom_mor_code': 'KLG',
    'purchase_uom_id': 'qt',
    'sales_price': '120.0000',
    'cost_price': '90.5000',
    'tax_code': 'VATEX',
    'excise_rate': null,
    'effective_excise_rate': '10.0000',
    'nature_of_supply': 'goods',
    'is_active': true,
    'barcodes': [
      {'barcode': '629', 'quantity': '1.0000', 'is_primary': false},
      {'barcode': '630', 'quantity': '12.0000', 'is_primary': true, 'packaging': 'Box'},
    ],
    'eims_ready': false,
    'eims_issues': ['unit'],
  };

  group('Product.fromJson', () {
    test('reads the API row, including MoR fields', () {
      final p = Product.fromJson(productJson);
      expect(p.itemCode, 'P0000001');
      expect(p.salesPrice, 120);
      expect(p.costPrice, 90.5);
      expect(p.taxCode, 'VATEX');
      expect(p.exciseRate, isNull);
      expect(p.effectiveExciseRate, 10);
      expect(p.uomMorCode, 'KLG');
      expect(p.typeLabel, 'Stock item');
      expect(p.primaryBarcode, '630');
      expect(p.barcodes.last.packaging, 'Box');
      expect(p.eimsReady, isFalse);
      expect(p.eimsIssues, ['unit']);
    });

    test('pages know whether more rows exist', () {
      final page = ProductPage.fromJson({
        'data': [productJson],
        'meta': {'page': 1, 'limit': 25, 'total': 30},
      });
      expect(page.items, hasLength(1));
      expect(page.hasMore, isTrue);
    });
  });

  group('ProductFormData', () {
    test('starts from a product and builds the API payload', () {
      final f = ProductFormData.fromProduct(Product.fromJson(productJson));
      expect(f.salesPrice, '120');
      expect(f.costPrice, '90.5');
      expect(f.exciseRate, '');
      final json = f.toJson();
      expect(json['tax_code'], 'VATEX');
      expect(json['item_code'], 'P0000001');
      expect(json['excise_rate'], isNull);
      expect(json['harmonization_code'], isNull);
      expect(json.containsKey('tax_rate'), isFalse);
      expect((json['barcodes'] as List).length, 2);
    });

    test('leaves the item code out of a new product so the server generates one', () {
      final json = ProductFormData(name: ' Buna ').toJson();
      expect(json['name'], 'Buna');
      expect(json.containsKey('item_code'), isFalse);
      expect(json['tax_code'], 'VAT15');
      expect(json['sales_price'], 0);
    });

    test('enforces the MoR limits and the API rules', () {
      final f = ProductFormData(
        name: ' ',
        sku: 'has space',
        salesPrice: '-1',
        taxCode: 'VAT5',
        itemCode: 'ITEM-CODE-TOO-LONG',
        harmonizationCode: '22-03',
        exciseRate: '600',
        invoiceDescription: 'x' * 101,
        barcodes: [const ProductBarcode(barcode: '1'), const ProductBarcode(barcode: '1')],
      );
      expect(f.validate().keys.toSet(), {
        'name', 'sku', 'sales_price', 'tax_code', 'item_code', 'harmonization_code', 'excise_rate',
        'invoice_description', 'barcodes',
      });
      final ok = ProductFormData(name: 'Beer', itemCode: 'BR-330', harmonizationCode: '22030000', exciseRate: '25');
      expect(ok.validate(), isEmpty);
    });

    test('purchase unit must be the same kind as the sales unit', () {
      const uoms = [
        UomCategory(id: 'weight', name: 'Weight', units: [Uom(id: 'kg', name: 'kg'), Uom(id: 'qt', name: 'Quintal')]),
        UomCategory(id: 'unit', name: 'Unit', units: [Uom(id: 'pcs', name: 'Units')]),
      ];
      expect(ProductFormData(name: 'x', uomId: 'kg', purchaseUomId: 'qt').validate(uoms: uoms), isEmpty);
      expect(ProductFormData(name: 'x', uomId: 'kg', purchaseUomId: 'pcs').validate(uoms: uoms).keys, ['purchase_uom_id']);
    });

    test('asks for an invoice description when the name is too long for MoR', () {
      expect(ProductFormData(name: 'n' * 101).needsInvoiceDescription, isTrue);
      expect(ProductFormData(name: 'n' * 101, invoiceDescription: 'short').needsInvoiceDescription, isFalse);
    });
  });

  group('helpers', () {
    test('ProductQuery equality keys the list provider', () {
      expect(const ProductQuery(q: 'a'), const ProductQuery(q: 'a'));
      expect(const ProductQuery().copyWith(eims: 'not_ready').toParams()['eims'], 'not_ready');
      expect(const ProductQuery(eims: 'not_ready').copyWith(clearEims: true).eims, isNull);
      expect(const ProductQuery(q: '  ').toParams().containsKey('q'), isFalse);
    });

    test('unit ratios and timeline values read naturally', () {
      const kg = Uom(id: 'kg', name: 'kg', isReference: true);
      expect(ratioText(const Uom(id: 'qt', name: 'Quintal', ratio: 100), kg), '1 Quintal = 100 kg');
      expect(ratioText(kg, kg), 'Reference unit');
      expect(formatTimelineValue(null), '—');
      expect(formatTimelineValue(true), 'Yes');
      expect(formatTimelineValue(['a', 'b']), 'a, b');
    });

    test('timeline events say where a change was made', () {
      final mobile = TimelineEvent.fromJson({
        'id': 'e1',
        'event_type': 'updated',
        'client_platform': 'mobile_app',
        'client_info': {'os': 'Android', 'appVersion': '1.0.0'},
        'occurred_at': '2026-11-21T10:00:00Z',
      });
      expect(mobile.clientLabel, 'Mobile app · Android 1.0.0');
      expect(mobile.occurredAt, isNotNull);
      final web = TimelineEvent.fromJson({
        'id': 'e2',
        'event_type': 'created',
        'client_platform': 'web',
        'client_info': {'browser': 'Chrome', 'os': 'Windows'},
      });
      expect(web.clientLabel, 'Web · Chrome on Windows');
    });
  });
}
