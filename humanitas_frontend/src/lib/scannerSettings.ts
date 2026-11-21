import { useSyncExternalStore } from 'react';

/**
 * Barcode scanner settings, saved per browser (each till, desk or tablet has its own device).
 * Used by useBarcodeScanner (USB/Bluetooth scanners) and BarcodeScanDialog (camera).
 */
export type ScanSuffix = 'enter' | 'tab' | 'any';

export interface ScannerSettings {
  /** Listen for USB/Bluetooth scanners in keyboard mode. */
  hardwareEnabled: boolean;
  /** What the scanner sends after each code. */
  suffix: ScanSuffix;
  /** Shortest code accepted. */
  minLength: number;
  /** Longest pause between characters of one scan (tuned with "Test your scanner"). */
  maxGapMs: number;
  /** Short beep when a scan is read (useful at a counter). */
  beep: boolean;
  /** Camera used by "Scan with camera"; null = back camera automatically. */
  cameraId: string | null;
  cameraLabel: string | null;
}

export const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  hardwareEnabled: true,
  suffix: 'any',
  minLength: 4,
  maxGapMs: 50,
  beep: false,
  cameraId: null,
  cameraLabel: null,
};

const KEY = 'humanitas.scanner.v1';
const listeners = new Set<() => void>();

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(hi, Math.max(lo, n));
};

/** Accept only known values, so a damaged saved value can never break scanning. */
export function sanitizeScannerSettings(v: unknown): ScannerSettings {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Record<keyof ScannerSettings, unknown>>;
  const d = DEFAULT_SCANNER_SETTINGS;
  return {
    hardwareEnabled: typeof o.hardwareEnabled === 'boolean' ? o.hardwareEnabled : d.hardwareEnabled,
    suffix: o.suffix === 'enter' || o.suffix === 'tab' || o.suffix === 'any' ? o.suffix : d.suffix,
    minLength: clamp(o.minLength, 1, 64, d.minLength),
    maxGapMs: clamp(o.maxGapMs, 15, 200, d.maxGapMs),
    beep: typeof o.beep === 'boolean' ? o.beep : d.beep,
    cameraId: typeof o.cameraId === 'string' && o.cameraId ? o.cameraId : null,
    cameraLabel: typeof o.cameraLabel === 'string' && o.cameraLabel ? o.cameraLabel : null,
  };
}

function load(): ScannerSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeScannerSettings(JSON.parse(raw)) : { ...DEFAULT_SCANNER_SETTINGS };
  } catch {
    return { ...DEFAULT_SCANNER_SETTINGS };
  }
}

let current: ScannerSettings = load();

export function getScannerSettings(): ScannerSettings {
  return current;
}

export function updateScannerSettings(patch: Partial<ScannerSettings>) {
  current = sanitizeScannerSettings({ ...current, ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode or storage full: the setting still applies until the page reloads.
  }
  listeners.forEach((l) => l());
}

export function resetScannerSettings() {
  updateScannerSettings(DEFAULT_SCANNER_SETTINGS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useScannerSettings(): ScannerSettings {
  return useSyncExternalStore(subscribe, getScannerSettings, getScannerSettings);
}

/** Pause limit from a test scan: twice the slowest gap, kept between 20 and 150 ms. */
export function tuneMaxGap(gaps: number[]): number {
  if (!gaps.length) return DEFAULT_SCANNER_SETTINGS.maxGapMs;
  return Math.min(150, Math.max(20, Math.ceil(Math.max(...gaps) * 2)));
}

/** Short confirmation beep; silent where audio is unavailable. */
export function scanBeep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1700;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => void ctx.close();
  } catch {
    // No audio: scanning still works.
  }
}
