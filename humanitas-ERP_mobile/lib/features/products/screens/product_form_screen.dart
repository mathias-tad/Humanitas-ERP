import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/app_colors.dart';
import '../../../core/providers/auth_provider.dart';
import '../models/product_models.dart';
import '../providers/products_providers.dart';
import '../repositories/products_repository.dart';
import '../widgets/barcode_capture_screen.dart';
import '../widgets/catalog_pickers.dart';
import '../widgets/products_common.dart';

/// Create or edit a product. Pops with the saved [Product].
/// [initialName] / [initialBarcode] pre-fill a new product, e.g. from a search or a scan that found nothing.
class ProductFormScreen extends ConsumerStatefulWidget {
  final Product? product;
  final String? initialName;
  final String? initialBarcode;

  const ProductFormScreen({super.key, this.product, this.initialName, this.initialBarcode});

  bool get isEdit => product != null;

  @override
  ConsumerState<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends ConsumerState<ProductFormScreen> {
  late final ProductFormData _f;
  final _barcodeController = TextEditingController();
  Map<String, String> _errors = const {};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _f = p != null ? ProductFormData.fromProduct(p) : ProductFormData(name: widget.initialName ?? '');
    final scanned = widget.initialBarcode?.trim();
    if (p == null && scanned != null && scanned.isNotEmpty) {
      _f.barcodes.add(ProductBarcode(barcode: scanned, isPrimary: true));
    }
  }

  @override
  void dispose() {
    _barcodeController.dispose();
    super.dispose();
  }

  Uom? _findUnit(List<UomCategory> groups, String? id) {
    if (id == null) return null;
    for (final g in groups) {
      for (final u in g.units) {
        if (u.id == id) return u;
      }
    }
    return null;
  }

  Future<void> _save(List<UomCategory> uoms) async {
    final errors = _f.validate(uoms: uoms);
    setState(() => _errors = errors);
    if (errors.isNotEmpty) {
      showProductsSnack(context, 'Please fix the highlighted fields', error: true);
      return;
    }
    setState(() => _saving = true);
    final repo = ref.read(productsRepositoryProvider);
    try {
      final body = _f.toJson();
      if (widget.isEdit && !_f.barcodesChangedFrom(widget.product!)) body.remove('barcodes');
      final saved = widget.isEdit ? await repo.updateProduct(widget.product!.id, body) : await repo.createProduct(body);
      invalidateProducts(ref);
      if (!mounted) return;
      showProductsSnack(context, widget.isEdit ? 'Product saved' : 'Product "${saved.name}" created');
      Navigator.of(context).pop(saved);
    } on ProductsApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showProductsSnack(context, e.message, error: true);
    }
  }

  Future<void> _scanBarcode() async {
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const BarcodeCaptureScreen(title: "Scan the product's barcode")),
    );
    if (code == null || !mounted) return;
    if (_f.barcodes.any((b) => b.barcode.trim() == code)) {
      showProductsSnack(context, '$code is already on this product');
      return;
    }
    _addBarcode(code);
    showProductsSnack(context, 'Barcode $code added');
  }

  void _addBarcode(String raw) {
    final code = raw.trim();
    if (code.isEmpty) return;
    setState(() {
      _f.barcodes.add(ProductBarcode(barcode: code, isPrimary: _f.barcodes.isEmpty));
      _barcodeController.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final canSave = widget.isEdit ? auth.hasPermission('edit_products') : auth.hasPermission('create_products');
    final uomsAsync = ref.watch(uomCategoriesProvider);
    final uoms = uomsAsync.asData?.value ?? const <UomCategory>[];
    final salesUnit = _findUnit(uoms, _f.uomId);
    final purchaseUnit = _findUnit(uoms, _f.purchaseUomId);
    final sellUnit = _findUnit(uoms, _f.salesUomId);

    InputDecoration deco(String label, String key, {String? hint, String? helper}) => InputDecoration(
          labelText: label,
          hintText: hint,
          helperText: helper,
          errorText: _errors[key],
          border: const OutlineInputBorder(),
        );

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEdit ? 'Edit product' : 'New product'),
        actions: [
          if (canSave)
            TextButton(
              onPressed: _saving ? null : () => _save(uoms),
              child: _saving
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Save'),
            ),
        ],
      ),
      body: AbsorbPointer(
        absorbing: !canSave || _saving,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          children: [
            TextFormField(
              key: const Key('product-name'),
              initialValue: _f.name,
              autofocus: !widget.isEdit,
              decoration: deco('Name *', 'name', hint: 'e.g. Teff flour 1 kg'),
              onChanged: (v) => setState(() => _f.name = v),
            ),
            const SizedBox(height: 12),
            TextFormField(
              initialValue: _f.sku,
              decoration: deco('SKU', 'sku', hint: 'TEFF-1KG'),
              onChanged: (v) => _f.sku = v,
            ),
            const SizedBox(height: 12),
            const Text('Type'),
            const SizedBox(height: 6),
            SegmentedButton<String>(
              segments: [
                for (final e in kProductTypeLabels.entries) ButtonSegment(value: e.key, label: Text(e.value)),
              ],
              selected: {_f.productType},
              onSelectionChanged: (s) => setState(() => _f.productType = s.first),
            ),
            const SizedBox(height: 4),
            Text(
              'Supply type on e-invoices: ${_f.productType == 'service' ? 'Service' : 'Goods'}',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
            ),
            const SizedBox(height: 8),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.folder_outlined),
              title: const Text('Category'),
              subtitle: Text(_f.categoryLabel ?? 'No category'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                final choice = await showCategoryPicker(context);
                if (choice == null) return;
                setState(() {
                  _f.categoryId = choice.category?.id;
                  _f.categoryLabel = choice.category?.fullPath;
                });
              },
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.straighten),
              title: const Text('Base unit (stock)'),
              subtitle: Text(salesUnit?.label ?? 'Units (default)'),
              trailing: const Icon(Icons.chevron_right),
              onTap: uoms.isEmpty
                  ? null
                  : () async {
                      final u = await showUnitPicker(context, uoms);
                      if (u == null) return;
                      setState(() {
                        _f.uomId = u.id;
                        _f.purchaseUomId = null;
                        _f.salesUomId = null;
                      });
                    },
            ),
            if (salesUnit != null && salesUnit.morCode == null)
              Text(
                '"${salesUnit.name}" has no MoR unit code yet, so e-invoices can\'t use it. Set one under Units of measure.',
                style: const TextStyle(fontSize: 12, color: AppColors.warning),
              ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.shopping_cart_outlined),
              title: const Text('Purchase unit'),
              subtitle: Text(purchaseUnit?.label ?? 'Same as base unit'),
              trailing: const Icon(Icons.chevron_right),
              onTap: uoms.isEmpty
                  ? null
                  : () async {
                      final u = await showUnitPicker(context, uoms, sameKindAs: _f.uomId);
                      if (u == null) return;
                      setState(() => _f.purchaseUomId = u.id);
                    },
            ),
            if (_errors['purchase_uom_id'] != null)
              Text(_errors['purchase_uom_id']!, style: const TextStyle(fontSize: 12, color: AppColors.error)),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.sell_outlined),
              title: const Text('Sales unit'),
              subtitle: Text(sellUnit?.label ?? 'Same as base unit'),
              trailing: const Icon(Icons.chevron_right),
              onTap: uoms.isEmpty
                  ? null
                  : () async {
                      final u = await showUnitPicker(context, uoms, sameKindAs: _f.uomId);
                      if (u == null) return;
                      setState(() => _f.salesUomId = u.id == _f.uomId ? null : u.id);
                    },
            ),
            if (_errors['sales_uom_id'] != null)
              Text(_errors['sales_uom_id']!, style: const TextStyle(fontSize: 12, color: AppColors.error)),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    initialValue: _f.minSaleQty,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: deco('Minimum order', 'min_sale_qty', hint: 'None'),
                    onChanged: (v) => _f.minSaleQty = v,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    initialValue: _f.saleQtyStep,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: deco('Sold in multiples of', 'sale_qty_step', hint: 'Any quantity'),
                    onChanged: (v) => _f.saleQtyStep = v,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    initialValue: _f.salesPrice,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: deco('Sales price', 'sales_price', hint: '0'),
                    onChanged: (v) => _f.salesPrice = v,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    initialValue: _f.costPrice,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: deco('Cost', 'cost_price', hint: '0'),
                    onChanged: (v) => _f.costPrice = v,
                  ),
                ),
              ],
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.percent),
              title: const Text('Tax'),
              subtitle: Text(kEimsTaxCodeLabels[_f.taxCode] ?? _f.taxCode),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                final code = await showTaxCodePicker(context, _f.taxCode);
                if (code != null) setState(() => _f.taxCode = code);
              },
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Can be sold'),
              value: _f.canBeSold,
              onChanged: (v) => setState(() => _f.canBeSold = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Can be purchased'),
              value: _f.canBePurchased,
              onChanged: (v) => setState(() => _f.canBePurchased = v),
            ),
            const ProductsSectionTitle('E-invoicing (MoR)', icon: Icons.receipt_long_outlined),
            TextFormField(
              initialValue: _f.itemCode,
              maxLength: 15,
              decoration: deco('Item code', 'item_code', hint: widget.isEdit ? null : 'Generated if empty'),
              onChanged: (v) => _f.itemCode = v,
            ),
            TextFormField(
              initialValue: _f.harmonizationCode,
              maxLength: 15,
              keyboardType: TextInputType.number,
              decoration: deco('HS code', 'harmonization_code', hint: 'Needed for exports'),
              onChanged: (v) => _f.harmonizationCode = v,
            ),
            TextFormField(
              initialValue: _f.exciseRate,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: deco('Excise %', 'excise_rate', hint: 'From category', helper: 'Leave empty to use the category rate'),
              onChanged: (v) => _f.exciseRate = v,
            ),
            const SizedBox(height: 12),
            TextFormField(
              initialValue: _f.invoiceDescription,
              maxLength: kMorDescriptionMax,
              decoration: deco('Invoice description', 'invoice_description', hint: 'Defaults to the product name'),
              onChanged: (v) => setState(() => _f.invoiceDescription = v),
            ),
            if (_f.needsInvoiceDescription)
              const Text(
                "The name is over 100 characters, which MoR won't accept. Add a shorter invoice description.",
                style: TextStyle(fontSize: 12, color: AppColors.warning),
              ),
            const ProductsSectionTitle('Barcodes', icon: Icons.qr_code_2),
            for (var i = 0; i < _f.barcodes.length; i++)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: IconButton(
                  tooltip: 'Make primary',
                  icon: Icon(_f.barcodes[i].isPrimary ? Icons.star : Icons.star_border),
                  onPressed: () => setState(() {
                    _f.barcodes = [
                      for (var j = 0; j < _f.barcodes.length; j++)
                        ProductBarcode(
                          barcode: _f.barcodes[j].barcode,
                          packaging: _f.barcodes[j].packaging,
                          quantity: _f.barcodes[j].quantity,
                          isPrimary: j == i,
                        ),
                    ];
                  }),
                ),
                title: Text(_f.barcodes[i].barcode),
                subtitle: _f.barcodes[i].isPrimary ? const Text('Primary') : null,
                trailing: IconButton(
                  tooltip: 'Remove barcode',
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => setState(() => _f.barcodes.removeAt(i)),
                ),
              ),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _barcodeController,
                    decoration: const InputDecoration(labelText: 'Type or scan a barcode', border: OutlineInputBorder()),
                    onSubmitted: _addBarcode,
                  ),
                ),
                IconButton(
                  tooltip: 'Scan with camera',
                  icon: const Icon(Icons.qr_code_scanner_rounded),
                  onPressed: _scanBarcode,
                ),
                IconButton(
                  tooltip: 'Add',
                  icon: const Icon(Icons.add),
                  onPressed: () => _addBarcode(_barcodeController.text),
                ),
              ],
            ),
            if (_errors['barcodes'] != null)
              Text(_errors['barcodes']!, style: const TextStyle(fontSize: 12, color: AppColors.error)),
            const SizedBox(height: 16),
            TextFormField(
              initialValue: _f.description,
              maxLines: 3,
              decoration: deco('Description', 'description'),
              onChanged: (v) => _f.description = v,
            ),
          ],
        ),
      ),
    );
  }
}
