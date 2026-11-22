/// Products & Catalog models for the tenant API (`/products`, `/product-categories`, `/uoms`).
/// The MoR e-invoicing rules mirror the backend (AGENTS.md rule 28, docs/eims/EIMS_REFERENCE.md).
library;

import 'product_extras_models.dart';

/// MoR line tax codes and their labels.
const List<String> kEimsTaxCodes = ['VAT15', 'VAT0', 'VATEX', 'TOT2', 'TOT10'];

const Map<String, String> kEimsTaxCodeLabels = {
  'VAT15': 'VAT 15%',
  'VAT0': 'VAT 0% (zero-rated)',
  'VATEX': 'VAT exempt',
  'TOT2': 'Turnover tax 2%',
  'TOT10': 'Turnover tax 10%',
};

/// What each readiness issue means and how to fix it.
const Map<String, String> kEimsIssueText = {
  'item_code': 'Item code is missing or invalid',
  'description': 'Name is over 100 characters: add a shorter invoice description',
  'unit': 'The unit has no MoR unit code: set one under Units of Measure',
  'tax_code': 'Tax code is missing',
};

const Map<String, String> kProductTypeLabels = {
  'storable': 'Stock item',
  'consumable': 'Consumable',
  'service': 'Service',
};

const int kMorDescriptionMax = 100;
final RegExp kItemCodePattern = RegExp(r'^[A-Za-z0-9._/-]{1,15}$');
final RegExp kHsCodePattern = RegExp(r'^[0-9A-Za-z.]{2,15}$');
final RegExp kSkuPattern = RegExp(r'^[A-Za-z0-9._\-/]+$');

double _toDouble(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

double? _toDoubleOrNull(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

String? _toStr(dynamic v) => v?.toString();

/// "120", "90.5" — numbers as people type them, without trailing zeros.
String formatNumber(double v) {
  if (v == v.roundToDouble()) return v.toStringAsFixed(0);
  return v.toString();
}

class ProductBarcode {
  final String barcode;
  final String? packaging;
  final double quantity;
  final bool isPrimary;

  /// Made by the in-store numbering (Product Settings in the web app).
  final bool isGenerated;

  const ProductBarcode({required this.barcode, this.packaging, this.quantity = 1, this.isPrimary = false, this.isGenerated = false});

  factory ProductBarcode.fromJson(Map<String, dynamic> json) => ProductBarcode(
        barcode: json['barcode']?.toString() ?? '',
        packaging: _toStr(json['packaging']),
        quantity: _toDoubleOrNull(json['quantity']) ?? 1,
        isPrimary: json['is_primary'] == true,
        isGenerated: json['is_generated'] == true,
      );

  Map<String, dynamic> toJson() => {
        'barcode': barcode,
        if (packaging != null && packaging!.isNotEmpty) 'packaging': packaging,
        'quantity': quantity,
        'is_primary': isPrimary,
      };
}

class Product {
  final String id;
  final String name;
  final String? sku;
  final String itemCode;
  final String productType;
  final String? description;
  final String? categoryId;
  final String? categoryName;
  final String uomId;
  final String uomName;
  final String? uomSymbol;
  final String? uomMorCode;
  final String purchaseUomId;
  final double salesPrice;
  final double costPrice;
  final String taxCode;
  final String? harmonizationCode;
  final double? exciseRate;
  final double effectiveExciseRate;
  final String? invoiceDescription;
  final String natureOfSupply;
  final bool canBeSold;
  final bool canBePurchased;
  final bool isActive;
  final List<ProductBarcode> barcodes;
  final bool eimsReady;
  final List<String> eimsIssues;

  /// Variants (featureslist §1): set on a variant, which belongs to [parentName].
  final String? parentId;
  final String? parentName;

  /// "Red, M"
  final String? variantLabel;

  /// Added to the parent's sales price.
  final double priceExtra;

  /// The product is a parent: its variants are sold and scanned, not it.
  final bool hasVariants;
  final int variantCount;

  /// The main picture (gallery) or a web address.
  final String? imageUrl;

  /// The unit it is sold in (same kind as the base unit [uomId]).
  final String? salesUomId;
  final String? salesUomName;
  final String? salesUomSymbol;

  /// Minimum order and "sold in multiples of", in the sales unit.
  final double minSaleQty;
  final double? saleQtyStep;

  /// single | kit | combo
  final String composition;
  final bool isBelowCost;
  final int mediaCount;
  final List<PackagingInfo> packagings;

  /// Lookup only: the package a scanned code belongs to and how many units it holds.
  final String? scannedPackaging;
  final double scannedQuantity;

  const Product({
    required this.id,
    required this.name,
    this.sku,
    required this.itemCode,
    this.productType = 'consumable',
    this.description,
    this.categoryId,
    this.categoryName,
    required this.uomId,
    required this.uomName,
    this.uomSymbol,
    this.uomMorCode,
    required this.purchaseUomId,
    this.salesPrice = 0,
    this.costPrice = 0,
    this.taxCode = 'VAT15',
    this.harmonizationCode,
    this.exciseRate,
    this.effectiveExciseRate = 0,
    this.invoiceDescription,
    this.natureOfSupply = 'goods',
    this.canBeSold = true,
    this.canBePurchased = true,
    this.isActive = true,
    this.barcodes = const [],
    this.eimsReady = false,
    this.eimsIssues = const [],
    this.parentId,
    this.parentName,
    this.variantLabel,
    this.priceExtra = 0,
    this.hasVariants = false,
    this.variantCount = 0,
    this.imageUrl,
    this.salesUomId,
    this.salesUomName,
    this.salesUomSymbol,
    this.minSaleQty = 0,
    this.saleQtyStep,
    this.composition = 'single',
    this.isBelowCost = false,
    this.mediaCount = 0,
    this.packagings = const [],
    this.scannedPackaging,
    this.scannedQuantity = 1,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    final rawBarcodes = json['barcodes'];
    final rawIssues = json['eims_issues'];
    return Product(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      sku: _toStr(json['sku']),
      itemCode: json['item_code']?.toString() ?? '',
      productType: json['product_type']?.toString() ?? 'consumable',
      description: _toStr(json['description']),
      categoryId: _toStr(json['category_id']),
      categoryName: _toStr(json['category_name']),
      uomId: json['uom_id']?.toString() ?? '',
      uomName: json['uom_name']?.toString() ?? '',
      uomSymbol: _toStr(json['uom_symbol']),
      uomMorCode: _toStr(json['uom_mor_code']),
      purchaseUomId: json['purchase_uom_id']?.toString() ?? '',
      salesPrice: _toDouble(json['sales_price']),
      costPrice: _toDouble(json['cost_price']),
      taxCode: json['tax_code']?.toString() ?? 'VAT15',
      harmonizationCode: _toStr(json['harmonization_code']),
      exciseRate: _toDoubleOrNull(json['excise_rate']),
      effectiveExciseRate: _toDouble(json['effective_excise_rate']),
      invoiceDescription: _toStr(json['invoice_description']),
      natureOfSupply: json['nature_of_supply']?.toString() ?? 'goods',
      canBeSold: json['can_be_sold'] != false,
      canBePurchased: json['can_be_purchased'] != false,
      isActive: json['is_active'] != false,
      barcodes: rawBarcodes is List
          ? rawBarcodes.whereType<Map<String, dynamic>>().map(ProductBarcode.fromJson).toList()
          : const [],
      eimsReady: json['eims_ready'] == true,
      eimsIssues: rawIssues is List ? rawIssues.map((e) => e.toString()).toList() : const [],
      parentId: _toStr(json['parent_id']),
      parentName: _toStr(json['parent_name']),
      variantLabel: _toStr(json['variant_label']),
      priceExtra: _toDouble(json['price_extra']),
      hasVariants: json['has_variants'] == true,
      variantCount: _toDouble(json['variant_count']).toInt(),
      imageUrl: _toStr(json['image_url']),
      salesUomId: _toStr(json['sales_uom_id']),
      salesUomName: _toStr(json['sales_uom_name']),
      salesUomSymbol: _toStr(json['sales_uom_symbol']),
      minSaleQty: _toDouble(json['min_sale_qty']),
      saleQtyStep: _toDoubleOrNull(json['sale_qty_step']),
      composition: json['composition']?.toString() ?? 'single',
      isBelowCost: json['is_below_cost'] == true,
      mediaCount: _toDouble(json['media_count']).toInt(),
      packagings: json['packagings'] is List
          ? (json['packagings'] as List).whereType<Map<String, dynamic>>().map(PackagingInfo.fromJson).toList()
          : const [],
      scannedPackaging: _toStr(json['scanned_packaging']),
      scannedQuantity: _toDoubleOrNull(json['scanned_quantity']) ?? 1,
    );
  }

  /// The sales unit's label; the base unit when it is sold in it.
  String get salesUnitLabel => salesUomSymbol ?? salesUomName ?? unitLabel;

  /// "Kit", "Combo" or null for a single product.
  String? get compositionLabel => composition == 'kit' ? 'Kit' : composition == 'combo' ? 'Combo' : null;

  String get typeLabel => kProductTypeLabels[productType] ?? productType;

  String get unitLabel => uomSymbol ?? uomName;

  bool get isVariant => parentId != null;

  String? get primaryBarcode {
    for (final b in barcodes) {
      if (b.isPrimary) return b.barcode;
    }
    return barcodes.isEmpty ? null : barcodes.first.barcode;
  }
}

class ProductPage {
  final List<Product> items;
  final int page;
  final int limit;
  final int total;

  const ProductPage({this.items = const [], this.page = 1, this.limit = 25, this.total = 0});

  factory ProductPage.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    final meta = json['meta'] is Map<String, dynamic> ? json['meta'] as Map<String, dynamic> : const <String, dynamic>{};
    return ProductPage(
      items: data is List ? data.whereType<Map<String, dynamic>>().map(Product.fromJson).toList() : const [],
      page: _toDouble(meta['page']).toInt().clamp(1, 1 << 30),
      limit: _toDouble(meta['limit']).toInt().clamp(1, 1 << 30),
      total: _toDouble(meta['total']).toInt(),
    );
  }

  bool get hasMore => page * limit < total;

  /// This page followed by [next] (the list loads page after page).
  ProductPage append(ProductPage next) =>
      ProductPage(items: [...items, ...next.items], page: next.page, limit: next.limit, total: next.total);
}

/// List filters. Equality matters: it is the key of the list provider.
class ProductQuery {
  final String q;
  final String status;
  final String? eims;
  final int page;
  final int limit;

  const ProductQuery({this.q = '', this.status = 'active', this.eims, this.page = 1, this.limit = 25});

  ProductQuery copyWith({String? q, String? status, String? eims, bool clearEims = false, int? page, int? limit}) =>
      ProductQuery(
        q: q ?? this.q,
        status: status ?? this.status,
        eims: clearEims ? null : (eims ?? this.eims),
        page: page ?? this.page,
        limit: limit ?? this.limit,
      );

  Map<String, dynamic> toParams() => {
        if (q.trim().isNotEmpty) 'q': q.trim(),
        'status': status,
        if (eims != null) 'eims': eims,
        'page': page,
        'limit': limit,
        'sort': 'name',
      };

  @override
  bool operator ==(Object other) =>
      other is ProductQuery &&
      other.q == q &&
      other.status == status &&
      other.eims == eims &&
      other.page == page &&
      other.limit == limit;

  @override
  int get hashCode => Object.hash(q, status, eims, page, limit);
}

class ProductCategory {
  final String id;
  final String? parentId;
  final String name;
  final String? code;
  final String fullPath;
  final int depth;
  final int productCount;
  final bool isActive;
  final double exciseRate;

  const ProductCategory({
    required this.id,
    this.parentId,
    required this.name,
    this.code,
    required this.fullPath,
    this.depth = 0,
    this.productCount = 0,
    this.isActive = true,
    this.exciseRate = 0,
  });

  factory ProductCategory.fromJson(Map<String, dynamic> json) => ProductCategory(
        id: json['id']?.toString() ?? '',
        parentId: _toStr(json['parent_id']),
        name: json['name']?.toString() ?? '',
        code: _toStr(json['code']),
        fullPath: json['full_path']?.toString() ?? json['name']?.toString() ?? '',
        depth: _toDouble(json['depth']).toInt(),
        productCount: _toDouble(json['product_count']).toInt(),
        isActive: json['is_active'] != false,
        exciseRate: _toDouble(json['excise_rate']),
      );
}

class Uom {
  final String id;
  final String name;
  final String? symbol;
  final String? morCode;
  final double ratio;
  final bool isReference;
  final bool isActive;

  const Uom({
    required this.id,
    required this.name,
    this.symbol,
    this.morCode,
    this.ratio = 1,
    this.isReference = false,
    this.isActive = true,
  });

  factory Uom.fromJson(Map<String, dynamic> json) => Uom(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        symbol: _toStr(json['symbol']),
        morCode: _toStr(json['mor_code']),
        ratio: _toDoubleOrNull(json['ratio']) ?? 1,
        isReference: json['is_reference'] == true,
        isActive: json['is_active'] != false,
      );

  String get label => symbol == null || symbol!.isEmpty ? name : '$name ($symbol)';
}

class UomCategory {
  final String id;
  final String name;
  final List<Uom> units;

  const UomCategory({required this.id, required this.name, this.units = const []});

  factory UomCategory.fromJson(Map<String, dynamic> json) {
    final units = json['units'];
    return UomCategory(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      units: units is List ? units.whereType<Map<String, dynamic>>().map(Uom.fromJson).toList() : const [],
    );
  }

  Uom? get reference {
    for (final u in units) {
      if (u.isReference) return u;
    }
    return null;
  }
}

/// "1 Quintal = 100 kg" — how a unit relates to its category's reference unit.
String ratioText(Uom unit, Uom? reference) {
  if (unit.isReference || reference == null) return 'Reference unit';
  return '1 ${unit.name} = ${formatNumber(unit.ratio)} ${reference.name}';
}

class MorUnitCode {
  final String code;
  final String name;

  const MorUnitCode({required this.code, required this.name});

  factory MorUnitCode.fromJson(Map<String, dynamic> json) =>
      MorUnitCode(code: json['code']?.toString() ?? '', name: json['name']?.toString() ?? '');
}

class TimelineChange {
  final String label;
  final dynamic oldValue;
  final dynamic newValue;

  const TimelineChange({required this.label, this.oldValue, this.newValue});

  factory TimelineChange.fromJson(Map<String, dynamic> json) => TimelineChange(
        label: json['label']?.toString() ?? json['field']?.toString() ?? '',
        oldValue: json['old'],
        newValue: json['new'],
      );
}

/// Timeline value as text, matching the web History tab.
String formatTimelineValue(dynamic v) {
  if (v == null || v == '') return '—';
  if (v is bool) return v ? 'Yes' : 'No';
  if (v is List) return v.isEmpty ? '—' : v.join(', ');
  return v.toString();
}

class TimelineEvent {
  final String id;
  final String eventType;
  final String? summary;
  final List<TimelineChange> changes;
  final String? createdByName;
  final String? clientPlatform;
  final String? clientDevice;
  final Map<String, dynamic> clientInfo;
  final DateTime? occurredAt;

  const TimelineEvent({
    required this.id,
    required this.eventType,
    this.summary,
    this.changes = const [],
    this.createdByName,
    this.clientPlatform,
    this.clientDevice,
    this.clientInfo = const {},
    this.occurredAt,
  });

  factory TimelineEvent.fromJson(Map<String, dynamic> json) {
    final changes = json['changes'];
    final info = json['client_info'];
    return TimelineEvent(
      id: json['id']?.toString() ?? '',
      eventType: json['event_type']?.toString() ?? '',
      summary: _toStr(json['summary']),
      changes: changes is List ? changes.whereType<Map<String, dynamic>>().map(TimelineChange.fromJson).toList() : const [],
      createdByName: _toStr(json['created_by_name']),
      clientPlatform: _toStr(json['client_platform']),
      clientDevice: _toStr(json['client_device']),
      clientInfo: info is Map<String, dynamic> ? info : const {},
      occurredAt: DateTime.tryParse(json['occurred_at']?.toString() ?? '')?.toLocal(),
    );
  }

  /// Where the change was made, e.g. "Mobile app · Android 1.0.0" or "Web · Chrome on Windows".
  String get clientLabel {
    final os = clientInfo['os']?.toString();
    final version = clientInfo['appVersion']?.toString();
    final browser = clientInfo['browser']?.toString();
    String join(List<String?> parts, String sep) => parts.where((p) => p != null && p.isNotEmpty).join(sep);
    switch (clientPlatform) {
      case 'mobile_app':
        return join(['Mobile app', join([os, version], ' ')], ' · ');
      case 'desktop_app':
        return join(['Desktop app', join([os, version], ' ')], ' · ');
      case 'web':
        return join(['Web', join([browser, os == null ? null : 'on $os'], ' ')], ' · ');
      case 'api':
        return 'API / integration';
      case 'mcp':
        return 'External AI (MCP)';
      case 'system':
        return 'System';
      default:
        return 'Unknown client';
    }
  }
}

class TimelinePage {
  final List<TimelineEvent> events;
  final String? nextCursor;

  const TimelinePage({this.events = const [], this.nextCursor});

  factory TimelinePage.fromJson(Map<String, dynamic> json) {
    final events = json['events'];
    return TimelinePage(
      events: events is List ? events.whereType<Map<String, dynamic>>().map(TimelineEvent.fromJson).toList() : const [],
      nextCursor: _toStr(json['nextCursor']),
    );
  }
}

/// Editable product form state, validated like the web form and the API.
class ProductFormData {
  String name;
  String sku;
  String productType;
  String? categoryId;
  String? categoryLabel;
  String? uomId;
  String? purchaseUomId;

  /// null = sold in the base unit.
  String? salesUomId;
  String minSaleQty;
  String saleQtyStep;
  String salesPrice;
  String costPrice;
  String taxCode;
  String itemCode;
  String harmonizationCode;
  String exciseRate;
  String invoiceDescription;
  String description;
  bool canBeSold;
  bool canBePurchased;
  List<ProductBarcode> barcodes;

  ProductFormData({
    this.name = '',
    this.sku = '',
    this.productType = 'consumable',
    this.categoryId,
    this.categoryLabel,
    this.uomId,
    this.purchaseUomId,
    this.salesUomId,
    this.minSaleQty = '',
    this.saleQtyStep = '',
    this.salesPrice = '',
    this.costPrice = '',
    this.taxCode = 'VAT15',
    this.itemCode = '',
    this.harmonizationCode = '',
    this.exciseRate = '',
    this.invoiceDescription = '',
    this.description = '',
    this.canBeSold = true,
    this.canBePurchased = true,
    List<ProductBarcode>? barcodes,
  }) : barcodes = barcodes ?? [];

  factory ProductFormData.fromProduct(Product p) => ProductFormData(
        name: p.name,
        sku: p.sku ?? '',
        productType: p.productType,
        categoryId: p.categoryId,
        categoryLabel: p.categoryName,
        uomId: p.uomId,
        purchaseUomId: p.purchaseUomId,
        salesUomId: p.salesUomId != null && p.salesUomId != p.uomId ? p.salesUomId : null,
        minSaleQty: p.minSaleQty > 0 ? formatNumber(p.minSaleQty) : '',
        saleQtyStep: p.saleQtyStep != null && p.saleQtyStep! > 0 ? formatNumber(p.saleQtyStep!) : '',
        salesPrice: formatNumber(p.salesPrice),
        costPrice: formatNumber(p.costPrice),
        taxCode: p.taxCode,
        itemCode: p.itemCode,
        harmonizationCode: p.harmonizationCode ?? '',
        exciseRate: p.exciseRate == null ? '' : formatNumber(p.exciseRate!),
        invoiceDescription: p.invoiceDescription ?? '',
        description: p.description ?? '',
        canBeSold: p.canBeSold,
        canBePurchased: p.canBePurchased,
        barcodes: List.of(p.barcodes),
      );

  /// Field → message. Empty when the form can be saved.
  Map<String, String> validate({List<UomCategory> uoms = const []}) {
    final errors = <String, String>{};
    if (name.trim().isEmpty) errors['name'] = 'Name is required';
    if (sku.trim().isNotEmpty && !kSkuPattern.hasMatch(sku.trim())) errors['sku'] = 'Letters, digits, . _ - / only';
    for (final entry in {'sales_price': salesPrice, 'cost_price': costPrice, 'min_sale_qty': minSaleQty, 'sale_qty_step': saleQtyStep}.entries) {
      final v = entry.value.trim();
      if (v.isNotEmpty && ((double.tryParse(v) ?? -1) < 0)) errors[entry.key] = 'Must be 0 or more';
    }
    if (!kEimsTaxCodes.contains(taxCode)) errors['tax_code'] = 'Choose a tax code';
    if (itemCode.trim().isNotEmpty && !kItemCodePattern.hasMatch(itemCode.trim())) {
      errors['item_code'] = 'Up to 15 letters, digits, . _ - /';
    }
    if (harmonizationCode.trim().isNotEmpty && !kHsCodePattern.hasMatch(harmonizationCode.trim())) {
      errors['harmonization_code'] = '2 to 15 digits';
    }
    final excise = exciseRate.trim();
    if (excise.isNotEmpty) {
      final v = double.tryParse(excise);
      if (v == null || v < 0 || v > 500) errors['excise_rate'] = 'Between 0 and 500';
    }
    if (invoiceDescription.trim().length > kMorDescriptionMax) {
      errors['invoice_description'] = 'At most $kMorDescriptionMax characters';
    }
    if (uomId != null && purchaseUomId != null && uoms.isNotEmpty) {
      String? kindOf(String id) {
        for (final c in uoms) {
          if (c.units.any((u) => u.id == id)) return c.id;
        }
        return null;
      }

      if (kindOf(uomId!) != kindOf(purchaseUomId!)) {
        errors['purchase_uom_id'] = 'Must be the same kind of unit as the base unit';
      }
    }
    if (uomId != null && salesUomId != null && uoms.isNotEmpty) {
      String? kindOf(String id) {
        for (final c in uoms) {
          if (c.units.any((u) => u.id == id)) return c.id;
        }
        return null;
      }

      if (kindOf(uomId!) != kindOf(salesUomId!)) errors['sales_uom_id'] = 'Must be the same kind of unit as the base unit';
    }
    final codes = barcodes.map((b) => b.barcode.trim()).where((b) => b.isNotEmpty).toList();
    if (codes.toSet().length != codes.length) errors['barcodes'] = 'Each barcode can be listed only once';
    if (codes.any((c) => c.contains(RegExp(r'\s')))) errors['barcodes'] = 'Barcodes cannot contain spaces';
    return errors;
  }

  /// Whether the barcodes differ from [p]'s. Unchanged barcodes are not sent, so generated ones keep their mark.
  bool barcodesChangedFrom(Product p) {
    String key(List<ProductBarcode> list) => list
        .where((b) => b.barcode.trim().isNotEmpty)
        .map((b) => '${b.barcode.trim()}|${b.packaging ?? ''}|${b.quantity}|${b.isPrimary}')
        .join(',');
    return key(barcodes) != key(p.barcodes);
  }

  /// True when the name is too long for MoR and no shorter invoice description is set.
  bool get needsInvoiceDescription =>
      invoiceDescription.trim().isEmpty && name.trim().length > kMorDescriptionMax;

  /// API payload. On create an empty item code is left out so the server generates one.
  Map<String, dynamic> toJson() {
    double? numOrNull(String s) => s.trim().isEmpty ? null : double.tryParse(s.trim());
    final cleanBarcodes = barcodes.where((b) => b.barcode.trim().isNotEmpty).toList();
    return {
      'name': name.trim(),
      'sku': sku.trim().isEmpty ? null : sku.trim(),
      'product_type': productType,
      'category_id': categoryId,
      if (uomId != null) 'uom_id': uomId,
      if (purchaseUomId != null) 'purchase_uom_id': purchaseUomId,
      if (salesUomId != null || uomId != null) 'sales_uom_id': salesUomId ?? uomId,
      'min_sale_qty': numOrNull(minSaleQty) ?? 0,
      'sale_qty_step': (numOrNull(saleQtyStep) ?? 0) > 0 ? numOrNull(saleQtyStep) : null,
      'sales_price': numOrNull(salesPrice) ?? 0,
      'cost_price': numOrNull(costPrice) ?? 0,
      'tax_code': taxCode,
      if (itemCode.trim().isNotEmpty) 'item_code': itemCode.trim(),
      'harmonization_code': harmonizationCode.trim().isEmpty ? null : harmonizationCode.trim(),
      'excise_rate': numOrNull(exciseRate),
      'invoice_description': invoiceDescription.trim().isEmpty ? null : invoiceDescription.trim(),
      'description': description.trim().isEmpty ? null : description.trim(),
      'can_be_sold': canBeSold,
      'can_be_purchased': canBePurchased,
      'barcodes': [
        for (final b in cleanBarcodes)
          ProductBarcode(
            barcode: b.barcode.trim(),
            packaging: b.packaging,
            quantity: b.quantity,
            isPrimary: b.isPrimary,
          ).toJson(),
      ],
    };
  }
}
