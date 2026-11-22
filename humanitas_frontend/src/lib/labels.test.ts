import { describe, expect, it } from 'vitest';
import type { Product } from '@/hooks/useProducts';
import { MAX_LABELS, NEW_TEMPLATE, expandLabels, labelCode, labelsPerPage, layoutProblem, pageSize, paginate, slotPosition, type LabelTemplate } from './labels';

const product = (over: Partial<Product> = {}) =>
  ({ id: 'p1', name: 'Teff flour 1kg', sku: 'TEFF1', item_code: 'P0000001', sales_price: '120.00', barcodes: [], parent_id: null, parent_name: null, variant_label: null, ...over }) as unknown as Product;
const sheet: LabelTemplate = {
  ...NEW_TEMPLATE, id: 't1', name: 'A4 3 × 8', layout: 'sheet', label_width_mm: '70.00', label_height_mm: '37.00', columns: 3, rows: 8,
  margin_top_mm: '0.50', company_id: null, sort_order: 1, is_active: true,
};

describe('labels', () => {
  it('checks that the labels fit on the page, as the server does', () => {
    expect(layoutProblem(sheet)).toBeNull();
    expect(layoutProblem({ ...sheet, columns: 4 })).toBe('4 labels of 70 mm with 0 mm gaps and a 0 mm margin need 280 mm; the page is 210 mm wide');
    expect(layoutProblem({ ...sheet, layout: 'roll', columns: 4 })).toBeNull();
  });

  it('uses the primary barcode, else the first, else the item code', () => {
    expect(labelCode(product({ barcodes: [{ barcode: '111' }, { barcode: '4006381333931', is_primary: true }] }))).toBe('4006381333931');
    expect(labelCode(product({ barcodes: [{ barcode: '111' }] }))).toBe('111');
    expect(labelCode(product())).toBe('P0000001');
  });

  it('makes one label per copy, with the list price when there is one', () => {
    const labels = expandLabels([{ product: product(), copies: 2 }, { product: product({ id: 'p2', name: 'Eggs' }), copies: 1 }], { p1: 110 });
    expect(labels.map((l) => [l.name, l.price])).toEqual([['Teff flour 1kg', 110], ['Teff flour 1kg', 110], ['Eggs', 120]]);
  });

  it('labels a variant with its parent name and its values', () => {
    const [l] = expandLabels([{ product: product({ name: 'T-shirt (Red, M)', parent_id: 'p0', parent_name: 'T-shirt', variant_label: 'Red, M' }), copies: 1 }], undefined);
    expect(l).toMatchObject({ name: 'T-shirt', variant: 'Red, M' });
  });

  it('stops at the most labels one print run makes', () => {
    expect(expandLabels([{ product: product(), copies: 5000 }], undefined)).toHaveLength(MAX_LABELS);
  });

  it('lays out sheets row by row and rolls one label per page', () => {
    expect(labelsPerPage(sheet)).toBe(24);
    expect(labelsPerPage({ ...sheet, layout: 'roll' })).toBe(1);
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(slotPosition(sheet, 0)).toEqual({ left: 0, top: 0.5 });
    expect(slotPosition(sheet, 4)).toEqual({ left: 70, top: 37.5 });
    expect(pageSize(sheet)).toEqual({ width: 210, height: 297 });
    expect(pageSize({ ...sheet, layout: 'roll' })).toEqual({ width: 70, height: 37 });
  });
});
