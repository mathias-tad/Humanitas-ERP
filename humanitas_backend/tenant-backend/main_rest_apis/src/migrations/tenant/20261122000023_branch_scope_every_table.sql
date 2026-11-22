-- ==============================================================================
-- Branch scope on every table (AGENTS.md rule 16).
-- 20261022000001 gave company_id/branch_id to the tables that existed then; every table created
-- since (catalog, CRM, contacts, chat, AI, approvals...) and the child tables were left out.
-- Three kinds, so no data loses its company or branch:
--   1. Operational records owned by a person: backfilled from that person's company/branch
--      (default company/branch when unknown) and filled on insert by trg_set_company_branch.
--   2. Child rows (lines, members, comments, attachments...): copy their parent's company and
--      branch, now and on every insert (trg_inherit_company_branch).
--   3. Catalog and set-up lists: NULL means "shared by every company/branch"; existing rows stay
--      shared, and a row can be limited to one company or branch.
-- Tables that do not exist in this edition (HR or ERP) are skipped. Idempotent.
-- ==============================================================================

-- New records of a person take that person's company and branch. Same as 20261022000001, and it
-- now also looks at owner_id, assigned_to, created_by_id and blocker_id (CRM, chat).
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
    FOREACH col IN ARRAY ARRAY['user_id', 'created_by', 'manager_id', 'owner_id', 'assigned_to', 'created_by_id', 'blocker_id'] LOOP
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

-- A child row takes its parent's company and branch. TG_ARGV[0] = parent table, TG_ARGV[1] = the
-- column holding the parent's id.
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
        RETURN NEW;
    END;
    IF (r->>'company_id') IS NULL THEN NEW.company_id := p_comp; END IF;
    IF (r->>'branch_id') IS NULL THEN NEW.branch_id := p_branch; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- When a record moves to another company or branch, its child rows move with it.
-- TG_ARGV[0] = child table, TG_ARGV[1] = the child's column holding this record's id.
CREATE OR REPLACE FUNCTION trg_cascade_company_branch()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
        EXECUTE format('UPDATE %I SET company_id = $1, branch_id = $2 WHERE %I = $3', TG_ARGV[0], TG_ARGV[1])
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
    -- 1. owned records: table, the column naming the person (NULL = none)
    owned text[][] := ARRAY[
        ARRAY['crm_leads', 'owner_id'],
        ARRAY['crm_opportunities', 'owner_id'],
        ARRAY['crm_activities', 'assigned_to'],
        ARRAY['user_income_assignments', 'user_id'],
        ARRAY['audit_logs', 'user_id'],
        ARRAY['system_audit_logs', ''],
        ARRAY['conversations', 'created_by_id'],
        ARRAY['message_settings', 'user_id'],
        ARRAY['blocked_users', 'blocker_id'],
        ARRAY['ai_conversations', 'user_id'],
        ARRAY['ai_pending_actions', 'user_id'],
        ARRAY['calculation_logs', '']
    ];
    -- 2. child rows: table, parent table, column with the parent's id
    children text[][] := ARRAY[
        ARRAY['income_type_category_rules', 'income_types', 'income_type_id'],
        ARRAY['category_allowances', 'employee_categories', 'employee_category_id'],
        ARRAY['pms_team_members', 'pms_teams', 'team_id'],
        ARRAY['pms_project_members', 'pms_projects', 'project_id'],
        ARRAY['pms_project_teams', 'pms_projects', 'project_id'],
        ARRAY['pms_task_comments', 'pms_tasks', 'task_id'],
        ARRAY['pms_task_attachments', 'pms_tasks', 'task_id'],
        ARRAY['pms_task_dependencies', 'pms_tasks', 'task_id'],
        ARRAY['pms_task_activity_logs', 'pms_tasks', 'task_id'],
        ARRAY['conversation_participants', 'conversations', 'conversation_id'],
        ARRAY['messages', 'conversations', 'conversation_id'],
        ARRAY['message_attachments', 'messages', 'message_id'],
        ARRAY['message_reactions', 'messages', 'message_id'],
        ARRAY['message_read_receipts', 'messages', 'message_id'],
        ARRAY['ai_messages', 'ai_conversations', 'conversation_id'],
        ARRAY['delegation_audit_logs', 'user_delegations', 'delegation_id'],
        ARRAY['approval_workflow_steps', 'approval_workflows', 'workflow_id'],
        ARRAY['approval_request_actions', 'approval_requests', 'request_id'],
        ARRAY['tenant_ai_knowledge_chunks', 'tenant_ai_knowledge_documents', 'document_id'],
        ARRAY['uoms', 'uom_categories', 'category_id'],
        ARRAY['product_attribute_values', 'product_attributes', 'attribute_id'],
        ARRAY['product_barcodes', 'products', 'product_id'],
        ARRAY['product_template_attributes', 'products', 'product_id'],
        ARRAY['product_variant_values', 'products', 'product_id'],
        ARRAY['product_packagings', 'products', 'product_id'],
        ARRAY['product_components', 'products', 'product_id'],
        ARRAY['product_combo_groups', 'products', 'product_id'],
        ARRAY['product_combo_choices', 'product_combo_groups', 'group_id'],
        ARRAY['product_media', 'products', 'product_id'],
        ARRAY['price_list_items', 'price_lists', 'price_list_id'],
        ARRAY['price_list_customers', 'price_lists', 'price_list_id'],
        ARRAY['crm_stages', 'crm_pipelines', 'pipeline_id']
    ];
    -- 3. catalog and set-up lists (NULL = shared)
    catalog text[] := ARRAY[
        'settings', 'employee_categories', 'roles', 'income_types', 'tax_rules',
        'pms_settings', 'pms_manual_kpi_metrics', 'ai_knowledge_entries',
        'uom_categories', 'product_categories', 'products', 'eims_codes', 'product_attributes',
        'product_settings', 'price_lists', 'label_templates', 'contact_categories', 'contacts',
        'crm_lead_sources', 'crm_lost_reasons', 'crm_pipelines', 'inventory_sequences'
    ];
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

    -- 1. Owned records: the person's company and branch, else the defaults; filled on insert.
    FOREACH spec SLICE 1 IN ARRAY owned LOOP
        t := spec[1];
        IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
        IF spec[2] <> '' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = spec[2]) THEN
            EXECUTE format(
                'UPDATE %I x SET company_id = COALESCE(x.company_id, u.company_id),
                        branch_id = COALESCE(x.branch_id, CASE WHEN x.company_id IS NULL OR x.company_id IS NOT DISTINCT FROM u.company_id THEN u.branch_id END)
                   FROM users u WHERE u.id::text = x.%I::text AND (x.company_id IS NULL OR x.branch_id IS NULL)', t, spec[2]);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'created_by') THEN
            EXECUTE format(
                'UPDATE %I x SET company_id = COALESCE(x.company_id, u.company_id),
                        branch_id = COALESCE(x.branch_id, CASE WHEN x.company_id IS NULL OR x.company_id IS NOT DISTINCT FROM u.company_id THEN u.branch_id END)
                   FROM users u WHERE u.id::text = x.created_by::text AND (x.company_id IS NULL OR x.branch_id IS NULL)', t);
        END IF;
        IF def_comp IS NOT NULL THEN EXECUTE format('UPDATE %I SET company_id = %L WHERE company_id IS NULL', t, def_comp); END IF;
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
    -- 3. Catalog rows keep NULL (shared) until someone limits them.
END $$;
