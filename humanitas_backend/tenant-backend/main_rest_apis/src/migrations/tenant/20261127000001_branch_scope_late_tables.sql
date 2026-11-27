-- ==============================================================================
-- Branch scope for the tables the first sweep missed (AGENTS.md rule 16).
-- 20261022000001 listed these operational tables, but they were only created later by
-- 20261115000001_consolidate_runtime_schema.sql, so that sweep skipped them: no company/branch
-- trigger, and possibly no columns. branch-scope-ordering.spec.ts flags such tables.
-- Each row takes its person's company and branch (user_id, else created_by), else the defaults,
-- now and on every insert (trg_set_company_branch). Tables missing in this edition are skipped.
-- Idempotent.
-- ==============================================================================
DO $$
DECLARE
    def_comp uuid;
    def_branch uuid;
    t text;
    col text;
    tables text[] := ARRAY[
        'schedule_patterns', 'shift_assignments', 'rotation_weeks', 'attendance_qr_codes',
        'allowed_networks', 'leave_balances', 'biometric_devices'
    ];
BEGIN
    SELECT id INTO def_comp FROM companies WHERE is_default = true LIMIT 1;
    SELECT id INTO def_branch FROM branches WHERE is_default = true LIMIT 1;
    FOREACH t IN ARRAY tables LOOP
        IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (company_id)', 'idx_' || t || '_company_id', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (branch_id)', 'idx_' || t || '_branch_id', t);
        FOREACH col IN ARRAY ARRAY['user_id', 'created_by'] LOOP
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = col) THEN
                EXECUTE format(
                    'UPDATE %I x SET company_id = COALESCE(x.company_id, u.company_id),
                            branch_id = COALESCE(x.branch_id, CASE WHEN x.company_id IS NULL OR x.company_id IS NOT DISTINCT FROM u.company_id THEN u.branch_id END)
                       FROM users u WHERE u.id::text = x.%I::text AND (x.company_id IS NULL OR x.branch_id IS NULL)', t, col);
            END IF;
        END LOOP;
        IF def_comp IS NOT NULL THEN EXECUTE format('UPDATE %I SET company_id = %L WHERE company_id IS NULL', t, def_comp); END IF;
        IF def_branch IS NOT NULL THEN
            EXECUTE format('UPDATE %I x SET branch_id = COALESCE(
                  (SELECT b.id FROM branches b WHERE b.company_id = x.company_id ORDER BY b.is_default DESC NULLS LAST, b.created_at LIMIT 1), %L)
                WHERE x.branch_id IS NULL', t, def_branch);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_comp_branch_' || t) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trg_set_company_branch()', 'trg_comp_branch_' || t, t);
        END IF;
    END LOOP;
END $$;
