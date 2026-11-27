import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { registerSlot, slotEntries, useSlot } from './moduleSlots';

const subscribed = new Set(['products', 'inventory']);
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => p !== 'secret' }) }));
vi.mock('@/context/ModuleContext', () => ({ useERPModules: () => ({ isModuleSubscribed: (m: string) => subscribed.has(m) }) }));

const Dummy = () => null;

describe('module slots (rule 30)', () => {
  it('shows an entry only for tenants with its module, people with its permission, and where it applies', () => {
    registerSlot('product.tabs', { id: 't.stock', module: 'inventory', permission: 'view_stock', label: 'Stock', when: (p) => !p.isParent, Component: Dummy });
    registerSlot('product.tabs', { id: 't.sales', module: 'sales', label: 'Sales', Component: Dummy });
    registerSlot('product.tabs', { id: 't.secret', module: 'inventory', permission: 'secret', label: 'Secret', Component: Dummy });
    registerSlot('product.tabs', { id: 't.bridge', module: 'inventory', requires: ['pos'], label: 'POS stock', Component: Dummy });
    expect(slotEntries('product.tabs').map((e) => e.id)).toEqual(expect.arrayContaining(['t.stock', 't.sales', 't.secret', 't.bridge']));
    const props = { productId: 'p1', isActive: true, isParent: false, productType: 'storable' };
    const { result } = renderHook(() => useSlot('product.tabs', props));
    expect(result.current.map((e) => e.id)).toEqual(['t.stock']);
    const parent = renderHook(() => useSlot('product.tabs', { ...props, isParent: true }));
    expect(parent.result.current).toEqual([]);
  });
});
