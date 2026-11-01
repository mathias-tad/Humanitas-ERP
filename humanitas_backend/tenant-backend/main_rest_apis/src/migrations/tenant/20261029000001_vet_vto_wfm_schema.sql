-- ==============================================================================
-- Migration: 20261029000001_vet_vto_wfm_schema.sql
-- Module: Workforce Management (WFM) - Voluntary Extra Time (VET) & Voluntary Time Off (VTO)
-- Enterprise Multi-Company & Multi-Branch Scoped Scheduling & Overtime Integration
-- ==============================================================================

-- 1. WFM Tenant & Branch Settings (Configurable Fatigue Limits, Auto-Approval & Claim Strategies)
CREATE TABLE IF NOT EXISTS wfm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  vet_enabled BOOLEAN NOT NULL DEFAULT true,
  vto_enabled BOOLEAN NOT NULL DEFAULT true,
  vet_claim_strategy VARCHAR(30) NOT NULL DEFAULT 'fcfs', -- 'fcfs', 'seniority', 'fairness'
  vto_claim_strategy VARCHAR(30) NOT NULL DEFAULT 'fcfs', -- 'fcfs', 'seniority', 'fairness'
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, branch_id)
);

-- Seed default wfm_settings for the default company & branch if none exists
INSERT INTO wfm_settings (company_id, branch_id, vet_enabled, vto_enabled, vet_auto_approval, vto_auto_approval, max_weekly_ot_hours, min_rest_hours_between_shifts)
SELECT c.id, b.id, true, true, true, true, 20.00, 11.00
FROM companies c
CROSS JOIN branches b
WHERE c.is_default = true AND b.is_default = true
ON CONFLICT (company_id, branch_id) DO NOTHING;

-- 2. WFM Broadcast Opportunities (VET & VTO Broadcast Offers)
CREATE TABLE IF NOT EXISTS wfm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  department_id UUID,
  type VARCHAR(10) NOT NULL, -- 'VET' or 'VTO'
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  start_time TIME,
  end_time TIME,
  hours NUMERIC(5,2) NOT NULL,
  slots_available INT NOT NULL DEFAULT 1,
  slots_claimed INT NOT NULL DEFAULT 0,
  ot_rate_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.50,
  ot_category VARCHAR(30) NOT NULL DEFAULT 'normal', -- 'normal', 'night', 'dayoff', 'holiday'
  urgency VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'normal', 'high', 'critical'
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'filled', 'cancelled', 'expired'
  reason TEXT,
  notes TEXT,
  expires_at TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wfm_opp_date_status ON wfm_opportunities(date, status);
CREATE INDEX IF NOT EXISTS idx_wfm_opp_company_branch ON wfm_opportunities(company_id, branch_id);

-- 3. WFM Opportunity Claims (Employee Claim Submissions, Overrides & Calculations)
CREATE TABLE IF NOT EXISTS wfm_opportunity_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES wfm_opportunities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_type VARCHAR(10) NOT NULL, -- 'VET' or 'VTO'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  use_pto_balance BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  overtime_entry_id UUID REFERENCES overtime_entries(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(opportunity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wfm_claims_user_status ON wfm_opportunity_claims(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wfm_claims_opp_id ON wfm_opportunity_claims(opportunity_id);

-- 4. Seed Permissions in Roles Table
DO $$
DECLARE
  r RECORD;
  current_perms JSONB;
BEGIN
  -- 4.1 Update Admin role with full permissions if not present
  UPDATE roles
  SET permissions = permissions || '["view_wfm_opportunities", "claim_wfm_opportunities", "broadcast_wfm_opportunities", "manage_wfm_claims", "manage_wfm_settings"]'::jsonb
  WHERE name = 'Admin' AND NOT (permissions @> '["broadcast_wfm_opportunities"]'::jsonb);

  -- 4.2 Update HR role with management permissions
  UPDATE roles
  SET permissions = permissions || '["view_wfm_opportunities", "claim_wfm_opportunities", "broadcast_wfm_opportunities", "manage_wfm_claims", "manage_wfm_settings"]'::jsonb
  WHERE name = 'HR' AND NOT (permissions @> '["broadcast_wfm_opportunities"]'::jsonb);

  -- 4.3 Update Manager role with broadcast and claims management
  UPDATE roles
  SET permissions = permissions || '["view_wfm_opportunities", "claim_wfm_opportunities", "broadcast_wfm_opportunities", "manage_wfm_claims"]'::jsonb
  WHERE name = 'Manager' AND NOT (permissions @> '["manage_wfm_claims"]'::jsonb);

  -- 4.4 Update Employee role with view and claim permissions
  UPDATE roles
  SET permissions = permissions || '["view_wfm_opportunities", "claim_wfm_opportunities"]'::jsonb
  WHERE name = 'Employee' AND NOT (permissions @> '["claim_wfm_opportunities"]'::jsonb);
END $$;

-- 5. AI Knowledge Base Entries for WFM Opportunities
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform,
  page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES (
  'scheduling',
  'Voluntary Extra Time (VET) & Voluntary Time Off (VTO) Hub',
  '/scheduling/opportunities',
  'VetVtoScreen',
  'Bottom Bar -> Scheduling -> VET & VTO Hub / Quick Action',
  'both',
  'Allows employees to browse and claim extra overtime shifts (VET) or voluntary time-off slots (VTO), while giving managers real-time shift staffing flex tools with fatigue compliance guardrails and payroll overtime calculation integration.',
  '["claim_vet_opportunity", "claim_vto_opportunity", "cancel_wfm_claim", "broadcast_opportunity", "review_wfm_claim", "configure_wfm_settings"]'::jsonb,
  '[
    {"label": "Claim Shift / Claim VTO", "location": "Right side of each opportunity card on the Available Opportunities tab"},
    {"label": "Broadcast Opportunity", "location": "Top right header of Broadcast Center tab"},
    {"label": "Approve / Reject Claim", "location": "Action column in Claims Review Queue tab"},
    {"label": "Save Policy Settings", "location": "Bottom right of Policy & Rules tab"}
  ]'::jsonb,
  '["view_wfm_opportunities"]'::jsonb,
  '{
    "web": [
      "Navigate to Scheduling -> VET & VTO Opportunities Hub (/scheduling/opportunities).",
      "On the Available Opportunities tab, browse active VET (extra overtime shifts) or VTO (voluntary excused time off) slots.",
      "Review the slot date, start/end times, hours, and OT multiplier (1.25x - 2.5x).",
      "Click Claim Shift or Claim VTO. If auto-approval is enabled and fatigue/rest limits pass, your schedule and overtime entries update immediately.",
      "Managers can click the Broadcast Center tab to open new shift opportunities with target slots and multipliers.",
      "Managers can review and approve pending claims in the Claims Review Queue tab."
    ],
    "mobile": [
      "Open the Humanitas mobile app and tap the Scheduling tab or quick action ''VET & VTO''.",
      "Switch between ''Open Opportunities'' and ''My Claims''.",
      "Tap ''Claim'' on any open VET shift or VTO slot to submit your request.",
      "Instant push notification alerts will confirm your approved shift assignment or excused absence."
    ]
  }'::jsonb
) ON CONFLICT (module_key, feature_name) DO UPDATE SET
  route_path = EXCLUDED.route_path,
  mobile_screen_name = EXCLUDED.mobile_screen_name,
  mobile_nav_path = EXCLUDED.mobile_nav_path,
  platform = EXCLUDED.platform,
  page_purpose = EXCLUDED.page_purpose,
  available_actions = EXCLUDED.available_actions,
  button_locations = EXCLUDED.button_locations,
  required_permissions = EXCLUDED.required_permissions,
  step_by_step_instructions = EXCLUDED.step_by_step_instructions,
  updated_at = CURRENT_TIMESTAMP;
