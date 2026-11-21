import { useEffect, useRef, useSyncExternalStore } from 'react';
import { isTextEntry } from '@/lib/scanDetector';

/**
 * Keyboard shortcuts for every module (AGENTS.md rule 24): one registry, one listener, one help
 * window (press ?). Keys are written like "n", "/", "?", "mod+s" (Ctrl on Windows/Linux, ⌘ on Mac),
 * "shift+n", "f2", "escape", or a two-step sequence "g p".
 * - Single keys without Ctrl/Alt/⌘ never fire while typing in a field, and wait a moment so a
 *   barcode scanner's burst of characters cancels them.
 * - When two screens register the same keys, the one opened last wins (a drawer before its page).
 */
export interface Shortcut {
  keys: string;
  description: string;
  group?: string;
  run: () => void;
  /** Also works while the cursor is in a field (use for Ctrl/⌘ combinations such as save). */
  allowInInputs?: boolean;
}

interface Step {
  key: string;
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

const ALIASES: Record<string, string> = { esc: 'escape', del: 'delete', space: ' ', return: 'enter' };

export function parseKeys(keys: string): Step[] {
  return keys.trim().split(/\s+/).map((part) => {
    const tokens = part.toLowerCase().split('+');
    const raw = tokens[tokens.length - 1] || '+';
    return {
      key: ALIASES[raw] ?? raw,
      mod: tokens.includes('mod'),
      ctrl: tokens.includes('ctrl'),
      alt: tokens.includes('alt'),
      shift: tokens.includes('shift'),
    };
  });
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function stepMatches(step: Step, e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>, mac = isMac()): boolean {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (key !== step.key) return false;
  const modPressed = mac ? e.metaKey : e.ctrlKey;
  if (step.mod !== modPressed) return false;
  if (!step.mod && (e.ctrlKey || e.metaKey) !== step.ctrl) return false;
  if (step.alt !== e.altKey) return false;
  // Symbols such as ? need Shift on most keyboards; only letters/named keys check Shift.
  const isLetterOrNamed = /^[a-z]$/.test(step.key) || step.key.length > 1;
  if (isLetterOrNamed && step.shift !== e.shiftKey) return false;
  return true;
}

/** "mod+s" → "Ctrl + S" (or "⌘ + S" on Mac), "g p" → "G then P". */
export function formatKeys(keys: string, mac = isMac()): string {
  return parseKeys(keys).map((s) => {
    const parts: string[] = [];
    if (s.mod) parts.push(mac ? '⌘' : 'Ctrl');
    if (s.ctrl) parts.push('Ctrl');
    if (s.alt) parts.push(mac ? '⌥' : 'Alt');
    if (s.shift) parts.push('Shift');
    const named: Record<string, string> = { escape: 'Esc', ' ': 'Space', enter: 'Enter', delete: 'Delete' };
    parts.push(named[s.key] ?? (s.key.length === 1 ? s.key.toUpperCase() : s.key.toUpperCase()));
    return parts.join(' + ');
  }).join(' then ');
}

/** Hover text for a control that has a shortcut: "New product (N)", "Save (Ctrl + S)". */
export function shortcutHint(label: string, keys: string, mac = isMac()): string {
  return `${label} (${formatKeys(keys, mac)})`;
}

// ── Registry ─────────────────────────────────────────────────────────────────────────
type Registration = { id: number; get: () => Shortcut[] };
let registrations: Registration[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

/** Every active shortcut, the most recently opened screen first; duplicates keep the newest. */
export function activeShortcuts(): Shortcut[] {
  const seen = new Set<string>();
  const out: Shortcut[] = [];
  for (const r of [...registrations].reverse()) {
    for (const s of r.get()) {
      const k = s.keys.toLowerCase().trim();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

export function useActiveShortcuts(): Shortcut[] {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => version,
  );
  return activeShortcuts();
}

// ── Listener ─────────────────────────────────────────────────────────────────────────
/** How long a single-key shortcut waits for a scanner burst to show itself. */
export const SINGLE_KEY_DELAY_MS = 90;
const SEQUENCE_TIMEOUT_MS = 1000;

let sequencePrefix: { step: Step; until: number } | null = null;
let pendingTimer: number | null = null;
let installed = false;

function inEditable(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (isTextEntry(el) || el.tagName === 'SELECT') return true;
  return el instanceof HTMLElement && el.isContentEditable;
}

function cancelPending() {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing) return;
  const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  // Another character while a single-key shortcut waits = typing burst or scanner: cancel it.
  if (printable && pendingTimer !== null) {
    cancelPending();
    sequencePrefix = null;
    return;
  }
  const editing = inEditable();
  const now = Date.now();
  const all = activeShortcuts();
  const usable = (s: Shortcut) => !editing || s.allowInInputs;

  // Second step of a sequence such as "g p".
  if (sequencePrefix && now <= sequencePrefix.until) {
    const prefix = sequencePrefix.step;
    sequencePrefix = null;
    const hit = all.find((s) => {
      const steps = parseKeys(s.keys);
      return steps.length === 2 && usable(s) && steps[0].key === prefix.key && stepMatches(steps[1], e);
    });
    if (hit) {
      e.preventDefault();
      schedule(hit, printable);
      return;
    }
  }
  sequencePrefix = null;

  const single = all.find((s) => {
    const steps = parseKeys(s.keys);
    return steps.length === 1 && usable(s) && stepMatches(steps[0], e);
  });
  if (single) {
    if (!printable) e.preventDefault();
    schedule(single, printable);
    return;
  }
  const starts = all.some((s) => {
    const steps = parseKeys(s.keys);
    return steps.length === 2 && usable(s) && stepMatches(steps[0], e);
  });
  if (starts) {
    const step = parseKeys(all.find((s) => parseKeys(s.keys).length === 2 && stepMatches(parseKeys(s.keys)[0], e))!.keys)[0];
    sequencePrefix = { step, until: now + SEQUENCE_TIMEOUT_MS };
  }
}

function schedule(s: Shortcut, deferred: boolean) {
  if (!deferred) {
    s.run();
    return;
  }
  cancelPending();
  pendingTimer = window.setTimeout(() => {
    pendingTimer = null;
    s.run();
  }, SINGLE_KEY_DELAY_MS);
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', onKeyDown);
}

/**
 * Register shortcuts while a component is mounted. `shortcuts` may change every render;
 * the latest handlers are always used.
 */
export function useShortcuts(shortcuts: Shortcut[], { enabled = true }: { enabled?: boolean } = {}) {
  const ref = useRef(shortcuts);
  useEffect(() => {
    ref.current = shortcuts;
  });
  const signature = shortcuts.map((s) => `${s.keys}|${s.description}|${s.group ?? ''}`).join(';');

  useEffect(() => {
    if (!enabled) return;
    const reg: Registration = { id: nextId++, get: () => ref.current };
    registrations.push(reg);
    install();
    notify();
    return () => {
      registrations = registrations.filter((r) => r !== reg);
      notify();
    };
  }, [enabled, signature]);
}

/** For tests. */
export function resetShortcutsForTests() {
  registrations = [];
  sequencePrefix = null;
  cancelPending();
  notify();
}
