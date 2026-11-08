-- Migration: 20261108000001_create_tenant_ai_knowledge_vault.sql
-- Description: Creates tenant_ai_knowledge_documents and tenant_ai_knowledge_chunks tables for tenant company policies,
-- proclamations, employee agreements, and guidelines with direct citation RAG and zero-guessing enforcement.

-- 1. Tenant AI Knowledge Documents Table
CREATE TABLE IF NOT EXISTS tenant_ai_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  branch_id UUID,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'company_policy',
  content_type VARCHAR(20) NOT NULL DEFAULT 'text',
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  file_size INTEGER,
  file_mime VARCHAR(100),
  raw_text TEXT NOT NULL,
  summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_ai_knowledge_docs_category ON tenant_ai_knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_knowledge_docs_company ON tenant_ai_knowledge_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_knowledge_docs_branch ON tenant_ai_knowledge_documents(branch_id);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_knowledge_docs_active ON tenant_ai_knowledge_documents(is_active);

-- 2. Tenant AI Knowledge Chunks Table (for indexed passage retrieval)
CREATE TABLE IF NOT EXISTS tenant_ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES tenant_ai_knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  section_title VARCHAR(255),
  chunk_text TEXT NOT NULL,
  page_number INTEGER,
  token_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_ai_chunks_doc ON tenant_ai_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_chunks_section ON tenant_ai_knowledge_chunks(section_title);

-- 3. Seed Default General Workplace Policy & Labour Standards Guide
DO $$
DECLARE
  v_doc_id UUID := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenant_ai_knowledge_documents WHERE title = 'Standard Company Code of Conduct & Workplace Guidelines') THEN
    INSERT INTO tenant_ai_knowledge_documents (
      id, title, category, content_type, raw_text, summary, metadata, is_active
    ) VALUES (
      v_doc_id,
      'Standard Company Code of Conduct & Workplace Guidelines',
      'code_of_conduct',
      'text',
      'SECTION 1: WORKING HOURS AND ATTENDANCE
Standard business hours are from 8:30 AM to 5:30 PM, Monday through Friday, with a one-hour lunch break. Punctuality is mandatory. Employees arriving more than 15 minutes late without prior notification must log an explanation. Overtime must be pre-approved by the department manager and is compensated in accordance with statutory labor regulations or as compensatory time off.

SECTION 2: PROBATION PERIOD AND PERFORMANCE EVALUATION
All new appointments are subject to a mandatory probationary period of sixty (60) calendar days from the official hire date. During the probation period, either party may terminate the employment contract with seven (7) calendar days prior written notice. A formal 360-degree performance evaluation is conducted prior to permanent confirmation.

SECTION 3: LEAVE ENTITLEMENTS AND ABSENCE PROCEDURES
Permanent employees are entitled to sixteen (16) working days of paid annual leave during their first year of service, incrementing by one additional day for every additional two years of service. Sick leave requires medical certification from an accredited healthcare practitioner if exceeding two consecutive working days. Maternity leave consists of ninety (90) consecutive paid calendar days. Paternity leave is five (5) paid working days.

SECTION 4: PROFESSIONAL ETHICS, CONFIDENTIALITY AND NON-DISCLOSURE
Employees must maintain strict confidentiality regarding all company proprietary information, client records, pricing models, intellectual property, and trade secrets. Unauthorized disclosure, copying, or dissemination of company information to third parties without prior written executive authorization constitutes gross misconduct and grounds for immediate termination.

SECTION 5: DISCIPLINARY MEASURES AND DUE PROCESS
Infractions are handled via a four-tier progressive disciplinary procedure: (1) Informal verbal counseling, (2) Formal written warning, (3) Final written warning with possible suspension, and (4) Dismissal. Employees are entitled to a formal disciplinary hearing and may present evidence and representation before any disciplinary determination is finalized.',
      'Comprehensive workplace policies governing working hours, probation, leave entitlements, confidentiality, and disciplinary due process.',
      '{"version": "1.0", "author": "HR Compliance", "is_seed": true}'::jsonb,
      TRUE
    );

    -- Insert corresponding chunks
    INSERT INTO tenant_ai_knowledge_chunks (document_id, chunk_index, section_title, chunk_text, page_number, token_count)
    VALUES
      (v_doc_id, 1, 'SECTION 1: WORKING HOURS AND ATTENDANCE', 'Standard business hours are from 8:30 AM to 5:30 PM, Monday through Friday, with a one-hour lunch break. Punctuality is mandatory. Employees arriving more than 15 minutes late without prior notification must log an explanation. Overtime must be pre-approved by the department manager and is compensated in accordance with statutory labor regulations or as compensatory time off.', 1, 65),
      (v_doc_id, 2, 'SECTION 2: PROBATION PERIOD AND PERFORMANCE EVALUATION', 'All new appointments are subject to a mandatory probationary period of sixty (60) calendar days from the official hire date. During the probation period, either party may terminate the employment contract with seven (7) calendar days prior written notice. A formal 360-degree performance evaluation is conducted prior to permanent confirmation.', 1, 58),
      (v_doc_id, 3, 'SECTION 3: LEAVE ENTITLEMENTS AND ABSENCE PROCEDURES', 'Permanent employees are entitled to sixteen (16) working days of paid annual leave during their first year of service, incrementing by one additional day for every additional two years of service. Sick leave requires medical certification from an accredited healthcare practitioner if exceeding two consecutive working days. Maternity leave consists of ninety (90) consecutive paid calendar days. Paternity leave is five (5) paid working days.', 1, 74),
      (v_doc_id, 4, 'SECTION 4: PROFESSIONAL ETHICS, CONFIDENTIALITY AND NON-DISCLOSURE', 'Employees must maintain strict confidentiality regarding all company proprietary information, client records, pricing models, intellectual property, and trade secrets. Unauthorized disclosure, copying, or dissemination of company information to third parties without prior written executive authorization constitutes gross misconduct and grounds for immediate termination.', 1, 52),
      (v_doc_id, 5, 'SECTION 5: DISCIPLINARY MEASURES AND DUE PROCESS', 'Infractions are handled via a four-tier progressive disciplinary procedure: (1) Informal verbal counseling, (2) Formal written warning, (3) Final written warning with possible suspension, and (4) Dismissal. Employees are entitled to a formal disciplinary hearing and may present evidence and representation before any disciplinary determination is finalized.', 1, 56);
  END IF;
END $$;
