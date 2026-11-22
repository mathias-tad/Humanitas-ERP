-- AI knowledge base (AGENTS.md rule 20): contacts, customers and contact categories (featureslist §4.1, CRM 1.3).
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'contacts',
  'Contacts',
  '/contacts',
  NULL,
  NULL,
  'web',
  'One list of companies and people for every module (open when the company has CRM, Sales, POS, Accounting, Purchasing, the online store or Delivery), so a company is never entered twice. A contact is a company or a person; a person can belong to a company (with a job title, and one person is the company''s primary contact). Roles say what the contact is to you: Customer (price list, credit limit, payment terms, account manager) and/or Vendor (used by Purchasing). Each contact has a code (C000001…), legal name, Ethiopian TIN (10 digits) and VAT number for MoR e-invoicing, phones, email, address (region, city, sub-city, woreda, street), category, tags and notes. While a contact is entered, contacts with the same TIN, phone (09…, +251…) or email are shown; a second contact with the same TIN needs "save anyway". The History tab shows every change and every call, meeting, email, visit and note. Contacts are archived, not deleted. The list loads as you scroll and exports to CSV.',
  $kb$["create_company_contact", "create_person_contact", "add_person_to_company", "set_primary_contact", "mark_as_customer", "mark_as_vendor", "edit_contact", "log_contact_call", "log_contact_meeting", "log_contact_note", "archive_contact", "restore_contact", "export_contacts", "search_contacts"]$kb$::jsonb,
  $kb$[{"label": "New contact", "location": "Top-right of the Contacts page (create_contacts)"}, {"label": "Export CSV", "location": "Top-right (export_contacts)"}, {"label": "All / Customers / Vendors", "location": "Tabs above the list"}, {"label": "Contact", "location": "Click a row: Details, People (companies) and History tabs (edit_contacts to change)"}, {"label": "Add person", "location": "People tab of a company"}, {"label": "Log a call / meeting / note", "location": "History tab (edit_contacts)"}, {"label": "Archive / Restore", "location": "Bottom of the contact drawer (delete_contacts / restore_contacts)"}]$kb$::jsonb,
  $kb$["view_contacts", "create_contacts", "edit_contacts", "delete_contacts", "restore_contacts", "export_contacts"]$kb$::jsonb,
  $kb${"web": ["Go to Contacts (/contacts) from the Sales, POS, Accounting or Purchasing menu.", "Click New contact and choose Company or Person. For a company enter the name, the TIN (10 digits) and VAT number for invoicing, and tick Customer and/or Vendor. If a contact with the same TIN, phone or email exists it is shown: open it instead of creating a second one.", "Add the people who work there (the first one is the primary contact), or later open the company and use the People tab.", "Open a contact and use the History tab to log a call, meeting, email, visit or note; pick which of the company's people it was with.", "Use Export CSV for a spreadsheet of the contacts in the current filter."], "mobile": ["Contacts are managed in the web app for now; the mobile Contacts screen comes in the next app update."]}$kb$::jsonb
),
(
  'contacts',
  'Customers',
  '/customers',
  NULL,
  NULL,
  'web',
  'The contacts marked as Customer: the companies and people you sell to, with their price list (their own, else their category''s, else the default list), credit limit, payment terms and account manager. The same records as Contacts, filtered; a new contact created here is a customer.',
  $kb$["create_customer", "edit_customer", "search_customers"]$kb$::jsonb,
  $kb$[{"label": "New customer", "location": "Top-right of the Customers page (create_contacts)"}, {"label": "Customer", "location": "Click a row to open it"}]$kb$::jsonb,
  $kb$["view_contacts", "create_contacts", "edit_contacts"]$kb$::jsonb,
  $kb${"web": ["Go to Customers (/customers) from the Sales, POS or Accounting menu.", "Click New customer: it is a contact with the Customer role ticked. Set the price list, credit limit and payment terms on the Details tab."], "mobile": ["Customers are managed in the web app for now; the mobile Contacts screen comes in the next app update."]}$kb$::jsonb
),
(
  'contacts',
  'Contact Categories',
  '/contacts/categories',
  NULL,
  NULL,
  'web',
  'Groups of contacts such as Retail, Wholesale, Corporate and Government, with a color and an optional price list that customers in the category get unless they have their own. A category with active contacts cannot be archived until they are moved.',
  $kb$["create_contact_category", "edit_contact_category", "archive_contact_category"]$kb$::jsonb,
  $kb$[{"label": "New category", "location": "Top-right of the Contact Categories page (create_contact_categories)"}, {"label": "Edit / Archive", "location": "Row buttons (edit_contact_categories / delete_contact_categories)"}]$kb$::jsonb,
  $kb$["view_contact_categories", "create_contact_categories", "edit_contact_categories", "delete_contact_categories"]$kb$::jsonb,
  $kb${"web": ["Go to Contacts -> Contact Categories (/contacts/categories).", "Click New category, enter the name, pick a color and, if its customers have their own prices, a price list.", "Set the category on each contact in the contact form."], "mobile": ["Contact categories are managed in the web app."]}$kb$::jsonb
)
ON CONFLICT (module_key, feature_name) DO UPDATE SET
  route_path = EXCLUDED.route_path,
  mobile_screen_name = EXCLUDED.mobile_screen_name,
  mobile_nav_path = EXCLUDED.mobile_nav_path,
  platform = EXCLUDED.platform,
  page_purpose = EXCLUDED.page_purpose,
  available_actions = EXCLUDED.available_actions,
  button_locations = EXCLUDED.button_locations,
  required_permissions = EXCLUDED.required_permissions,
  step_by_step_instructions = EXCLUDED.step_by_step_instructions,
  updated_at = CURRENT_TIMESTAMP;
