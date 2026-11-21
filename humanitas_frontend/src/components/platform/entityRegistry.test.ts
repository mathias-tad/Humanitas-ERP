import { describe, expect, it } from 'vitest';
import { entityAccess, pickerActions, registerEntity, getEntity, type EntityDefinition } from './entityRegistry';

const def: EntityDefinition<{ id: string; name: string }> = {
  type: 'thing', label: 'product', module: 'products',
  permissions: { view: 'view_products', create: 'create_products' },
  search: async () => [], toOption: (r) => ({ id: r.id, label: r.name }),
  quickCreate: async (name) => ({ id: 'new', name }),
  Form: () => null,
};
const checks = (perms: string[], modules = ['products']) => ({
  hasPermission: (p: string) => perms.includes(p),
  isModuleSubscribed: (m: string) => modules.includes(m),
});

describe('entityAccess', () => {
  it('needs the module, then one permission per action', () => {
    expect(entityAccess(def, checks(['view_products', 'create_products'], []))).toEqual({ available: false, canView: false, canCreate: false });
    expect(entityAccess(def, checks(['view_products']))).toEqual({ available: true, canView: true, canCreate: false });
    expect(entityAccess(def, checks(['view_products', 'create_products']))).toEqual({ available: true, canView: true, canCreate: true });
    expect(entityAccess(def, checks(['create_products'])).canCreate).toBe(false);
    expect(entityAccess(undefined, checks(['view_products'])).available).toBe(false);
  });
});

describe('pickerActions', () => {
  const opts = [{ id: '1', label: 'Teff flour' }];
  it('offers one-step create and create & edit to users who may create', () => {
    const kinds = pickerActions(def, entityAccess(def, checks(['view_products', 'create_products'])), 'Buna', opts).map((a) => a.kind);
    expect(kinds).toEqual(['option', 'quick-create', 'create-edit', 'search-more']);
  });

  it('does not offer creating something that already exists', () => {
    const kinds = pickerActions(def, entityAccess(def, checks(['view_products', 'create_products'])), ' teff FLOUR ', opts).map((a) => a.kind);
    expect(kinds).toEqual(['option', 'search-more']);
  });

  it('explains who can create when the user may only view', () => {
    const actions = pickerActions(def, entityAccess(def, checks(['view_products'])), 'Buna', []);
    expect(actions[0]).toMatchObject({ kind: 'no-permission' });
    expect((actions[0] as { label: string }).label).toContain('create_products');
  });

  it('offers nothing to create for empty text', () => {
    expect(pickerActions(def, entityAccess(def, checks(['view_products', 'create_products'])), '  ', []).map((a) => a.kind)).toEqual(['search-more']);
  });

  it('registers and retrieves definitions', () => {
    registerEntity(def);
    expect(getEntity('thing')).toBe(def);
    expect(getEntity('missing')).toBeUndefined();
  });
});
