import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resetBarcodeScannerForTests, useBarcodeScanner } from './useBarcodeScanner';

/** What a USB scanner sends: every character at once, then Enter. Returns the Enter event. */
function scan(code: string, target: EventTarget = document.activeElement ?? document.body) {
  for (const key of code) target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  target.dispatchEvent(enter);
  return enter;
}

function Listener({ onScan, children }: { onScan: (c: string) => void; children?: ReactNode }) {
  useBarcodeScanner(onScan);
  return <>{children}</>;
}

function SearchBox() {
  const [v, setV] = useState('teff 6291041500213');
  return <input aria-label="search" value={v} onChange={(e) => setV(e.target.value)} />;
}

afterEach(() => resetBarcodeScannerForTests());

describe('useBarcodeScanner (hardware scanners)', () => {
  it('receives scans without any field selected and stops Enter from submitting or clicking', () => {
    const onScan = vi.fn();
    render(<Listener onScan={onScan} />);
    const enter = scan('6291041500213', document.body);
    expect(onScan).toHaveBeenCalledWith('6291041500213');
    expect(enter.defaultPrevented).toBe(true);
  });

  it('gives the scan to the screen opened last (a drawer before the page behind it)', () => {
    const page = vi.fn();
    const drawer = vi.fn();
    const { rerender } = render(<><Listener onScan={page} /><Listener onScan={drawer} /></>);
    scan('12345678', document.body);
    expect(drawer).toHaveBeenCalledWith('12345678');
    expect(page).not.toHaveBeenCalled();
    rerender(<Listener onScan={page} />);
    scan('87654321', document.body);
    expect(page).toHaveBeenCalledWith('87654321');
  });

  it('takes a scan back out of a normal field it landed in', () => {
    const onScan = vi.fn();
    render(<Listener onScan={onScan}><SearchBox /></Listener>);
    const box = screen.getByLabelText('search') as HTMLInputElement;
    box.focus();
    scan('6291041500213', box);
    expect(onScan).toHaveBeenCalledWith('6291041500213');
    expect(box.value).toBe('teff ');
  });

  it('leaves barcode fields alone but still blocks the Enter', () => {
    const onScan = vi.fn();
    render(<Listener onScan={onScan}><input aria-label="barcode" data-barcode-input defaultValue="6291041500213" /></Listener>);
    const field = screen.getByLabelText('barcode') as HTMLInputElement;
    field.focus();
    const enter = scan('6291041500213', field);
    expect(onScan).not.toHaveBeenCalled();
    expect(field.value).toBe('6291041500213');
    expect(enter.defaultPrevented).toBe(true);
  });
});
