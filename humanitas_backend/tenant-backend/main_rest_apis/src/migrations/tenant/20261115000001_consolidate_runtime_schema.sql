-- ============================================================================
-- Consolidated runtime schema (schema-drift fix)
--
-- Every CREATE TABLE / ALTER TABLE / CREATE INDEX that services used to run at
-- request time ("ensureTables()" and similar) now lives here, so each tenant
-- database gets it exactly once through TenantMigrationService.
--
-- Each statement runs in its own savepoint. Statements that fail (e.g. because a
-- table they reference is created later in this list) are retried in further
-- passes until everything applies or no more progress is possible — the same
-- tolerance the old runtime try/catch blocks had, but deterministic.
-- Generated from 38 service files (132 statements).
-- ============================================================================
DO $consolidate$
DECLARE
  stmts text[] := ARRAY[
    -- modules/ai/ai-settings.service.ts :: updateAiConfig
    $ddl0$CREATE TABLE IF NOT EXISTS system_settings (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl0$,
    -- modules/announcements/announcements.service.ts :: ensureAnnouncementsTables
    $ddl1$CREATE TABLE IF NOT EXISTS announcements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                priority VARCHAR(20) DEFAULT 'normal',
                target_type VARCHAR(20) NOT NULL,
                target_ids TEXT[],
                created_by UUID,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )$ddl1$,
    -- modules/approvals/approvals.service.ts :: ensureApprovalTables
    $ddl2$CREATE TABLE IF NOT EXISTS approval_workflows (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            company_id UUID,
            branch_id UUID,
            workflow_type VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            routing_mode VARCHAR(50) DEFAULT 'sequential',
            threshold_amount NUMERIC(15, 2),
            threshold_currency VARCHAR(10) DEFAULT 'USD',
            department VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS approval_workflow_steps (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
            step_order INT NOT NULL,
            step_name VARCHAR(255) NOT NULL,
            approver_role VARCHAR(100),
            approver_user_id UUID,
            require_all_in_step BOOLEAN DEFAULT FALSE,
            escalation_hours INT DEFAULT 24,
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS approval_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            company_id UUID,
            branch_id UUID,
            workflow_id UUID REFERENCES approval_workflows(id) ON DELETE SET NULL,
            workflow_type VARCHAR(100) NOT NULL,
            entity_type VARCHAR(100) NOT NULL,
            entity_id VARCHAR(100) NOT NULL,
            reference_number VARCHAR(100),
            title VARCHAR(255) NOT NULL,
            amount NUMERIC(15, 2),
            currency VARCHAR(10) DEFAULT 'USD',
            submitter_id UUID NOT NULL,
            submitter_name VARCHAR(255) NOT NULL,
            submitter_email VARCHAR(255),
            department VARCHAR(100),
            current_step_order INT DEFAULT 1,
            total_steps INT DEFAULT 1,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS approval_request_actions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
            step_order INT NOT NULL,
            approver_id UUID NOT NULL,
            approver_name VARCHAR(255) NOT NULL,
            approver_role VARCHAR(100),
            action VARCHAR(50) NOT NULL,
            comments TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_approval_workflows_tenant ON approval_workflows(tenant_id);
          CREATE INDEX IF NOT EXISTS idx_approval_workflows_type ON approval_workflows(workflow_type);
          CREATE INDEX IF NOT EXISTS idx_approval_wf_scope ON approval_workflows(company_id, branch_id);
          CREATE INDEX IF NOT EXISTS idx_approval_workflow_steps_wf ON approval_workflow_steps(workflow_id);
          CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant ON approval_requests(tenant_id);
          CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
          CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(workflow_type);
          CREATE INDEX IF NOT EXISTS idx_approval_requests_submitter ON approval_requests(submitter_id);
          CREATE INDEX IF NOT EXISTS idx_approval_requests_entity ON approval_requests(entity_type, entity_id);
          CREATE INDEX IF NOT EXISTS idx_approval_req_scope ON approval_requests(company_id, branch_id);
          CREATE INDEX IF NOT EXISTS idx_approval_actions_request ON approval_request_actions(request_id)$ddl2$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl3$CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        grace_minutes INTEGER DEFAULT 15,
        wait_for_absent_minutes INTEGER DEFAULT NULL,
        color VARCHAR(50) DEFAULT 'bg-blue-500',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl3$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl4$CREATE TABLE IF NOT EXISTS schedule_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        rotation_type VARCHAR(20) DEFAULT 'fixed',
        auto_rotate BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl4$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl5$CREATE TABLE IF NOT EXISTS rotation_weeks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pattern_id UUID REFERENCES schedule_patterns(id) ON DELETE CASCADE,
        week_number INTEGER NOT NULL,
        shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
        days_off TEXT[] DEFAULT ARRAY['Sat', 'Sun'],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl5$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl6$CREATE TABLE IF NOT EXISTS shift_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        pattern_id UUID REFERENCES schedule_patterns(id) ON DELETE CASCADE,
        current_week_in_rotation INTEGER DEFAULT 1,
        effective_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )$ddl6$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl7$CREATE TABLE IF NOT EXISTS attendance_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        date DATE NOT NULL,
        shift_id UUID REFERENCES shifts(id),
        scheduled_in TIME,
        scheduled_out TIME,
        actual_in TIMESTAMP,
        actual_out TIMESTAMP,
        status VARCHAR(20) DEFAULT 'Pending',
        work_hours INTERVAL,
        remarks TEXT,
        is_corrected BOOLEAN DEFAULT false,
        corrected_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )$ddl7$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl8$ALTER TABLE attendance_records 
      ADD COLUMN IF NOT EXISTS shift_id UUID,
      ADD COLUMN IF NOT EXISTS scheduled_in TIME,
      ADD COLUMN IF NOT EXISTS scheduled_out TIME,
      ADD COLUMN IF NOT EXISTS actual_in TIMESTAMP,
      ADD COLUMN IF NOT EXISTS actual_out TIMESTAMP,
      ADD COLUMN IF NOT EXISTS remarks TEXT,
      ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS ot_duration_normal INTERVAL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS ot_duration_night INTERVAL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS ot_duration_holiday INTERVAL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS ot_duration_dayoff INTERVAL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS forced_clock_out_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS forced_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS missed_punch_type VARCHAR(20) DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS is_overnight BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ot_approved BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS correction_status VARCHAR(20) DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS in_punch_log_id UUID,
      ADD COLUMN IF NOT EXISTS out_punch_log_id UUID,
      ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS auto_close_reason VARCHAR(100),
      ADD COLUMN IF NOT EXISTS reconciled_from_offline_sync BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS pending_overtime_approval BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS pending_overtime_hours NUMERIC(5,2) DEFAULT 0.00$ddl8$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl9$CREATE TABLE IF NOT EXISTS biometric_punch_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID,
        company_id UUID,
        branch_id UUID,
        device_id UUID,
        device_serial_number VARCHAR(100),
        pin VARCHAR(100) NOT NULL,
        user_id UUID,
        punch_time TIMESTAMP WITH TIME ZONE NOT NULL,
        punch_type VARCHAR(50) DEFAULT 'auto',
        verify_method VARCHAR(50) DEFAULT 'fingerprint',
        status VARCHAR(50) DEFAULT 'processed',
        raw_payload TEXT,
        is_offline_sync BOOLEAN DEFAULT false,
        reconciled_record_id UUID,
        reconciled_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      ALTER TABLE biometric_punch_logs
        ADD COLUMN IF NOT EXISTS is_offline_sync BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS reconciled_record_id UUID,
        ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_biometric_punch_logs_natural_key 
        ON biometric_punch_logs (COALESCE(device_serial_number, 'MANUAL'), pin, punch_time);
      CREATE INDEX IF NOT EXISTS idx_biometric_punch_logs_user_punch ON biometric_punch_logs(user_id, punch_time);
      CREATE INDEX IF NOT EXISTS idx_biometric_punch_logs_status ON biometric_punch_logs(status);

      CREATE TABLE IF NOT EXISTS attendance_correction_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID,
        company_id UUID,
        branch_id UUID,
        attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        work_date DATE NOT NULL,
        shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
        requested_in TIME,
        requested_out TIME,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewer_notes TEXT,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_att_corr_user_status ON attendance_correction_requests(user_id, status);

      CREATE TABLE IF NOT EXISTS attendance_alarm_dismissals (
        user_id UUID NOT NULL,
        date DATE NOT NULL,
        dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (user_id, date)
      )$ddl9$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl10$DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'attendance_records' 
              AND column_name = 'actual_in' 
              AND data_type = 'time without time zone'
          ) THEN
            ALTER TABLE attendance_records ALTER COLUMN actual_in TYPE TIMESTAMP USING (date + actual_in);
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'attendance_records' 
              AND column_name = 'work_hours' 
              AND data_type IN ('numeric', 'decimal')
          ) THEN
            ALTER TABLE attendance_records ALTER COLUMN work_hours TYPE INTERVAL USING (work_hours || ' hours')::interval;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END $$$ddl10$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl11$CREATE TABLE IF NOT EXISTS overtime_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        date DATE NOT NULL,
        attendance_id UUID REFERENCES attendance_records(id),
        normal_ot_hours NUMERIC(5,2) DEFAULT 0,
        night_ot_hours NUMERIC(5,2) DEFAULT 0,
        holiday_ot_hours NUMERIC(5,2) DEFAULT 0,
        dayoff_ot_hours NUMERIC(5,2) DEFAULT 0,
        total_amount NUMERIC(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'Pending', -- Pending, Approved, Rejected
        is_manual BOOLEAN DEFAULT false,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )$ddl11$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl12$CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        shift_id UUID REFERENCES shifts(id),
        date DATE NOT NULL,
        is_day_off BOOLEAN DEFAULT false,
        is_override BOOLEAN DEFAULT false,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id),
        UNIQUE(user_id, date)
      )$ddl12$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl13$ALTER TABLE schedules 
      ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id)$ddl13$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl14$CREATE TABLE IF NOT EXISTS user_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        device_name VARCHAR(255),
        device_type VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        approved_by UUID,
        approved_at TIMESTAMP,
        UNIQUE(user_id, device_id)
      )$ddl14$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl15$CREATE TABLE IF NOT EXISTS attendance_qr_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(100) NOT NULL UNIQUE,
        type VARCHAR(20) DEFAULT 'clock_in',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl15$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl16$CREATE TABLE IF NOT EXISTS allowed_networks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        ip_address INET,
        subnet_mask VARCHAR(15),
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl16$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl17$CREATE TABLE IF NOT EXISTS late_minutes_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        week_start_date DATE NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL,
        
        late_minutes INTEGER DEFAULT 0,
        late_penalty_amount DECIMAL(10,2) DEFAULT 0,
        
        weekly_late_minutes INTEGER DEFAULT 0,
        weekly_late_penalty DECIMAL(10,2) DEFAULT 0,
        
        monthly_late_minutes INTEGER DEFAULT 0,
        monthly_late_penalty DECIMAL(10,2) DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(user_id, date)
      )$ddl17$,
    -- modules/attendance/attendance.service.ts :: ensureAttendanceTables
    $ddl18$ALTER TABLE shifts ADD COLUMN IF NOT EXISTS wait_for_absent_minutes INTEGER DEFAULT NULL;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS grace_minutes INTEGER DEFAULT 15;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
        ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS clock_method VARCHAR(20) DEFAULT 'manual';
        ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES biometric_devices(id)$ddl18$,
    -- modules/attendance/attendance.service.ts :: ensureAuditTable
    $ddl19$CREATE TABLE IF NOT EXISTS audit_logs(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      action VARCHAR(100),
      target_id VARCHAR(255),
      details JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )$ddl19$,
    -- modules/biometric-devices/biometric-devices.service.ts :: ensureBiometricTables
    $ddl20$CREATE TABLE IF NOT EXISTS biometric_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        model VARCHAR(100) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        serial_number VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        registered_ip VARCHAR(45),
        last_seen_ip VARCHAR(45),
        port INTEGER DEFAULT 4370,
        protocol VARCHAR(50) NOT NULL,
        auth_method VARCHAR(50),
        auth_credentials JSONB,
        location VARCHAR(255),
        timezone VARCHAR(50) DEFAULT 'UTC',
        status VARCHAR(30) DEFAULT 'offline',
        is_authorized BOOLEAN DEFAULT false,
        pending_since TIMESTAMP,
        authorized_at TIMESTAMP,
        authorized_by UUID,
        last_sync_at TIMESTAMP,
        last_heartbeat_at TIMESTAMP,
        max_users INTEGER DEFAULT 3000,
        max_fingerprints INTEGER DEFAULT 9000,
        max_faces INTEGER DEFAULT 3000,
        current_users INTEGER DEFAULT 0,
        firmware_version VARCHAR(50),
        device_time TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        sync_enabled BOOLEAN DEFAULT true,
        sync_interval_minutes INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID,
        UNIQUE(tenant_id, serial_number)
      );

      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN DEFAULT false;
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS registered_ip VARCHAR(45);
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS last_seen_ip VARCHAR(45);
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS pending_since TIMESTAMP;
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMP;
      ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS authorized_by UUID;

      CREATE TABLE IF NOT EXISTS device_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        device_id UUID REFERENCES biometric_devices(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        device_user_id VARCHAR(50),
        enrollment_number VARCHAR(50),
        fingerprint_templates JSONB,
        face_templates JSONB,
        card_number VARCHAR(50),
        sync_status VARCHAR(20) DEFAULT 'pending',
        last_synced_at TIMESTAMP,
        sync_error TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS device_protocols (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        protocol_name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        connection_params_schema JSONB NOT NULL,
        auth_params_schema JSONB,
        capabilities JSONB,
        sdk_version VARCHAR(50),
        api_endpoint_pattern VARCHAR(255),
        default_port INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS device_sync_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID REFERENCES biometric_devices(id) ON DELETE CASCADE,
        sync_type VARCHAR(50) NOT NULL,
        sync_direction VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        records_processed INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        duration_ms INTEGER
      );

      CREATE TABLE IF NOT EXISTS device_commands (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        device_id UUID REFERENCES biometric_devices(id) ON DELETE CASCADE,
        device_sn VARCHAR(255) NOT NULL,
        cmd_id INTEGER NOT NULL,
        command_type VARCHAR(50) NOT NULL,
        command_content TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        return_code INTEGER,
        response_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        executed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS biometric_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        pin VARCHAR(50) NOT NULL,
        finger_id INTEGER DEFAULT 0,
        template_type VARCHAR(20) NOT NULL,
        template_data TEXT NOT NULL,
        template_size INTEGER DEFAULT 0,
        source_device_sn VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, pin, finger_id, template_type)
      );

      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS palm_templates JSONB;
      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS has_fingerprint BOOLEAN DEFAULT false;
      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS has_face BOOLEAN DEFAULT false;
      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS has_palm BOOLEAN DEFAULT false;
      ALTER TABLE device_users ADD COLUMN IF NOT EXISTS has_card BOOLEAN DEFAULT false;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS has_fingerprint BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS has_face BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS has_palm BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS card_number VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS biometric_pin VARCHAR(50);

      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'clock_method') THEN
              ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS clock_method VARCHAR(20) DEFAULT 'manual';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'device_id') THEN
              ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES biometric_devices(id);
          END IF;
      END
      $$$ddl20$,
    -- modules/calendar/calendar.service.ts :: ensureCalendarTables
    $ddl21$CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        all_day BOOLEAN DEFAULT false,
        event_type VARCHAR(50) NOT NULL DEFAULT 'custom',
        color VARCHAR(20),
        source_module VARCHAR(50) DEFAULT 'calendar',
        source_id UUID,
        recurrence_rule TEXT,
        location VARCHAR(255),
        is_public BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        company_id UUID,
        branch_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_company_id ON calendar_events(company_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_branch_id ON calendar_events(branch_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type)$ddl21$,
    -- modules/delegations/delegations.service.ts :: ensureDelegationTables
    $ddl22$CREATE TABLE IF NOT EXISTS user_delegations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID,
          company_id UUID,
          branch_id UUID,
          delegator_id UUID NOT NULL,
          delegatee_id UUID NOT NULL,
          start_date TIMESTAMPTZ NOT NULL,
          end_date TIMESTAMPTZ NOT NULL,
          scope VARCHAR(50) NOT NULL DEFAULT 'ALL',
          reason TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          created_by UUID,
          is_acting_assignment BOOLEAN DEFAULT FALSE,
          acting_position_title VARCHAR(150),
          acting_allowance_type VARCHAR(30) DEFAULT 'percentage',
          acting_allowance_percentage NUMERIC(5, 2) DEFAULT 0.00,
          acting_allowance_amount NUMERIC(12, 2) DEFAULT 0.00,
          acting_approved_by UUID,
          acting_approved_at TIMESTAMPTZ,
          acting_notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Add acting assignment columns if table was created previously without them
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS is_acting_assignment BOOLEAN DEFAULT FALSE;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_position_title VARCHAR(150);
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_allowance_type VARCHAR(30) DEFAULT 'percentage';
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_allowance_percentage NUMERIC(5, 2) DEFAULT 0.00;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_allowance_amount NUMERIC(12, 2) DEFAULT 0.00;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_approved_by UUID;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_approved_at TIMESTAMPTZ;
        ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS acting_notes TEXT;

        CREATE INDEX IF NOT EXISTS idx_user_delegations_delegator ON user_delegations(delegator_id);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_delegatee ON user_delegations(delegatee_id);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_active ON user_delegations(delegatee_id, status, start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_company ON user_delegations(company_id);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_branch ON user_delegations(branch_id);
        CREATE INDEX IF NOT EXISTS idx_user_delegations_acting ON user_delegations(is_acting_assignment, status);

        CREATE TABLE IF NOT EXISTS delegation_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          delegation_id UUID,
          performed_by UUID NOT NULL,
          on_behalf_of UUID NOT NULL,
          action VARCHAR(100) NOT NULL,
          resource VARCHAR(100),
          details JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_delegation_audit_delegation ON delegation_audit_logs(delegation_id);
        CREATE INDEX IF NOT EXISTS idx_delegation_audit_performed ON delegation_audit_logs(performed_by);
        CREATE INDEX IF NOT EXISTS idx_delegation_audit_on_behalf ON delegation_audit_logs(on_behalf_of);
        CREATE INDEX IF NOT EXISTS idx_delegation_audit_created ON delegation_audit_logs(created_at)$ddl22$,
    -- modules/developer-api/developer-api.service.ts :: ensureDeveloperApiTables
    $ddl23$CREATE TABLE IF NOT EXISTS developer_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        key_prefix VARCHAR(15) NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        rate_limit_per_minute INT NOT NULL DEFAULT 60,
        is_active BOOLEAN NOT NULL DEFAULT true,
        expires_at TIMESTAMP NULL,
        last_used_at TIMESTAMP NULL,
        request_count INT NOT NULL DEFAULT 0,
        created_by UUID NULL,
        company_id UUID NULL,
        branch_id UUID NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_dev_keys_hash ON developer_api_keys(key_hash);
      CREATE INDEX IF NOT EXISTS idx_dev_keys_company ON developer_api_keys(company_id);

      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        target_url TEXT NOT NULL,
        secret_key VARCHAR(100) NOT NULL,
        events JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT true,
        company_id UUID NULL,
        branch_id UUID NULL,
        created_by UUID NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_webhooks_company ON webhook_subscriptions(company_id);

      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
        event VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        response_status INT NULL,
        response_body TEXT NULL,
        attempts INT NOT NULL DEFAULT 1,
        status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'success' | 'failed' | 'retrying'
        duration_ms INT NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_wh ON webhook_deliveries(webhook_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

      CREATE TABLE IF NOT EXISTS api_key_activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        status_code INT NOT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        duration_ms INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_key_activity_logs(api_key_id)$ddl23$,
    -- modules/events/events.service.ts :: ensureEventsTables
    $ddl24$CREATE TABLE IF NOT EXISTS events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(255) NOT NULL,
                content TEXT,
                event_date DATE NOT NULL,
                event_time TIME,
                location VARCHAR(255),
                target_type VARCHAR(20) NOT NULL,
                target_ids TEXT[],
                created_by UUID,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )$ddl24$,
    -- modules/holidays/holidays.service.ts :: ensureHolidaysTable
    $ddl25$CREATE TABLE IF NOT EXISTS holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        date DATE NOT NULL,
        description TEXT,
        is_recurring BOOLEAN DEFAULT TRUE,
        type VARCHAR DEFAULT 'public',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )$ddl25$,
    -- modules/holidays/holidays.service.ts :: ensureHolidaysTable
    $ddl26$ALTER TABLE holidays ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'public'$ddl26$,
    -- modules/hrms-assets/hrms-assets.service.ts :: ensureTables
    $ddl27$CREATE TABLE IF NOT EXISTS asset_categories (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(50),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl27$,
    -- modules/hrms-assets/hrms-assets.service.ts :: ensureTables
    $ddl28$CREATE TABLE IF NOT EXISTS company_assets (
          id VARCHAR(36) PRIMARY KEY,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          category_id VARCHAR(36) NOT NULL,
          name VARCHAR(255) NOT NULL,
          model VARCHAR(150),
          serial_number VARCHAR(100),
          asset_tag VARCHAR(100) NOT NULL,
          qr_code_data TEXT,
          status VARCHAR(50) DEFAULT 'available',
          current_condition VARCHAR(50) DEFAULT 'good',
          purchase_cost DECIMAL(12, 2) DEFAULT 0.00,
          purchase_date DATE,
          warranty_expiry DATE,
          location VARCHAR(150),
          notes TEXT,
          current_assigned_user_id VARCHAR(36),
          created_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl28$,
    -- modules/hrms-assets/hrms-assets.service.ts :: ensureTables
    $ddl29$CREATE TABLE IF NOT EXISTS asset_assignments (
          id VARCHAR(36) PRIMARY KEY,
          asset_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          assigned_by VARCHAR(36),
          assigned_date DATE NOT NULL,
          expected_return_date DATE,
          returned_date DATE,
          received_by VARCHAR(36),
          return_condition VARCHAR(50),
          is_active BOOLEAN DEFAULT TRUE,
          acknowledged_at TIMESTAMP NULL,
          acknowledgment_signature TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl29$,
    -- modules/hrms-assets/hrms-assets.service.ts :: ensureTables
    $ddl30$CREATE TABLE IF NOT EXISTS asset_maintenance_logs (
          id VARCHAR(36) PRIMARY KEY,
          asset_id VARCHAR(36) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          cost DECIMAL(10, 2) DEFAULT 0.00,
          service_provider VARCHAR(150),
          service_date DATE NOT NULL,
          next_service_date DATE,
          status VARCHAR(50) DEFAULT 'completed',
          logged_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl30$,
    -- modules/hrms-benefits/hrms-benefits.service.ts :: ensureTables
    $ddl31$-- Master Benefit Plans Table
        CREATE TABLE IF NOT EXISTS benefit_plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50) UNIQUE NOT NULL,
          plan_type VARCHAR(64) NOT NULL,
          tier VARCHAR(32) DEFAULT 'standard',
          provider_name VARCHAR(255),
          policy_number VARCHAR(100),
          description TEXT,
          total_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          employer_contribution DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          employee_contribution DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          employer_percentage DECIMAL(5,2) DEFAULT 0.00,
          employee_percentage DECIMAL(5,2) DEFAULT 0.00,
          contribution_frequency VARCHAR(32) DEFAULT 'monthly',
          is_family_covered BOOLEAN DEFAULT FALSE,
          max_dependents INT DEFAULT 0,
          min_tenure_months INT DEFAULT 0,
          eligible_employment_types JSONB DEFAULT '["full_time"]',
          eligible_departments JSONB DEFAULT '[]',
          is_active BOOLEAN DEFAULT TRUE,
          company_id UUID,
          branch_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Employee Benefit Enrollments Table
        CREATE TABLE IF NOT EXISTS benefit_enrollments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          plan_id UUID NOT NULL REFERENCES benefit_plans(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          coverage_tier VARCHAR(32) DEFAULT 'individual',
          status VARCHAR(32) DEFAULT 'enrolled',
          enrollment_type VARCHAR(32) DEFAULT 'open_enrollment',
          qualifying_life_event VARCHAR(64),
          life_event_date DATE,
          effective_start_date DATE NOT NULL,
          effective_end_date DATE,
          employee_deduction_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          employer_cost_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          notes TEXT,
          company_id UUID,
          branch_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Covered Dependents Table
        CREATE TABLE IF NOT EXISTS benefit_dependents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          enrollment_id UUID NOT NULL REFERENCES benefit_enrollments(id) ON DELETE CASCADE,
          full_name VARCHAR(255) NOT NULL,
          relationship VARCHAR(32) NOT NULL,
          date_of_birth DATE,
          national_id VARCHAR(50),
          gender VARCHAR(20),
          is_covered BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Open Enrollment Periods
        CREATE TABLE IF NOT EXISTS open_enrollment_periods (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255) NOT NULL,
          plan_year INT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status VARCHAR(32) DEFAULT 'upcoming',
          company_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_benefit_plans_type ON benefit_plans(plan_type);
        CREATE INDEX IF NOT EXISTS idx_benefit_enrollments_user ON benefit_enrollments(user_id);
        CREATE INDEX IF NOT EXISTS idx_benefit_enrollments_status ON benefit_enrollments(status);
        CREATE INDEX IF NOT EXISTS idx_benefit_dependents_enrollment ON benefit_dependents(enrollment_id)$ddl31$,
    -- modules/hrms-documents/hrms-documents.service.ts :: ensureTables
    $ddl32$CREATE TABLE IF NOT EXISTS letter_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID,
          branch_id UUID,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50) NOT NULL UNIQUE,
          category VARCHAR(50) NOT NULL DEFAULT 'employment',
          description TEXT,
          subject VARCHAR(255) NOT NULL,
          body_template TEXT NOT NULL,
          is_system BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS employee_documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID,
          branch_id UUID,
          user_id UUID NOT NULL,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL,
          document_type VARCHAR(50) NOT NULL,
          file_url TEXT NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_size INTEGER NOT NULL DEFAULT 0,
          mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
          issue_date DATE,
          expiry_date DATE,
          verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
          verified_by UUID,
          verified_at TIMESTAMP WITH TIME ZONE,
          signature_status VARCHAR(30) NOT NULL DEFAULT 'not_required',
          signed_at TIMESTAMP WITH TIME ZONE,
          notes TEXT,
          template_id UUID,
          generated_at TIMESTAMP WITH TIME ZONE,
          status VARCHAR(30),
          is_confidential BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS document_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID NOT NULL,
          version_number INTEGER NOT NULL DEFAULT 1,
          file_url TEXT,
          file_name VARCHAR(255),
          uploaded_by UUID,
          uploaded_by_name VARCHAR(255),
          change_notes TEXT,
          file_size INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS letter_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_id UUID,
          template_name VARCHAR(255),
          generated_for_user_id UUID,
          generated_by UUID,
          document_title VARCHAR(255),
          generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS system_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS user_signatures (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
          user_id VARCHAR(255) NOT NULL UNIQUE,
          signature_url TEXT NOT NULL,
          uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS esign_provider_config (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
          provider VARCHAR(50) DEFAULT 'none',
          client_id VARCHAR(255),
          client_secret TEXT,
          account_id VARCHAR(255),
          is_active BOOLEAN DEFAULT TRUE,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_emp_docs_user ON employee_documents(user_id);
        CREATE INDEX IF NOT EXISTS idx_emp_docs_expiry ON employee_documents(expiry_date);
        CREATE INDEX IF NOT EXISTS idx_emp_docs_company ON employee_documents(company_id);
        CREATE INDEX IF NOT EXISTS idx_emp_docs_branch ON employee_documents(branch_id);
        CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON document_versions(document_id);
        CREATE INDEX IF NOT EXISTS idx_letter_audit_log_user ON letter_audit_log(generated_for_user_id);
        CREATE INDEX IF NOT EXISTS idx_letter_audit_log_tpl ON letter_audit_log(template_id);
        CREATE INDEX IF NOT EXISTS idx_user_signatures_user ON user_signatures(user_id)$ddl32$,
    -- modules/hrms-expenses/hrms-expenses.service.ts :: ensureTables
    $ddl33$CREATE TABLE IF NOT EXISTS expense_categories (
          id VARCHAR(36) PRIMARY KEY,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          name VARCHAR(100) NOT NULL,
          code VARCHAR(50) NOT NULL,
          description TEXT,
          spending_limit DECIMAL(12,2),
          daily_per_diem_cap DECIMAL(12,2),
          requires_receipt BOOLEAN DEFAULT TRUE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expense_reports (
          id VARCHAR(36) PRIMARY KEY,
          report_number VARCHAR(50) NOT NULL,
          employee_id VARCHAR(36) NOT NULL,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          title VARCHAR(255) NOT NULL,
          purpose TEXT,
          status VARCHAR(50) DEFAULT 'draft',
          total_amount DECIMAL(12,2) DEFAULT 0,
          approved_amount DECIMAL(12,2) DEFAULT 0,
          currency VARCHAR(10) DEFAULT 'USD',
          submitted_at TIMESTAMP,
          approved_by VARCHAR(36),
          approved_at TIMESTAMP,
          rejection_reason TEXT,
          reimbursed_at TIMESTAMP,
          include_in_payroll BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS expense_items (
          id VARCHAR(36) PRIMARY KEY,
          report_id VARCHAR(36) NOT NULL,
          category_id VARCHAR(36) NOT NULL,
          expense_date DATE NOT NULL,
          merchant_name VARCHAR(255),
          description TEXT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          receipt_url TEXT,
          ocr_scanned BOOLEAN DEFAULT FALSE,
          policy_violation BOOLEAN DEFAULT FALSE,
          violation_note TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl33$,
    -- modules/hrms-grievances/hrms-grievances.service.ts :: ensureTables
    $ddl34$-- Master Grievances Table
        CREATE TABLE IF NOT EXISTS grievances (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_number VARCHAR(32) UNIQUE NOT NULL,
          user_id UUID,
          is_anonymous BOOLEAN DEFAULT FALSE,
          category VARCHAR(64) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          priority VARCHAR(32) DEFAULT 'medium',
          status VARCHAR(32) DEFAULT 'filed',
          incident_date DATE,
          incident_location VARCHAR(255),
          accused_parties VARCHAR(255),
          witnesses TEXT,
          assigned_investigator_id UUID,
          investigation_notes TEXT,
          resolution_summary TEXT,
          resolution_action_items TEXT,
          resolution_date TIMESTAMP,
          acknowledged_at TIMESTAMP,
          sla_acknowledgment_deadline TIMESTAMP,
          sla_resolution_deadline TIMESTAMP,
          is_sla_breached BOOLEAN DEFAULT FALSE,
          retaliation_monitoring_flag BOOLEAN DEFAULT FALSE,
          satisfaction_score INT,
          satisfaction_feedback TEXT,
          company_id UUID,
          branch_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Grievance Timeline & Audit Events
        CREATE TABLE IF NOT EXISTS grievance_timeline (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          grievance_id UUID NOT NULL,
          actor_id UUID,
          action VARCHAR(64) NOT NULL,
          notes TEXT,
          is_confidential BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Grievance Attachments
        CREATE TABLE IF NOT EXISTS grievance_attachments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          grievance_id UUID NOT NULL,
          uploaded_by UUID,
          file_name VARCHAR(255) NOT NULL,
          file_url TEXT NOT NULL,
          file_size INT,
          file_type VARCHAR(64),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_grievances_user_id ON grievances(user_id);
        CREATE INDEX IF NOT EXISTS idx_grievances_status ON grievances(status);
        CREATE INDEX IF NOT EXISTS idx_grievances_company_id ON grievances(company_id);
        CREATE INDEX IF NOT EXISTS idx_grievance_timeline_grievance_id ON grievance_timeline(grievance_id)$ddl34$,
    -- modules/hrms-import-export/hrms-import-export.service.ts :: ensureTables
    $ddl35$CREATE TABLE IF NOT EXISTS import_export_jobs (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36),
        branch_id VARCHAR(36),
        job_type VARCHAR(20) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        format VARCHAR(10) NOT NULL DEFAULT 'csv',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        file_name VARCHAR(255),
        file_url VARCHAR(500),
        total_rows INT DEFAULT 0,
        processed_rows INT DEFAULT 0,
        error_rows INT DEFAULT 0,
        validation_errors JSON,
        rollback_window_expires_at TIMESTAMP NULL,
        can_rollback BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl35$,
    -- modules/hrms-import-export/hrms-import-export.service.ts :: ensureTables
    $ddl36$CREATE TABLE IF NOT EXISTS export_templates (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        selected_fields JSON NOT NULL,
        filter_config JSON,
        schedule_cron VARCHAR(50),
        delivery_email VARCHAR(255),
        created_by VARCHAR(36),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl36$,
    -- modules/hrms-onboarding/hrms-onboarding.service.ts :: ensureTables
    $ddl37$-- Onboarding/Offboarding checklist templates
        CREATE TABLE IF NOT EXISTS onboarding_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          type VARCHAR(50) NOT NULL DEFAULT 'onboarding',
          department VARCHAR(100),
          employment_type VARCHAR(50),
          is_default BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Template checklist items
        CREATE TABLE IF NOT EXISTS onboarding_template_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_id UUID NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(50) DEFAULT 'general',
          assignee_role VARCHAR(100),
          due_days_from_start INT DEFAULT 1,
          is_required BOOLEAN DEFAULT TRUE,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Employee onboarding instances
        CREATE TABLE IF NOT EXISTS employee_onboarding (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          template_id UUID,
          status VARCHAR(50) DEFAULT 'not_started',
          start_date DATE,
          target_completion_date DATE,
          completed_date DATE,
          probation_days INT DEFAULT 90,
          probation_end_date DATE,
          probation_outcome VARCHAR(50),
          probation_outcome_notes TEXT,
          probation_extended_until DATE,
          created_by UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Onboarding task instances per employee
        CREATE TABLE IF NOT EXISTS onboarding_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          onboarding_id UUID NOT NULL,
          template_item_id UUID,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(50) DEFAULT 'general',
          assignee_role VARCHAR(100),
          due_date DATE,
          is_required BOOLEAN DEFAULT TRUE,
          status VARCHAR(50) DEFAULT 'pending',
          completed_by UUID,
          completed_at TIMESTAMP,
          notes TEXT,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Employee offboarding instances
        CREATE TABLE IF NOT EXISTS employee_offboarding (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          template_id UUID,
          status VARCHAR(50) DEFAULT 'initiated',
          last_working_day DATE,
          reason VARCHAR(255),
          initiated_by UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Offboarding tasks per employee
        CREATE TABLE IF NOT EXISTS offboarding_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          offboarding_id UUID NOT NULL,
          template_item_id UUID,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(50) DEFAULT 'general',
          assignee_role VARCHAR(100),
          due_date DATE,
          is_required BOOLEAN DEFAULT TRUE,
          status VARCHAR(50) DEFAULT 'pending',
          completed_by UUID,
          completed_at TIMESTAMP,
          notes TEXT,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Exit interview responses
        CREATE TABLE IF NOT EXISTS exit_interviews (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          offboarding_id UUID NOT NULL,
          user_id UUID,
          satisfaction_score SMALLINT,
          reason_for_leaving TEXT,
          feedback TEXT,
          is_anonymous BOOLEAN DEFAULT FALSE,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_emp_onboarding_user ON employee_onboarding(user_id);
        CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_parent ON onboarding_tasks(onboarding_id);
        CREATE INDEX IF NOT EXISTS idx_emp_offboarding_user ON employee_offboarding(user_id);
        CREATE INDEX IF NOT EXISTS idx_offboarding_tasks_parent ON offboarding_tasks(offboarding_id);

        -- C1: Welcome Portal progress tracking per new hire
        CREATE TABLE IF NOT EXISTS welcome_portal_status (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE,
          onboarding_id UUID,
          documents_uploaded BOOLEAN NOT NULL DEFAULT FALSE,
          policy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
          policy_accepted_at TIMESTAMP WITH TIME ZONE,
          personal_info_completed BOOLEAN NOT NULL DEFAULT FALSE,
          contract_signed BOOLEAN NOT NULL DEFAULT FALSE,
          contract_signed_at TIMESTAMP WITH TIME ZONE,
          e_signature TEXT,
          orientation_viewed BOOLEAN NOT NULL DEFAULT FALSE,
          completed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_welcome_portal_user ON welcome_portal_status(user_id);

        -- Onboarding Welcome Checklist
        CREATE TABLE IF NOT EXISTS onboarding_welcome_checklist (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          onboarding_id UUID,
          document_uploaded BOOLEAN DEFAULT FALSE,
          policy_accepted BOOLEAN DEFAULT FALSE,
          profile_completed BOOLEAN DEFAULT FALSE,
          orientation_viewed BOOLEAN DEFAULT FALSE,
          welcome_packet_viewed BOOLEAN DEFAULT FALSE,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_welcome_checklist_user ON onboarding_welcome_checklist(user_id)$ddl37$,
    -- modules/hrms-surveys/hrms-surveys.service.ts :: ensureTables
    $ddl38$CREATE TABLE IF NOT EXISTS surveys (
          id VARCHAR(36) PRIMARY KEY,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          survey_type VARCHAR(50) DEFAULT 'pulse',
          status VARCHAR(50) DEFAULT 'active',
          is_anonymous BOOLEAN DEFAULT TRUE,
          min_responses_for_results INT DEFAULT 3,
          target_audience VARCHAR(50) DEFAULT 'all',
          target_department VARCHAR(100),
          target_branch_id VARCHAR(36),
          start_date DATE,
          end_date DATE,
          created_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl38$,
    -- modules/hrms-surveys/hrms-surveys.service.ts :: ensureTables
    $ddl39$CREATE TABLE IF NOT EXISTS survey_questions (
          id VARCHAR(36) PRIMARY KEY,
          survey_id VARCHAR(36) NOT NULL,
          question_text TEXT NOT NULL,
          question_type VARCHAR(50) NOT NULL,
          options TEXT,
          is_required BOOLEAN DEFAULT TRUE,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl39$,
    -- modules/hrms-surveys/hrms-surveys.service.ts :: ensureTables
    $ddl40$CREATE TABLE IF NOT EXISTS survey_responses (
          id VARCHAR(36) PRIMARY KEY,
          survey_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36),
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl40$,
    -- modules/hrms-surveys/hrms-surveys.service.ts :: ensureTables
    $ddl41$CREATE TABLE IF NOT EXISTS survey_answers (
          id VARCHAR(36) PRIMARY KEY,
          response_id VARCHAR(36) NOT NULL,
          question_id VARCHAR(36) NOT NULL,
          rating_value INT,
          text_value TEXT,
          selected_option VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl41$,
    -- modules/hrms-surveys/hrms-surveys.service.ts :: ensureTables
    $ddl42$CREATE TABLE IF NOT EXISTS survey_action_items (
          id VARCHAR(36) PRIMARY KEY,
          survey_id VARCHAR(36) NOT NULL,
          department VARCHAR(100),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          assigned_to_user_id VARCHAR(36),
          due_date DATE,
          status VARCHAR(50) DEFAULT 'open',
          resolution_notes TEXT,
          created_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl42$,
    -- modules/hrms-training/hrms-training.service.ts :: ensureTables
    $ddl43$CREATE TABLE IF NOT EXISTS training_courses (
          id VARCHAR(36) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT,
          prerequisites TEXT,
          delivery_method VARCHAR(50) DEFAULT 'online',
          duration_hours NUMERIC(5, 2) DEFAULT 1.0,
          capacity_limit INT DEFAULT 50,
          is_mandatory BOOLEAN DEFAULT false,
          passing_score INT DEFAULT 80,
          provider_name VARCHAR(255),
          cost_per_learner NUMERIC(10, 2) DEFAULT 0.0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl43$,
    -- modules/hrms-training/hrms-training.service.ts :: ensureTables
    $ddl44$CREATE TABLE IF NOT EXISTS training_sessions (
          id VARCHAR(36) PRIMARY KEY,
          course_id VARCHAR(36) NOT NULL,
          instructor_name VARCHAR(255),
          venue_or_link VARCHAR(500),
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          max_participants INT DEFAULT 30,
          status VARCHAR(50) DEFAULT 'scheduled',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl44$,
    -- modules/hrms-training/hrms-training.service.ts :: ensureTables
    $ddl45$CREATE TABLE IF NOT EXISTS training_enrollments (
          id VARCHAR(36) PRIMARY KEY,
          course_id VARCHAR(36) NOT NULL,
          session_id VARCHAR(36),
          user_id VARCHAR(36) NOT NULL,
          enrolled_by VARCHAR(36),
          status VARCHAR(50) DEFAULT 'confirmed',
          completion_percentage INT DEFAULT 0,
          score NUMERIC(5, 2),
          attendance_confirmed BOOLEAN DEFAULT false,
          certificate_issued BOOLEAN DEFAULT false,
          completion_date DATE,
          expiry_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl45$,
    -- modules/hrms-training/hrms-training.service.ts :: ensureTables
    $ddl46$CREATE TABLE IF NOT EXISTS employee_skills (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          skill_name VARCHAR(150) NOT NULL,
          category VARCHAR(100) NOT NULL,
          proficiency_level VARCHAR(50) DEFAULT 'intermediate',
          verified BOOLEAN DEFAULT false,
          verified_by VARCHAR(36),
          verified_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl46$,
    -- modules/leave/leave.service.ts :: ensureSettingsTable
    $ddl47$CREATE TABLE IF NOT EXISTS settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(50) NOT NULL UNIQUE,
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl47$,
    -- modules/leave/leave.service.ts :: ensureLeaveTables
    $ddl48$ALTER TABLE IF EXISTS leave_requests ADD COLUMN IF NOT EXISTS leave_type_id VARCHAR(100)$ddl48$,
    -- modules/leave/leave.service.ts :: ensureLeaveTables
    $ddl49$CREATE TABLE IF NOT EXISTS leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        leave_type_id VARCHAR(100) NOT NULL,
        leave_type_name VARCHAR(100) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'Pending',
        approval_status VARCHAR(20) DEFAULT 'Pending',
        current_step INTEGER DEFAULT 0,
        approved_by UUID,
        approved_at TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl49$,
    -- modules/leave/leave.service.ts :: ensureLeaveTables
    $ddl50$DO $$ 
        BEGIN 
            ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'Pending';
            ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;
            ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        EXCEPTION WHEN others THEN NULL; 
        END $$$ddl50$,
    -- modules/leave/leave.service.ts :: ensureLeaveTables
    $ddl51$CREATE TABLE IF NOT EXISTS leave_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        step_order INTEGER NOT NULL,
        role_required VARCHAR(50) NOT NULL,
        is_final BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl51$,
    -- modules/leave/leave.service.ts :: ensureLeaveTables
    $ddl52$CREATE TABLE IF NOT EXISTS leave_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        leave_request_id UUID REFERENCES leave_requests(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        approver_id UUID REFERENCES users(id),
        status VARCHAR(20) NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl52$,
    -- modules/leave/leave.service.ts :: ensureLeaveTables
    $ddl53$CREATE TABLE IF NOT EXISTS leave_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        leave_type_id VARCHAR(100) NOT NULL,
        leave_type_name VARCHAR(100) NOT NULL,
        total_days DECIMAL(10,2) NOT NULL DEFAULT 0,
        used_days DECIMAL(10,2) NOT NULL DEFAULT 0,
        year INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, leave_type_id, year)
      )$ddl53$,
    -- modules/leave/leave.service.ts :: ensureLeaveTables
    $ddl54$ALTER TABLE leave_balances 
        ALTER COLUMN total_days TYPE DECIMAL(10,2),
        ALTER COLUMN used_days TYPE DECIMAL(10,2)$ddl54$,
    -- modules/leave/leave.service.ts :: getUserBalancesWithCalculation
    $ddl55$ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS carried_over DECIMAL(10,2) DEFAULT 0$ddl55$,
    -- modules/leave/leave.service.ts :: calculateAndSetInitialBalance
    $ddl56$ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS carried_over DECIMAL(10,2) DEFAULT 0$ddl56$,
    -- modules/notifications/email-templates.service.ts :: ensureTables
    $ddl57$CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_key VARCHAR(100) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        html_body TEXT NOT NULL,
        plain_text_body TEXT,
        available_variables TEXT,
        is_system_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        last_edited_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(template_key, is_system_default)
      )$ddl57$,
    -- modules/notifications/notification-reports.service.ts :: ensureTables
    $ddl58$CREATE TABLE IF NOT EXISTS notification_delivery_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(36),
        user_id VARCHAR(36),
        category VARCHAR(100),
        channel VARCHAR(10) NOT NULL,
        status VARCHAR(20) DEFAULT 'sent',
        template_name VARCHAR(100),
        recipient_email VARCHAR(255),
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT NOW()
      )$ddl58$,
    -- modules/notifications/notification-reports.service.ts :: ensureTables
    $ddl59$CREATE INDEX IF NOT EXISTS idx_ndl_tenant_sent ON notification_delivery_logs(tenant_id, sent_at);
      ALTER TABLE notification_delivery_logs ADD COLUMN IF NOT EXISTS message_id VARCHAR(100);
      ALTER TABLE notification_delivery_logs ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_ndl_msg_id ON notification_delivery_logs(message_id)$ddl59$,
    -- modules/notifications/notification-reports.service.ts :: getPreferenceDistribution
    $ddl60$CREATE TABLE IF NOT EXISTS user_notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        category VARCHAR(100) NOT NULL,
        channel VARCHAR(10) NOT NULL DEFAULT 'both',
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, category)
      )$ddl60$,
    -- modules/notifications/notifications.service.ts :: ensureNotificationsTables
    $ddl61$CREATE TABLE IF NOT EXISTS notifications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    reference_id UUID,
                    title VARCHAR(255) NOT NULL,
                    message TEXT,
                    deep_link VARCHAR(500),
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deep_link VARCHAR(500);
                CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
                CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
                CREATE TABLE IF NOT EXISTS user_notification_preferences (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    channel VARCHAR(10) NOT NULL DEFAULT 'both',
                    updated_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id, category)
                );
                CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON user_notification_preferences(user_id);
                CREATE TABLE IF NOT EXISTS push_device_tokens (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    token VARCHAR(500) NOT NULL,
                    platform VARCHAR(20) DEFAULT 'android',
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW(),
                    CONSTRAINT uniq_user_token UNIQUE (user_id, token)
                );
                CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user ON push_device_tokens(user_id)$ddl61$,
    -- modules/notifications/notifications.service.ts :: getEffectiveChannel
    $ddl62$CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )$ddl62$,
    -- modules/notifications/notifications.service.ts :: getEffectiveChannel
    $ddl63$CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )$ddl63$,
    -- modules/notifications/notifications.service.ts :: getBirthdayGreetingSettings
    $ddl64$CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )$ddl64$,
    -- modules/notifications/notifications.service.ts :: getBirthdayGreetingSettings
    $ddl65$CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )$ddl65$,
    -- modules/payroll/loan.service.ts :: seedRolesForTenants
    $ddl66$CREATE TABLE IF NOT EXISTS roles (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        name VARCHAR(100) NOT NULL,
                        description TEXT,
                        permissions JSONB NOT NULL DEFAULT '[]',
                        is_system BOOLEAN DEFAULT false,
                        is_active BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )$ddl66$,
    -- modules/payroll/loan.service.ts :: ensureLoanSchema
    $ddl67$CREATE TABLE IF NOT EXISTS loans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                loan_type VARCHAR(50) NOT NULL,
                description TEXT,
                total_amount DECIMAL(10, 2) NOT NULL,
                monthly_deduction DECIMAL(10, 2) NOT NULL,
                remaining_balance DECIMAL(10, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending', -- pending, active, rejected, paid, cancelled, frozen
                approved_by UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )$ddl67$,
    -- modules/payroll/loan.service.ts :: ensureLoanSchema
    $ddl68$DO $$ 
            BEGIN 
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_month INTEGER DEFAULT 1;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_year INTEGER DEFAULT 2024;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_date DATE;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS term_months INTEGER DEFAULT 1;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending';
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS approved_by UUID;
                ALTER TABLE loans ADD COLUMN IF NOT EXISTS requested_by UUID;
            EXCEPTION WHEN others THEN NULL; 
            END $$$ddl68$,
    -- modules/payroll/payroll.service.ts :: seedDefaultTaxRules
    $ddl69$ALTER TABLE tax_rules ALTER COLUMN max_salary DROP NOT NULL$ddl69$,
    -- modules/payroll/per-diem.service.ts :: ensurePerDiemTable
    $ddl70$DO $$ BEGIN
                ALTER TABLE per_diem_claims ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING_USER_ACTION';
                ALTER TABLE per_diem_claims ADD COLUMN IF NOT EXISTS assigned_by UUID DEFAULT NULL;
                ALTER TABLE per_diem_claims ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;
            EXCEPTION WHEN others THEN NULL;
            END $$$ddl70$,
    -- modules/pms-reviews/pms-reviews.service.ts :: ensureTables
    $ddl71$CREATE TABLE IF NOT EXISTS pms_review_cycles (
          id VARCHAR(36) PRIMARY KEY,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          title VARCHAR(255) NOT NULL,
          cycle_type VARCHAR(50) DEFAULT 'quarterly',
          status VARCHAR(50) DEFAULT 'draft',
          start_date DATE NOT NULL,
          due_date DATE NOT NULL,
          self_review_due_date DATE,
          peer_review_due_date DATE,
          manager_review_due_date DATE,
          description TEXT,
          is_peer_review_enabled BOOLEAN DEFAULT TRUE,
          min_peers INT DEFAULT 2,
          max_peers INT DEFAULT 5,
          is_upward_review_enabled BOOLEAN DEFAULT TRUE,
          created_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_competencies (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(50) DEFAULT 'core',
          description TEXT,
          rating_scale VARCHAR(50) DEFAULT '1-5',
          is_core BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_employee_reviews (
          id VARCHAR(36) PRIMARY KEY,
          cycle_id VARCHAR(36) NOT NULL,
          employee_id VARCHAR(36) NOT NULL,
          manager_id VARCHAR(36),
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          status VARCHAR(50) DEFAULT 'pending_self',
          self_rating DECIMAL(3,2),
          manager_rating DECIMAL(3,2),
          peer_rating_avg DECIMAL(3,2),
          calibrated_rating DECIMAL(3,2),
          final_rating DECIMAL(3,2),
          manager_summary TEXT,
          strengths TEXT,
          areas_for_growth TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_review_feedbacks (
          id VARCHAR(36) PRIMARY KEY,
          review_id VARCHAR(36) NOT NULL,
          cycle_id VARCHAR(36) NOT NULL,
          reviewer_id VARCHAR(36) NOT NULL,
          reviewer_type VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          overall_rating DECIMAL(3,2),
          general_feedback TEXT,
          strengths TEXT,
          improvements TEXT,
          submitted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_review_competency_scores (
          id VARCHAR(36) PRIMARY KEY,
          feedback_id VARCHAR(36) NOT NULL,
          competency_id VARCHAR(36) NOT NULL,
          score DECIMAL(3,2) NOT NULL,
          comments TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_performance_improvement_plans (
          id VARCHAR(36) PRIMARY KEY,
          employee_id VARCHAR(36) NOT NULL,
          manager_id VARCHAR(36),
          review_id VARCHAR(36),
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          title VARCHAR(255) NOT NULL,
          reason TEXT NOT NULL,
          action_plan TEXT NOT NULL,
          success_criteria TEXT NOT NULL,
          support_resources TEXT,
          start_date DATE NOT NULL,
          target_end_date DATE NOT NULL,
          check_in_frequency VARCHAR(50) DEFAULT 'bi_weekly',
          status VARCHAR(50) DEFAULT 'active',
          outcome_notes TEXT,
          outcome_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl71$,
    -- modules/pms/pms.service.ts :: ensurePmsSchema
    $ddl72$ALTER TABLE pms_projects ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';
                ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS story_points INT DEFAULT 0;
                ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS backlog_order INT DEFAULT 0;
                ALTER TABLE pms_tasks ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT FALSE;
                ALTER TABLE pms_task_time_logs ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT TRUE;
                ALTER TABLE pms_task_time_logs ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2) DEFAULT 0$ddl72$,
    -- modules/recruitment/recruitment.service.ts :: ensureRecruitmentTables
    $ddl73$CREATE TABLE IF NOT EXISTS recruitment_interviews (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID,
          company_id UUID,
          branch_id UUID,
          job_id VARCHAR(100) NOT NULL,
          candidate_id VARCHAR(100) NOT NULL,
          candidate_name VARCHAR(255) NOT NULL,
          candidate_email VARCHAR(255),
          interviewer_id UUID,
          interviewer_name VARCHAR(255),
          interview_type VARCHAR(50) DEFAULT 'technical',
          scheduled_at TIMESTAMP NOT NULL,
          duration_minutes INT DEFAULT 45,
          meeting_link TEXT,
          status VARCHAR(50) DEFAULT 'scheduled',
          feedback TEXT,
          rating INT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_rec_interviews_job_cand ON recruitment_interviews(job_id, candidate_id);
        CREATE INDEX IF NOT EXISTS idx_rec_interviews_scope ON recruitment_interviews(company_id, branch_id);

        CREATE TABLE IF NOT EXISTS recruitment_offers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID,
          company_id UUID,
          branch_id UUID,
          job_id VARCHAR(100) NOT NULL,
          candidate_id VARCHAR(100) NOT NULL,
          candidate_name VARCHAR(255) NOT NULL,
          candidate_email VARCHAR(255),
          position_title VARCHAR(255) NOT NULL,
          department VARCHAR(100),
          offered_salary DECIMAL(12,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          start_date DATE,
          expiry_date DATE,
          status VARCHAR(50) DEFAULT 'draft',
          letter_content TEXT,
          signed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_rec_offers_job_cand ON recruitment_offers(job_id, candidate_id);
        CREATE INDEX IF NOT EXISTS idx_rec_offers_scope ON recruitment_offers(company_id, branch_id)$ddl73$,
    -- modules/roles/roles.service.ts :: ensureRolesTable
    $ddl74$CREATE TABLE IF NOT EXISTS roles (

        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        name VARCHAR(100) NOT NULL,

        description TEXT,

        permissions JSONB NOT NULL DEFAULT '[]',

        is_system BOOLEAN DEFAULT false,

        is_active BOOLEAN DEFAULT true,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

      )$ddl74$,
    -- modules/roles/roles.service.ts :: migrateNewPermissions
    $ddl75$CREATE TABLE IF NOT EXISTS _permission_migrations (

        permission VARCHAR(100) PRIMARY KEY,

        migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

      )$ddl75$,
    -- modules/scheduling/scheduling.service.ts :: ensureSchedulingTables
    $ddl76$CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        color VARCHAR(20) DEFAULT '#3B82F6',
        is_overnight BOOLEAN DEFAULT false,
        description TEXT,
        grace_minutes INTEGER DEFAULT 15,
        wait_for_absent_minutes INTEGER DEFAULT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        shift_id UUID REFERENCES shifts(id),
        date DATE NOT NULL,
        is_day_off BOOLEAN DEFAULT false,
        is_override BOOLEAN DEFAULT false,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );

      CREATE TABLE IF NOT EXISTS shift_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        cycle_length_days INTEGER NOT NULL,
        shifts JSONB NOT NULL,
        enable_dayoff_rotation BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_shift_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        pattern_id UUID REFERENCES shift_patterns(id),
        start_date DATE NOT NULL,
        end_date DATE,
        day_off_days JSONB DEFAULT '[]',
        auto_rotate_dayoff BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );

      CREATE TABLE IF NOT EXISTS attendance_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        date DATE NOT NULL,
        shift_id UUID REFERENCES shifts(id),
        scheduled_in TIME,
        scheduled_out TIME,
        actual_in TIMESTAMP,
        actual_out TIMESTAMP,
        status VARCHAR(20) DEFAULT 'Pending',
        work_hours INTERVAL,
        remarks TEXT,
        is_corrected BOOLEAN DEFAULT false,
        corrected_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )$ddl76$,
    -- modules/scheduling/scheduling.service.ts :: ensureSchedulingTables
    $ddl77$ALTER TABLE shift_patterns ADD COLUMN IF NOT EXISTS enable_dayoff_rotation BOOLEAN DEFAULT false;
        ALTER TABLE user_shift_patterns ADD COLUMN IF NOT EXISTS day_off_days JSONB DEFAULT '[]';
        ALTER TABLE user_shift_patterns ADD COLUMN IF NOT EXISTS auto_rotate_dayoff BOOLEAN DEFAULT true;
        ALTER TABLE schedules ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS grace_minutes INTEGER DEFAULT 15;
        ALTER TABLE shifts ADD COLUMN IF NOT EXISTS wait_for_absent_minutes INTEGER DEFAULT NULL$ddl77$,
    -- modules/self-service/self-service.service.ts :: ensureTables
    $ddl78$ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)$ddl78$,
    -- modules/self-service/self-service.service.ts :: ensureTables
    $ddl79$CREATE TABLE IF NOT EXISTS profile_change_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          field_name VARCHAR(100) NOT NULL,
          current_value TEXT,
          proposed_value TEXT NOT NULL,
          reason TEXT,
          supporting_doc_url TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          reviewed_by UUID,
          reviewed_at TIMESTAMP,
          reviewer_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl79$,
    -- modules/settings/settings.service.ts :: ensureSettingsTable
    $ddl80$CREATE TABLE IF NOT EXISTS settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(50) NOT NULL UNIQUE,
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl80$,
    -- modules/settings/settings.service.ts :: ensureDepartmentsTable
    $ddl81$CREATE TABLE IF NOT EXISTS departments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        parent_id UUID,
        manager_id UUID,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl81$,
    -- modules/settings/settings.service.ts :: ensureCompaniesTable
    $ddl82$CREATE TABLE IF NOT EXISTS companies (
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
      )$ddl82$,
    -- modules/settings/settings.service.ts :: ensureBranchesTable
    $ddl83$CREATE TABLE IF NOT EXISTS branches (
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
      )$ddl83$,
    -- modules/settings/settings.service.ts :: ensurePayrollTables
    $ddl84$CREATE TABLE IF NOT EXISTS income_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_taxable BOOLEAN DEFAULT true,
        is_pensionable BOOLEAN DEFAULT false,
        calculation_type VARCHAR(20) DEFAULT 'fixed',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        check(calculation_type in ('fixed', 'percentage'))
      )$ddl84$,
    -- modules/settings/settings.service.ts :: ensurePayrollTables
    $ddl85$CREATE TABLE IF NOT EXISTS income_type_category_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        income_type_id UUID NOT NULL REFERENCES income_types(id) ON DELETE CASCADE,
        employee_category_id UUID NOT NULL REFERENCES employee_categories(id) ON DELETE CASCADE,
        fixed_amount DECIMAL(15,2) DEFAULT NULL,
        percentage_value DECIMAL(5,2) DEFAULT NULL,
        calculation_mode VARCHAR(20) DEFAULT 'both_highest',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(income_type_id, employee_category_id),
        CHECK(calculation_mode IN ('fixed_only', 'percentage_only', 'both_highest'))
      )$ddl85$,
    -- modules/settings/settings.service.ts :: ensurePayrollTables
    $ddl86$DO $$ BEGIN
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS is_category_specific BOOLEAN DEFAULT false;
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS universal_fixed_amount DECIMAL(15,2) DEFAULT NULL;
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS universal_percentage_value DECIMAL(5,2) DEFAULT NULL;
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS universal_calculation_mode VARCHAR(20) DEFAULT 'both_highest';
      EXCEPTION WHEN others THEN NULL;
      END $$$ddl86$,
    -- modules/settings/settings.service.ts :: ensurePayrollTables
    $ddl87$DO $$ BEGIN
        ALTER TABLE income_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      EXCEPTION WHEN others THEN NULL;
      END $$$ddl87$,
    -- modules/settings/settings.service.ts :: seedDefaultCategories
    $ddl88$CREATE TABLE IF NOT EXISTS employee_categories(
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        default_transport_allowance DECIMAL(10, 2) DEFAULT 0,
        default_per_diem_fixed DECIMAL(10, 2) DEFAULT 0,
        per_diem_no_receipt_fixed DECIMAL(10, 2) DEFAULT 0,
        per_diem_no_receipt_percent DECIMAL(5, 2) DEFAULT 0,
        per_diem_receipt_fixed DECIMAL(10, 2) DEFAULT 0,
        per_diem_receipt_percent DECIMAL(5, 2) DEFAULT 0,
        desert_min_percent DECIMAL(5, 2) DEFAULT 0,
        desert_mid_percent DECIMAL(5, 2) DEFAULT 0,
        desert_max_percent DECIMAL(5, 2) DEFAULT 0,
        hardship_min_percent DECIMAL(5, 2) DEFAULT 0,
        hardship_mid_percent DECIMAL(5, 2) DEFAULT 0,
        hardship_max_percent DECIMAL(5, 2) DEFAULT 0,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl88$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl89$ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID$ddl89$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl90$ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP$ddl90$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl91$ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token VARCHAR(255)$ddl91$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl92$ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token_expires_at TIMESTAMP$ddl92$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl93$ALTER TABLE users ADD COLUMN IF NOT EXISTS is_password_set BOOLEAN DEFAULT false$ddl93$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl94$ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE$ddl94$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl95$ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT$ddl95$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl96$ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)$ddl96$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl97$ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100)$ddl97$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl98$ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100)$ddl98$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl99$ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)$ddl99$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl100$ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20)$ddl100$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl101$ALTER TABLE users ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20)$ddl101$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl102$ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality VARCHAR(100)$ddl102$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl103$ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id VARCHAR(50)$ddl103$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl104$ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255)$ddl104$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl105$ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50)$ddl105$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl106$ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(50)$ddl106$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl107$ALTER TABLE users ADD COLUMN IF NOT EXISTS hire_date DATE$ddl107$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl108$ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50)$ddl108$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl109$ALTER TABLE users ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(15,2) DEFAULT 0$ddl109$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl110$ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_allowance_percent DECIMAL(5,2) DEFAULT 0$ddl110$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl111$ALTER TABLE users ADD COLUMN IF NOT EXISTS tin VARCHAR(50) DEFAULT NULL$ddl111$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl112$ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(50) DEFAULT NULL$ddl112$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl113$ALTER TABLE users ADD COLUMN IF NOT EXISTS desert_allowance_override VARCHAR(20) DEFAULT NULL$ddl113$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl114$ALTER TABLE users ADD COLUMN IF NOT EXISTS hardship_allowance_override VARCHAR(20) DEFAULT NULL$ddl114$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl115$ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_allowance_override VARCHAR(20) DEFAULT NULL$ddl115$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl116$ALTER TABLE users ADD COLUMN IF NOT EXISTS per_diem_allowance_override VARCHAR(20) DEFAULT NULL$ddl116$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl117$ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID$ddl117$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl118$ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID$ddl118$,
    -- modules/users/users.service.ts :: ensureUserColumns
    $ddl119$ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID$ddl119$,
    -- modules/users/users.service.ts :: findAllUsers
    $ddl120$CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions JSONB NOT NULL DEFAULT '[]',
        is_system BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl120$,
    -- modules/users/users.service.ts :: ensureAttachmentsTable
    $ddl121$CREATE TABLE IF NOT EXISTS user_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'other',
        description TEXT,
        uploaded_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl121$,
    -- modules/users/users.service.ts :: ensureCategoryAllowanceColumns
    $ddl122$ALTER TABLE category_allowances ADD COLUMN IF NOT EXISTS min_amount DECIMAL(10,2) DEFAULT 0$ddl122$,
    -- modules/users/users.service.ts :: ensureCategoryAllowanceColumns
    $ddl123$ALTER TABLE category_allowances ADD COLUMN IF NOT EXISTS mid_amount DECIMAL(10,2) DEFAULT 0$ddl123$,
    -- modules/users/users.service.ts :: ensureCategoryAllowanceColumns
    $ddl124$ALTER TABLE category_allowances ADD COLUMN IF NOT EXISTS max_amount DECIMAL(10,2) DEFAULT 0$ddl124$,
    -- modules/users/users.service.ts :: ensureCategoryAllowanceColumns
    $ddl125$ALTER TABLE category_allowances ADD COLUMN IF NOT EXISTS default_tier VARCHAR(20) DEFAULT 'none'$ddl125$,
    -- modules/users/users.service.ts :: ensureCategoryAllowanceColumns
    $ddl126$CREATE TABLE IF NOT EXISTS user_allowance_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL, 
          income_type_id UUID NOT NULL, 
          tier VARCHAR(20), 
          custom_amount DECIMAL(10,2), 
          created_at TIMESTAMP DEFAULT NOW(), 
          updated_at TIMESTAMP DEFAULT NOW()
       )$ddl126$,
    -- modules/wfm-opportunities/wfm-opportunities.service.ts :: ensureTables
    $ddl127$CREATE TABLE IF NOT EXISTS wfm_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID,
        branch_id UUID,
        vet_enabled BOOLEAN NOT NULL DEFAULT true,
        vto_enabled BOOLEAN NOT NULL DEFAULT true,
        vet_claim_strategy VARCHAR(30) NOT NULL DEFAULT 'fcfs',
        vto_claim_strategy VARCHAR(30) NOT NULL DEFAULT 'fcfs',
        vet_auto_approval BOOLEAN NOT NULL DEFAULT true,
        vto_auto_approval BOOLEAN NOT NULL DEFAULT true,
        max_weekly_ot_hours NUMERIC(5,2) NOT NULL DEFAULT 20.00,
        min_rest_hours_between_shifts NUMERIC(4,2) NOT NULL DEFAULT 11.00,
        vto_allow_pto_funding BOOLEAN NOT NULL DEFAULT false,
        vet_cancellation_cutoff_hours INT NOT NULL DEFAULT 4,
        vto_cancellation_cutoff_hours INT NOT NULL DEFAULT 2,
        notify_via_push BOOLEAN NOT NULL DEFAULT true,
        notify_via_email BOOLEAN NOT NULL DEFAULT true,
        notify_via_in_app BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wfm_opportunities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID,
        branch_id UUID,
        department_id UUID,
        type VARCHAR(10) NOT NULL,
        title VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        shift_id UUID,
        start_time TIME,
        end_time TIME,
        hours NUMERIC(5,2) NOT NULL,
        slots_available INT NOT NULL DEFAULT 1,
        slots_claimed INT NOT NULL DEFAULT 0,
        ot_rate_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.50,
        ot_category VARCHAR(30) NOT NULL DEFAULT 'normal',
        urgency VARCHAR(20) NOT NULL DEFAULT 'normal',
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        reason TEXT,
        notes TEXT,
        expires_at TIMESTAMP,
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wfm_opportunity_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        opportunity_id UUID NOT NULL,
        user_id UUID NOT NULL,
        claim_type VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        use_pto_balance BOOLEAN NOT NULL DEFAULT false,
        reviewed_by UUID,
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        schedule_id UUID,
        overtime_entry_id UUID,
        company_id UUID,
        branch_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(opportunity_id, user_id)
      );
      ALTER TABLE wfm_opportunities ADD COLUMN IF NOT EXISTS vto_compensation_type VARCHAR(20) DEFAULT 'unpaid';
      ALTER TABLE wfm_settings ADD COLUMN IF NOT EXISTS default_vto_compensation VARCHAR(20) DEFAULT 'unpaid';
      ALTER TABLE wfm_opportunity_claims ADD COLUMN IF NOT EXISTS hours NUMERIC(5,2);
      ALTER TABLE wfm_opportunity_claims ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
      ALTER TABLE wfm_opportunities ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP$ddl127$,
    -- modules/ai/services/ai-action.service.ts :: ?
    $ddl128$CREATE TABLE IF NOT EXISTS system_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_type VARCHAR(50) NOT NULL,
        performed_by UUID,
        executed_by VARCHAR(50) DEFAULT 'ai_on_behalf',
        entity_type VARCHAR(100),
        entity_id VARCHAR(255),
        details JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )$ddl128$,
    -- modules/ai/services/ai-action.service.ts :: ?
    $ddl129$CREATE TABLE IF NOT EXISTS announcements (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              title VARCHAR(255) NOT NULL, content TEXT NOT NULL,
              priority VARCHAR(20) DEFAULT 'normal', target_type VARCHAR(20) NOT NULL,
              target_ids TEXT[], created_by UUID, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
            )$ddl129$,
    -- modules/ai/services/ai-document.service.ts :: ?
    $ddl130$CREATE TABLE IF NOT EXISTS ai_document_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id VARCHAR(100),
          user_id VARCHAR(100),
          template_id VARCHAR(100),
          format VARCHAR(20),
          filename VARCHAR(255),
          parameters JSONB,
          executed_by VARCHAR(50) DEFAULT 'ai_on_behalf',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )$ddl130$,
    -- modules/auth/guards/module-subscription.guard.ts :: ?
    $ddl131$CREATE TABLE IF NOT EXISTS tenant_modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module_key VARCHAR(50) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )$ddl131$
  ];
  pending text[];
  failed text[];
  errs text[];
  s text;
  pass int := 0;
  progress boolean;
BEGIN
  pending := stmts;
  LOOP
    pass := pass + 1;
    progress := false;
    failed := '{}';
    errs := '{}';
    FOREACH s IN ARRAY pending LOOP
      BEGIN
        EXECUTE s;
        progress := true;
      EXCEPTION WHEN others THEN
        failed := failed || s;
        errs := errs || SQLERRM;
      END;
    END LOOP;
    EXIT WHEN coalesce(array_length(failed, 1), 0) = 0 OR NOT progress OR pass >= 10;
    pending := failed;
  END LOOP;

  IF coalesce(array_length(failed, 1), 0) > 0 THEN
    FOR i IN 1 .. array_length(failed, 1) LOOP
      RAISE WARNING 'consolidated schema: statement not applied (%): %', errs[i], left(failed[i], 200);
    END LOOP;
  END IF;
END
$consolidate$;
