-- CRM core (featureslist §4.1, CRM 1.1, 1.2, 1.4, 1.5): leads, opportunities on pipelines, and activities.
-- Leads are converted into a contact (Contacts, §4.1 1.3) and an opportunity. Every record keeps its
-- history on the timeline (§30), with the time spent in each status or stage.

CREATE SEQUENCE IF NOT EXISTS crm_lead_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS crm_opportunity_code_seq START 1;

CREATE TABLE IF NOT EXISTS crm_lead_sources (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER      NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_lead_sources_name ON crm_lead_sources (lower(name));

CREATE TABLE IF NOT EXISTS crm_lost_reasons (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER      NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_lost_reasons_name ON crm_lost_reasons (lower(name));

CREATE TABLE IF NOT EXISTS crm_pipelines (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    is_default BOOLEAN      NOT NULL DEFAULT false,
    company_id UUID,
    sort_order INTEGER      NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT true,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_pipelines_name
    ON crm_pipelines (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_pipelines_one_default
    ON crm_pipelines (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE is_default AND is_active;

CREATE TABLE IF NOT EXISTS crm_stages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID         NOT NULL REFERENCES crm_pipelines(id),
    name        VARCHAR(100) NOT NULL,
    -- Default win probability of a deal in this stage (a deal can override it).
    probability INTEGER      NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
    -- Days a deal may stay here before it shows as stuck.
    rotting_days INTEGER     CHECK (rotting_days IS NULL OR rotting_days BETWEEN 1 AND 365),
    is_won      BOOLEAN      NOT NULL DEFAULT false,
    is_lost     BOOLEAN      NOT NULL DEFAULT false,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_crm_stages_won_lost CHECK (NOT (is_won AND is_lost))
);
CREATE INDEX IF NOT EXISTS idx_crm_stages_pipeline ON crm_stages (pipeline_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_stages_name ON crm_stages (pipeline_id, lower(name)) WHERE is_active;

CREATE TABLE IF NOT EXISTS crm_leads (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                     VARCHAR(30)  NOT NULL DEFAULT ('L' || lpad(nextval('crm_lead_code_seq')::text, 6, '0')),
    title                    VARCHAR(255) NOT NULL,
    person_name              VARCHAR(255),
    company_name             VARCHAR(255),
    job_title                VARCHAR(100),
    email                    VARCHAR(255),
    phone                    VARCHAR(30),
    mobile                   VARCHAR(30),
    city                     VARCHAR(100),
    source_id                UUID REFERENCES crm_lead_sources(id),
    owner_id                 UUID,
    status                   VARCHAR(12)  NOT NULL DEFAULT 'new'
                             CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    status_changed_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Qualification (need, budget, timeline, decision maker).
    need                     TEXT,
    budget                   NUMERIC(18,2) CHECK (budget IS NULL OR budget >= 0),
    timeline                 VARCHAR(100),
    decision_maker           VARCHAR(255),
    expected_revenue         NUMERIC(18,2) CHECK (expected_revenue IS NULL OR expected_revenue >= 0),
    lost_reason_id           UUID REFERENCES crm_lost_reasons(id),
    lost_note                TEXT,
    converted_contact_id     UUID REFERENCES contacts(id),
    converted_opportunity_id UUID,
    converted_at             TIMESTAMPTZ,
    tags                     TEXT[]       NOT NULL DEFAULT '{}',
    notes                    TEXT,
    company_id               UUID,
    is_active                BOOLEAN      NOT NULL DEFAULT true,
    created_by               UUID,
    updated_by               UUID,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_leads_code ON crm_leads (lower(code));
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads (status) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner ON crm_leads (owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_company ON crm_leads (company_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON crm_leads (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON crm_leads (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_opportunities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(30)  NOT NULL DEFAULT ('O' || lpad(nextval('crm_opportunity_code_seq')::text, 6, '0')),
    name                VARCHAR(255) NOT NULL,
    contact_id          UUID REFERENCES contacts(id),
    person_id           UUID REFERENCES contacts(id),
    pipeline_id         UUID         NOT NULL REFERENCES crm_pipelines(id),
    stage_id            UUID         NOT NULL REFERENCES crm_stages(id),
    stage_changed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    owner_id            UUID,
    expected_revenue    NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (expected_revenue >= 0),
    currency            CHAR(3)      NOT NULL DEFAULT 'ETB' CHECK (currency ~ '^[A-Z]{3}$'),
    -- NULL = the stage's probability.
    probability         INTEGER      CHECK (probability IS NULL OR probability BETWEEN 0 AND 100),
    expected_close_date DATE,
    status              VARCHAR(6)   NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
    closed_at           TIMESTAMPTZ,
    lost_reason_id      UUID REFERENCES crm_lost_reasons(id),
    lost_note           TEXT,
    lead_id             UUID REFERENCES crm_leads(id),
    source_id           UUID REFERENCES crm_lead_sources(id),
    tags                TEXT[]       NOT NULL DEFAULT '{}',
    notes               TEXT,
    company_id          UUID,
    is_active           BOOLEAN      NOT NULL DEFAULT true,
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_opportunities_code ON crm_opportunities (lower(code));
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_board ON crm_opportunities (pipeline_id, stage_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_contact ON crm_opportunities (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_owner ON crm_opportunities (owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_close ON crm_opportunities (expected_close_date) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_company ON crm_opportunities (company_id);
ALTER TABLE crm_leads DROP CONSTRAINT IF EXISTS fk_crm_leads_opportunity;
ALTER TABLE crm_leads ADD CONSTRAINT fk_crm_leads_opportunity FOREIGN KEY (converted_opportunity_id) REFERENCES crm_opportunities(id);

CREATE TABLE IF NOT EXISTS crm_activities (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type    VARCHAR(10)  NOT NULL CHECK (activity_type IN ('call', 'meeting', 'email', 'visit', 'todo')),
    subject          VARCHAR(255) NOT NULL,
    notes            TEXT,
    due_at           TIMESTAMPTZ  NOT NULL,
    duration_minutes INTEGER      CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440),
    assigned_to      UUID         NOT NULL,
    -- What it is about: a lead, an opportunity or a contact.
    related_type     VARCHAR(12)  CHECK (related_type IS NULL OR related_type IN ('lead', 'opportunity', 'contact')),
    related_id       UUID,
    done_at          TIMESTAMPTZ,
    done_by          UUID,
    outcome          TEXT,
    company_id       UUID,
    is_active        BOOLEAN      NOT NULL DEFAULT true,
    created_by       UUID,
    updated_by       UUID,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_crm_activities_related CHECK ((related_type IS NULL) = (related_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_crm_activities_mine ON crm_activities (assigned_to, due_at) WHERE is_active AND done_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_related ON crm_activities (related_type, related_id);

-- Starting lists (rename, add or archive freely).
INSERT INTO crm_lead_sources (name, sort_order)
SELECT * FROM (VALUES ('Walk-in', 1), ('Phone call', 2), ('Website', 3), ('Referral', 4), ('Social media', 5), ('Trade fair', 6),
                      ('Campaign', 7), ('Telegram', 8), ('Other', 9)) AS t(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM crm_lead_sources);

INSERT INTO crm_lost_reasons (name, sort_order)
SELECT * FROM (VALUES ('Price too high', 1), ('Chose a competitor', 2), ('No budget', 3), ('No response', 4), ('Not a fit', 5),
                      ('Timing', 6), ('Other', 7)) AS t(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM crm_lost_reasons);

INSERT INTO crm_pipelines (name, is_default, sort_order)
SELECT 'Sales pipeline', true, 1 WHERE NOT EXISTS (SELECT 1 FROM crm_pipelines);

INSERT INTO crm_stages (pipeline_id, name, probability, rotting_days, is_won, is_lost, sort_order)
SELECT p.id, s.name, s.probability, s.rotting_days, s.is_won, s.is_lost, s.sort_order
  FROM crm_pipelines p
 CROSS JOIN (VALUES ('New', 10, 7, false, false, 1), ('Qualified', 25, 14, false, false, 2), ('Proposal', 50, 14, false, false, 3),
                    ('Negotiation', 75, 14, false, false, 4), ('Won', 100, NULL, true, false, 5), ('Lost', 0, NULL, false, true, 6))
       AS s(name, probability, rotting_days, is_won, is_lost, sort_order)
 WHERE p.is_default AND NOT EXISTS (SELECT 1 FROM crm_stages);
