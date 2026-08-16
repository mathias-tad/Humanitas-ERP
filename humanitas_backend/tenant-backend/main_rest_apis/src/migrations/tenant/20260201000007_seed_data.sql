-- ============================================================
-- Migration 007: Seed Data
-- Default roles, employee categories, income types,
-- HR settings, payroll settings (Ethiopian tax brackets)
-- ============================================================

INSERT INTO roles (name, description, permissions, is_system)
SELECT * FROM (VALUES
  ('Admin',    'Full system access',
   '["all", "use_ai", "view_ai_usage", "view_ai_history"]'::jsonb, true),
  ('HR',       'Human Resources management',
   '["view_users","manage_attendance","manage_leaves","absence_penalty_approve","view_payroll","manage_schedules","use_ai","view_ai_history"]'::jsonb, false),
  ('Manager',  'Department manager',
   '["view_users","view_attendance","absence_penalty_approve","approve_leaves","use_ai","view_ai_history"]'::jsonb, false),
  ('Finance',  'Finance department',
   '["view_payroll","export_payroll","use_ai","view_ai_history"]'::jsonb, false),
  ('CEO',      'Chief Executive Officer',
   '["view_users","view_payroll","view_reports","use_ai","view_ai_history"]'::jsonb, false),
  ('Employee', 'Standard employee',
   '["view_own_profile","view_own_payslip","request_leave","use_ai","view_ai_history"]'::jsonb, false)
) AS v(name, description, permissions, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE roles.name = v.name
);

-- ── Employee Categories ────────────────────────────────────
INSERT INTO employee_categories (
  slug, name, description, is_system,
  default_transport_allowance, default_per_diem_fixed,
  per_diem_no_receipt_fixed, per_diem_no_receipt_percent,
  per_diem_receipt_fixed, per_diem_receipt_percent,
  desert_min_percent, desert_mid_percent, desert_max_percent,
  hardship_min_percent, hardship_mid_percent, hardship_max_percent
)
SELECT * FROM (VALUES
  ('management',       'Management',     'Senior management members',  true, 2200.0, 1000.0, 1000.0, 20.0,   600.0, 33.33, 20.0, 30.0, 40.0, 40.0, 50.0, 60.0),
  ('field',            'Field Worker',   'Employees working outside',  true, 2200.0,  600.0,  600.0, 25.0,   250.0,  2.50, 20.0, 30.0, 40.0, 40.0, 50.0, 60.0),
  ('general',          'General Staff',  'Standard office employees',  true,  600.0,  600.0,  600.0, 25.0,   250.0,  2.50,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0)
) AS v(slug, name, description, is_system, default_transport_allowance, default_per_diem_fixed, per_diem_no_receipt_fixed, per_diem_no_receipt_percent, per_diem_receipt_fixed, per_diem_receipt_percent, desert_min_percent, desert_mid_percent, desert_max_percent, hardship_min_percent, hardship_mid_percent, hardship_max_percent)
WHERE NOT EXISTS (
  SELECT 1 FROM employee_categories WHERE employee_categories.slug = v.slug
);

-- ── Income Types ───────────────────────────────────────────
INSERT INTO income_types (name, description, is_taxable, is_pensionable, calculation_type, tax_rate, is_category_specific)
SELECT * FROM (VALUES
  ('Transport Allowance', 'Monthly transport allowance',     false, false, 'fixed',      '0%',      true),
  ('Hardship Allowance',  'Allowance for difficult locations',true,  true,  'percentage', 'standard',false),
  ('Desert Allowance',    'Allowance for desert areas',       true,  true,  'percentage', 'standard',false),
  ('Acting Allowance',    'Temporary acting role allowance', false, false, 'fixed',      '0%',      false),
  ('Per Diem Allowance',  'Daily subsistence allowance',     false, false, 'fixed',      '0%',      false)
) AS v(name, description, is_taxable, is_pensionable, calculation_type, tax_rate, is_category_specific)
WHERE NOT EXISTS (
  SELECT 1 FROM income_types WHERE income_types.name = v.name
);

-- ── HR Settings ────────────────────────────────────────────
INSERT INTO settings (category, data)
SELECT * FROM (VALUES ('hr', '{
  "work_hours_per_month": 192,
  "work_days": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
  "half_day_allowed": true,
  "overtime_threshold_hours": 8,
  "probation_period_days": 60,
  "leave_increase_per_year": 2,
  "days_in_month_mode": "FIXED_30",
  "late_penalty_per_minute": 0,
  "late_arrival_tolerance": 5,
  "late_to_absent_cutoff_hours": 4,
  "notify_consecutive_absences": 3,
  "notify_total_absences_monthly": 5,
  "notify_absence_roles": ["HR Manager","Department Head"],
  "employee_pension_rate": 7,
  "employer_pension_rate": 11,
  "leave_types": [
    {"name":"Annual Leave",      "days_per_year":20, "is_paid":true},
    {"name":"Sick Leave",        "days_per_year":15, "is_paid":true},
    {"name":"Maternity Leave",   "days_per_year":90, "is_paid":true},
    {"name":"Paternity Leave",   "days_per_year":5,  "is_paid":true},
    {"name":"Unpaid Leave",      "days_per_year":30, "is_paid":false},
    {"name":"Compassionate Leave","days_per_year":3,  "is_paid":true}
  ]
}'::jsonb)) AS v(category, data)
WHERE NOT EXISTS (
  SELECT 1 FROM settings WHERE settings.category = v.category
);

-- ── Payroll Settings (Ethiopian 2024 tax brackets) ─────────
INSERT INTO settings (category, data)
SELECT * FROM (VALUES ('payroll', '{
  "currency": "ETB",
  "ot_rate_normal": 1.25,
  "ot_rate_night": 1.5,
  "ot_rate_dayoff": 2.0,
  "ot_rate_holiday": 2.5,
  "acting_allowance_percentage": 10,
  "acting_allowance_additional_type": "NONE",
  "acting_allowance_additional_value": 0,
  "bonus_tax_rate": 10,
  "max_deduction_percent": 33.33,
  "penalty_deduction_base": "NET",
  "tax_rules": [
    {"min_income":    0, "max_income":  600, "tax_rate":  0, "deductible":    0},
    {"min_income":  601, "max_income": 1650, "tax_rate": 10, "deductible":   60},
    {"min_income": 1651, "max_income": 3200, "tax_rate": 15, "deductible":  142.5},
    {"min_income": 3201, "max_income": 5250, "tax_rate": 20, "deductible":  302.5},
    {"min_income": 5251, "max_income": 7800, "tax_rate": 25, "deductible":  565},
    {"min_income": 7801, "max_income":10900, "tax_rate": 30, "deductible":  955},
    {"min_income":10901, "max_income": null, "tax_rate": 35, "deductible": 1500}
  ]
}'::jsonb)) AS v(category, data)
WHERE NOT EXISTS (
  SELECT 1 FROM settings WHERE settings.category = v.category
);

-- ── Ethiopian Tax Rules (tax_rules table) ──────────────────
INSERT INTO tax_rules (min_salary, max_salary, tax_rate, deductible, description, is_active)
SELECT * FROM (VALUES
  (    0,      600,  0,     0,   'Tax-free bracket',          true),
  (  601,     1650, 10,    60,   '10% bracket',               true),
  ( 1651,     3200, 15,   142.5, '15% bracket',               true),
  ( 3201,     5250, 20,   302.5, '20% bracket',               true),
  ( 5251,     7800, 25,   565,   '25% bracket',               true),
  ( 7801,    10900, 30,   955,   '30% bracket',               true),
  (10901, 99999999, 35,  1500,   '35% bracket (highest)',     true)
) AS v(min_salary, max_salary, tax_rate, deductible, description, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM tax_rules WHERE tax_rules.min_salary = v.min_salary
);
