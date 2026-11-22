/// A product's price on every active price list: GET /price-lists/for-product/:id (featureslist §1).
double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;

class PriceListRef {
  final String id;
  final String name;
  final String currency;
  final bool isDefault;

  const PriceListRef({required this.id, required this.name, this.currency = 'ETB', this.isDefault = false});

  factory PriceListRef.fromJson(Map<String, dynamic> json) => PriceListRef(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        currency: json['currency']?.toString() ?? 'ETB',
        isDefault: json['is_default'] == true,
      );
}

class PriceCell {
  final double price;

  /// 'rule' when a price list rule set the price, 'base' when the product's sales price applies.
  final String source;

  const PriceCell({required this.price, this.source = 'base'});

  bool get fromRule => source == 'rule';

  factory PriceCell.fromJson(Map<String, dynamic> json) =>
      PriceCell(price: _num(json['price']), source: json['source']?.toString() ?? 'base');
}

class PriceRow {
  final String productId;
  final String name;
  final double basePrice;
  final Map<String, PriceCell> prices;

  const PriceRow({required this.productId, required this.name, this.basePrice = 0, this.prices = const {}});

  factory PriceRow.fromJson(Map<String, dynamic> json) {
    final raw = json['prices'];
    return PriceRow(
      productId: json['product_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      basePrice: _num(json['base_price']),
      prices: raw is Map
          ? {
              for (final e in raw.entries)
                if (e.value is Map<String, dynamic>) e.key.toString(): PriceCell.fromJson(e.value as Map<String, dynamic>),
            }
          : const {},
    );
  }
}

class ProductPrices {
  final String productId;
  final double quantity;
  final List<PriceListRef> lists;

  /// One row per variant for a product with variants, otherwise one row.
  final List<PriceRow> rows;

  const ProductPrices({required this.productId, this.quantity = 1, this.lists = const [], this.rows = const []});

  factory ProductPrices.fromJson(Map<String, dynamic> json) {
    final lists = json['lists'];
    final rows = json['rows'];
    return ProductPrices(
      productId: json['product_id']?.toString() ?? '',
      quantity: json['quantity'] == null ? 1 : _num(json['quantity']),
      lists: lists is List ? lists.whereType<Map<String, dynamic>>().map(PriceListRef.fromJson).toList() : const [],
      rows: rows is List ? rows.whereType<Map<String, dynamic>>().map(PriceRow.fromJson).toList() : const [],
    );
  }
}
