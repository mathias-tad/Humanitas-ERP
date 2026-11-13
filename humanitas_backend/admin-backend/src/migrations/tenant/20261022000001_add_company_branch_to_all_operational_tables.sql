-- ==============================================================================
-- Migration: 20261022000001_add_company_branch_to_all_operational_tables.sql
-- Directive 16: Multi-Company & Multi-Branch Enterprise Scoping Architecture
-- Adds company_id and branch_id to all operational tables across all modules,
-- backfills existing rows with default company/branch, creates indexes,
-- and attaches an automatic inheritance trigger for new inserts.
-- ==============================================================================

-- 1. Ensure companies table exists with at least one default company
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),
  registration_number VARCHAR(100),
  tax_number VARCHAR(100),
  industry VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(200),
  website VARCHAR(200),
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO companies (name, is_default, is_active)
SELECT 'Default Company', true, true
WHERE NOT EXISTS (SELECT 1 FROM companies);

-- 2. Ensure branches table exists with at least one default branch
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(200),
  manager_id UUID,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO branches (company_id, name, is_default, is_active)
SELECT (SELECT id FROM companies WHERE is_default = true LIMIT 1), 'Main Branch', true, true
WHERE NOT EXISTS (SELECT 1 FROM branches);

-- 3. Automatic Company & Branch Inheritance Trigger Function
CREATE OR REPLACE FUNCTION trg_set_company_branch()
RETURNS TRIGGER AS $$
DECLARE
    row_json jsonb;
    target_user_id uuid := NULL;
    u_comp_id uuid := NULL;
    u_branch_id uuid := NULL;
    def_comp_id uuid;
    def_branch_id uuid;
BEGIN
    row_json := to_jsonb(NEW);

    -- If both are already provided, do not override
    IF (row_json->>'company_id') IS NOT NULL AND (row_json->>'branch_id') IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT id INTO def_comp_id FROM companies WHERE is_default = true LIMIT 1;
    SELECT id INTO def_branch_id FROM branches WHERE is_default = true LIMIT 1;

    -- Infer user identity from record if available
    IF (row_json->>'user_id') IS NOT NULL THEN
        BEGIN
            target_user_id := (row_json->>'user_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            target_user_id := NULL;
        END;
    ELSIF (row_json->>'created_by') IS NOT NULL THEN
        BEGIN
            target_user_id := (row_json->>'created_by')::uuid;
        EXCEPTION WHEN OTHERS THEN
            target_user_id := NULL;
        END;
    ELSIF (row_json->>'manager_id') IS NOT NULL THEN
        BEGIN
            target_user_id := (row_json->>'manager_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
            target_user_id := NULL;
        END;
    END IF;

    -- Look up the user's assigned company and branch
    IF target_user_id IS NOT NULL THEN
        SELECT company_id, branch_id INTO u_comp_id, u_branch_id FROM users WHERE id = target_user_id;
    END IF;

    -- Assign company_id if not present
    IF (row_json->>'company_id') IS NULL THEN
        NEW.company_id := COALESCE(u_comp_id, def_comp_id);
    END IF;

    -- Assign branch_id if not present
    IF (row_json->>'branch_id') IS NULL THEN
        NEW.branch_id := COALESCE(u_branch_id, def_branch_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply columns, backfill, indexing, and trigger across all operational tables
DO $$
DECLARE
    tbl text;
    def_comp_id uuid;
    def_branch_id uuid;
    tables text[] := ARRAY[
        -- Core & Organization
        'users',
        'departments',
        'positions',
        'user_allowance_settings',

        -- Attendance & Scheduling
        'attendance',
        'attendance_records',
        'shifts',
        'schedules',
        'schedule_patterns',
        'shift_patterns',
        'shift_assignments',
        'user_shift_patterns',
        'rotation_weeks',
        'overtime_entries',
        'late_minutes_summary',
        'absence_summary',
        'attendance_qr_codes',
        'allowed_networks',

        -- Leave Management
        'leave_requests',
        'leave_balances',
        'leave_workflows',
        'leave_approvals',

        -- Payroll & Compensation
        'payroll_runs',
        'payroll_items',
        'loans',
        'loan_workflows',
        'loan_approvals',
        'per_diem_claims',
        'user_penalties',
        'holidays',
        'user_incomes',
        'acting_assignments',

        -- PMS (Projects, Sprints & Tasks)
        'pms_projects',
        'pms_teams',
        'pms_sprints',
        'pms_tasks',
        'pms_task_time_logs',
        'pms_manual_kpi_scores',

        -- Devices & Biometrics
        'device_registry',
        'biometric_devices',

        -- Communication & Events
        'announcements',
        'events',

        -- ERP Financial & Operations (Forward Compatible)
        'inventory_warehouses',
        'inventory_items',
        'sales_orders',
        'purchase_orders',
        'pos_terminals',
        'chart_of_accounts',
        'journal_entries'
    ];
BEGIN
    SELECT id INTO def_comp_id FROM companies WHERE is_default = true LIMIT 1;
    SELECT id INTO def_branch_id FROM branches WHERE is_default = true LIMIT 1;

    FOREACH tbl IN ARRAY tables
    LOOP
        -- Check if table exists in public schema
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
            -- 1. Add company_id column if not exists
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL', tbl);

            -- 2. Add branch_id column if not exists
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL', tbl);

            -- 3. Backfill from users table if table has a user_id column
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = tbl AND column_name = 'user_id' AND table_schema = 'public') THEN
                EXECUTE format('
                    UPDATE %I t
                    SET company_id = COALESCE(t.company_id, u.company_id),
                        branch_id = COALESCE(t.branch_id, u.branch_id)
                    FROM users u
                    WHERE t.user_id = u.id AND (t.company_id IS NULL OR t.branch_id IS NULL)
                ', tbl);
            END IF;

            -- 4. Backfill any remaining NULLs with default company and branch
            IF def_comp_id IS NOT NULL THEN
                EXECUTE format('UPDATE %I SET company_id = %L WHERE company_id IS NULL', tbl, def_comp_id);
            END IF;
            IF def_branch_id IS NOT NULL THEN
                EXECUTE format('UPDATE %I SET branch_id = %L WHERE branch_id IS NULL', tbl, def_branch_id);
            END IF;

            -- 5. Create performance indexes
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (company_id)', 'idx_' || tbl || '_company_id', tbl);
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (branch_id)', 'idx_' || tbl || '_branch_id', tbl);

            -- 6. Attach auto-assignment trigger
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_comp_branch_' || tbl, tbl);
            EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trg_set_company_branch()', 'trg_comp_branch_' || tbl, tbl);
        END IF;
    END LOOP;
END $$;
