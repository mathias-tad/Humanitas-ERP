-- ============================================================
-- Migration 20260804000001: Telegram Messaging & Schema Updates
-- ============================================================

-- 1. Upgrade conversations table for Channels and Groups
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_type_check;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS only_admins_can_post BOOLEAN DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS invite_link VARCHAR(255);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Upgrade messages table for Editing and Forwarding
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- 3. Attendance records shift_id column
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL;
