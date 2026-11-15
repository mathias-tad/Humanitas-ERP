import * as fs from 'fs';
import * as path from 'path';

/**
 * Schema-drift guard.
 *
 * Tenant database schema must come ONLY from src/migrations/tenant/*.sql, applied once per
 * tenant by TenantMigrationService. Services must not run CREATE TABLE / ALTER TABLE /
 * CREATE INDEX at request time (that is how the schema drifted before).
 *
 * If this test fails: move your DDL into a new, timestamped migration file instead.
 */
const SRC = path.join(__dirname, '..', '..');
const MODULES = path.join(SRC, 'modules');
const MIGRATIONS = path.join(SRC, 'migrations', 'tenant');

// Files allowed to contain DDL, with the reason. Keep this list short.
const ALLOWED: Record<string, string> = {
  // The migration engine's own bookkeeping table.
  'database/tenant-migration.service.ts': 'schema_migrations tracking table',
  // MASTER database objects (not tenant schema); the master DB has no tenant migration runner.
  'system-logs/system-logs.controller.ts': 'master-db calculation_logs table',
  'biometric-devices/biometric-devices.service.ts': 'master-db device_registry table',
};

const DDL = /\b(CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+(UNIQUE\s+)?INDEX|DROP\s+TABLE)\b/i;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [p] : [];
  });
}

/** Very small scanner: returns the contents of string/template literals (comments skipped). */
function literals(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (src.startsWith('//', i)) { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    if (src.startsWith('/*', i)) { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      out.push(src.slice(i + 1, j));
      i = j + 1;
      continue;
    }
    i++;
  }
  return out;
}

describe('Tenant schema drift guard', () => {
  it('services do not run DDL at request time', () => {
    const offenders: string[] = [];
    for (const file of walk(MODULES)) {
      const rel = path.relative(MODULES, file).split(path.sep).join('/');
      if (ALLOWED[rel]) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (literals(src).some((l) => DDL.test(l))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it('the consolidated runtime-schema migration exists', () => {
    expect(fs.existsSync(path.join(MIGRATIONS, '20261115000001_consolidate_runtime_schema.sql'))).toBe(true);
  });

  it('tenant migrations never destroy data', () => {
    const destructive = /\b(DROP\s+TABLE|DROP\s+SCHEMA|TRUNCATE|DELETE\s+FROM)\b/i;
    const bad = fs
      .readdirSync(MIGRATIONS)
      .filter((f) => f >= '20261115' && f.endsWith('.sql'))
      .filter((f) => destructive.test(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')));
    expect(bad).toEqual([]);
  });
});
