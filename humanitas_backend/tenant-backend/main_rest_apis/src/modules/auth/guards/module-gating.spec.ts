import * as fs from 'fs';
import * as path from 'path';

/**
 * Module-gating guard (AGENTS.md rule 4, rule 24).
 *
 * Every controller must declare the module it belongs to with @RequireModule(...), so the
 * ModuleSubscriptionGuard rejects tenants that are not subscribed. Without it the guard
 * allows every request — that is how hrms/assets, hrms/surveys and hrms/import-export were
 * reachable by tenants without HRMS.
 *
 * If this test fails: add @RequireModule('<module>') to the controller, or — only for
 * endpoints that are genuinely module-independent — add it below with the reason.
 */
const MODULES = path.join(__dirname, '..', '..');

const ALLOWED: Record<string, string> = {
  'auth/auth.controller.ts': 'login/refresh must work before any module check',
  'health/health.controller.ts': 'container health checks',
  'setup/setup.controller.ts': 'first-run tenant setup',
  'public-support/public-support.controller.ts': 'public landing-page support, no tenant session',
  'biometric-devices/adms.controller.ts': 'device push protocol authenticated by device serial',
  'notifications/email-tracking.controller.ts': 'email open-tracking pixel, no session',
  'overtime/overtime.webhook.controller.ts': 'signed external webhook',
  'delegations/delegations.controller.ts': 'core platform module (COMMON_PLATFORM_MODULES)',
  'ai/ai-settings.controller.ts': 'tenant admins must reach AI settings to enable AI',
};

function controllers(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return controllers(p);
    return e.name.endsWith('.controller.ts') ? [p] : [];
  });
}

describe('module gating', () => {
  const files = controllers(MODULES).map((f) => path.relative(MODULES, f).split(path.sep).join('/'));

  it('finds the controllers', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it.each(files.filter((f) => !ALLOWED[f]))('%s declares @RequireModule', (rel) => {
    const src = fs.readFileSync(path.join(MODULES, rel), 'utf8');
    expect(src).toMatch(/@RequireModule\(\s*['"][a-z_.]+['"]\s*\)/);
  });

  it('keeps the allow-list honest (every entry still exists and is still ungated)', () => {
    for (const rel of Object.keys(ALLOWED)) {
      expect(files).toContain(rel);
    }
  });
});
