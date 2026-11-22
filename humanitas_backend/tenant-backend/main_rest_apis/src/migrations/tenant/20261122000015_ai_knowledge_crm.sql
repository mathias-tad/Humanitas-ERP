-- AI knowledge base (AGENTS.md rule 20): CRM core (featureslist §4.1, CRM 1.1, 1.2, 1.4, 1.5).
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'crm', 'Leads', '/crm/leads', NULL, NULL, 'web',
  'Possible customers before they are qualified: title, person and company, phone, email, city, source (walk-in, phone call, website, referral, Telegram…), owner, and qualification (need, budget, timeline, decision maker, expected revenue). Status: New, Contacted, Qualified, then Converted or Lost (with a lost reason). Converting creates a customer contact (the company with the person under it, or the person) or uses an existing contact, and an opportunity in the pipeline; open activities move to the opportunity. Every change and the time in each status is on the history.',
  $kb$["create_lead", "assign_lead", "qualify_lead", "change_lead_status", "convert_lead", "mark_lead_lost", "archive_lead", "restore_lead", "export_leads"]$kb$::jsonb,
  $kb$[{"label": "New lead", "location": "Top-right of the Leads page (create_crm_leads)"}, {"label": "Status tabs", "location": "Above the list: Open, New, Contacted, Qualified, Converted, Lost"}, {"label": "Convert", "location": "Lead drawer (edit_crm_leads)"}, {"label": "Mark as lost", "location": "Lead drawer, with the reason (edit_crm_leads)"}, {"label": "Export CSV", "location": "Top-right (export_crm_leads)"}]$kb$::jsonb,
  $kb$["view_crm_leads", "create_crm_leads", "edit_crm_leads", "delete_crm_leads", "restore_crm_leads", "export_crm_leads"]$kb$::jsonb,
  $kb${"web": ["Go to CRM -> Leads (/crm/leads) and click New lead: the title (what they want), the person and company, phone or email, the source and the owner.", "After the first call set the status to Contacted; fill need, budget, timeline and decision maker, and set Qualified.", "Click Convert: choose an existing contact or let it create the customer, and keep Create opportunity on to put the deal in the pipeline.", "If it goes nowhere, click Mark as lost and pick the reason."], "mobile": ["The CRM screens in the app come with the next app update; use the web app until then."]}$kb$::jsonb
),
(
  'crm', 'Opportunities and Pipeline', '/crm/opportunities', NULL, NULL, 'web',
  'Deals on a pipeline board (Kanban): each stage has a default win probability and a number of days after which a deal shows as stuck. A deal has a customer (contact) and contact person, owner, expected revenue, probability (its own or the stage''s), expected close date, source and notes. Drag a deal to move it; the Won stage wins it; Mark as lost asks for the reason; a closed deal can be reopened. Column totals show revenue and weighted revenue; the Forecast shows weighted revenue by expected close month, deals past their close date and stuck deals. Every stage move is on the history with the days spent in the stage.',
  $kb$["create_opportunity", "move_opportunity_stage", "mark_opportunity_won", "mark_opportunity_lost", "reopen_opportunity", "view_pipeline_board", "view_sales_forecast", "archive_opportunity", "restore_opportunity", "export_opportunities"]$kb$::jsonb,
  $kb$[{"label": "Board / List / Forecast", "location": "Tabs at the top of the Opportunities page"}, {"label": "New opportunity", "location": "Top-right (create_crm_opportunities)"}, {"label": "Pipeline", "location": "Picker above the board"}, {"label": "Won / Lost / Reopen", "location": "Deal drawer (edit_crm_opportunities)"}, {"label": "Export CSV", "location": "List tab (export_crm_opportunities)"}]$kb$::jsonb,
  $kb$["view_crm_opportunities", "create_crm_opportunities", "edit_crm_opportunities", "delete_crm_opportunities", "restore_crm_opportunities", "export_crm_opportunities"]$kb$::jsonb,
  $kb${"web": ["Go to CRM -> Opportunities (/crm/opportunities). The Board shows the pipeline; pick another pipeline above it.", "Click New opportunity: name, customer, expected revenue and close date.", "Drag a card to the next stage as the deal moves; drop it on Won when it is won, or open it and click Mark as lost with the reason.", "Use the Forecast tab for weighted revenue by month, deals past their close date and stuck deals."], "mobile": ["The CRM screens in the app come with the next app update; use the web app until then."]}$kb$::jsonb
),
(
  'crm', 'My Activities', '/crm/activities', NULL, NULL, 'web',
  'Planned calls, meetings, emails, visits and to-dos with a due date and time, for yourself or a colleague, about a lead, a deal or a contact. My activities shows Overdue, Today and Upcoming in your time zone. Marking one done with the outcome logs it on the lead, deal or contact history.',
  $kb$["plan_activity", "assign_activity", "complete_activity", "view_overdue_activities", "delete_activity"]$kb$::jsonb,
  $kb$[{"label": "New activity", "location": "Top-right of My Activities, and on each lead, deal and contact (create_crm_activities)"}, {"label": "Overdue / Today / Upcoming / Done", "location": "Tabs on My Activities"}, {"label": "Done", "location": "Check box on each activity (edit_crm_activities)"}]$kb$::jsonb,
  $kb$["view_crm_activities", "create_crm_activities", "edit_crm_activities", "delete_crm_activities"]$kb$::jsonb,
  $kb${"web": ["Go to CRM -> My Activities (/crm/activities) to see what is overdue, due today and coming up.", "Plan an activity from a lead or deal (Next activity) or with New activity: the type, subject, date and time and who does it.", "When it is done, tick it and write the outcome; it goes on the lead or deal history."], "mobile": ["The CRM screens in the app come with the next app update; use the web app until then."]}$kb$::jsonb
),
(
  'crm', 'CRM Set-up', '/crm/setup', NULL, NULL, 'web',
  'Pipelines and their stages (name, order, win probability, days before a deal is stuck, won and lost stages), one default pipeline per company, lead sources and lost reasons. A stage with open deals, the default pipeline and the last won or lost stage of a pipeline cannot be archived.',
  $kb$["create_pipeline", "edit_pipeline_stages", "reorder_stages", "manage_lead_sources", "manage_lost_reasons"]$kb$::jsonb,
  $kb$[{"label": "Pipelines", "location": "First tab of CRM Set-up (create/edit/delete_crm_setup)"}, {"label": "Lead sources / Lost reasons", "location": "Tabs of CRM Set-up"}]$kb$::jsonb,
  $kb$["view_crm_setup", "create_crm_setup", "edit_crm_setup", "delete_crm_setup"]$kb$::jsonb,
  $kb${"web": ["Go to CRM -> Set-up (/crm/setup).", "Add a pipeline (it starts with New, Qualified, Proposal, Negotiation, Won and Lost), rename stages, set their probability and stuck days, and drag them into order.", "Add the lead sources and lost reasons your team uses."], "mobile": ["CRM set-up is done in the web app."]}$kb$::jsonb
)
ON CONFLICT (module_key, feature_name) DO UPDATE SET
  route_path = EXCLUDED.route_path, mobile_screen_name = EXCLUDED.mobile_screen_name, mobile_nav_path = EXCLUDED.mobile_nav_path,
  platform = EXCLUDED.platform, page_purpose = EXCLUDED.page_purpose, available_actions = EXCLUDED.available_actions,
  button_locations = EXCLUDED.button_locations, required_permissions = EXCLUDED.required_permissions,
  step_by_step_instructions = EXCLUDED.step_by_step_instructions, updated_at = CURRENT_TIMESTAMP;
