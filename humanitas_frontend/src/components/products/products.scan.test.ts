import { describe, expect, it } from 'vitest';
import { addScannedBarcode, emptyProductForm } from './ProductForm';

describe('scanning barcodes into the product form', () => {
  it('adds a scanned code; the first becomes primary', () => {
    const r = addScannedBarcode([], ' 629104 ');
    expect(r).toEqual({ barcodes: [{ barcode: '629104', quantity: 1, is_primary: true }], duplicate: false });
    expect(addScannedBarcode(r.barcodes, '777').barcodes[1]).toMatchObject({ barcode: '777', is_primary: false });
  });

  it('fills an empty row first and refuses duplicates', () => {
    const rows = [{ barcode: '111', quantity: 1, is_primary: true }, { barcode: '', quantity: 1, is_primary: false }];
    expect(addScannedBarcode(rows, '222').barcodes.map((b) => b.barcode)).toEqual(['111', '222']);
    expect(addScannedBarcode(rows, '111')).toEqual({ barcodes: rows, duplicate: true });
    expect(addScannedBarcode(rows, '  ').duplicate).toBe(false);
  });

  it('starts a new product from a scanned barcode', () => {
    expect(emptyProductForm({ barcode: ' 629104 ' }).barcodes).toEqual([{ barcode: '629104', quantity: 1, is_primary: true }]);
    expect(emptyProductForm().barcodes).toEqual([]);
  });
});
