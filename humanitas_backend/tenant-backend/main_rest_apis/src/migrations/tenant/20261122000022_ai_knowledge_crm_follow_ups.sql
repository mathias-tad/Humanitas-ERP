-- AI knowledge base (AGENTS.md rule 20): logging CRM follow-ups.
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'crm', 'Follow-ups', '/crm/leads', NULL, NULL, 'web',
  'Every contact with a lead or deal that already happened: by call, meeting, visit, email, Telegram, WhatsApp or SMS (or a note), whether we contacted them or they contacted us, when (now or backdated up to a year), how long, with whom and the outcome. Contacts are numbered (1st, 2nd, 3rd contact). The next step can be planned in the same form. The Follow-ups tab lists them with the next step on top; the Leads and Opportunities lists show the last contact. A follow-up on a deal also goes on the customer''s history. Ticking a planned call, meeting, email or visit done counts as a contact too.',
  $kb$["log_follow_up", "plan_next_step", "view_follow_ups", "see_last_contact"]$kb$::jsonb,
  $kb$[{"label": "Log follow-up", "location": "Top of the lead or deal drawer, and its Follow-ups tab"}, {"label": "Last contact", "location": "Column in the Leads and Opportunities lists"}]$kb$::jsonb,
  $kb$["edit_crm_leads", "edit_crm_opportunities", "view_crm_leads", "view_crm_opportunities"]$kb$::jsonb,
  $kb${"web": ["Open the lead or deal and click Log follow-up.", "Choose how (call, meeting, visit, email, Telegram, WhatsApp, SMS or note), whether we or they made contact, and when if it was earlier.", "Write the outcome, and optionally plan the next step with its date and time, then Save.", "The Follow-ups tab shows every contact numbered, newest first, with the next step on top."], "mobile": ["Follow-ups come with the CRM screens in the next app update; use the web app until then."]}$kb$::jsonb
)
ON CONFLICT (module_key, feature_name) DO UPDATE SET
  route_path = EXCLUDED.route_path, page_purpose = EXCLUDED.page_purpose, available_actions = EXCLUDED.available_actions,
  button_locations = EXCLUDED.button_locations, required_permissions = EXCLUDED.required_permissions,
  step_by_step_instructions = EXCLUDED.step_by_step_instructions, updated_at = CURRENT_TIMESTAMP;
