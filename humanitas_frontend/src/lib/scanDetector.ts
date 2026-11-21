/**
 * Recognises a hardware barcode scanner (USB or Bluetooth, "keyboard mode"): it types the code far
 * faster than a person, then sends Enter (or Tab). People never type 4+ characters with every key
 * under ~50 ms apart, so a fast burst ending in Enter is a scan.
 */
export interface ScanDetectorOptions {
  /** Shortest code accepted (EAN-8 is 8; short internal codes exist, so 4). */
  minLength?: number;
  /** Longest pause between two characters of one scan. */
  maxGapMs?: number;
  /** What ends a scan: Enter, Tab, or either (default). */
  suffix?: 'enter' | 'tab' | 'any';
}

export class ScanDetector {
  private buffer = '';
  private last = 0;
  private minLength = 4;
  private maxGapMs = 50;
  private suffix: 'enter' | 'tab' | 'any' = 'any';

  constructor(opts: ScanDetectorOptions = {}) {
    this.configure(opts);
  }

  /** Apply the device's scanner settings (see scannerSettings.ts). */
  configure(opts: ScanDetectorOptions) {
    if (opts.minLength !== undefined) this.minLength = opts.minLength;
    if (opts.maxGapMs !== undefined) this.maxGapMs = opts.maxGapMs;
    if (opts.suffix !== undefined) this.suffix = opts.suffix;
  }

  /** True while characters of a possible scan are arriving (shortcuts wait for this to settle). */
  isBursting(time: number): boolean {
    return this.buffer.length > 1 && time - this.last <= this.maxGapMs;
  }

  /** Feed one key; returns the scanned code when this key completes a scan, otherwise null. */
  push(key: string, time: number): string | null {
    const ends = (key === 'Enter' && this.suffix !== 'tab') || (key === 'Tab' && this.suffix !== 'enter');
    if (ends) {
      const code = this.buffer;
      const fresh = time - this.last <= this.maxGapMs * 4;
      this.reset();
      return code.length >= this.minLength && fresh ? code : null;
    }
    if (key.length !== 1) {
      if (key !== 'Shift') this.reset();
      return null;
    }
    this.buffer = time - this.last > this.maxGapMs ? key : this.buffer + key;
    this.last = time;
    return null;
  }

  /** Characters of the scan in progress (to take them back out of a field they landed in). */
  get pending(): string {
    return this.buffer;
  }

  reset() {
    this.buffer = '';
    this.last = 0;
  }
}

/** Fields where typed text belongs (a scan there is taken back out unless it is a barcode field). */
export function isTextEntry(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'hidden'].includes((el as HTMLInputElement).type);
}

/** Barcode fields keep scanned text; mark them with data-barcode-input. */
export function isBarcodeField(el: Element | null): boolean {
  return !!el && el instanceof HTMLElement && el.dataset.barcodeInput !== undefined;
}

/** Remove a scan's text from a React-controlled field (sets the value the way React notices). */
export function removeScannedText(el: HTMLInputElement | HTMLTextAreaElement, code: string) {
  const value = el.value;
  const at = value.lastIndexOf(code);
  if (at < 0) return;
  const next = value.slice(0, at) + value.slice(at + code.length);
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
