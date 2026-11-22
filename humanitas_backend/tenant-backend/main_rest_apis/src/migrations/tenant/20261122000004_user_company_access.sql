-- Allowed companies and branches per user (AGENTS.md rule 16). A user works in the companies
-- listed here (one marked default); in each, in all branches or only the listed ones.
-- view_all_companies / view_all_branches still mean every company / branch.
CREATE TABLE IF NOT EXISTS user_company_access (
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    all_branches BOOLEAN     NOT NULL DEFAULT true,
    branch_ids   UUID[]      NOT NULL DEFAULT '{}',
    is_default   BOOLEAN     NOT NULL DEFAULT false,
    created_by   UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, company_id),
    CONSTRAINT chk_user_company_access_branches CHECK (all_branches OR cardinality(branch_ids) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_company_access_default ON user_company_access (user_id) WHERE is_default;
CREATE INDEX IF NOT EXISTS idx_user_company_access_company ON user_company_access (company_id);

-- Existing users keep exactly the access they had: their company, and their branch if they had one.
INSERT INTO user_company_access (user_id, company_id, all_branches, branch_ids, is_default)
SELECT u.id, u.company_id,
       u.branch_id IS NULL OR NOT EXISTS (SELECT 1 FROM branches b WHERE b.id = u.branch_id AND b.company_id = u.company_id),
       CASE WHEN u.branch_id IS NOT NULL AND EXISTS (SELECT 1 FROM branches b WHERE b.id = u.branch_id AND b.company_id = u.company_id)
            THEN ARRAY[u.branch_id] ELSE '{}'::uuid[] END,
       true
  FROM users u
  JOIN companies c ON c.id = u.company_id
 WHERE NOT EXISTS (SELECT 1 FROM user_company_access a WHERE a.user_id = u.id)
ON CONFLICT DO NOTHING;
