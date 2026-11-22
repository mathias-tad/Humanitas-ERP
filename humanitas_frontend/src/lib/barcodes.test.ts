import { describe, expect, it } from 'vitest';
import { CODE128_PATTERNS, chooseFormat, code128Modules, code128Values, ean13Modules, ean8Modules } from './barcodes';

describe('Code 128', () => {
  it('has 106 symbols of 11 modules and a 13-module stop, all different', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    CODE128_PATTERNS.forEach((p, i) => {
      expect(p.split('').reduce((s, d) => s + Number(d), 0)).toBe(i === 106 ? 13 : 11);
    });
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
  });

  it('encodes text in set B with the weighted checksum', () => {
    // A=33, B=34: (104 + 33×1 + 34×2) mod 103 = 102
    expect(code128Values('AB')).toEqual([104, 33, 34, 102, 106]);
    expect(code128Modules('AB')).toHaveLength(11 * 4 + 13);
  });

  it('packs an even run of digits two per symbol (set C)', () => {
    // (105 + 12×1 + 34×2) mod 103 = 82
    expect(code128Values('1234')).toEqual([105, 12, 34, 82, 106]);
  });

  it('refuses characters it cannot print', () => {
    expect(code128Values('ብር')).toBeNull();
    expect(code128Values('')).toBeNull();
  });
});

describe('EAN', () => {
  it('draws a valid EAN-13 with guards and 95 modules', () => {
    const m = ean13Modules('4006381333931')!;
    expect(m).toHaveLength(95);
    expect(m.startsWith('101')).toBe(true);
    expect(m.slice(45, 50)).toBe('01010');
    expect(m.endsWith('101')).toBe(true);
    // First digit 4 = LGLLGG: the second digit (0) is L-coded, the third (0) G-coded.
    expect(m.slice(3, 10)).toBe('0001101');
    expect(m.slice(10, 17)).toBe('0100111');
  });

  it('refuses a wrong check digit instead of printing a bad barcode', () => {
    expect(ean13Modules('4006381333932')).toBeNull();
  });

  it('draws EAN-8 with 67 modules', () => {
    expect(ean8Modules('96385074')).toHaveLength(67);
  });
});

describe('chooseFormat', () => {
  it('prints retail codes as EAN and other codes as Code 128', () => {
    expect(chooseFormat('4006381333931', 'auto')).toEqual({ format: 'ean13', value: '4006381333931' });
    expect(chooseFormat('036000291452', 'auto')).toEqual({ format: 'ean13', value: '0036000291452' });
    expect(chooseFormat('96385074', 'auto')).toEqual({ format: 'ean8', value: '96385074' });
    expect(chooseFormat('P0000123', 'auto')).toEqual({ format: 'code128', value: 'P0000123' });
    expect(chooseFormat('4006381333932', 'auto')).toEqual({ format: 'code128', value: '4006381333932' });
  });

  it('follows the template: QR, always Code 128, or no barcode', () => {
    expect(chooseFormat('4006381333931', 'qr')).toEqual({ format: 'qr', value: '4006381333931' });
    expect(chooseFormat('4006381333931', 'code128')?.format).toBe('code128');
    expect(chooseFormat('P1', 'none')).toBeNull();
    expect(chooseFormat('ብር 10', 'auto')?.format).toBe('qr');
  });
});
