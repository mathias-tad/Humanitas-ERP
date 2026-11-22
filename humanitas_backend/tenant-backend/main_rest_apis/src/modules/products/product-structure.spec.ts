import {
  compositionProblem, ean13, formatSku, gs1CheckDigit, gtinType, isValidGtin, marginBand, marginPercent, packagingProblem, quantityProblem, sniffFile,
} from './product-structure';

describe('GS1 barcodes', () => {
  it('computes check digits and validates GTINs', () => {
    expect(gs1CheckDigit('629104150021')).toBe(3);
    expect(isValidGtin('6291041500213')).toBe(true);
    expect(isValidGtin('6291041500214')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true);
    expect(isValidGtin('036000291452')).toBe(true);
    expect(isValidGtin('10012345678902')).toBe(true);
    expect(isValidGtin('12345')).toBe(false);
    expect(gtinType('10012345678902')).toBe('code128');
  });

  it('makes in-store EAN-13s from a prefix and a number', () => {
    const code = ean13('20', 42);
    expect(code).toBe('2000000000428');
    expect(isValidGtin(code)).toBe(true);
    expect(() => ean13('2012345678', 1000)).toThrow();
    expect(formatSku('P', 6, 12)).toBe('P000012');
  });
});

describe('order quantities', () => {
  it('checks the minimum order and multiples', () => {
    expect(quantityProblem(5, 10, null, 'pc')).toBe('The minimum order is 10 pc');
    expect(quantityProblem(13, 12, 6)).toBe('Sold in multiples of 6');
    expect(quantityProblem(18, 12, 6)).toBeNull();
    expect(quantityProblem(0.75, 0, 0.25)).toBeNull();
    expect(quantityProblem(1, '0', null)).toBeNull();
  });
});

describe('packaging', () => {
  it('needs unique names and GTINs, valid GTINs and a quantity', () => {
    expect(packagingProblem([{ name: 'Box', quantity: 12 }, { name: 'box ', quantity: 6 }])).toMatch(/twice/);
    expect(packagingProblem([{ name: 'Box', quantity: 0 }])).toMatch(/how many/);
    expect(packagingProblem([{ name: 'Box', quantity: 12, gtin: '6291041500214' }])).toMatch(/not a valid GTIN/);
    expect(packagingProblem([{ name: 'Box', quantity: 12, gtin: '16291041500210' }, { name: 'Case', quantity: 48 }])).toBeNull();
  });
});

describe('kits and combos', () => {
  const A = 'a', B = 'b';
  it('checks a kit', () => {
    expect(compositionProblem('k', 'kit', [], [])).toMatch(/Add the products/);
    expect(compositionProblem('k', 'kit', [{ component_id: 'k', quantity: 1 }], [])).toMatch(/itself/);
    expect(compositionProblem('k', 'kit', [{ component_id: A, quantity: 1 }, { component_id: A, quantity: 2 }], [])).toMatch(/twice/);
    expect(compositionProblem('k', 'kit', [{ component_id: A, quantity: 2 }, { component_id: B, quantity: 1 }], [])).toBeNull();
  });

  it('checks a combo', () => {
    const g = (over = {}) => ({ name: 'Drink', min_choices: 1, max_choices: 1, choices: [{ component_id: A }, { component_id: B, extra_price: 10 }], ...over });
    expect(compositionProblem('c', 'combo', [], [])).toMatch(/choice group/);
    expect(compositionProblem('c', 'combo', [], [g({ max_choices: 3 })])).toMatch(/allows 3 choices but has only 2/);
    expect(compositionProblem('c', 'combo', [], [g({ min_choices: 2 })])).toMatch(/minimum/);
    expect(compositionProblem('c', 'combo', [], [g(), g()])).toMatch(/listed twice/);
    expect(compositionProblem('c', 'combo', [], [g({ choices: [{ component_id: A, is_default: true }, { component_id: B, is_default: true }] })])).toMatch(/default/);
    expect(compositionProblem('c', 'combo', [], [g(), g({ name: 'Main', min_choices: 0, max_choices: 2 })])).toBeNull();
    expect(compositionProblem('s', 'single', [], [])).toBeNull();
  });
});

describe('margins and files', () => {
  it('computes margins and bands', () => {
    expect(marginPercent(100, 75)).toBe(25);
    expect(marginPercent(0, 10)).toBeNull();
    expect(marginBand(-5)).toBe('negative');
    expect(marginBand(9.9)).toBe('low');
    expect(marginBand(25)).toBe('good');
    expect(marginBand(80)).toBe('high');
  });

  it('tells pictures and documents by their bytes, not their name', () => {
    expect(sniffFile(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), '.png')).toEqual({ kind: 'image', mime: 'image/jpeg' });
    expect(sniffFile(Buffer.from('%PDF-1.7'), '.pdf')).toEqual({ kind: 'document', mime: 'application/pdf' });
    expect(sniffFile(Buffer.from('<html><script>'), '.jpg')).toBeNull();
    expect(sniffFile(Buffer.from([0x50, 0x4b, 0x03, 0x04]), '.zip')).toBeNull();
    expect(sniffFile(Buffer.from('a,b\n1,2'), '.csv')).toEqual({ kind: 'document', mime: 'text/csv' });
  });
});
