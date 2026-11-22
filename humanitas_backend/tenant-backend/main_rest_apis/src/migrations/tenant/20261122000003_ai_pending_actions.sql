-- AI actions (AGENTS.md rule 29): changes the AI assistant proposes wait here until the user
-- confirms them in their next message; then they run once, exactly as shown to the user.
CREATE TABLE IF NOT EXISTS ai_pending_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL,
    conversation_id TEXT         NOT NULL,
    action          VARCHAR(300) NOT NULL,
    url             TEXT         NOT NULL,
    body            JSONB,
    summary         TEXT         NOT NULL,
    status          VARCHAR(12)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'cancelled', 'running', 'done', 'failed')),
    result          TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    decided_at      TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_open ON ai_pending_actions (user_id, conversation_id) WHERE status IN ('pending', 'approved');

-- Assistant knowledge entry (rule 20).
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'ai',
  'AI assistant actions and documents',
  '/ai',
  'AiChatScreen',
  'Home -> AI assistant',
  'both',
  'The AI assistant can do for you anything you can do in the app yourself: look things up, create, change, approve or archive records in any module you have access to (for example "create a product called Teff 1 kg at 120 birr" or "approve Abebe''s leave"). It works through the app with your own permissions, so it can never do more than you; companies, approvals and history apply as if you had clicked the button, and history shows the change was made by the AI for you. Every change is shown to you first and only happens after you reply "yes" (reply "no" to cancel; a proposal expires after 15 minutes). Generated documents (PDF, Word, Excel) only use data you are allowed to see. Requires the AI Actions plan for changes and the use_ai permission.',
  $kb$["ask_ai_to_do_something", "confirm_ai_change", "cancel_ai_change", "generate_document_from_app_data"]$kb$::jsonb,
  $kb$[{"label": "AI assistant", "location": "Assistant button at the bottom-right of every page (web) or Home -> AI assistant (mobile)"}, {"label": "Confirm", "location": "Reply yes in the chat after the assistant describes the change"}, {"label": "Cancel", "location": "Reply no in the chat"}]$kb$::jsonb,
  $kb$["use_ai"]$kb$::jsonb,
  $kb${"web": ["Open the AI assistant and say what you want done, with the details you know (names, amounts, dates).", "The assistant finds the right action and tells you exactly what it will change. Nothing changes yet.", "Reply yes to carry it out, or no to cancel. It reports the result and you can open the record to check.", "To make a document, ask for it (e.g. a PDF of this month's leave requests); it only includes data you can see."], "mobile": ["Open Home -> AI assistant and type or say what you want done.", "Read the change the assistant proposes, then reply yes to carry it out or no to cancel."]}$kb$::jsonb
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
