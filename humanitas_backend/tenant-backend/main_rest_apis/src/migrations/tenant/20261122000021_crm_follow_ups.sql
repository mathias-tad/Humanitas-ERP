-- CRM follow-ups (featureslist §30, §4.1 1.5): leads and deals remember their last contact and how many
-- contacts there have been. The contacts themselves are activity_events (event_type 'interaction').
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS last_contact_channel VARCHAR(20);
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS contact_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS last_contact_channel VARCHAR(20);
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS contact_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_crm_leads_last_contact ON crm_leads (last_contact_at);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_last_contact ON crm_opportunities (last_contact_at);

-- Calls, meetings, emails and visits already ticked done count as contacts.
UPDATE crm_leads l SET contact_count = x.n, last_contact_at = x.last_at, last_contact_channel = x.channel
  FROM (SELECT a.related_id, count(*)::int AS n, max(a.done_at) AS last_at,
               (array_agg(a.activity_type ORDER BY a.done_at DESC))[1] AS channel
          FROM crm_activities a
         WHERE a.related_type = 'lead' AND a.done_at IS NOT NULL AND a.activity_type <> 'todo' AND a.is_active
         GROUP BY a.related_id) x
 WHERE l.id = x.related_id AND l.contact_count = 0;
UPDATE crm_opportunities o SET contact_count = x.n, last_contact_at = x.last_at, last_contact_channel = x.channel
  FROM (SELECT a.related_id, count(*)::int AS n, max(a.done_at) AS last_at,
               (array_agg(a.activity_type ORDER BY a.done_at DESC))[1] AS channel
          FROM crm_activities a
         WHERE a.related_type = 'opportunity' AND a.done_at IS NOT NULL AND a.activity_type <> 'todo' AND a.is_active
         GROUP BY a.related_id) x
 WHERE o.id = x.related_id AND o.contact_count = 0;
