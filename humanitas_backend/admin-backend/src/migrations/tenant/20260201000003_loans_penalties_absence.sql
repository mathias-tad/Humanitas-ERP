-- ============================================================
-- Migration 003: Loans, Penalties & Absence Tracking
-- Tables: loans, loan_workflows, loan_approvals,
--         user_penalties, absence_summary,
--         late_minutes_summary, per_diem_claims,
--         overtime_entries
-- ============================================================

-- Loans
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loan_type VARCHAR(100) DEFAULT 'personal',
  description TEXT,
  total_amount DECIMAL(10, 2) NOT NULL,
  monthly_deduction DECIMAL(10, 2) NOT NULL,
  remaining_balance DECIMAL(10, 2) NOT NULL,
  start_month INTEGER,
  start_year INTEGER,
  start_date DATE,
  term_months INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active',
  approval_status VARCHAR(20) DEFAULT 'pending',
  current_step INTEGER DEFAULT 1,
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- Loan Workflows (approval chain config)
CREATE TABLE IF NOT EXISTS loan_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_order INTEGER NOT NULL,
  role_required VARCHAR(100) NOT NULL,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loan Approvals (per-step approval records)
CREATE TABLE IF NOT EXISTS loan_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  approver_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Penalties (manual or absence-based deductions)
CREATE TABLE IF NOT EXISTS user_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  attachment_url VARCHAR(500),
  month INTEGER,
  year INTEGER,
  status VARCHAR(20) DEFAULT 'Pending',
  penalty_type VARCHAR(20) DEFAULT 'Manual',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_penalties_status ON user_penalties(user_id, month, year, status);

-- Absence Summary (weekly/monthly aggregate for notification triggers)
CREATE TABLE IF NOT EXISTS absence_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  weekly_absent_count INTEGER DEFAULT 0,
  monthly_absent_count INTEGER DEFAULT 0,
  consecutive_absent_count INTEGER DEFAULT 0,
  last_absent_date DATE,
  consecutive_notified BOOLEAN DEFAULT false,
  monthly_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, week_start_date),
  UNIQUE(user_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_absence_summary_user ON absence_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_absence_summary_notifications
  ON absence_summary(user_id, consecutive_notified, monthly_notified);

-- Late Minutes Summary (daily/weekly/monthly aggregates)
CREATE TABLE IF NOT EXISTS late_minutes_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  week_start_date DATE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  late_minutes INTEGER DEFAULT 0,
  late_penalty_amount DECIMAL(10, 2) DEFAULT 0,
  weekly_late_minutes INTEGER DEFAULT 0,
  weekly_late_penalty DECIMAL(10, 2) DEFAULT 0,
  monthly_late_minutes INTEGER DEFAULT 0,
  monthly_late_penalty DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_late_summary_user_month ON late_minutes_summary(user_id, month, year);
CREATE INDEX IF NOT EXISTS idx_late_summary_week ON late_minutes_summary(user_id, week_start_date);

-- Per Diem Claims (receipt-based per diem submission)
CREATE TABLE IF NOT EXISTS per_diem_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  has_receipt BOOLEAN DEFAULT false,
  receipt_file_url VARCHAR(500),
  receipt_amount DECIMAL(10, 2),
  receipt_uploaded_at TIMESTAMP,
  calculated_amount DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_per_diem_claims_user ON per_diem_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_per_diem_claims_month_year ON per_diem_claims(month, year);

-- Overtime Entries (per-day OT records)
CREATE TABLE IF NOT EXISTS overtime_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_id UUID,
  date DATE NOT NULL,
  normal_ot_hours DECIMAL(10, 2) DEFAULT 0,
  night_ot_hours DECIMAL(10, 2) DEFAULT 0,
  holiday_ot_hours DECIMAL(10, 2) DEFAULT 0,
  dayoff_ot_hours DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Pending',
  period_start DATE,
  period_end DATE,
  period_label VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);
