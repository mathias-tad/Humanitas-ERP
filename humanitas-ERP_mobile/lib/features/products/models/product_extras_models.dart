/// Products completion (featureslist §1): pictures, packaging, kits and combos, catalog report.
/// Mirrors the API's product-structure.ts.

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;
String? _s(dynamic v) => v == null || v.toString().isEmpty ? null : v.toString();

/// The full address of a stored picture or file. The API serves /uploads/... next to /api/v1.
String resolveMediaUrl(String apiBaseUrl, String? path) {
  if (path == null || path.isEmpty) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final base = apiBaseUrl.replaceAll(RegExp(r'/api/v\d+/?$'), '').replaceAll(RegExp(r'/$'), '');
  return '$base${path.startsWith('/') ? '' : '/'}$path';
}

/// GS1 check digit (GTIN-8, 12, 13, 14).
int gs1CheckDigit(String body) {
  var sum = 0;
  for (var i = 0; i < body.length; i++) {
    final d = int.parse(body[body.length - 1 - i]);
    sum += i.isEven ? d * 3 : d;
  }
  return (10 - sum % 10) % 10;
}

bool isValidGtin(String code) {
  if (!RegExp(r'^(\d{8}|\d{12}|\d{13}|\d{14})$').hasMatch(code)) return false;
  return gs1CheckDigit(code.substring(0, code.length - 1)) == int.parse(code[code.length - 1]);
}

String _n(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// Why a sale quantity is not allowed (minimum order, sold in multiples), or null.
String? quantityProblem(double quantity, double minQty, double? step, {String unit = ''}) {
  final u = unit.isEmpty ? '' : ' $unit';
  if (minQty > 0 && quantity < minQty) return 'The minimum order is ${_n(minQty)}$u';
  if (step != null && step > 0) {
    final ratio = quantity / step;
    if ((ratio - ratio.round()).abs() > 1e-6) return 'Sold in multiples of ${_n(step)}$u';
  }
  return null;
}

/// "Box of 12: 12 pc" when a package barcode was scanned; null for a single unit.
String? scannedQuantityText(String? packaging, double quantity, String unit) {
  if (quantity == 1 && (packaging == null || packaging.isEmpty)) return null;
  final q = '${_n(quantity)} $unit'.trim();
  return packaging == null || packaging.isEmpty ? '$q scanned' : '$packaging scanned: $q';
}

class ProductMedia {
  final String id;
  final String kind;
  final String filePath;
  final String fileName;
  final String mimeType;
  final int fileSize;
  final String? title;
  final bool isPrimary;

  const ProductMedia({
    required this.id,
    required this.kind,
    required this.filePath,
    required this.fileName,
    this.mimeType = '',
    this.fileSize = 0,
    this.title,
    this.isPrimary = false,
  });

  bool get isImage => kind == 'image';

  String get label => title ?? fileName;

  String get sizeText {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024) return '${(fileSize / 1024).round()} KB';
    return '${(fileSize / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  factory ProductMedia.fromJson(Map<String, dynamic> j) => ProductMedia(
        id: j['id']?.toString() ?? '',
        kind: j['kind']?.toString() ?? 'image',
        filePath: j['file_path']?.toString() ?? '',
        fileName: j['file_name']?.toString() ?? '',
        mimeType: j['mime_type']?.toString() ?? '',
        fileSize: _d(j['file_size']).toInt(),
        title: _s(j['title']),
        isPrimary: j['is_primary'] == true,
      );
}

class PackagingInfo {
  final String name;
  final String level;
  final double quantity;
  final String? gtin;
  final bool canSell;
  final bool canBuy;

  const PackagingInfo({required this.name, this.level = 'case', required this.quantity, this.gtin, this.canSell = true, this.canBuy = true});

  static const levelLabels = {'unit': 'Unit', 'inner': 'Inner pack', 'case': 'Case / box', 'pallet': 'Pallet', 'other': 'Other'};

  String get levelLabel => levelLabels[level] ?? level;

  factory PackagingInfo.fromJson(Map<String, dynamic> j) => PackagingInfo(
        name: j['name']?.toString() ?? '',
        level: j['level']?.toString() ?? 'case',
        quantity: _d(j['quantity']),
        gtin: _s(j['gtin']),
        canSell: j['can_sell'] != false,
        canBuy: j['can_buy'] != false,
      );
}

class KitComponent {
  final String componentId;
  final String name;
  final double quantity;
  final double salesPrice;
  final double costPrice;
  final bool isActive;

  const KitComponent({required this.componentId, required this.name, required this.quantity, this.salesPrice = 0, this.costPrice = 0, this.isActive = true});

  factory KitComponent.fromJson(Map<String, dynamic> j) => KitComponent(
        componentId: j['component_id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        quantity: _d(j['quantity']),
        salesPrice: _d(j['sales_price']),
        costPrice: _d(j['cost_price']),
        isActive: j['is_active'] != false,
      );
}

class ComboChoice {
  final String componentId;
  final String name;
  final double extraPrice;
  final bool isDefault;

  const ComboChoice({required this.componentId, required this.name, this.extraPrice = 0, this.isDefault = false});

  factory ComboChoice.fromJson(Map<String, dynamic> j) => ComboChoice(
        componentId: j['component_id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        extraPrice: _d(j['extra_price']),
        isDefault: j['is_default'] == true,
      );
}

class ComboGroup {
  final String name;
  final int minChoices;
  final int maxChoices;
  final List<ComboChoice> choices;

  const ComboGroup({required this.name, this.minChoices = 1, this.maxChoices = 1, this.choices = const []});

  /// "Pick 1", "Pick 1 to 2", "Up to 2".
  String get ruleText {
    if (minChoices == maxChoices) return 'Pick $minChoices';
    if (minChoices == 0) return 'Up to $maxChoices';
    return 'Pick $minChoices to $maxChoices';
  }

  factory ComboGroup.fromJson(Map<String, dynamic> j) {
    final c = j['choices'];
    return ComboGroup(
      name: j['name']?.toString() ?? '',
      minChoices: _d(j['min_choices']).toInt(),
      maxChoices: _d(j['max_choices']).toInt(),
      choices: c is List ? c.whereType<Map<String, dynamic>>().map(ComboChoice.fromJson).toList() : const [],
    );
  }
}

class ProductComposition {
  final String composition;
  final List<KitComponent> components;
  final List<ComboGroup> groups;
  final double componentsPrice;
  final double componentsCost;
  final double salesPrice;

  const ProductComposition({
    this.composition = 'single',
    this.components = const [],
    this.groups = const [],
    this.componentsPrice = 0,
    this.componentsCost = 0,
    this.salesPrice = 0,
  });

  bool get isKit => composition == 'kit';
  bool get isCombo => composition == 'combo';

  /// What the customer saves buying the kit instead of the components (0 when it costs more).
  double get kitSaving => isKit && componentsPrice > salesPrice ? componentsPrice - salesPrice : 0;

  factory ProductComposition.fromJson(Map<String, dynamic> j) {
    final c = j['components'];
    final g = j['groups'];
    return ProductComposition(
      composition: j['composition']?.toString() ?? 'single',
      components: c is List ? c.whereType<Map<String, dynamic>>().map(KitComponent.fromJson).toList() : const [],
      groups: g is List ? g.whereType<Map<String, dynamic>>().map(ComboGroup.fromJson).toList() : const [],
      componentsPrice: _d(j['components_price']),
      componentsCost: _d(j['components_cost']),
      salesPrice: _d(j['sales_price']),
    );
  }
}

class CatalogIssueCount {
  final String key;
  final String label;
  final int count;

  const CatalogIssueCount({required this.key, required this.label, required this.count});
}

/// The catalog report summary (web: Product Reports).
class CatalogReport {
  final int products;
  final int variants;
  final int sellable;
  final int archived;
  final int kits;
  final int combos;
  final double completeness;
  final double? avgMargin;
  final List<CatalogIssueCount> issues;
  final List<({String name, double margin})> lowestMargins;

  const CatalogReport({
    this.products = 0,
    this.variants = 0,
    this.sellable = 0,
    this.archived = 0,
    this.kits = 0,
    this.combos = 0,
    this.completeness = 100,
    this.avgMargin,
    this.issues = const [],
    this.lowestMargins = const [],
  });

  factory CatalogReport.fromJson(Map<String, dynamic> j) {
    final t = j['totals'] is Map<String, dynamic> ? j['totals'] as Map<String, dynamic> : const <String, dynamic>{};
    final m = j['margins'] is Map<String, dynamic> ? j['margins'] as Map<String, dynamic> : const <String, dynamic>{};
    final issues = j['issues'];
    final lowest = m['lowest'];
    return CatalogReport(
      products: _d(t['products']).toInt(),
      variants: _d(t['variants']).toInt(),
      sellable: _d(t['sellable']).toInt(),
      archived: _d(t['archived']).toInt(),
      kits: _d(t['kits']).toInt(),
      combos: _d(t['combos']).toInt(),
      completeness: _d(j['completeness'] ?? 100),
      avgMargin: m['avg_margin'] == null ? null : _d(m['avg_margin']),
      issues: issues is List
          ? issues.whereType<Map<String, dynamic>>()
              .map((i) => CatalogIssueCount(key: i['key']?.toString() ?? '', label: i['label']?.toString() ?? '', count: _d(i['count']).toInt()))
              .toList()
          : const [],
      lowestMargins: lowest is List
          ? lowest.whereType<Map<String, dynamic>>().map((r) => (name: r['name']?.toString() ?? '', margin: _d(r['margin']))).toList()
          : const [],
    );
  }
}
