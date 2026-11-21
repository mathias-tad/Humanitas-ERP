import { describe, expect, it } from 'vitest';
import { groupModules, neededBy, slugFormatProblem, suggestSlug, withDependencies, type SignupModule } from './signup';

const mod = (key: string, depends: string[] = [], status: 'available' | 'coming_soon' = 'available', category = 'operations'): SignupModule => ({
  key, name: key, category, description: '', depends, status,
});
const MODULES = [
  mod('hrms', [], 'available', 'people'),
  mod('products'),
  mod('inventory', ['products'], 'coming_soon'),
  mod('manufacturing', ['products', 'inventory'], 'coming_soon'),
];

describe('sign-up helpers', () => {
  it('suggests an organization ID from the company name', () => {
    expect(suggestSlug('Abebe & Sons PLC')).toBe('abebe-sons-plc');
    expect(suggestSlug('  Café 24 ')).toBe('cafe-24');
  });

  it('checks the organization ID format', () => {
    expect(slugFormatProblem('abebe-trading')).toBeNull();
    expect(slugFormatProblem('ab')).toMatch(/3/);
    expect(slugFormatProblem('Abebe')).toMatch(/lowercase/);
    expect(slugFormatProblem('-ab')).toMatch(/Hyphens/);
    expect(slugFormatProblem('123')).toMatch(/letter/);
  });

  it('adds what chosen modules need, transitively', () => {
    expect([...withDependencies(['manufacturing'], MODULES)].sort()).toEqual(['inventory', 'manufacturing', 'products']);
    expect(neededBy('products', ['manufacturing', 'hrms'], MODULES)).toEqual(['manufacturing']);
    expect(neededBy('hrms', ['manufacturing'], MODULES)).toEqual([]);
  });

  it('groups modules by category with ready ones first', () => {
    const g = groupModules(MODULES);
    expect(g.map((x) => x.label)).toEqual(['People', 'Operations']);
    expect(g[1].modules.map((m) => m.key)).toEqual(['products', 'inventory', 'manufacturing']);
  });
});
