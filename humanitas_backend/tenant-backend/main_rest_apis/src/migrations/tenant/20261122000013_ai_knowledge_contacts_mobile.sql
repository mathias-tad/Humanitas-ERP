-- AI knowledge base (rules 20 and 24 item 27): the mobile app now has Contacts.
UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'ContactsScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Contacts',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}',
         $kb$["In the app open Home -> Quick Actions -> Contacts. Use All, Customers or Vendors and search by name, code, TIN, phone, email or a person's name; the list loads as you scroll.", "Tap New contact (or New customer on the Customers tab), choose Company or Person, enter the name, TIN, phones and address; contacts with the same TIN, phone or email are shown so you can open them instead.", "Open a contact for its details, the People at a company (Add a person) and the History. Tap Log call / note to record a call, meeting, email, visit or note, and with which person.", "The customer's price list is set in the web app."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'contacts' AND feature_name IN ('Contacts', 'Customers');
