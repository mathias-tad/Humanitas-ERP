-- ==============================================================================
-- Migration: 20261123000002_inventory_branch_scope.sql
-- Branch scope for Inventory (AGENTS.md rule 16, featureslist §2).
--
-- 20261122000023_branch_scope_every_table.sql wires company_id / branch_id, the inherit and the
-- cascade triggers for the tables that existed when it ran; it walks hard-coded lists and skips
-- every table it cannot find (`IF to_regclass(...) IS NULL THEN CONTINUE`). The inventory tables
-- are created in 20261123000001_inventory_core.sql, which sorts AFTER it, so that migration
-- skipped all of them: they carried the columns but no trigger at all — a warehouse, bin, move,
-- quant or lot inserted without an explicit company/branch stayed NULL, and no child row inherited
-- its parent's scope. This migration runs after the tables exist and applies the same three kinds.
--
-- `branch-scope-ordering.spec.ts` fails when a future module repeats the mistake, by checking that
-- a table is listed by a scope migration that sorts after the file creating it.
--
--   1. Root documents: company and branch of the person who created them, else the tenant defaults.
--   2. Child rows: their parent's company and branch on insert, and on every move of the parent —
--      a bin follows its warehouse, a move its transfer, a quant its location, a layer its move.
--   3. inventory_sequences: set-up list (NULL = shared by every company), like the other counters.
-- Idempotent: safe to run on a tenant that already has any of it.
-- ==============================================================================

DO $$
DECLARE
    def_comp uuid;
    def_branch uuid;
    t text;
    spec text[];
    -- 1. Root documents: the creator's company and branch, else the tenant defaults.
    owned text[][] := ARRAY[
        ARRAY['inventory_warehouses'],
        ARRAY['inventory_transfers'],
        ARRAY['inventory_counts'],
        ARRAY['inventory_lots'],
        ARRAY['inventory_product_config'],
        ARRAY['inventory_putaway_rules'],
        ARRAY['inventory_orderpoints'],
        ARRAY['inventory_settings']
    ];
    -- 2. Child rows: table, parent table, column holding the parent's id.
    children text[][] := ARRAY[
        ARRAY['inventory_locations',        'inventory_warehouses', 'warehouse_id'],
        ARRAY['inventory_moves',            'inventory_transfers',  'transfer_id'],
        ARRAY['inventory_count_lines',      'inventory_counts',     'count_id'],
        ARRAY['inventory_valuation_layers', 'inventory_moves',      'move_id'],
        ARRAY['inventory_quants',           'inventory_locations',  'location_id']
    ];
    -- 3. Set-up lists (NULL = shared by every company).
    catalog text[] := ARRAY['inventory_sequences'];
    all_tables text[];
BEGIN
    SELECT id INTO def_comp FROM companies WHERE is_default = true LIMIT 1;
    SELECT id INTO def_branch FROM branches WHERE is_default = true LIMIT 1;

    -- Columns and indexes on every table of the three lists.
    all_tables := catalog;
    FOREACH spec SLICE 1 IN ARRAY owned LOOP all_tables := all_tables || spec[1]; END LOOP;
    FOREACH spec SLICE 1 IN ARRAY children LOOP all_tables := all_tables || spec[1]; END LOOP;
    FOREACH t IN ARRAY all_tables LOOP
        IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (company_id)', 'idx_' || t || '_company_id', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (branch_id)', 'idx_' || t || '_branch_id', t);
    END LOOP;

    -- 1. Root documents: existing rows (none on a fresh tenant) take the defaults; new rows take
    --    the creator's company and branch through trg_set_company_branch.
    FOREACH spec SLICE 1 IN ARRAY owned LOOP
        t := spec[1];
        IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
        IF def_comp IS NOT NULL THEN
            EXECUTE format('UPDATE %I SET company_id = %L WHERE company_id IS NULL', t, def_comp);
        END IF;
        IF def_branch IS NOT NULL THEN
            -- the default branch only where it belongs to the row's company
            EXECUTE format('UPDATE %I x SET branch_id = COALESCE(
                  (SELECT b.id FROM branches b WHERE b.company_id = x.company_id ORDER BY b.is_default DESC NULLS LAST, b.created_at LIMIT 1), %L)
                WHERE x.branch_id IS NULL', t, def_branch);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_comp_branch_' || t) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trg_set_company_branch()', 'trg_comp_branch_' || t, t);
        END IF;
    END LOOP;

    -- 2. Child rows: the parent's company and branch (parents listed before their children).
    FOREACH spec SLICE 1 IN ARRAY children LOOP
        t := spec[1];
        IF to_regclass(format('public.%I', t)) IS NULL OR to_regclass(format('public.%I', spec[2])) IS NULL THEN CONTINUE; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = spec[2] AND column_name = 'branch_id') THEN CONTINUE; END IF;
        EXECUTE format(
            'UPDATE %I c SET company_id = COALESCE(c.company_id, p.company_id), branch_id = COALESCE(c.branch_id, p.branch_id)
               FROM %I p WHERE p.id::text = c.%I::text AND (c.company_id IS NULL OR c.branch_id IS NULL)', t, spec[2], spec[3]);
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inherit_scope_' || t) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trg_inherit_company_branch(%L, %L)',
                'trg_inherit_scope_' || t, t, spec[2], spec[3]);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cascade_scope_' || t) THEN
            EXECUTE format('CREATE TRIGGER %I AFTER UPDATE OF company_id, branch_id ON %I FOR EACH ROW EXECUTE FUNCTION trg_cascade_company_branch(%L, %L)',
                'trg_cascade_scope_' || t, spec[2], t, spec[3]);
        END IF;
    END LOOP;
    -- 3. Set-up rows keep NULL (shared) until someone limits them.
END $$;