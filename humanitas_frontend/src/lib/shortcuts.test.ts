import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { formatKeys, parseKeys, resetShortcutsForTests, shortcutHint, SINGLE_KEY_DELAY_MS, stepMatches, useShortcuts } from './shortcuts';

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  resetShortcutsForTests();
  vi.useRealTimers();
});

describe('shortcut keys', () => {
  it('parses and matches combinations', () => {
    const [save] = parseKeys('mod+s');
    expect(stepMatches(save, { key: 's', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, false)).toBe(true);
    expect(stepMatches(save, { key: 's', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false }, true)).toBe(true);
    expect(stepMatches(save, { key: 's', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, false)).toBe(false);
    const [help] = parseKeys('?');
    expect(stepMatches(help, { key: '?', ctrlKey: false, metaKey: false, altKey: false, shiftKey: true }, false)).toBe(true);
    expect(parseKeys('g p')).toHaveLength(2);
  });

  it('formats keys for people', () => {
    expect(formatKeys('mod+s', false)).toBe('Ctrl + S');
    expect(formatKeys('mod+s', true)).toBe('⌘ + S');
    expect(formatKeys('g p', false)).toBe('G then P');
    expect(shortcutHint('New product', 'n', false)).toBe('New product (N)');
    expect(shortcutHint('Save', 'mod+s', true)).toBe('Save (⌘ + S)');
  });
});

describe('useShortcuts', () => {
  it('runs a single-key shortcut after a short wait', () => {
    const run = vi.fn();
    renderHook(() => useShortcuts([{ keys: 'n', description: 'New', run }]));
    press('n');
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SINGLE_KEY_DELAY_MS + 5);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('is cancelled by a scanner burst that starts with the same letter', () => {
    const run = vi.fn();
    renderHook(() => useShortcuts([{ keys: 'n', description: 'New', run }]));
    press('n');
    press('1');
    press('2');
    vi.advanceTimersByTime(500);
    expect(run).not.toHaveBeenCalled();
  });

  it('ignores single keys while typing in a field, but Ctrl/⌘ combinations marked for inputs still work', () => {
    const typed = vi.fn();
    const save = vi.fn();
    renderHook(() => useShortcuts([
      { keys: 'n', description: 'New', run: typed },
      { keys: 'mod+s', description: 'Save', run: save, allowInInputs: true },
    ]));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    press('n', {}, input);
    vi.advanceTimersByTime(500);
    expect(typed).not.toHaveBeenCalled();
    const e = press('s', { ctrlKey: true }, input);
    expect(save).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    input.remove();
  });

  it('supports two-step sequences and lets the newest screen win', () => {
    const page = vi.fn();
    const drawer = vi.fn();
    const go = vi.fn();
    renderHook(() => useShortcuts([{ keys: 'n', description: 'New', run: page }, { keys: 'g p', description: 'Products', run: go }]));
    renderHook(() => useShortcuts([{ keys: 'n', description: 'New in drawer', run: drawer }]));
    press('n');
    vi.advanceTimersByTime(200);
    expect(drawer).toHaveBeenCalledTimes(1);
    expect(page).not.toHaveBeenCalled();
    press('g');
    vi.advanceTimersByTime(200);
    press('p');
    vi.advanceTimersByTime(200);
    expect(go).toHaveBeenCalledTimes(1);
  });
});
