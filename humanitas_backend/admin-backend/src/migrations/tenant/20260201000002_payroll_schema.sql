-- ============================================================
-- Migration 002: Payroll Schema
-- Tables: income_types, income_type_category_rules,
--         category_allowances, user_incomes,
--         user_income_assignments, acting_assignments,
--         tax_rules, holidays, payroll_runs, payroll_items
-- ============================================================

-- Income Types (Transport, Hardship, Desert, Acting, Per Diem, etc.)
CREATE TABLE IF NOT EXISTS income_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_taxable BOOLEAN DEFAULT true,
  is_pensionable BOOLEAN DEFAULT false,
  calculation_type VARCHAR(20) DEFAULT 'fixed' CHECK (calculation_type IN ('fixed', 'percentage')),
  tax_rate VARCHAR(50) DEFAULT 'standard',
  is_active BOOLEAN DEFAULT true,
  is_category_specific BOOLEAN DEFAULT false,
  universal_fixed_amount DECIMAL(15, 2),
  universal_percentage_value DECIMAL(5, 2),
  universal_calculation_mode VARCHAR(20) DEFAULT 'both_highest'
    CHECK (universal_calculation_mode IN ('fixed_only', 'percentage_only', 'both_highest')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Income Type Category Rules (per-category calculation overrides)
CREATE TABLE IF NOT EXISTS income_type_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  income_type_id UUID NOT NULL REFERENCES income_types(id) ON DELETE CASCADE,
  employee_category_id UUID NOT NULL REFERENCES employee_categories(id) ON DELETE CASCADE,
  fixed_amount DECIMAL(15, 2),
  percentage_value DECIMAL(5, 2),
  calculation_mode VARCHAR(20) DEFAULT 'both_highest'
    CHECK (calculation_mode IN ('fixed_only', 'percentage_only', 'both_highest')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(income_type_id, employee_category_id)
);

-- Category Allowances (amounts linked to categories + tiers)
CREATE TABLE IF NOT EXISTS category_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_category_id UUID NOT NULL REFERENCES employee_categories(id) ON DELETE CASCADE,
  income_type_id UUID NOT NULL,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  min_amount DECIMAL(15, 2) DEFAULT 0,
  mid_amount DECIMAL(15, 2) DEFAULT 0,
  max_amount DECIMAL(15, 2) DEFAULT 0,
  default_tier VARCHAR(20) DEFAULT 'none',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_category_id, income_type_id)
);

-- User Incomes (manual income/allowance assignments per employee)
CREATE TABLE IF NOT EXISTS user_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  income_type_id UUID NOT NULL REFERENCES income_types(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_taxable BOOLEAN,                   -- NULL = inherit from income_type (base), TRUE/FALSE = override
  alias VARCHAR(255),                   -- Label for additional assignments
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_incomes_user ON user_incomes(user_id);

-- User Income Assignments (generic assignments table, used by some modules)
CREATE TABLE IF NOT EXISTS user_income_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  income_type_id UUID REFERENCES income_types(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, income_type_id)
);

-- Acting Assignments (temporary role coverage — generates tax-free allowance)
CREATE TABLE IF NOT EXISTS acting_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);

-- Tax Rules (Ethiopian progressive brackets — configurable per tenant)
CREATE TABLE IF NOT EXISTS tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_salary DECIMAL(15, 2) NOT NULL,
  max_salary DECIMAL(15, 2),             -- NULL = no upper bound (highest bracket)
  tax_rate DECIMAL(5, 2) NOT NULL,
  deductible DECIMAL(15, 2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Holidays (Ethiopian public holidays — recurring or one-off)
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date)
);

-- Payroll Runs (one per month/year per tenant)
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  status_message TEXT,
  total_employees INTEGER DEFAULT 0,
  total_gross DECIMAL(15, 2) DEFAULT 0,
  total_deductions DECIMAL(15, 2) DEFAULT 0,
  total_net DECIMAL(15, 2) DEFAULT 0,
  total_tax DECIMAL(15, 2) DEFAULT 0,
  total_pension_employee DECIMAL(15, 2) DEFAULT 0,
  total_pension_employer DECIMAL(15, 2) DEFAULT 0,
  run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  created_by UUID,
  UNIQUE(month, year)
);

-- Payroll Items (one row per employee per payroll run)
CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  basic_salary DECIMAL(15, 2) DEFAULT 0,
  total_allowances DECIMAL(15, 2) DEFAULT 0,
  taxable_allowances DECIMAL(15, 2) DEFAULT 0,
  non_taxable_allowances DECIMAL(15, 2) DEFAULT 0,
  pensionable_income DECIMAL(15, 2) DEFAULT 0,
  taxable_income DECIMAL(15, 2) DEFAULT 0,
  gross_salary DECIMAL(15, 2) DEFAULT 0,
  income_tax DECIMAL(15, 2) DEFAULT 0,
  pension_employee DECIMAL(15, 2) DEFAULT 0,
  pension_employer DECIMAL(15, 2) DEFAULT 0,
  loan_deduction DECIMAL(15, 2) DEFAULT 0,
  late_deduction DECIMAL(15, 2) DEFAULT 0,
  other_deductions DECIMAL(15, 2) DEFAULT 0,
  total_deductions DECIMAL(15, 2) DEFAULT 0,
  net_salary DECIMAL(15, 2) DEFAULT 0,
  days_worked INTEGER DEFAULT 0,
  days_absent INTEGER DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  allowances_breakdown JSONB DEFAULT '[]',
  loans_breakdown JSONB DEFAULT '[]',
  penalties_breakdown JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_user ON payroll_items(user_id);
