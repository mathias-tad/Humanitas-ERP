-- AI knowledge base (AGENTS.md rule 20): sales staff see their own CRM records unless they have view_all_crm_records.
UPDATE ai_knowledge_entries
   SET page_purpose = page_purpose || ' Without "See everyone''s leads, deals and activities" (view_all_crm_records) a person sees only the leads and deals they own or created, and the activities assigned to them, created by them or on their own leads and deals; Administrators and Managers have it by default.',
       required_permissions = required_permissions || $kb$["view_all_crm_records"]$kb$::jsonb,
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'crm' AND feature_name IN ('Leads', 'Opportunities and Pipeline', 'My Activities')
   AND NOT (required_permissions @> $kb$["view_all_crm_records"]$kb$::jsonb);
