-- ==============================================================================
-- Branch scope for the tables 20261115000001_consolidate_runtime_schema.sql created
-- (AGENTS.md rule 16).
-- That migration moved the CREATE TABLEs out of the services as dollar-quoted strings
-- ($ddlN$CREATE TABLE ... )$ddlN$). branch-scope-coverage.spec.ts only recognised a table body
-- ending in "\n);", so it read past them and never saw these tables: 53 had no company_id /
-- branch_id at all, and 25 that carry the columns inline had no trigger filling them.
-- Same three kinds as 20261122000023:
--   1. Owned records: the person's company and branch (defaults when unknown), now and on insert.
--   2. Child rows: the parent's company and branch, now and on insert; they follow the parent.
--   3. Set-up lists and rows their service scopes itself: NULL = shared, no trigger.
-- _permission_migrations is a migration log, like schema_migrations, and is exempt.
-- Tables that do not exist in this edition (HR or ERP) are skipped. Idempotent.
-- ==============================================================================

-- More columns that name the record's person, tried after the existing ones.
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
                               'employee_id', 'generated_for_user_id', 'requester_id', 'uploaded_by', 'logged_by', 'initiated_by'] LOOP
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

-- A child row takes its parent's company and branch. Some parents have text ids ('tc-001'),
-- so a parent id that is not a uuid is matched as text.
CREATE OR REPLACE FUNCTION trg_inherit_company_branch()
RETURNS TRIGGER AS $$
DECLARE
    r jsonb := to_jsonb(NEW);
    parent_id text := r->>TG_ARGV[1];
    p_comp uuid;
    p_branch uuid;
BEGIN
    IF parent_id IS NULL OR ((r->>'company_id') IS NOT NULL AND (r->>'branch_id') IS NOT NULL) THEN
        RETURN NEW;
    END IF;
    BEGIN
        EXECUTE format('SELECT company_id, branch_id FROM %I WHERE id = $1::uuid', TG_ARGV[0])
            INTO p_comp, p_branch USING parent_id;
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            EXECUTE format('SELECT company_id, branch_id FROM %I WHERE id::text = $1', TG_ARGV[0])
                INTO p_comp, p_branch USING parent_id;
        EXCEPTION WHEN OTHERS THEN
            RETURN NEW;
        END;
    END;
    IF (r->>'company_id') IS NULL THEN NEW.company_id := p_comp; END IF;
    IF (r->>'branch_id') IS NULL THEN NEW.branch_id := p_branch; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- When a record moves to another company or branch, its child rows move with it. Compared as
-- text: some child columns are VARCHAR while the parent id is a uuid.
CREATE OR REPLACE FUNCTION trg_cascade_company_branch()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
        EXECUTE format('UPDATE %I SET company_id = $1, branch_id = $2 WHERE %I::text = $3::text', TG_ARGV[0], TG_ARGV[1])
            USING NEW.company_id, NEW.branch_id, NEW.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    def_comp uuid;
    def_branch uuid;
    t text;
    spec text[];
    -- 1. owned records: table, the column naming the person
    owned text[][] := ARRAY[
        ARRAY['attendance_alarm_dismissals', 'user_id'],
        ARRAY['attendance_correction_requests', 'user_id'],
        ARRAY['user_devices', 'user_id'],
        ARRAY['biometric_templates', 'user_id'],
        ARRAY['biometric_punch_logs', 'user_id'],
        ARRAY['employee_onboarding', 'user_id'],
        ARRAY['employee_offboarding', 'user_id'],
        ARRAY['exit_interviews', 'user_id'],
        ARRAY['welcome_portal_status', 'user_id'],
        ARRAY['onboarding_welcome_checklist', 'user_id'],
        ARRAY['employee_skills', 'user_id'],
        ARRAY['training_enrollments', 'user_id'],
        ARRAY['profile_change_requests', 'user_id'],
        ARRAY['user_attachments', 'user_id'],
        ARRAY['user_signatures', 'user_id'],
        ARRAY['employee_documents', 'user_id'],
        ARRAY['letter_audit_log', 'generated_for_user_id'],
        ARRAY['ai_document_audit_logs', 'user_id'],
        ARRAY['notifications', 'user_id'],
        ARRAY['push_device_tokens', 'user_id'],
        ARRAY['user_notification_preferences', 'user_id'],
        ARRAY['notification_delivery_logs', 'user_id'],
        ARRAY['benefit_enrollments', 'user_id'],
        ARRAY['expense_reports', 'employee_id'],
        ARRAY['grievances', 'user_id'],
        ARRAY['pms_employee_reviews', 'employee_id'],
        ARRAY['pms_performance_improvement_plans', 'employee_id'],
        ARRAY['survey_responses', 'user_id'],
        ARRAY['wfm_opportunity_claims', 'user_id'],
        ARRAY['company_assets', 'created_by'],
        ARRAY['export_templates', 'created_by'],
        ARRAY['import_export_jobs', 'created_by'],
        ARRAY['developer_api_keys', 'created_by'],
        ARRAY['webhook_subscriptions', 'created_by']
    ];
    -- 2. child rows: table, parent table, column with the parent's id (parents first)
    children text[][] := ARRAY[
        ARRAY['device_users', 'biometric_devices', 'device_id'],
        ARRAY['device_sync_logs', 'biometric_devices', 'device_id'],
        ARRAY['device_commands', 'biometric_devices', 'device_id'],
        ARRAY['webhook_deliveries', 'webhook_subscriptions', 'webhook_id'],
        ARRAY['api_key_activity_logs', 'developer_api_keys', 'api_key_id'],
        ARRAY['asset_assignments', 'company_assets', 'asset_id'],
        ARRAY['asset_maintenance_logs', 'company_assets', 'asset_id'],
        ARRAY['benefit_dependents', 'benefit_enrollments', 'enrollment_id'],
        ARRAY['document_versions', 'employee_documents', 'document_id'],
        ARRAY['expense_items', 'expense_reports', 'report_id'],
        ARRAY['grievance_timeline', 'grievances', 'grievance_id'],
        ARRAY['grievance_attachments', 'grievances', 'grievance_id'],
        ARRAY['onboarding_template_items', 'onboarding_templates', 'template_id'],
        ARRAY['onboarding_tasks', 'employee_onboarding', 'onboarding_id'],
        ARRAY['offboarding_tasks', 'employee_offboarding', 'offboarding_id'],
        ARRAY['survey_questions', 'surveys', 'survey_id'],
        ARRAY['survey_action_items', 'surveys', 'survey_id'],
        ARRAY['survey_answers', 'survey_responses', 'response_id'],
        ARRAY['training_sessions', 'training_courses', 'course_id'],
        ARRAY['pms_review_feedbacks', 'pms_employee_reviews', 'review_id'],
        ARRAY['pms_review_competency_scores', 'pms_review_feedbacks', 'feedback_id']
    ];
    -- 3. set-up lists (NULL = shared), and rows whose service writes company/branch itself
    --    (calendar events, surveys, review cycles, shift opportunities, recruitment): no trigger,
    --    so a row left NULL on purpose stays shared.
    catalog text[] := ARRAY[
        'asset_categories', 'device_protocols', 'email_templates', 'esign_provider_config',
        'onboarding_templates', 'open_enrollment_periods', 'pms_competencies', 'training_courses',
        'system_settings', 'tenant_modules', 'benefit_plans', 'expense_categories', 'letter_templates',
        'chat_role_restrictions', 'chat_direct_access_grants', 'wfm_settings', 'wfm_opportunities',
        'calendar_events', 'surveys', 'pms_review_cycles', 'recruitment_interviews', 'recruitment_offers'
    ];
    all_tables text[];
BEGIN
    SELECT id INTO def_comp FROM companies WHERE is_default = true LIMIT 1;
    SELECT id INTO def_branch FROM branches WHERE is_default = true LIMIT 1;

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

    -- 1. Owned records.
    FOREACH spec SLICE 1 IN ARRAY owned LOOP
        t := spec[1];
        IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = spec[2]) THEN
            EXECUTE format(
                'UPDATE %I x SET company_id = COALESCE(x.company_id, u.company_id),
                        branch_id = COALESCE(x.branch_id, CASE WHEN x.company_id IS NULL OR x.company_id IS NOT DISTINCT FROM u.company_id THEN u.branch_id END)
                   FROM users u WHERE u.id::text = x.%I::text AND (x.company_id IS NULL OR x.branch_id IS NULL)', t, spec[2]);
        END IF;
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

    -- 2. Child rows.
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
