-- AI knowledge base (rules 20 and 24 item 27): the mobile app now has CRM (Home -> Quick Actions -> CRM).
UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'CrmScreen',
       mobile_nav_path = 'Home -> Quick Actions -> CRM -> Leads',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}',
         $kb$["In the app open Home -> Quick Actions -> CRM and the Leads tab. Use Open, New, Contacted, Qualified, Converted, Lost or All (with counts), Mine for your own, and search by title, code, person, company, phone or email; the list loads as you scroll.", "Tap New lead: what they want, the person and company, phones, email, city, source, and the qualification (need, budget, timeline, decision maker, expected revenue).", "Open a lead and use Mark Contacted / Mark Qualified as it moves, Convert to make the customer (or pick an existing contact) and the deal, or Mark as lost with the reason. A lost lead can be reopened.", "Tap Log follow-up after every call, visit or message; the Follow-ups tab shows the planned next steps and every contact, numbered."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'crm' AND feature_name = 'Leads';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'CrmScreen',
       mobile_nav_path = 'Home -> Quick Actions -> CRM -> Deals',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}',
         $kb$["In the app open Home -> Quick Actions -> CRM and the Deals tab. Each deal shows its customer, stage, close date, amount and a colour: green on track, amber needs a next step, red late. Filter Open, Won, Lost, All, Mine, Past close date, No next step or Stuck.", "Tap New deal: the name, the customer (search Contacts), the stage, expected revenue, chance and close date.", "Open a deal to see expected, chance and weighted revenue; tap a stage under Move to stage, Won when it is won, Lost with the reason, or Reopen a closed deal.", "The pipeline board with drag and drop and the forecast are on the web app."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'crm' AND feature_name = 'Opportunities and Pipeline';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'CrmScreen',
       mobile_nav_path = 'Home -> Quick Actions -> CRM -> My day',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}',
         $kb$["In the app open Home -> Quick Actions -> CRM; My day shows your activities: All open, Overdue, Today and Upcoming (with counts) and Done.", "Tap Plan for a new call, meeting, email, visit or to-do with its date and time; on a lead or deal use Plan an activity on its Follow-ups tab.", "Tap the tick on an activity to mark it done and write how it went; tap the activity to change or remove it, and the arrow to open its lead or deal."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'crm' AND feature_name = 'My Activities';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'CrmScreen',
       mobile_nav_path = 'Home -> Quick Actions -> CRM -> a lead or deal -> Log follow-up',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}',
         $kb$["Open the lead or deal in the app (Home -> Quick Actions -> CRM) and tap Log follow-up.", "Choose how (call, meeting, visit, email, Telegram, WhatsApp, SMS or note), whether we or they made contact, with whom, how many minutes, and When if it was earlier.", "Write the outcome; keep Plan the next step on to plan the next call or visit with its date, then Log it.", "The Follow-ups tab shows the planned next steps on top and every contact numbered, newest first."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'crm' AND feature_name = 'Follow-ups';
