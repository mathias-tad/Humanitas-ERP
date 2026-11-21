/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AGENTS.md rule 24: a hook that needs a provider ("useX must be used inside <XProvider>") may only
 * be used by code the app actually renders if that provider is mounted at the root (main.tsx,
 * App.tsx) or in a layout. This catches "provider added to a file the app never renders" before deploy.
 */
// Vitest runs from the frontend folder (package.json), so src/ is relative to the working directory.
const SRC = resolve(process.cwd(), 'src');
const EXT = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'];

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  for (const e of EXT) {
    const p = base + e;
    if (existsSync(p) && /\.(t|j)sx?$/.test(p)) return p;
  }
  return null;
}

/** Every file reachable from main.tsx through static and lazy imports. */
function reachableFiles(): Map<string, string> {
  const seen = new Map<string, string>();
  const queue = [join(SRC, 'main.tsx')];
  const IMPORT = /(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+|export\s[^'"]*?from\s*)['"]([^'"]+)['"]/g;
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    const text = readFileSync(file, 'utf8');
    seen.set(file, text);
    for (const m of text.matchAll(IMPORT)) {
      const next = resolveImport(file, m[1]);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

describe('context providers are mounted where their hooks are used', () => {
  const files = reachableFiles();
  const roots = [...files.entries()].filter(([f]) => /[\\/](main|App)\.tsx$/.test(f) || /[\\/]layouts[\\/]/.test(f));

  const guards: { hook: string; provider: string; file: string }[] = [];
  for (const [file, text] of files) {
    for (const m of text.matchAll(/(use\w+) must be used (?:inside|within) (?:an? |the )?<?(\w+Provider)/g)) {
      guards.push({ hook: m[1], provider: m[2], file });
    }
  }

  it('finds the app and its guarded hooks', () => {
    expect(files.size).toBeGreaterThan(20);
    expect(guards.length).toBeGreaterThan(0);
  });

  it.each(guards.map((g) => [g.provider, g]))('%s is mounted for every rendered user of its hook', (_name, g) => {
    const call = new RegExp(`\\b${g.hook}\\s*\\(`);
    const users = [...files.entries()].filter(([f, t]) => f !== g.file && call.test(t)).map(([f]) => f);
    if (users.length === 0) return;
    const mountedAt = roots.filter(([, t]) => new RegExp(`<${g.provider}[\\s>]`).test(t)).map(([f]) => f);
    expect({ provider: g.provider, mountedAt: mountedAt.length > 0 }).toEqual({ provider: g.provider, mountedAt: true });
  });
});
