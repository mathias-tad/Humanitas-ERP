import * as fs from 'fs';
import * as path from 'path';

/**
 * Rule 16, ordering: a scope migration only wires the tables that exist when it runs, because it
 * skips every table it cannot find. A table created by a LATER migration therefore gets its
 * company_id / branch_id columns but no trigger at all. A table is covered when ANY scope migration
 * that lists it sorts after the file that creates it: a scope migration may have been written (and
 * skipped the table) before the table existed, so long as a later one wires it. Only a table named
 * exclusively by scope migrations that all sort BEFORE its creation is a real gap.
 *
 * This guard reads the migration files in the order the engine applies them, collects the scope
 * migrations that name each table, and fails for any table no scope migration wires after its
 * creation. Tables with branch_id written inline are not exempt: the column is not the trigger.
 */
const MIGRATIONS = path.join(__dirname, '..', '..', 'migrations', 'tenant');

/** Migrations that wire scope triggers for the tables they list. */
const SCOPE_MIGRATIONS = [
  '20261022000001_add_company_branch_to_all_operational_tables.sql',
  '20261122000023_branch_scope_every_table.sql',
  '20261123000002_inventory_branch_scope.sql',
  '20261127000001_branch_scope_late_tables.sql',
];

/** The hierarchy itself, the migration log and the access table that defines branch access. */
const EXEMPT = new Set(['companies', 'branches', 'schema_migrations', 'user_company_access']);

/**
 * Tables a scope migration listed before they existed and no later one wired yet. Empty: the
 * seven HR tables 20261022000001 missed are wired by 20261127000001_branch_scope_late_tables.sql.
 * Never add a name here to pass the test; write a scope migration that sorts after the table.
 */
const KNOWN_UNWIRED = new Set<string>([]);

const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const read = (f: string) => fs.readFileSync(path.join(MIGRATIONS, f), 'utf8');

/** Table -> the migration that creates it. */
function createdIn(): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of files) {
    for (const m of read(f).matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+"?([a-z_][a-z0-9_]*)"?\s*\(/gi)) {
      if (!out.has(m[1])) out.set(m[1], f);
    }
  }
  return out;
}

/** Table -> every scope migration that names it (a table may be listed by several). */
function scopedIn(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const f of SCOPE_MIGRATIONS) {
    if (!files.includes(f)) continue;
    // Quoted table names only: the lists are written as 'schema_table' string literals and the SQL
    // keywords around them (public, uuid, branches...) are not tables.
    for (const m of read(f).matchAll(/'([a-z][a-z0-9]*(?:_[a-z0-9]+)+)'/g)) {
      if (!out.has(m[1])) out.set(m[1], new Set());
      out.get(m[1])!.add(f);
    }
  }
  return out;
}

/** True when some scope migration naming the table sorts after the file that creates it. */
function coveredBy(scoped: Map<string, Set<string>>, table: string, creation: string): boolean {
  const named = scoped.get(table);
  if (!named) return false;
  for (const f of named) if (f > creation) return true;
  return false;
}

describe('company and branch scope triggers are wired after the tables exist (rule 16)', () => {
  it('every table some scope migration names is wired by one that sorts after its creation', () => {
    const created = createdIn();
    const scoped = scopedIn();
    const broken: string[] = [];
    for (const [table, named] of scoped) {
      const creation = created.get(table);
      // Candidates are only checked when the table belongs to this edition.
      if (!creation || EXEMPT.has(table) || KNOWN_UNWIRED.has(table)) continue;
      if (!coveredBy(scoped, table, creation)) {
        const worst = [...named].sort()[named.size - 1];
        broken.push(`${table} (last scope listing ${worst} sorts before its creation ${creation})`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('every inventory table is wired by a scope migration that sorts after its creation', () => {
    const created = createdIn();
    const scoped = scopedIn();
    const uncovered = [...created.keys()]
      .filter((t) => t.startsWith('inventory_') && t !== 'inventory_movement_history' && t !== 'inventory_stock_on_hand')
      .filter((t) => !coveredBy(scoped, t, created.get(t) as string));
    expect(uncovered).toEqual([]);
  });
});