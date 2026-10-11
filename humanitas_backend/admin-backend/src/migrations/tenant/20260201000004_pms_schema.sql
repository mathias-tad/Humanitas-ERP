-- ============================================================
-- Migration 004: PMS (Project Management System)
-- Tables: pms_projects, pms_sprints, pms_tasks,
--         pms_project_members, pms_teams, pms_team_members,
--         pms_project_teams, pms_task_comments,
--         pms_task_attachments, pms_task_time_logs,
--         pms_task_dependencies, pms_task_activity_logs,
--         pms_settings, pms_manual_kpi_metrics,
--         pms_manual_kpi_scores, audit_logs
-- ============================================================

-- PMS ENUM types (idempotent via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_projects_status_enum') THEN
    CREATE TYPE pms_projects_status_enum AS ENUM('Planning','Active','On Hold','Completed','Archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_projects_priority_enum') THEN
    CREATE TYPE pms_projects_priority_enum AS ENUM('Low','Medium','High','Critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_sprints_status_enum') THEN
    CREATE TYPE pms_sprints_status_enum AS ENUM('Planned','Active','Completed','Cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_tasks_status_enum') THEN
    CREATE TYPE pms_tasks_status_enum AS ENUM('Backlog','To Do','In Progress','In Review','Blocked','Done');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_tasks_priority_enum') THEN
    CREATE TYPE pms_tasks_priority_enum AS ENUM('Low','Medium','High','Critical');
  END IF;
END $$;

-- Teams
CREATE TABLE IF NOT EXISTS pms_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Members
CREATE TABLE IF NOT EXISTS pms_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES pms_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, user_id)
);

-- Projects
CREATE TABLE IF NOT EXISTS pms_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status pms_projects_status_enum DEFAULT 'Planning',
  priority pms_projects_priority_enum DEFAULT 'Medium',
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  budget DECIMAL(15, 2),
  actual_cost DECIMAL(15, 2),
  currency VARCHAR(3) DEFAULT 'ETB',
  manager_id UUID REFERENCES users(id),
  created_by UUID NOT NULL,
  team_id UUID REFERENCES pms_teams(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sprints
CREATE TABLE IF NOT EXISTS pms_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES pms_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  goal TEXT,
  status pms_sprints_status_enum DEFAULT 'Planned',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks
CREATE TABLE IF NOT EXISTS pms_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES pms_projects(id) ON DELETE CASCADE,
  sprint_id UUID REFERENCES pms_sprints(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES pms_tasks(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status pms_tasks_status_enum DEFAULT 'Backlog',
  priority pms_tasks_priority_enum DEFAULT 'Medium',
  assignee_id UUID REFERENCES users(id),
  reporter_id UUID REFERENCES users(id),
  reviewer_id UUID REFERENCES users(id),
  team_id UUID REFERENCES pms_teams(id),
  status_changed_at TIMESTAMP,
  status_changed_by UUID,
  previous_status VARCHAR,
  return_comment TEXT,
  blocker_category VARCHAR(50),
  estimated_hours DECIMAL(5, 2),
  actual_hours DECIMAL(5, 2) DEFAULT 0,
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  due_date DATE,
  start_date DATE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pms_tasks_project ON pms_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_pms_tasks_assignee ON pms_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_pms_tasks_status ON pms_tasks(status);

-- Project Members
CREATE TABLE IF NOT EXISTS pms_project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES pms_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  can_create_tasks BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

-- Project Teams (junction)
CREATE TABLE IF NOT EXISTS pms_project_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES pms_projects(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES pms_teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, team_id)
);

-- Task Comments
CREATE TABLE IF NOT EXISTS pms_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES pms_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Attachments
CREATE TABLE IF NOT EXISTS pms_task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES pms_tasks(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size INT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Time Logs
CREATE TABLE IF NOT EXISTS pms_task_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES pms_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hours DECIMAL(10, 2) NOT NULL,
  description TEXT,
  log_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Dependencies
CREATE TABLE IF NOT EXISTS pms_task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES pms_tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES pms_tasks(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) DEFAULT 'finish_to_start',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, depends_on_id)
);

-- Task Activity Logs
CREATE TABLE IF NOT EXISTS pms_task_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES pms_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR NOT NULL,
  from_value VARCHAR,
  to_value VARCHAR,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PMS Settings (one row per tenant)
CREATE TABLE IF NOT EXISTS pms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  default_task_priority VARCHAR(20) DEFAULT 'Medium',
  enable_time_tracking BOOLEAN DEFAULT true,
  enable_story_points BOOLEAN DEFAULT true,
  enable_budget_tracking BOOLEAN DEFAULT false,
  enable_hr_integration BOOLEAN DEFAULT true,
  enable_payroll_integration BOOLEAN DEFAULT false,
  default_task_time_estimate DECIMAL(5, 2) DEFAULT 8.0,
  kpi_include_completion_rate BOOLEAN DEFAULT true,
  kpi_include_on_time_rate BOOLEAN DEFAULT true,
  kpi_include_avg_duration BOOLEAN DEFAULT true,
  kpi_include_overdue_count BOOLEAN DEFAULT true,
  kpi_weight_system INT DEFAULT 50,
  kpi_weight_manual INT DEFAULT 50,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manual KPI Metrics
CREATE TABLE IF NOT EXISTS pms_manual_kpi_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  max_score DECIMAL(5, 2) DEFAULT 10,
  weight DECIMAL(5, 2) DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manual KPI Scores
CREATE TABLE IF NOT EXISTS pms_manual_kpi_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  metric_id UUID NOT NULL REFERENCES pms_manual_kpi_metrics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score DECIMAL(5, 2) NOT NULL,
  period_start DATE,
  period_end DATE,
  notes TEXT,
  scored_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_id VARCHAR(100),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
