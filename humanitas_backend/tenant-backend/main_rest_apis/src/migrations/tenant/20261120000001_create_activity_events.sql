-- Universal Activity Timeline (featureslist §30, AGENTS.md rule 23).
-- One immutable, time-stamped history for every business record of every module.
-- Modules only INSERT through ActivityTimelineService; rows are never updated or deleted.

CREATE TABLE IF NOT EXISTS activity_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(80)  NOT NULL,              -- e.g. 'product', 'crm_lead', 'sales_order'
    entity_id     VARCHAR(100) NOT NULL,
    event_type    VARCHAR(40)  NOT NULL,              -- created | updated | deleted | restored | stage_changed | note | interaction | activity | system
    module_key    VARCHAR(60),                        -- owning module, e.g. 'products'
    summary       TEXT,
    changes       JSONB        NOT NULL DEFAULT '[]', -- [{ "field", "label", "old", "new" }]
    payload       JSONB        NOT NULL DEFAULT '{}', -- channel, direction, duration, attachments, ...
    source        VARCHAR(20)  NOT NULL DEFAULT 'ui', -- ui | api | ai | mcp | system | import
    visibility    VARCHAR(20)  NOT NULL DEFAULT 'internal', -- internal | customer
    created_by    UUID,
    on_behalf_of  UUID,
    company_id    UUID,
    branch_id     UUID,
    occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_activity_events_event_type CHECK (event_type IN
        ('created','updated','deleted','restored','stage_changed','note','interaction','activity','system')),
    CONSTRAINT chk_activity_events_source CHECK (source IN ('ui','api','ai','mcp','system','import')),
    CONSTRAINT chk_activity_events_visibility CHECK (visibility IN ('internal','customer'))
);

CREATE INDEX IF NOT EXISTS idx_activity_events_entity
    ON activity_events (entity_type, entity_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_by ON activity_events (created_by);
CREATE INDEX IF NOT EXISTS idx_activity_events_company_id ON activity_events (company_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_branch_id ON activity_events (branch_id);

-- Company/branch inherited from the acting user (rule 16), like every operational table.
DROP TRIGGER IF EXISTS trg_comp_branch_activity_events ON activity_events;
CREATE TRIGGER trg_comp_branch_activity_events
    BEFORE INSERT ON activity_events
    FOR EACH ROW EXECUTE FUNCTION trg_set_company_branch();

-- The timeline is an audit trail: block UPDATE and DELETE.
CREATE OR REPLACE FUNCTION trg_activity_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'activity_events rows are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_events_no_update ON activity_events;
CREATE TRIGGER trg_activity_events_no_update
    BEFORE UPDATE OR DELETE ON activity_events
    FOR EACH ROW EXECUTE FUNCTION trg_activity_events_immutable();
