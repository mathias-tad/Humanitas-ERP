-- Migration: 20261108000003_create_biometric_punch_logs_and_attendance_enhancements.sql
-- Description: Creates biometric_punch_logs, attendance_correction_requests, and enhances attendance_records for debouncing, overnight shifts, missed punches, and overtime decision governance.

-- 1. Create biometric_punch_logs table (Immutable raw punch ledger)
CREATE TABLE IF NOT EXISTS biometric_punch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    company_id UUID,
    branch_id UUID,
    device_id UUID,
    device_serial_number VARCHAR(100),
    pin VARCHAR(100) NOT NULL,
    user_id UUID,
    punch_time TIMESTAMP WITH TIME ZONE NOT NULL,
    punch_type VARCHAR(50) DEFAULT 'auto', -- 'auto' | 'in' | 'out' | 'break_in' | 'break_out'
    verify_method VARCHAR(50) DEFAULT 'fingerprint', -- 'fingerprint' | 'face' | 'palm' | 'card' | 'qr' | 'manual'
    status VARCHAR(50) DEFAULT 'processed', -- 'processed' | 'debounced_duplicate' | 'unmatched_user' | 'error'
    raw_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biometric_punch_logs_user_punch ON biometric_punch_logs(user_id, punch_time);
CREATE INDEX IF NOT EXISTS idx_biometric_punch_logs_status ON biometric_punch_logs(status);
CREATE INDEX IF NOT EXISTS idx_biometric_punch_logs_device ON biometric_punch_logs(device_serial_number);
CREATE INDEX IF NOT EXISTS idx_biometric_punch_logs_pin ON biometric_punch_logs(pin);

-- 2. Enhance attendance_records with overnight, missed punch type, and overtime governance columns
ALTER TABLE attendance_records 
    ADD COLUMN IF NOT EXISTS missed_punch_type VARCHAR(20) DEFAULT 'none', -- 'none' | 'missed_in' | 'missed_out'
    ADD COLUMN IF NOT EXISTS is_overnight BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ot_approved BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS correction_status VARCHAR(20) DEFAULT 'none', -- 'none' | 'pending' | 'approved' | 'rejected'
    ADD COLUMN IF NOT EXISTS in_punch_log_id UUID,
    ADD COLUMN IF NOT EXISTS out_punch_log_id UUID,
    ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS auto_close_reason VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_attendance_records_missed_punch ON attendance_records(missed_punch_type);
CREATE INDEX IF NOT EXISTS idx_attendance_records_correction ON attendance_records(correction_status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_is_overnight ON attendance_records(is_overnight);

-- 3. Create attendance_correction_requests table (Regularization workflow)
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
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_att_corr_user_status ON attendance_correction_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_att_corr_record ON attendance_correction_requests(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_att_corr_work_date ON attendance_correction_requests(work_date);


-- 4. Register Live Overtime Monitor in AI Knowledge Base (Directive 20 & 21)
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform,
  page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES (
  'attendance',
  'Live Overtime Monitor & Supervisory Shift Close',
  '/attendance/overtime-monitor',
  'AttendanceScreen',
  'Bottom Bar -> Home -> Attendance -> Live Overtime',
  'both',
  'Real-time active overtime monitoring and supervisory force clock-out. Displays employees working past their scheduled shift end in real time with WebSocket updates. Enables authorized supervisors to manually force clock out employees with an explicit choice whether to grant extra elapsed hours as Overtime or close at standard shift length (0 OT). Enforces policy to use Voluntary Extra Time (VET) and Voluntary Time Off (VTO) shifts instead of continuous endless shifts.',
  '["view_overtime_workers", "toggle_live_mode", "force_clock_out", "grant_overtime_decision", "view_vet_vto_opportunities"]'::jsonb,
  '[{"label": "Live OT Monitor", "location": "Contextual Dock under Time & Attendance, or Attendance page top toolbar button and tab"}, {"label": "Go Live / Live Mode", "location": "Top right header of Overtime Monitor page"}, {"label": "Force Clock Out", "location": "Actions column in overtime workers table, red button with logout icon"}, {"label": "Approve & Grant Overtime Credit", "location": "Radio choice in Force Clock Out dialog"}, {"label": "No Overtime Credit (Standard Shift Close)", "location": "Radio choice in Force Clock Out dialog"}]'::jsonb,
  '["view_overtime_workers", "force_clockout"]'::jsonb,
  '{"web": ["Navigate to Time & Attendance -> Live OT Monitor (/attendance/overtime-monitor) from the contextual dock or Attendance page button.", "Click ''Go Live'' to stream real-time punch status via WebSocket.", "Click ''Force Clock Out'' next to an employee working overdue.", "Select whether to grant extra hours as Overtime or close at standard shift duration (0 OT).", "Enter a reason and click ''Confirm Force Out''."], "mobile": ["Open Attendance screen from the Home tab.", "View active shift status and any missed punch warnings.", "Use Regularize to adjust missed punches, or request VET shifts for scheduled extra hours."]}'::jsonb
)
ON CONFLICT (module_key, feature_name) DO UPDATE SET
  page_purpose = EXCLUDED.page_purpose,
  available_actions = EXCLUDED.available_actions,
  button_locations = EXCLUDED.button_locations,
  required_permissions = EXCLUDED.required_permissions,
  step_by_step_instructions = EXCLUDED.step_by_step_instructions,
  updated_at = NOW();
