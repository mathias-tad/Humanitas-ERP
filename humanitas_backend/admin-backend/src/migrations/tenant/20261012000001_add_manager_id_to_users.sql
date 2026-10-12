-- ============================================================
-- Migration: Add manager_id reporting hierarchy to users
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);
