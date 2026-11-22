import { describe, expect, it } from 'vitest';
import {
  compositionDraftProblem, ean13Preview, fileSizeText, isValidGtin, kitTotals, mediaUrl, moveId, packagingListProblem, packagingToInput, skuPreview,
} from './useProductExtras';

describe('GS1 and numbering helpers', () => {
  it('validates GTINs like the API', () => {
    expect(isValidGtin('6291041500213')).toBe(true);
    expect(isValidGtin('6291041500214')).toBe(false);
    expect(isValidGtin('16291041500210')).toBe(true);
    expect(isValidGtin('629104')).toBe(false);
  });

  it('previews the next SKU and in-store barcode', () => {
    expect(skuPreview('P', 6, 12)).toBe('P000012');
    expect(ean13Preview('20', 42)).toBe('2000000000428');
    expect(ean13Preview('2012345678', 1000)).toBeNull();
    expect(ean13Preview('2a', 1)).toBeNull();
  });
});

describe('packaging', () => {
  it('finds the first problem and builds the API rows', () => {
    const row = { name: 'Box of 12', level: 'case' as const, quantity: '12', gtin: '', can_sell: true, can_buy: true, weight_kg: '' };
    expect(packagingListProblem([row])).toBeNull();
    expect(packagingListProblem([row, { ...row, name: ' box of 12' }])).toMatch(/twice/);
    expect(packagingListProblem([{ ...row, gtin: '6291041500214' }])).toMatch(/not a valid GTIN/);
    expect(packagingListProblem([{ ...row, quantity: '0' }])).toMatch(/how many/);
    expect(packagingToInput({ ...row, gtin: ' 16291041500210 ' })).toMatchObject({ name: 'Box of 12', quantity: 12, gtin: '16291041500210', weight_kg: null });
  });
});

describe('kits and combos', () => {
  it('checks a kit draft and totals its components', () => {
    expect(compositionDraftProblem('k', 'kit', [], [])).toMatch(/Add the products/);
    expect(compositionDraftProblem('k', 'kit', [{ component_id: 'k', quantity: 1 }], [])).toMatch(/itself/);
    const comps = [{ component_id: 'a', quantity: '2', sales_price: '180', cost_price: '120' }, { component_id: 'b', quantity: 1, sales_price: '150', cost_price: '80' }];
    expect(compositionDraftProblem('k', 'kit', comps, [])).toBeNull();
    expect(kitTotals(comps)).toEqual({ price: 510, cost: 320 });
  });

  it('checks combo groups', () => {
    const g = { name: 'Drink', min_choices: 1, max_choices: 2, choices: [{ component_id: 'a' }] };
    expect(compositionDraftProblem('c', 'combo', [], [g])).toMatch(/allows 2 choices but has 1/);
    expect(compositionDraftProblem('c', 'combo', [], [{ ...g, max_choices: 1 }])).toBeNull();
    expect(compositionDraftProblem('c', 'combo', [], [{ ...g, max_choices: 1 }, { ...g, max_choices: 1, name: 'drink' }])).toMatch(/twice/);
    expect(compositionDraftProblem('s', 'single', [], [])).toBeNull();
  });
});

describe('media helpers', () => {
  it('reorders, sizes and builds file addresses', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(fileSizeText(2048)).toBe('2 KB');
    expect(fileSizeText(3 * 1024 * 1024)).toBe('3.0 MB');
    expect(mediaUrl('/uploads/products/t1/img_1.png', 'https://api.example.com/api/v1')).toBe('https://api.example.com/uploads/products/t1/img_1.png');
    expect(mediaUrl('uploads/a.png', 'https://api.example.com/api/v1/')).toBe('https://api.example.com/uploads/a.png');
    expect(mediaUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(mediaUrl(null)).toBe('');
  });
});
