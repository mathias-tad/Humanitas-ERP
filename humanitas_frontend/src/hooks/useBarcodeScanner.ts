import { useEffect, useRef } from 'react';
import { ScanDetector, isBarcodeField, isTextEntry, removeScannedText } from '@/lib/scanDetector';

/**
 * Hardware barcode scanners on any page (USB or Bluetooth in keyboard mode).
 * The most recently mounted enabled handler receives scans, so a product form open in a drawer
 * gets them before the page behind it. Products, Sales and POS all use this one hook
 * (AGENTS.md rule 24): scans work without clicking into a field, a scan that lands in a normal
 * field (search, name) is taken back out of it, and the scanner's Enter never submits a form.
 * Barcode fields (data-barcode-input) keep the scanned text as typed.
 */
type Handler = { onScan: (code: string) => void };
const handlers: Handler[] = [];
const detector = new ScanDetector();
let installed = false;

function onKeyDown(e: KeyboardEvent) {
  if (!handlers.length || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
  const target = document.activeElement;
  const code = detector.push(e.key, e.timeStamp || performance.now());
  if (!code) return;
  e.preventDefault(); // the scanner's Enter must never submit a form or press a focused button
  if (isBarcodeField(target)) return; // the field keeps the text; its own Enter handling (if any) still runs
  e.stopPropagation();
  if (isTextEntry(target)) removeScannedText(target, code);
  handlers[handlers.length - 1].onScan(code);
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', onKeyDown, true);
}

export function useBarcodeScanner(onScan: (code: string) => void, { enabled = true }: { enabled?: boolean } = {}) {
  const ref = useRef(onScan);
  useEffect(() => {
    ref.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    const handler: Handler = { onScan: (code) => ref.current(code) };
    handlers.push(handler);
    install();
    return () => {
      const i = handlers.indexOf(handler);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, [enabled]);
}

/** For tests: forget registered handlers and any scan in progress. */
export function resetBarcodeScannerForTests() {
  handlers.length = 0;
  detector.reset();
}
