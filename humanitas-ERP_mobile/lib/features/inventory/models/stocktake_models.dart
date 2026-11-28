/// Stocktakes on mobile: count by scanning (featureslist §2); mirrors GET /inventory/counts.
String? _str(dynamic v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

double? _numOrNull(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse(v.toString()));

double _num(dynamic v) => _numOrNull(v) ?? 0;

String? _day(dynamic v) {
  final s = _str(v);
  if (s == null) return null;
  return s.length >= 10 ? s.substring(0, 10) : s;
}

const countStateLabel = <String, String>{
  'draft': 'Planned',
  'counting': 'Counting',
  'review': 'In review',
  'posted': 'Posted',
  'cancelled': 'Cancelled',
};

const countTypeLabel = <String, String>{
  'cycle': 'Cycle count',
  'full': 'Full count',
  'blind': 'Blind count',
  'spot': 'Spot check',
};

class Stocktake {
  final String id;
  final String name;
  final String countType;
  final String state;
  final String? warehouseName;
  final String? locationCode;
  final bool isBlind;
  final String? scheduledDate;
  final String? responsibleName;
  final bool expectedHidden;
  final int lines;
  final int counted;
  final int withVariance;
  final double? accuracy;

  const Stocktake({
    required this.id,
    required this.name,
    this.countType = 'cycle',
    this.state = 'draft',
    this.warehouseName,
    this.locationCode,
    this.isBlind = false,
    this.scheduledDate,
    this.responsibleName,
    this.expectedHidden = false,
    this.lines = 0,
    this.counted = 0,
    this.withVariance = 0,
    this.accuracy,
  });

  /// People may still count (until it is posted or cancelled).
  bool get isOpenForCounting => state == 'counting' || state == 'review';

  String get stateLabel => countStateLabel[state] ?? state;

  /// "12 of 40 counted"
  String get progressLabel => lines == 0 ? 'Nothing to count yet' : '$counted of $lines counted';

  double get progress => lines == 0 ? 0 : counted / lines;

  /// "Main · A-01 and below"
  String get where => [warehouseName, if (locationCode != null) '$locationCode and below'].whereType<String>().join(' · ');

  factory Stocktake.fromJson(Map<String, dynamic> j) {
    final t = j['totals'] is Map<String, dynamic> ? j['totals'] as Map<String, dynamic> : const <String, dynamic>{};
    return Stocktake(
      id: j['id']?.toString() ?? '',
      name: j['name']?.toString() ?? '',
      countType: j['count_type']?.toString() ?? 'cycle',
      state: j['state']?.toString() ?? 'draft',
      warehouseName: _str(j['warehouse_name']),
      locationCode: _str(j['location_code']),
      isBlind: j['is_blind'] == true,
      scheduledDate: _day(j['scheduled_date']),
      responsibleName: _str(j['responsible_name']),
      expectedHidden: j['expected_hidden'] == true,
      lines: _num(t['lines'] ?? j['line_count']).toInt(),
      counted: _num(t['counted'] ?? j['counted_count']).toInt(),
      withVariance: _num(t['with_variance']).toInt(),
      accuracy: _numOrNull(t['accuracy']),
    );
  }
}

class CountLine {
  final String id;
  final String productId;
  final String productName;
  final String? sku;
  final String? lotName;
  final String locationId;
  final String? locationCode;

  /// Null on a blind count (hidden from counters).
  final double? expected;
  final double? counted;
  final double? variance;
  final bool isUnexpected;
  final String? countedByName;

  const CountLine({
    required this.id,
    required this.productId,
    required this.productName,
    this.sku,
    this.lotName,
    required this.locationId,
    this.locationCode,
    this.expected,
    this.counted,
    this.variance,
    this.isUnexpected = false,
    this.countedByName,
  });

  bool get isCounted => counted != null;

  factory CountLine.fromJson(Map<String, dynamic> j) => CountLine(
        id: j['id']?.toString() ?? '',
        productId: j['product_id']?.toString() ?? '',
        productName: j['product_name']?.toString() ?? '',
        sku: _str(j['sku']),
        lotName: _str(j['lot_name']),
        locationId: j['location_id']?.toString() ?? '',
        locationCode: _str(j['location_code']),
        expected: _numOrNull(j['expected_qty']),
        counted: _numOrNull(j['counted_qty']),
        variance: j.containsKey('expected_qty') && j['counted_qty'] != null ? _numOrNull(j['variance']) : null,
        isUnexpected: j['is_unexpected'] == true,
        countedByName: _str(j['counted_by_name']),
      );
}

/// "+2", "−3", "0", or "" when not counted or hidden.
String varianceText(double? v) {
  if (v == null) return '';
  if (v == 0) return '0';
  String q(double n) => n == n.roundToDouble() ? n.toStringAsFixed(0) : n.toString();
  return v > 0 ? '+${q(v)}' : '−${q(-v)}';
}

/// A quantity without trailing zeros: 3, 2.5.
String qtyText(double? v) => v == null ? '—' : (v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString());

class CountLinePage {
  final List<CountLine> items;
  final int page;
  final int limit;
  final int total;

  const CountLinePage({this.items = const [], this.page = 1, this.limit = 100, this.total = 0});

  factory CountLinePage.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final meta = json['meta'] is Map<String, dynamic> ? json['meta'] as Map<String, dynamic> : const <String, dynamic>{};
    return CountLinePage(
      items: data is List ? data.whereType<Map<String, dynamic>>().map(CountLine.fromJson).toList() : const [],
      page: _num(meta['page'] ?? 1).toInt(),
      limit: _num(meta['limit'] ?? 100).toInt(),
      total: _num(meta['total']).toInt(),
    );
  }

  bool get hasMore => page * limit < total;
}

/// What a scan did: moved the counter to a location, or counted a line.
class CountScanResult {
  final String? locationId;
  final String? locationCode;
  final CountLine? line;

  const CountScanResult({this.locationId, this.locationCode, this.line});

  bool get isLocation => locationId != null;

  factory CountScanResult.fromJson(Map<String, dynamic> j) {
    if (j['kind'] == 'location' && j['location'] is Map<String, dynamic>) {
      final l = j['location'] as Map<String, dynamic>;
      return CountScanResult(locationId: l['id']?.toString(), locationCode: _str(l['code']));
    }
    final line = j['line'];
    return CountScanResult(line: line is Map<String, dynamic> ? CountLine.fromJson(line) : null);
  }
}
