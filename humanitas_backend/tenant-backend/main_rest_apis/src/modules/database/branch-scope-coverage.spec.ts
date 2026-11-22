import * as fs from 'fs';
import * as path from 'path';

/**
 * Rule 16: every table carries company_id and branch_id, so no data loses its company or branch.
 * A table is covered when its CREATE TABLE has branch_id, a later ALTER TABLE adds it, or it is
 * listed in 20261022000001 / 20261122000023 (owned, child and catalog tables).
 */
const MIGRATIONS = path.join(__dirname, '..', '..', 'migrations', 'tenant');
// The hierarchy itself, the migration log and the access table that defines branch access.
const EXEMPT = new Set(['companies', 'branches', 'schema_migrations', 'user_company_access']);
const LISTS = ['20261022000001_add_company_branch_to_all_operational_tables.sql', '20261122000023_branch_scope_every_table.sql'];

describe('branch scope on every table (rule 16)', () => {
  it('gives every table a company and a branch', () => {
    const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
    const sql = files.map((f) => fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')).join('\n');
    const covered = new Set<string>();
    for (const f of LISTS) {
      if (!files.includes(f)) continue;
      for (const m of fs.readFileSync(path.join(MIGRATIONS, f), 'utf8').matchAll(/'([a-z_]+)'/g)) covered.add(m[1]);
    }
    for (const m of sql.matchAll(/ALTER TABLE(?: IF EXISTS)?\s+"?(\w+)"?\s+ADD COLUMN(?: IF NOT EXISTS)?\s+branch_id\b/gi)) covered.add(m[1]);
    const missing: string[] = [];
    for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+"?(\w+)"?\s*\(([\s\S]*?)\n\);/gi)) {
      const [, table, body] = m;
      if (EXEMPT.has(table) || covered.has(table) || /\bbranch_id\b/.test(body)) continue;
      missing.push(table);
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
