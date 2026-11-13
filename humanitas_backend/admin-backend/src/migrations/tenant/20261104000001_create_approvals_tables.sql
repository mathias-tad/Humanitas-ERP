-- ============================================================================
-- Migration: 20261104000001_create_approvals_tables.sql
-- Purpose: Creates approval_workflows, approval_workflow_steps,
--          approval_requests, and approval_request_actions tables and indexes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_workflows (
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
CREATE INDEX IF NOT EXISTS idx_approval_actions_request ON approval_request_actions(request_id);
