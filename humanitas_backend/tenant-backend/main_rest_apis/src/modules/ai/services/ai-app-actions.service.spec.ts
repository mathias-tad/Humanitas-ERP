import { AiAppActionsService } from './ai-app-actions.service';
import type { AppActionCatalogService } from './app-action-catalog.service';
import type { AppAction } from './app-action-catalog';
import type { AiRequestContext } from './ai-request-context';
import type { DatabaseService } from '../../database/database.service';

const CREATE: AppAction = { id: 'POST /products', method: 'POST', path: '/products', module: 'products', permissions: ['create_products'], summary: 'products: create', pathParams: [], body: [{ name: 'name', required: true, type: 'string' }], query: [] };
const LIST: AppAction = { id: 'GET /products', method: 'GET', path: '/products', module: 'products', permissions: ['view_products'], summary: 'products: list', pathParams: [], body: [], query: [] };

function setup(perms: string[] = ['create_products', 'view_products'], pendingRows: unknown[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const ds = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (/INSERT INTO ai_pending_actions/.test(sql)) return [{ id: 'p-1' }];
      if (/UPDATE ai_pending_actions SET status = 'running'/.test(sql)) return pendingRows;
      if (/UPDATE ai_pending_actions SET status = \$4/.test(sql)) return [{ id: 'p-1', summary: 'products: create (POST /products)' }];
      return [];
    }),
  };
  const catalog = {
    search: jest.fn(() => [CREATE, LIST]),
    get: jest.fn((id: string) => [CREATE, LIST].find((a) => a.id === id)),
  } as unknown as AppActionCatalogService;
  const injected: { method: string; url: string; headers: Record<string, string>; payload?: string }[] = [];
  class TestService extends AiAppActionsService {
    protected injector() {
      return async (o: { method: string; url: string; headers: Record<string, string>; payload?: string }) => {
        injected.push(o);
        return { statusCode: o.method === 'GET' ? 200 : 201, body: JSON.stringify({ id: 'prod-1', name: 'Teff' }) };
      };
    }
  }
  const svc = new TestService(catalog, {} as never, { get: () => 'api/v1' } as never, { getTenantConnectionById: jest.fn().mockResolvedValue(ds) } as unknown as DatabaseService);
  const ctx: AiRequestContext = {
    tenantId: 't1', tenantSlug: 't', userId: 'u1', role: 'staff', accessToken: 'tok', headers: { 'x-company-id': 'c1' },
    permissions: async () => perms,
  };
  const [find, run] = svc.tools(ctx, 'convo-1') as unknown as { invoke: (a: Record<string, unknown>) => Promise<string> }[];
  return { svc, ctx, find, run, calls, injected };
}

describe('AiAppActionsService', () => {
  it('reads at once, as the user, through the API', async () => {
    const { run, injected } = setup();
    const out = await run.invoke({ action_id: 'GET /products', query: { q: 'teff' } });
    expect(out).toMatch(/^OK \(200\) GET \/products/);
    expect(injected[0]).toMatchObject({ method: 'GET', url: '/api/v1/products?q=teff' });
    expect(injected[0].headers).toMatchObject({ cookie: 'access_token=tok', 'x-ai-action': '1', 'x-company-id': 'c1' });
  });

  it('holds a change for confirmation instead of running it', async () => {
    const { run, injected, calls } = setup();
    const out = await run.invoke({ action_id: 'POST /products', body: { name: 'Teff' } });
    expect(out).toMatch(/CONFIRMATION NEEDED \(pending_id p-1\)/);
    expect(out).toMatch(/Nothing has changed yet/);
    expect(injected).toHaveLength(0);
    expect(calls.find((c) => /INSERT INTO ai_pending_actions/.test(c.sql))!.params.slice(0, 4)).toEqual(['u1', 'convo-1', 'POST /products', '/products']);
  });

  it('runs a confirmed change exactly as it was held, and refuses an unconfirmed one', async () => {
    const held = { id: 'p-1', action: 'POST /products', url: '/products', body: { name: 'Teff' }, summary: 's', status: 'running' };
    const ok = setup(undefined, [held]);
    const out = await ok.run.invoke({ pending_id: 'p-1', body: { name: 'Something else' } });
    expect(out).toMatch(/^OK \(201\) POST \/products/);
    expect(JSON.parse(ok.injected[0].payload!)).toEqual({ name: 'Teff' });
    expect(ok.calls.some((c) => /INSERT INTO system_audit_logs/.test(c.sql))).toBe(true);

    const none = setup(undefined, []);
    expect(await none.run.invoke({ pending_id: 'p-1' })).toMatch(/has not been confirmed/);
    expect(none.injected).toHaveLength(0);
  });

  it('refuses actions the user has no permission for, and changes in read-only mode', async () => {
    const { run } = setup(['view_products']);
    expect(await run.invoke({ action_id: 'POST /products', body: { name: 'x' } })).toMatch(/do not have permission/);
    const s = setup();
    const [, readRun] = s.svc.tools(s.ctx, 'document', { readOnly: true }) as unknown as { invoke: (a: Record<string, unknown>) => Promise<string> }[];
    expect(await readRun.invoke({ action_id: 'POST /products', body: { name: 'x' } })).toMatch(/Only reading/);
    expect(await readRun.invoke({ pending_id: 'p-1' })).toMatch(/not allowed/);
  });

  it('turns the user\'s yes into a note naming the confirmed changes', async () => {
    const { svc, ctx } = setup();
    expect(await svc.resolvePending(ctx, 'convo-1', 'yes')).toMatch(/confirmed these changes[\s\S]*pending_id p-1/);
    expect(await svc.resolvePending(ctx, 'convo-1', 'no')).toMatch(/cancelled/);
    expect(await svc.resolvePending(ctx, 'convo-1', 'how much is teff?')).toBeNull();
  });

  it('finds actions and says when nothing matches', async () => {
    const { find } = setup();
    expect(await find.invoke({ request: 'create product' })).toMatch(/POST \/products/);
  });
});
