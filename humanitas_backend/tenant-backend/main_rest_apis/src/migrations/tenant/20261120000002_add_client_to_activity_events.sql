-- Activity timeline: which client produced the event (featureslist §30).
-- web = browser (desktop or phone, see client_device) · mobile_app = Humanitas Android/iOS app
-- desktop_app = native desktop app · api = API key / integration · mcp = external AI through MCP
-- system = scheduled jobs and internal processes · unknown = not identifiable (older clients)

ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS client_platform VARCHAR(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS client_device   VARCHAR(10);
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS client_info     JSONB NOT NULL DEFAULT '{}';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_activity_events_client_platform') THEN
        ALTER TABLE activity_events ADD CONSTRAINT chk_activity_events_client_platform
            CHECK (client_platform IN ('web','mobile_app','desktop_app','api','mcp','system','unknown'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_activity_events_client_device') THEN
        ALTER TABLE activity_events ADD CONSTRAINT chk_activity_events_client_device
            CHECK (client_device IS NULL OR client_device IN ('desktop','phone','tablet'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_events_client_platform ON activity_events (client_platform);
