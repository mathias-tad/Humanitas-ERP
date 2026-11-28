import * as fs from 'fs';
import * as path from 'path';

/**
 * Rule 16: every table carries company_id and branch_id, so no data loses its company or branch.
 * A table is covered when its CREATE TABLE has branch_id, a later ALTER TABLE adds it, or it is
 * listed in a scope migration (owned, child and catalog tables).
 *
 * Table bodies are read by matching parentheses, not by looking for "\n);": the consolidated
 * runtime schema (20261115000001) writes its tables as $ddlN$CREATE TABLE ... )$ddlN$ strings,
 * and a "\n);" search read straight past 53 of them without ever checking them.
 */
const MIGRATIONS = path.join(__dirname, '..', '..', 'migrations', 'tenant');
// The hierarchy itself, the migration logs and the access table that defines branch access.
const EXEMPT = new Set(['companies', 'branches', 'schema_migrations', '_permission_migrations', 'user_company_access']);
const LISTS = [
  '20261022000001_add_company_branch_to_all_operational_tables.sql',
  '20261122000023_branch_scope_every_table.sql',
  '20261123000002_inventory_branch_scope.sql',
  '20261127000001_branch_scope_late_tables.sql',
  '20261127000003_branch_scope_runtime_tables.sql',
];

const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const sql = files.map((f) => fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')).join('\n');

/** Every CREATE TABLE with its column list, found by matching parentheses. */
function tableBodies(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of text.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+"?([a-z_][a-z0-9_]*)"?\s*\(/gi)) {
    const start = (m.index as number) + m[0].length;
    let depth = 1;
    let i = start;
    while (depth > 0 && i < text.length) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
      i++;
    }
    out.push([m[1], text.slice(start, i - 1)]);
  }
  return out;
}

function listed(): Set<string> {
  const covered = new Set<string>();
  for (const f of LISTS) {
    if (!files.includes(f)) continue;
    for (const m of fs.readFileSync(path.join(MIGRATIONS, f), 'utf8').matchAll(/'([a-z_]+)'/g)) covered.add(m[1]);
  }
  return covered;
}

describe('branch scope on every table (rule 16)', () => {
  it('reads dollar-quoted table bodies', () => {
    const bodies = tableBodies("x := $d$CREATE TABLE IF NOT EXISTS a (id int, n numeric(5, 2))$d$,\n$e$CREATE TABLE b (\n branch_id uuid\n)$e$");
    expect(bodies).toEqual([
      ['a', 'id int, n numeric(5, 2)'],
      ['b', '\n branch_id uuid\n'],
    ]);
  });

  it('gives every table a company and a branch', () => {
    const covered = listed();
    for (const m of sql.matchAll(/ALTER TABLE(?: IF EXISTS)?\s+"?(\w+)"?\s+ADD COLUMN(?: IF NOT EXISTS)?\s+branch_id\b/gi)) covered.add(m[1]);
    const missing: string[] = [];
    for (const [table, body] of tableBodies(sql)) {
      if (EXEMPT.has(table) || covered.has(table) || /\bbranch_id\b/.test(body)) continue;
      missing.push(table);
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('says how every table with inline company/branch columns is filled', () => {
    // A column nobody fills is no scope: each such table is listed as owned, child or set-up
    // (NULL = shared) in a scope migration, or has a scope trigger of its own.
    const covered = listed();
    const triggered = new Set<string>();
    for (const m of sql.matchAll(/CREATE TRIGGER\s+\w+\s+BEFORE INSERT[^;]*?ON\s+"?(\w+)"?[^;]*?(?:set_company_branch|inherit_company_branch)/gi)) {
      triggered.add(m[1]);
    }
    const unexplained: string[] = [];
    for (const [table, body] of tableBodies(sql)) {
      if (EXEMPT.has(table) || covered.has(table) || triggered.has(table)) continue;
      if (/\bbranch_id\b/.test(body)) unexplained.push(table);
    }
    expect([...new Set(unexplained)]).toEqual([]);
  });
});
