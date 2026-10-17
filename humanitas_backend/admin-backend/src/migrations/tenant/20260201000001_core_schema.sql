-- ============================================================
-- Migration 001: Core HR Schema
-- Tables: settings, employee_categories, roles, users,
--         departments, attendance, attendance_records,
--         leave_requests, leave_workflows, leave_approvals,
--         user_allowance_settings
-- ============================================================

-- Settings (key-value store for HR & Payroll config)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee Categories (Management, Field, General, etc.)
CREATE TABLE IF NOT EXISTS employee_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  default_transport_allowance DECIMAL(10, 2) DEFAULT 0,
  default_per_diem_fixed DECIMAL(10, 2) DEFAULT 0,
  use_transport_allowance BOOLEAN DEFAULT TRUE,
  use_per_diem BOOLEAN DEFAULT TRUE,
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
  desert_default_tier VARCHAR(10) DEFAULT 'none',
  hardship_default_tier VARCHAR(10) DEFAULT 'none',
  transport_default_tier VARCHAR(10) DEFAULT 'none',
  per_diem_default_tier VARCHAR(10) DEFAULT 'none',
  transport_min_percent DECIMAL(5, 2) DEFAULT 0,
  transport_mid_percent DECIMAL(5, 2) DEFAULT 0,
  transport_max_percent DECIMAL(5, 2) DEFAULT 0,
  per_diem_min_percent DECIMAL(5, 2) DEFAULT 0,
  per_diem_mid_percent DECIMAL(5, 2) DEFAULT 0,
  per_diem_max_percent DECIMAL(5, 2) DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles (RBAC)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'employee',
  role_id UUID REFERENCES roles(id),
  department VARCHAR(100),
  position VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_password_set BOOLEAN DEFAULT false,
  password_reset_token VARCHAR(255),
  password_reset_expires_at TIMESTAMP,
  last_login_at TIMESTAMP,
  refresh_token TEXT,
  avatar_url TEXT,
  employee_category_id UUID REFERENCES employee_categories(id),
  setup_token VARCHAR(255),
  setup_token_expires_at TIMESTAMP,
  -- Payroll fields
  basic_salary DECIMAL(15, 2) DEFAULT 0,
  desert_allowance_percent DECIMAL(5, 2) DEFAULT 0,
  hardship_allowance_percent DECIMAL(5, 2) DEFAULT 0,
  desert_allowance_override VARCHAR(10),
  hardship_allowance_override VARCHAR(10),
  transport_allowance_override VARCHAR(10),
  per_diem_allowance_override VARCHAR(10),
  -- HR fields
  tin VARCHAR(50),
  account_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all columns exist even if users table was pre-existing
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_category_id UUID REFERENCES employee_categories(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'employee';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_password_set BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS desert_allowance_percent DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hardship_allowance_percent DECIMAL(5, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS desert_allowance_override VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hardship_allowance_override VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_allowance_override VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS per_diem_allowance_override VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tin VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_category ON users(employee_category_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES departments(id),
  manager_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Positions
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  department_id UUID REFERENCES departments(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance (TypeORM entity-managed legacy table)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in TIMESTAMP NOT NULL,
  check_out TIMESTAMP,
  work_hours DECIMAL(5, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Records (used by payroll & biometric system)
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_id UUID,
  scheduled_in TIME,
  scheduled_out TIME,
  actual_in TIMESTAMP,
  actual_out TIMESTAMP,
  status VARCHAR(20) DEFAULT 'Pending',
  work_hours INTERVAL,
  remarks TEXT,
  is_corrected BOOLEAN DEFAULT false,
  corrected_by UUID REFERENCES users(id),
  ot_duration_normal INTERVAL DEFAULT '0',
  ot_duration_night INTERVAL DEFAULT '0',
  ot_duration_holiday INTERVAL DEFAULT '0',
  ot_duration_dayoff INTERVAL DEFAULT '0',
  forced_clock_out_by UUID REFERENCES users(id),
  forced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

-- Patch: add any columns that may be missing from older schema versions
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS shift_id UUID;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS scheduled_in TIME;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS scheduled_out TIME;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS actual_in TIMESTAMP;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS actual_out TIMESTAMP;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN DEFAULT false;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES users(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ot_duration_normal INTERVAL DEFAULT '0';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ot_duration_night INTERVAL DEFAULT '0';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ot_duration_holiday INTERVAL DEFAULT '0';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ot_duration_dayoff INTERVAL DEFAULT '0';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS forced_clock_out_by UUID REFERENCES users(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS forced_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date ON attendance_records(user_id, date);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type_id VARCHAR(100),
  leave_type_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'Pending',
  approval_status VARCHAR(20) DEFAULT 'Pending',
  current_step INTEGER DEFAULT 0,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);

-- Leave Workflows
CREATE TABLE IF NOT EXISTS leave_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_order INTEGER NOT NULL,
  role_required VARCHAR(50) NOT NULL,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave Approvals
CREATE TABLE IF NOT EXISTS leave_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID REFERENCES leave_requests(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  approver_id UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Allowance Settings (tier overrides per user)
CREATE TABLE IF NOT EXISTS user_allowance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  income_type_id UUID NOT NULL,
  tier VARCHAR(20),
  custom_amount DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, income_type_id)
);
