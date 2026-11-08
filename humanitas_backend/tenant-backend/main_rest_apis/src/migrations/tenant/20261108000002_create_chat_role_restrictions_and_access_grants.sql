-- ==============================================================================
-- Migration: 20261108000002_create_chat_role_restrictions_and_access_grants.sql
-- Description: Chat Role Restrictions, AI Triage Prompts, and Direct Chat Access Grants
-- Supports: Admin role-based chat restrictions, AI triage redirection, 
--           timed/indefinite access approvals, and user self-override.
-- ==============================================================================

-- 1. Add allow_direct_chat_override column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_direct_chat_override BOOLEAN DEFAULT FALSE;

-- 2. Create chat_role_restrictions table
CREATE TABLE IF NOT EXISTS chat_role_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    branch_id UUID,
    role VARCHAR(100) NOT NULL,
    is_restricted BOOLEAN NOT NULL DEFAULT TRUE,
    triage_prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_role_restriction_per_company UNIQUE (role, company_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_role_restrictions_role ON chat_role_restrictions(role);
CREATE INDEX IF NOT EXISTS idx_chat_role_restrictions_company_branch ON chat_role_restrictions(company_id, branch_id);

-- 3. Create chat_direct_access_grants table
CREATE TABLE IF NOT EXISTS chat_direct_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    branch_id UUID,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
    expires_at TIMESTAMP WITH TIME ZONE NULL,       -- NULL means indefinite / forever
    reason TEXT NOT NULL,
    response_note TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_access_grants_req_target ON chat_direct_access_grants(requester_id, target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_access_grants_target ON chat_direct_access_grants(target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_access_grants_expires ON chat_direct_access_grants(expires_at);

-- 4. Seed default sensible role restrictions
INSERT INTO chat_role_restrictions (role, is_restricted, triage_prompt)
VALUES 
  ('hr_manager', true, 'HR inquiries regarding company policies, leave entitlements, probation, and employment contracts should first be queried through the AI Assistant or Knowledge Vault.'),
  ('general_manager', true, 'Direct messaging to executive management requires prior clearance. Please consult department procedures or request direct access.'),
  ('ceo', true, 'Executive leadership direct communication requires prior clearance. Please state the nature of your urgent or confidential request.'),
  ('legal_counsel', true, 'Legal inquiries should follow formal documentation procedures. Please review standard contracts or submit a direct access request.')
ON CONFLICT (role, company_id) DO NOTHING;
