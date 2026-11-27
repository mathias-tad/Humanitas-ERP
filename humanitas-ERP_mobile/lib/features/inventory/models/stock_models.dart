double _num(dynamic v) => v == null ? 0 : (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
String? _str(dynamic v) => v?.toString();

/// One line of stock on hand: a product at a location (and lot).
class StockLine {
  final String id;
  final String productId;
  final String productName;
  final String? sku;
  final String locationId;
  final String locationCode;
  final String? warehouseName;
  final String? lotId;
  final String? lotName;
  final double quantity;
  final double free;
  /// Null without the valuation permission.
  final double? value;

  const StockLine({
    required this.id,
    required this.productId,
    required this.productName,
    this.sku,
    required this.locationId,
    required this.locationCode,
    this.warehouseName,
    this.lotId,
    this.lotName,
    required this.quantity,
    required this.free,
    this.value,
  });

  factory StockLine.fromJson(Map<String, dynamic> j) => StockLine(
        id: j['id'].toString(),
        productId: j['product_id'].toString(),
        productName: _str(j['product_name']) ?? '',
        sku: _str(j['sku']),
        locationId: j['location_id'].toString(),
        locationCode: _str(j['location_code']) ?? '',
        warehouseName: _str(j['warehouse_name']),
        lotId: _str(j['lot_id']),
        lotName: _str(j['lot_name']),
        quantity: _num(j['quantity']),
        free: _num(j['free_quantity']),
        value: j.containsKey('stock_value') ? _num(j['stock_value']) : null,
      );
}

class StockPage {
  final List<StockLine> lines;
  final int total;
  final int page;

  const StockPage(this.lines, this.total, this.page);

  bool get hasMore => lines.isNotEmpty && page * 40 < total;

  factory StockPage.fromJson(Map<String, dynamic> j) {
    final data = (j['data'] as List? ?? const []).whereType<Map<String, dynamic>>().map(StockLine.fromJson).toList();
    final meta = j['meta'] is Map ? j['meta'] as Map : const {};
    return StockPage(data, int.tryParse('${meta['total'] ?? data.length}') ?? data.length, int.tryParse('${meta['page'] ?? 1}') ?? 1);
  }
}

/// "12" / "12.5" — quantities without trailing zeros.
String qtyText(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(4).replaceFirst(RegExp(r'0+$'), '');
