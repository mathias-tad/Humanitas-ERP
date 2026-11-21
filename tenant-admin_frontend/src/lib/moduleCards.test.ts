import { describe, expect, it } from 'vitest';
import { Package, Puzzle } from 'lucide-react';
import { moduleCards } from './moduleCards';
import type { ModuleCatalog } from './moduleCatalog';

const catalog: ModuleCatalog = {
  modules: [
    { key: 'products', name: 'Products & Catalog', category: 'operations', description: 'd', depends: [], status: 'available' },
    { key: 'fleet', name: 'Fleet', category: 'logistics', description: 'f', depends: [], status: 'coming_soon' },
    { key: 'newthing', name: 'New', category: 'operations', description: 'n', depends: [], status: 'coming_soon' },
  ],
  bridges: [],
};

describe('moduleCards', () => {
  it('lists every catalog module with its status and icon', () => {
    const cards = moduleCards(catalog, []);
    expect(cards.map((c) => c.id)).toEqual(['products', 'fleet', 'newthing']);
    expect(cards[0]).toMatchObject({ icon: Package, status: 'available', comingSoon: false });
    expect(cards[1].status).toBe('coming_soon');
    expect(cards[2].icon).toBe(Puzzle);
  });

  it('falls back to the built-in list when the catalog is unavailable', () => {
    const cards = moduleCards(null, [{ id: 'hrms', name: 'HR', description: 'x', icon: Package }]);
    expect(cards).toEqual([expect.objectContaining({ id: 'hrms', status: 'available' })]);
  });
});
