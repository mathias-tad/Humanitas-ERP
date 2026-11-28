-- ==============================================================================
-- Set-up rows are shared unless someone limits them (AGENTS.md rule 16).
-- 20261022000001 gave holidays, events, announcements, shifts and shift / schedule patterns the
-- person-owned trigger, so every row was stamped with its creator's company and branch, or the
-- default ones. Nothing filtered on them, so every branch saw every row. Lists now filter by
-- company and branch (Round B), which would hide head-office holidays, shifts and announcements
-- from the other branches.
-- These are set-up lists, like the catalog tables of 20261122000023: NULL = shared by every
-- company / branch. Existing rows become shared, which is what every user saw until now; a new
-- row takes the one company / branch the request works in (a branch-limited user's own branch),
-- else it is shared. The insert trigger is removed so NULL stays NULL.
-- Tables missing in this edition are skipped. Idempotent.
-- ==============================================================================
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['holidays', 'events', 'announcements', 'shifts', 'shift_patterns', 'schedule_patterns'] LOOP
        IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_comp_branch_' || t, t);
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'branch_id')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'company_id') THEN
            EXECUTE format('UPDATE %I SET company_id = NULL, branch_id = NULL WHERE company_id IS NOT NULL OR branch_id IS NOT NULL', t);
        END IF;
    END LOOP;
END $$;
