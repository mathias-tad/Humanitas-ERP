import { describe, expect, it } from 'vitest';
import { ScanDetector, isBarcodeField, isTextEntry } from './scanDetector';

function feed(d: ScanDetector, text: string, start: number, gap: number, end = 'Enter') {
  let t = start;
  for (const ch of text) {
    d.push(ch, t);
    t += gap;
  }
  return d.push(end, t);
}

describe('ScanDetector', () => {
  it('recognises a scanner burst ending in Enter or Tab', () => {
    expect(feed(new ScanDetector(), '6291041500213', 1000, 8)).toBe('6291041500213');
    expect(feed(new ScanDetector(), 'TEFF-1KG', 1000, 20, 'Tab')).toBe('TEFF-1KG');
  });

  it('ignores people typing, short bursts and lone Enter', () => {
    expect(feed(new ScanDetector(), '6291041500213', 1000, 120)).toBeNull();
    expect(feed(new ScanDetector(), '12', 1000, 5)).toBeNull();
    expect(new ScanDetector().push('Enter', 5)).toBeNull();
  });

  it('keeps Shift inside a scan (capital letters) but resets on other control keys', () => {
    const d = new ScanDetector();
    d.push('A', 100);
    d.push('Shift', 105);
    d.push('B', 110);
    d.push('C', 115);
    expect(d.push('D', 120)).toBeNull();
    expect(d.pending).toBe('ABCD');
    d.push('ArrowLeft', 125);
    expect(d.pending).toBe('');
  });
});

describe('field detection', () => {
  it('knows text fields from buttons and barcode fields from others', () => {
    const input = document.createElement('input');
    const check = Object.assign(document.createElement('input'), { type: 'checkbox' });
    const barcode = document.createElement('input');
    barcode.dataset.barcodeInput = '';
    expect(isTextEntry(input)).toBe(true);
    expect(isTextEntry(document.createElement('textarea'))).toBe(true);
    expect(isTextEntry(check)).toBe(false);
    expect(isTextEntry(document.createElement('button'))).toBe(false);
    expect(isBarcodeField(barcode)).toBe(true);
    expect(isBarcodeField(input)).toBe(false);
  });
});
