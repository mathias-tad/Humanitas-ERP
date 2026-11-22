/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { APP_ROUTES } from './appRoutes.generated';

/** The Ctrl+K search offers only pages the router has: this list must follow AppRoutes.tsx. */
describe('app routes for search', () => {
  it('matches AppRoutes.tsx (regenerate with: python scripts/gen_app_routes.py)', () => {
    const src = readFileSync(join(process.cwd(), 'src/AppRoutes.tsx'), 'utf8');
    const paths = [...new Set([...src.matchAll(/path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*'))].sort();
    expect([...APP_ROUTES].sort()).toEqual(paths);
  });
});
