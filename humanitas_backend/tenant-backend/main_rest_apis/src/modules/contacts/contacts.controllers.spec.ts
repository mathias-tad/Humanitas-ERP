import 'reflect-metadata';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MODULE_KEY } from '../auth/guards/module-subscription.guard';
import { ContactCategoriesController, ContactsController } from './contacts.controller';
import { PERMISSION_CATALOG } from '../roles/permission-catalog';
import { ALL_CONTACTS_PERMISSIONS, CONTACTS_EMPLOYEE_PERMISSIONS, CONTACTS_MANAGER_PERMISSIONS, CONTACTS_ADMIN_ONLY_PERMISSIONS } from './contacts.permissions';

/** AGENTS.md rules 4 and 27: module gate on every controller, exactly one permission per endpoint. */
const controllers = [ContactsController, ContactCategoriesController];
const handlers = (cls: new (...args: never[]) => object) =>
  Object.getOwnPropertyNames(cls.prototype).filter((n) => n !== 'constructor')
    .map((n) => ({ name: `${cls.name}.${n}`, fn: (cls.prototype as Record<string, unknown>)[n] as object }));

describe('Contacts controllers', () => {
  it.each(controllers.map((c) => [c.name, c]))('%s opens with the contacts module family', (_n, cls) => {
    expect(Reflect.getMetadata(MODULE_KEY, cls)).toBe('contacts');
  });

  const all = controllers.flatMap((c) => handlers(c as never));
  it.each(all.map((h) => [h.name, h.fn]))('%s requires exactly one registered permission', (_n, fn) => {
    const perms: string[] = Reflect.getMetadata(PERMISSIONS_KEY, fn);
    expect(perms).toHaveLength(1);
    expect(ALL_CONTACTS_PERMISSIONS).toContain(perms[0]);
  });

  it('uses every Contacts permission and splits role defaults sensibly', () => {
    const used = new Set(all.flatMap((h) => Reflect.getMetadata(PERMISSIONS_KEY, h.fn) as string[]));
    expect(ALL_CONTACTS_PERMISSIONS.filter((p) => !used.has(p))).toEqual([]);
    for (const p of ALL_CONTACTS_PERMISSIONS) expect(p).toMatch(/^(view|create|edit|delete|restore|export)_[a-z_]+$/);
    expect(CONTACTS_EMPLOYEE_PERMISSIONS.every((p) => p.startsWith('view_'))).toBe(true);
    expect([...CONTACTS_MANAGER_PERMISSIONS, ...CONTACTS_ADMIN_ONLY_PERMISSIONS].sort()).toEqual([...ALL_CONTACTS_PERMISSIONS].sort());
  });

  it('lists every Contacts permission in Access Control, under the contacts module', () => {
    const inCatalog = PERMISSION_CATALOG.filter((p) => ALL_CONTACTS_PERMISSIONS.includes(p.id));
    expect(inCatalog.map((p) => p.id).sort()).toEqual([...ALL_CONTACTS_PERMISSIONS].sort());
    expect(inCatalog.every((p) => p.module === 'contacts')).toBe(true);
  });
});

describe('Contacts AI knowledge (rules 20, 24.27)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('path') as typeof import('path');
  const sql = readFileSync(join(__dirname, '../../migrations/tenant/20261122000012_ai_knowledge_contacts.sql'), 'utf8');

  it.each(ALL_CONTACTS_PERMISSIONS)('mentions the %s permission', (p) => expect(sql).toContain(`"${p}"`));

  it('describes the pages with web and mobile steps', () => {
    for (const r of ['/contacts', '/customers', '/contacts/categories']) expect(sql).toContain(`'${r}'`);
    expect(sql.match(/"mobile": \[/g)).toHaveLength(3);
  });
});
