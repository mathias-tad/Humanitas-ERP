import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MODULE_KEY } from '../auth/guards/module-subscription.guard';
import { PERMISSION_CATALOG } from '../roles/permission-catalog';
import { CrmActivitiesController, CrmLeadsController, CrmOpportunitiesController, CrmSetupController } from './crm.controllers';
import { ALL_CRM_PERMISSIONS, CRM_ADMIN_ONLY_PERMISSIONS, CRM_MANAGER_PERMISSIONS } from './crm.permissions';

/** AGENTS.md rules 4, 20 and 27: module gate, one registered permission per endpoint, Access Control and AI knowledge. */
const controllers = [CrmLeadsController, CrmOpportunitiesController, CrmActivitiesController, CrmSetupController];
const handlers = (cls: new (...args: never[]) => object) =>
  Object.getOwnPropertyNames(cls.prototype).filter((n) => n !== 'constructor')
    .map((n) => ({ name: `${cls.name}.${n}`, fn: (cls.prototype as Record<string, unknown>)[n] as object }));

describe('CRM controllers', () => {
  it.each(controllers.map((c) => [c.name, c]))('%s requires the crm module', (_n, cls) => {
    expect(Reflect.getMetadata(MODULE_KEY, cls)).toBe('crm');
  });

  const all = controllers.flatMap((c) => handlers(c as never));
  it.each(all.map((h) => [h.name, h.fn]))('%s requires exactly one registered permission', (_n, fn) => {
    const perms: string[] = Reflect.getMetadata(PERMISSIONS_KEY, fn);
    expect(perms).toHaveLength(1);
    expect(ALL_CRM_PERMISSIONS).toContain(perms[0]);
  });

  it('uses every CRM permission, names them <action>_<resource> and splits role defaults', () => {
    const used = new Set(all.flatMap((h) => Reflect.getMetadata(PERMISSIONS_KEY, h.fn) as string[]));
    expect(ALL_CRM_PERMISSIONS.filter((p) => !used.has(p))).toEqual([]);
    for (const p of ALL_CRM_PERMISSIONS) expect(p).toMatch(/^(view|create|edit|delete|restore|export)_crm_[a-z_]+$/);
    expect([...CRM_MANAGER_PERMISSIONS, ...CRM_ADMIN_ONLY_PERMISSIONS].sort()).toEqual([...ALL_CRM_PERMISSIONS].sort());
  });

  it('lists every CRM permission in Access Control under the crm module', () => {
    const inCatalog = PERMISSION_CATALOG.filter((p) => ALL_CRM_PERMISSIONS.includes(p.id));
    expect(inCatalog.map((p) => p.id).sort()).toEqual([...ALL_CRM_PERMISSIONS].sort());
    expect(inCatalog.every((p) => p.module === 'crm')).toBe(true);
  });
});

describe('CRM AI knowledge (rules 20, 24.27)', () => {
  const sql = readFileSync(join(__dirname, '../../migrations/tenant/20261122000015_ai_knowledge_crm.sql'), 'utf8');
  it.each(ALL_CRM_PERMISSIONS)('mentions the %s permission', (p) => expect(sql).toContain(`"${p}"`));
  it('describes every CRM page with web and mobile steps', () => {
    for (const r of ['/crm/leads', '/crm/opportunities', '/crm/activities', '/crm/setup']) expect(sql).toContain(`'${r}'`);
    expect(sql.match(/"mobile": \[/g)).toHaveLength(4);
  });
});
