-- ==============================================================================
-- PMS work follows its project (AGENTS.md rule 16).
-- 20261022000001 gave pms_projects, pms_teams, pms_sprints and pms_tasks the person-owned trigger,
-- but filled existing rows from user_id only, which these tables do not have: they all got the
-- default company and branch. Tasks and sprints name no person the trigger knows, so new ones got
-- the defaults too.
-- Now:
--   - a project takes its manager's company and branch (else its creator's);
--   - a team takes its leader's;
--   - sprints and tasks take their project's, now and on every insert, and move with it; a task
--     without a project takes its assignee's (else its reporter's).
-- Only rows still on the automatic default are re-derived: no form sets a PMS branch, but a row
-- someone moved since is left alone. Tables missing in this edition are skipped. Idempotent.
-- ==============================================================================

-- assignee_id, reporter_id and leader_id also name the record's person.
CREATE OR REPLACE FUNCTION trg_set_company_branch()
RETURNS TRIGGER AS $$
DECLARE
    row_json jsonb := to_jsonb(NEW);
    col text;
    target_user_id uuid := NULL;
    u_comp_id uuid := NULL;
    u_branch_id uuid := NULL;
    def_comp_id uuid;
    def_branch_id uuid;
BEGIN
    IF (row_json->>'company_id') IS NOT NULL AND (row_json->>'branch_id') IS NOT NULL THEN
        RETURN NEW;
    END IF;
    SELECT id INTO def_comp_id FROM companies WHERE is_default = true LIMIT 1;
    SELECT id INTO def_branch_id FROM branches WHERE is_default = true LIMIT 1;
    FOREACH col IN ARRAY ARRAY['user_id', 'created_by', 'manager_id', 'owner_id', 'assigned_to', 'created_by_id', 'blocker_id',
                               'employee_id', 'generated_for_user_id', 'requester_id', 'uploaded_by', 'logged_by', 'initiated_by',
                               'assignee_id', 'reporter_id', 'leader_id'] LOOP
        IF (row_json->>col) IS NOT NULL THEN
            BEGIN
                target_user_id := (row_json->>col)::uuid;
            EXCEPTION WHEN OTHERS THEN
                target_user_id := NULL;
            END;
            EXIT WHEN target_user_id IS NOT NULL;
        END IF;
    END LOOP;
    IF target_user_id IS NOT NULL THEN
        SELECT company_id, branch_id INTO u_comp_id, u_branch_id FROM users WHERE id = target_user_id;
    END IF;
    IF (row_json->>'company_id') IS NULL THEN
        NEW.company_id := COALESCE(u_comp_id, def_comp_id);
    END IF;
    IF (row_json->>'branch_id') IS NULL THEN
        NEW.branch_id := COALESCE(u_branch_id, def_branch_id);
        -- never a branch of another company: then that company's main branch
        IF NEW.company_id IS NOT NULL AND NEW.branch_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.branch_id AND (company_id IS NULL OR company_id = NEW.company_id)) THEN
            NEW.branch_id := (SELECT id FROM branches WHERE company_id = NEW.company_id
                              ORDER BY is_default DESC NULLS LAST, created_at LIMIT 1);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    def_comp uuid;
    def_branch uuid;
    spec text[];
BEGIN
    SELECT id INTO def_comp FROM companies WHERE is_default = true LIMIT 1;
    SELECT id INTO def_branch FROM branches WHERE is_default = true LIMIT 1;

    -- Projects: manager, else creator. Teams: leader.
    FOREACH spec SLICE 1 IN ARRAY ARRAY[
        ARRAY['pms_projects', 'manager_id'], ARRAY['pms_projects', 'created_by'], ARRAY['pms_teams', 'leader_id']
    ] LOOP
        IF to_regclass(format('public.%I', spec[1])) IS NULL THEN CONTINUE; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = spec[1] AND column_name = spec[2])
           OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = spec[1] AND column_name = 'branch_id') THEN
            CONTINUE;
        END IF;
        EXECUTE format(
            'UPDATE %I x SET company_id = u.company_id, branch_id = u.branch_id
               FROM users u
              WHERE u.id::text = x.%I::text AND u.company_id IS NOT NULL
                AND x.company_id IS NOT DISTINCT FROM $1 AND x.branch_id IS NOT DISTINCT FROM $2
                AND (x.company_id IS DISTINCT FROM u.company_id OR x.branch_id IS DISTINCT FROM u.branch_id)',
            spec[1], spec[2]) USING def_comp, def_branch;
    END LOOP;

    -- Sprints and tasks: their project's company and branch.
    FOREACH spec SLICE 1 IN ARRAY ARRAY[ARRAY['pms_sprints', 'project_id'], ARRAY['pms_tasks', 'project_id']] LOOP
        IF to_regclass(format('public.%I', spec[1])) IS NULL OR to_regclass('public.pms_projects') IS NULL THEN CONTINUE; END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = spec[1] AND column_name = 'branch_id') THEN CONTINUE; END IF;
        EXECUTE format(
            'UPDATE %I x SET company_id = p.company_id, branch_id = p.branch_id
               FROM pms_projects p
              WHERE p.id::text = x.%I::text
                AND x.company_id IS NOT DISTINCT FROM $1 AND x.branch_id IS NOT DISTINCT FROM $2
                AND (x.company_id IS DISTINCT FROM p.company_id OR x.branch_id IS DISTINCT FROM p.branch_id)',
            spec[1], spec[2]) USING def_comp, def_branch;
        -- The project's company and branch on insert (before the person trigger), and on a move.
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_comp_branch_' || spec[1], spec[1]);
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_inherit_scope_' || spec[1]) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trg_inherit_company_branch(%L, %L)',
                'trg_inherit_scope_' || spec[1], spec[1], 'pms_projects', spec[2]);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cascade_scope_' || spec[1]) THEN
            EXECUTE format('CREATE TRIGGER %I AFTER UPDATE OF company_id, branch_id ON pms_projects FOR EACH ROW EXECUTE FUNCTION trg_cascade_company_branch(%L, %L)',
                'trg_cascade_scope_' || spec[1], spec[1], spec[2]);
        END IF;
        -- Without a project: the person's (assignee, reporter), else the defaults. Fires after
        -- trg_inherit_scope_ (triggers run in name order) and fills only what is still empty.
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_scope_owned_' || spec[1]) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trg_set_company_branch()',
                'trg_scope_owned_' || spec[1], spec[1]);
        END IF;
    END LOOP;

    -- Tasks without a project: assignee, else reporter.
    IF to_regclass('public.pms_tasks') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pms_tasks' AND column_name = 'branch_id') THEN
        FOREACH spec SLICE 1 IN ARRAY ARRAY[ARRAY['pms_tasks', 'assignee_id'], ARRAY['pms_tasks', 'reporter_id']] LOOP
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pms_tasks' AND column_name = spec[2]) THEN CONTINUE; END IF;
            EXECUTE format(
                'UPDATE pms_tasks x SET company_id = u.company_id, branch_id = u.branch_id
                   FROM users u
                  WHERE x.project_id IS NULL AND u.id::text = x.%I::text AND u.company_id IS NOT NULL
                    AND x.company_id IS NOT DISTINCT FROM $1 AND x.branch_id IS NOT DISTINCT FROM $2
                    AND (x.company_id IS DISTINCT FROM u.company_id OR x.branch_id IS DISTINCT FROM u.branch_id)',
                spec[2]) USING def_comp, def_branch;
        END LOOP;
    END IF;
END $$;
