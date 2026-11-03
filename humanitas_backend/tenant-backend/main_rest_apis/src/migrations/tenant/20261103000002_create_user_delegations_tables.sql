-- ==============================================================================
-- Migration: 20261103000002_create_user_delegations_tables.sql
-- Module: Common Platform Core - User Delegation & Authority Engine
-- Multi-Company & Multi-Branch Scoped Delegations & Audit Trail
-- HRMS Bridge: Acting Assignment & Financial Compensation Allowance
-- ==============================================================================

CREATE TABLE IF NOT EXISTS user_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  delegator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delegatee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  scope VARCHAR(50) NOT NULL DEFAULT 'ALL',
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- HR Acting Assignment & Allowance Extension
  is_acting_assignment BOOLEAN DEFAULT FALSE,
  acting_position_title VARCHAR(150),
  acting_allowance_type VARCHAR(30) DEFAULT 'percentage',
  acting_allowance_percentage NUMERIC(5, 2) DEFAULT 0.00,
  acting_allowance_amount NUMERIC(12, 2) DEFAULT 0.00,
  acting_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acting_approved_at TIMESTAMPTZ,
  acting_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_delegations_delegator ON user_delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_user_delegations_delegatee ON user_delegations(delegatee_id);
CREATE INDEX IF NOT EXISTS idx_user_delegations_active ON user_delegations(delegatee_id, status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_user_delegations_company ON user_delegations(company_id);
CREATE INDEX IF NOT EXISTS idx_user_delegations_branch ON user_delegations(branch_id);
CREATE INDEX IF NOT EXISTS idx_user_delegations_status ON user_delegations(status);
CREATE INDEX IF NOT EXISTS idx_user_delegations_acting ON user_delegations(is_acting_assignment, status);

CREATE TABLE IF NOT EXISTS delegation_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID REFERENCES user_delegations(id) ON DELETE SET NULL,
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  on_behalf_of UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delegation_audit_delegation ON delegation_audit_logs(delegation_id);
CREATE INDEX IF NOT EXISTS idx_delegation_audit_performed ON delegation_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_delegation_audit_on_behalf ON delegation_audit_logs(on_behalf_of);
CREATE INDEX IF NOT EXISTS idx_delegation_audit_created ON delegation_audit_logs(created_at);
