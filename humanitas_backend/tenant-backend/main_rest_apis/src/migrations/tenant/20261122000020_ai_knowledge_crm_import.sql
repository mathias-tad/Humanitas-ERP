-- AI knowledge base (AGENTS.md rule 20): importing CRM leads and opportunities from Excel or CSV.
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'crm', 'Import Leads and Opportunities', '/crm/leads', NULL, NULL, 'web',
  'Bring leads or deals in from an Excel (.xlsx) or CSV file, up to 5000 rows at a time. Columns are matched to fields by their names (you can change the match); every row is checked first and the problems are listed by row number; then the good rows are imported. Leads with an email or phone already in the CRM are skipped as duplicates. Sources (and, for deals, customers) the file names can be created during the import. Deals find their customer by TIN, phone or name, their pipeline and stage by name; a deal in the Lost stage needs its lost reason. Each record''s history says it was imported and from which file.',
  $kb$["import_leads", "import_opportunities", "download_import_template", "check_import_file"]$kb$::jsonb,
  $kb$[{"label": "Import", "location": "Top-right of the Leads page and of the Opportunities page"}, {"label": "Download template", "location": "First step of the Import window"}]$kb$::jsonb,
  $kb$["create_crm_leads", "create_crm_opportunities"]$kb$::jsonb,
  $kb${"web": ["Go to CRM -> Leads (or Opportunities) and click Import.", "Download the template or use your own file; choose the .xlsx or .csv file.", "Check that each field shows the right column, and tick Create missing sources (and Create missing customers for deals) if you want them made.", "Click Check: fix the rows listed, or carry on without them, then click Import."], "mobile": ["Importing is done in the web app."]}$kb$::jsonb
)
ON CONFLICT (module_key, feature_name) DO UPDATE SET
  route_path = EXCLUDED.route_path, page_purpose = EXCLUDED.page_purpose, available_actions = EXCLUDED.available_actions,
  button_locations = EXCLUDED.button_locations, required_permissions = EXCLUDED.required_permissions,
  step_by_step_instructions = EXCLUDED.step_by_step_instructions, updated_at = CURRENT_TIMESTAMP;
