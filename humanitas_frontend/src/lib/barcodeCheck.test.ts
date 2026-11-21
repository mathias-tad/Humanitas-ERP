import { describe, expect, it } from 'vitest';
import { gs1CheckDigitOk, isPlausibleRead, ReadConfirmer, upcEToUpcA } from './barcodeCheck';

describe('gs1CheckDigitOk', () => {
  it('accepts codes whose check digit matches', () => {
    expect(gs1CheckDigitOk('6291041500213')).toBe(true); // EAN-13
    expect(gs1CheckDigitOk('4006381333931')).toBe(true); // EAN-13
    expect(gs1CheckDigitOk('96385074')).toBe(true); // EAN-8
    expect(gs1CheckDigitOk('036000291452')).toBe(true); // UPC-A
    expect(gs1CheckDigitOk('10012345678902')).toBe(true); // ITF-14
  });
  it('rejects a code with one wrong digit', () => {
    expect(gs1CheckDigitOk('6291041500214')).toBe(false);
    expect(gs1CheckDigitOk('6291041580213')).toBe(false);
    expect(gs1CheckDigitOk('abc')).toBe(false);
  });
});

describe('upcEToUpcA', () => {
  it('expands UPC-E to UPC-A', () => {
    expect(upcEToUpcA('04252614')).toBe('042100005264');
    expect(gs1CheckDigitOk(upcEToUpcA('04252614')!)).toBe(true);
    expect(upcEToUpcA('12345')).toBeNull();
  });
});

describe('isPlausibleRead', () => {
  it('checks retail codes against their format', () => {
    expect(isPlausibleRead('6291041500213', 'EAN_13')).toBe(true);
    expect(isPlausibleRead('6291041500214', 'EAN_13')).toBe(false);
    expect(isPlausibleRead('629104150021', 'EAN_13')).toBe(false);
    expect(isPlausibleRead('96385074', 'EAN_8')).toBe(true);
    expect(isPlausibleRead('036000291452', 'UPC_A')).toBe(true);
    expect(isPlausibleRead('04252614', 'UPC_E')).toBe(true);
    expect(isPlausibleRead('04252615', 'UPC_E')).toBe(false);
  });
  it('rejects short or odd ITF reads, which are usually partial EAN reads', () => {
    expect(isPlausibleRead('1041', 'ITF')).toBe(false);
    expect(isPlausibleRead('10415', 'ITF')).toBe(false);
    expect(isPlausibleRead('104150', 'ITF')).toBe(true);
    expect(isPlausibleRead('10012345678902', 'ITF')).toBe(true);
    expect(isPlausibleRead('10012345678903', 'ITF')).toBe(false);
  });
  it('accepts text codes and QR codes, and checks retail-looking codes of unknown format', () => {
    expect(isPlausibleRead('SKU-001', 'CODE_128')).toBe(true);
    expect(isPlausibleRead('AB', 'CODE_39')).toBe(false);
    expect(isPlausibleRead('https://example.com', 'QR_CODE')).toBe(true);
    expect(isPlausibleRead('6291041500214', undefined)).toBe(false);
    expect(isPlausibleRead('6291041500213', undefined)).toBe(true);
  });
});

describe('ReadConfirmer', () => {
  it('confirms a code read the same way twice in a row', () => {
    const c = new ReadConfirmer();
    expect(c.push('111', 0)).toBeNull();
    expect(c.push('111', 100)).toBe('111');
  });
  it('starts over when a different code is read', () => {
    const c = new ReadConfirmer();
    c.push('111', 0);
    expect(c.push('112', 100)).toBeNull();
    expect(c.push('111', 200)).toBeNull();
    expect(c.push('111', 300)).toBe('111');
  });
  it('starts over when the reads are too far apart', () => {
    const c = new ReadConfirmer(2, 1000);
    c.push('111', 0);
    expect(c.push('111', 2000)).toBeNull();
    expect(c.push('111', 2500)).toBe('111');
  });
});
