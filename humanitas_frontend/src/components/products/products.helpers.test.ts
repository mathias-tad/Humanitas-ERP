import { describe, expect, it } from 'vitest';
import { emptyProductForm, formToInput, productToForm, validateProductForm } from './ProductForm';
import { selfAndDescendants } from './CategoryForm';
import { ratioText } from '@/pages/products/UnitsPage';
import { formatValue } from '@/components/platform/TimelinePanel';
import type { Product, ProductCategory, UomCategory } from '@/hooks/useProducts';

const uoms: UomCategory[] = [
  { id: 'unit', name: 'Unit', is_active: true, units: [{ id: 'pcs', name: 'Units', symbol: 'pc', ratio: 1, mor_code: 'PCS', is_reference: true, rounding: 1, is_active: true }] },
  { id: 'weight', name: 'Weight', is_active: true, units: [
    { id: 'kg', name: 'kg', symbol: 'kg', mor_code: 'KLG', ratio: 1, is_reference: true, rounding: 0.001, is_active: true },
    { id: 'qt', name: 'Quintal', symbol: 'qt', mor_code: null, ratio: '100.00000000', is_reference: false, rounding: 0.001, is_active: true },
  ] },
];

describe('product form helpers', () => {
  it('starts from what the user typed in a picker', () => {
    expect(emptyProductForm({ name: 'Buna' }).name).toBe('Buna');
  });

  it('validates required name, numbers, unit kinds and barcodes', () => {
    const f = { ...emptyProductForm(), name: ' ', sales_price: '-1', uom_id: 'kg', purchase_uom_id: 'pcs',
      barcodes: [{ barcode: '123' }, { barcode: '123' }] };
    expect(Object.keys(validateProductForm(f, uoms)).sort()).toEqual(['barcodes', 'name', 'purchase_uom_id', 'sales_price']);
    const ok = { ...emptyProductForm(), name: 'Teff', uom_id: 'kg', purchase_uom_id: 'qt', sales_price: '120', tax_code: 'VAT15' as const };
    expect(validateProductForm(ok, uoms)).toEqual({});
  });

  it('enforces the MoR e-invoicing limits (rule 28)', () => {
    const f = {
      ...emptyProductForm(), name: 'Beer', item_code: 'ITEM-CODE-TOO-LONG', harmonization_code: '22-03', excise_rate: '600',
      invoice_description: 'x'.repeat(101), tax_code: 'VAT5' as never,
    };
    expect(Object.keys(validateProductForm(f, uoms)).sort()).toEqual(
      ['excise_rate', 'harmonization_code', 'invoice_description', 'item_code', 'tax_code']);
    const ok = { ...emptyProductForm(), name: 'Beer', item_code: 'BR-330', harmonization_code: '22030000', excise_rate: '25',
      invoice_description: 'Beer 330 ml', tax_code: 'VATEX' as const };
    expect(validateProductForm(ok, uoms)).toEqual({});
  });

  it('builds the API payload: trims, converts numbers, drops empty barcodes', () => {
    const input = formToInput({ ...emptyProductForm(), name: ' Teff ', sku: ' ', sales_price: '120.5',
      barcodes: [{ barcode: ' 629 ', quantity: '10', is_primary: true }, { barcode: '  ' }] });
    expect(input).toMatchObject({
      name: 'Teff', sku: null, sales_price: 120.5, cost_price: 0, uom_id: undefined,
      tax_code: 'VAT15', item_code: undefined, harmonization_code: null, excise_rate: null, invoice_description: null,
    });
    expect(input).not.toHaveProperty('tax_rate');
    expect(formToInput({ ...emptyProductForm(), name: 'x', item_code: ' BR-1 ', excise_rate: '12.5' }))
      .toMatchObject({ item_code: 'BR-1', excise_rate: 12.5 });
    expect(input.barcodes).toEqual([{ barcode: '629', packaging: undefined, quantity: 10, is_primary: true }]);
  });

  it('loads an API product into the form', () => {
    const p = { name: 'Teff', sku: 'T1', product_type: 'storable', category_id: 'c', category_name: 'Food / Grains', uom_id: 'kg',
      purchase_uom_id: 'qt', sales_price: '120.0000', cost_price: '90.5000', tax_code: 'TOT2', item_code: 'T1', excise_rate: '10.0000',
      harmonization_code: null, invoice_description: null, can_be_sold: true, can_be_purchased: false,
      description: null, barcodes: [{ barcode: '629', quantity: '1.0000', is_primary: true }] } as unknown as Product;
    expect(productToForm(p)).toMatchObject({ sales_price: '120', cost_price: '90.5', tax_code: 'TOT2', item_code: 'T1',
      excise_rate: '10', harmonization_code: '', invoice_description: '', can_be_purchased: false,
      barcodes: [{ barcode: '629', quantity: 1, is_primary: true }] });
  });
});

describe('category and unit helpers', () => {
  it('finds a category and all its descendants', () => {
    const cats = [
      { id: 'food', parent_id: null }, { id: 'grains', parent_id: 'food' }, { id: 'teff', parent_id: 'grains' }, { id: 'drinks', parent_id: null },
    ] as ProductCategory[];
    expect(selfAndDescendants(cats, 'food').sort()).toEqual(['food', 'grains', 'teff']);
    expect(selfAndDescendants(cats, 'drinks')).toEqual(['drinks']);
  });

  it('explains unit ratios in plain words', () => {
    expect(ratioText({ name: 'Quintal', ratio: '100.00000000', is_reference: false }, { name: 'kg' })).toBe('1 Quintal = 100 kg');
    expect(ratioText({ name: 'g', ratio: '0.00100000', is_reference: false }, { name: 'kg' })).toBe('1 g = 0.001 kg');
    expect(ratioText({ name: 'kg', ratio: 1, is_reference: true }, { name: 'kg' })).toBe('Reference unit');
  });

  it('formats timeline values', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(true)).toBe('Yes');
    expect(formatValue(['a', 'b'])).toBe('a, b');
    expect(formatValue('120.0000')).toBe('120.0000');
  });
});
