-- Migration: 20261028000001_ai_knowledge_and_audit_schema.sql
-- Description: Creates system_audit_logs and ai_knowledge_entries tables, and seeds comprehensive knowledge entries for Web and Mobile across all common modules.

-- 1. System Audit Logs for AI and System Operations
CREATE TABLE IF NOT EXISTS system_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL,
  performed_by UUID,
  executed_by VARCHAR(50) DEFAULT 'ai_on_behalf',
  entity_type VARCHAR(100),
  entity_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_performed_by ON system_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_executed_by ON system_audit_logs(executed_by);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_created_at ON system_audit_logs(created_at);

-- 2. AI Knowledge Entries Table (Directive 20 & 21)
CREATE TABLE IF NOT EXISTS ai_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key VARCHAR(50) NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  route_path VARCHAR(255) NOT NULL,
  mobile_screen_name VARCHAR(100),
  mobile_nav_path VARCHAR(255),
  platform VARCHAR(20) DEFAULT 'both',
  page_purpose TEXT NOT NULL,
  available_actions JSONB NOT NULL DEFAULT '[]',
  button_locations JSONB NOT NULL DEFAULT '[]',
  required_permissions JSONB NOT NULL DEFAULT '[]',
  step_by_step_instructions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_ai_knowledge_module_feature UNIQUE (module_key, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_module_key ON ai_knowledge_entries(module_key);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_route_path ON ai_knowledge_entries(route_path);

-- 3. Seed Comprehensive Knowledge Base Entries for Common Modules
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform,
  page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'hrms_workforce',
  'Workforce Directory',
  '/accounts',
  'EmployeeListScreen',
  'Bottom Bar -> Profile -> Directory / Team',
  'both',
  'Manage employee accounts, view employee profiles, filter by department/position/status, add new employees, and manage roles.',
  '["add_employee", "edit_employee", "deactivate_employee", "view_profile", "reset_password", "filter_employees"]'::jsonb,
  '[{"label": "Add Employee", "location": "Top right header of the page, gold button with + icon"}, {"label": "Edit", "location": "Actions column in data table, pencil icon button"}, {"label": "Deactivate", "location": "Actions column dropdown menu"}]'::jsonb,
  '["view_users", "create_users", "edit_users", "delete_users"]'::jsonb,
  '{"web": ["Navigate to Accounts (/accounts) from the contextual dock or 9-dot launcher.", "Click the gold ''+ Add Employee'' button in the top-right corner.", "Fill in Full Name, Email, Department, Position, and assign Company and Branch.", "Click ''Save Employee'' to create the user."], "mobile": ["Open mobile app, tap Profile tab in the bottom bar.", "Select ''Employee Directory''.", "Tap the ''+'' floating action button in bottom right.", "Enter employee information and tap ''Create''."]}'::jsonb
),
(
  'attendance',
  'Attendance & Biometrics',
  '/attendance/view',
  'AttendanceScreen',
  'Bottom Bar -> Home -> Attendance widget / Clock-in button',
  'both',
  'Monitor daily clock-in/out records, verify biometric check-ins, inspect punctuality rates and late arrivals, and calculate daily overtime.',
  '["clock_in", "clock_out", "view_daily_logs", "export_attendance", "monitor_overtime", "generate_qr_clockin"]'::jsonb,
  '[{"label": "Clock In / Clock Out", "location": "Quick action banner at the top of the screen or Home dashboard"}, {"label": "Export Report", "location": "Top right of attendance table, outline button with download icon"}]'::jsonb,
  '["view_attendance", "manage_attendance"]'::jsonb,
  '{"web": ["Navigate to HRMS -> Attendance (/attendance/view).", "Use the date range picker and department filter to review attendance records.", "Click ''Export'' to download the attendance CSV report."], "mobile": ["On the Home tab, view the live Attendance card.", "Tap the large circular ''Clock In'' button with biometric/face confirmation or QR scan.", "Tap ''Clock Out'' at shift completion."]}'::jsonb
),
(
  'leave',
  'Leave Management',
  '/leave/requests',
  'LeaveRequestsScreen',
  'Bottom Bar -> Requests -> Leave tab',
  'both',
  'Submit employee leave requests, track leave balances across types (Annual, Sick, Maternity, Casual), and process managerial approvals/rejections.',
  '["submit_leave", "approve_leave", "reject_leave", "cancel_leave", "view_balances", "configure_policies"]'::jsonb,
  '[{"label": "Request Leave", "location": "Top right button above the leave table"}, {"label": "Approve", "location": "Green checkmark button on pending request rows"}, {"label": "Reject", "location": "Red cross button on pending request rows"}]'::jsonb,
  '["view_leave", "approve_leave", "manage_leave"]'::jsonb,
  '{"web": ["Go to HRMS -> Leave (/leave/requests).", "Click ''Request Leave'' button.", "Select leave type, start date, end date, and provide a reason.", "Click ''Submit Request'' for approval routing."], "mobile": ["Tap the ''Requests'' tab on the bottom bar.", "Select ''Leave'' from the top toggle.", "Tap the ''+'' FAB, select dates and type, then tap ''Submit''."]}'::jsonb
),
(
  'scheduling',
  'Roster & Shift Scheduling',
  '/scheduling',
  'RosterScreen',
  'Bottom Bar -> Home -> My Shifts / Roster card',
  'both',
  'Build and publish weekly shift rosters, manage shift patterns, allocate employees to morning/evening/night shifts, mark days off, and log approved overtime.',
  '["create_shift", "assign_shift", "publish_roster", "mark_day_off", "log_overtime", "swap_shifts"]'::jsonb,
  '[{"label": "Add Shift", "location": "Top right button in the Shift Definitions view"}, {"label": "Publish Roster", "location": "Top bar next to week date picker, primary gold button"}]'::jsonb,
  '["view_roster", "manage_roster"]'::jsonb,
  '{"web": ["Go to HRMS -> Scheduling (/scheduling).", "Select target week and department filters.", "Click on any grid cell to assign a shift or mark a day off.", "Click ''Publish Roster'' to notify scheduled employees."], "mobile": ["Tap Home tab, then tap ''My Schedule / Shifts''.", "View assigned shifts for current week or month.", "Tap a shift to view timings, location, and assigned branch."]}'::jsonb
),
(
  'payroll',
  'Automated Payroll Engine',
  '/payroll/dashboard',
  'PayrollScreen',
  'Bottom Bar -> Profile -> Payslips',
  'both',
  'Process automated monthly salaries, apply tax deductions and pension brackets via the calculation service, disburse loans, and generate bank transfer files.',
  '["run_payroll", "view_payslips", "manage_loans", "export_bank_file", "approve_payroll", "download_tax_summary"]'::jsonb,
  '[{"label": "Run Payroll", "location": "Top right of Payroll Dashboard, prominent gold button"}, {"label": "Export Bank File", "location": "Inside the completed payroll run view, ''Export ABA/ACH/CSV'' button"}, {"label": "Download Payslip", "location": "Action column on individual employee payslip row"}]'::jsonb,
  '["view_payroll", "run_payroll", "manage_payroll"]'::jsonb,
  '{"web": ["Navigate to HRMS -> Payroll (/payroll/dashboard).", "Click ''Run Payroll'', select month and year, then click ''Process''.", "Verify gross-to-net calculations, tax withholdings, and loan deductions.", "Click ''Approve & Finalize'' and download the bank transfer file."], "mobile": ["Tap Profile tab in bottom bar.", "Select ''Payslips''.", "Tap on any month to view gross pay, deductions, net salary, and tap ''Download PDF''."]}'::jsonb
),
(
  'pms_projects',
  'PMS Projects & Sprints',
  '/pms/projects',
  'ProjectListScreen',
  'Bottom Bar -> Profile -> Projects',
  'both',
  'Track strategic project milestones, sprint cycles, team members, deliverables, and project health indicators.',
  '["create_project", "create_sprint", "add_member", "archive_project", "view_burndown_chart"]'::jsonb,
  '[{"label": "Create Project", "location": "Top right of Projects page, gold button"}, {"label": "Add Sprint", "location": "Inside project detail view, Sprints tab header"}]'::jsonb,
  '["view_projects", "manage_projects"]'::jsonb,
  '{"web": ["Go to PMS -> Projects (/pms/projects).", "Click ''Create Project'', specify name, key, budget, and project lead.", "Open project detail page to add sprints and invite members."], "mobile": ["Tap Profile tab -> Projects.", "Browse assigned projects and tap to view active milestones and progress."]}'::jsonb
),
(
  'pms_tasks',
  'PMS Task Kanban & Backlog',
  '/pms/all-tasks',
  'TaskKanbanScreen',
  'Bottom Bar -> Profile -> My Tasks',
  'both',
  'Agile task tracking with Kanban columns (To Do, In Progress, In Review, Done), story points, sprint assignments, and deadline alerts.',
  '["create_task", "update_task_status", "assign_task", "submit_for_review", "log_task_time"]'::jsonb,
  '[{"label": "New Task", "location": "Top right of Kanban board or List view, gold button"}, {"label": "Drag handle", "location": "Card header to drag between status columns"}]'::jsonb,
  '["view_all_tasks", "manage_tasks", "view_my_tasks"]'::jsonb,
  '{"web": ["Go to PMS -> All Tasks (/pms/all-tasks).", "Click ''New Task'', enter title, description, assignee, priority, and due date.", "Drag task cards across Kanban columns as progress occurs."], "mobile": ["Tap Profile tab -> ''My Tasks''.", "Tap a task to view details, update status via dropdown, or add comments."]}'::jsonb
),
(
  'pms_reviews',
  '360 Performance Reviews & Goals',
  '/pms/reviews',
  'ReviewCyclesScreen',
  'Bottom Bar -> Profile -> Performance Reviews',
  'both',
  'Conduct 360-degree performance appraisal cycles, self-evaluations, manager reviews, peer feedback, competency ratings, and PIP tracking.',
  '["create_cycle", "submit_self_review", "submit_manager_review", "rate_competency", "view_review_analytics"]'::jsonb,
  '[{"label": "Create Cycle", "location": "Top right button in Review Cycles tab"}, {"label": "Start Review", "location": "Review card or row action button"}]'::jsonb,
  '["view_pms_reviews", "manage_pms_reviews"]'::jsonb,
  '{"web": ["Go to PMS -> Reviews (/pms/reviews).", "Admin clicks ''Create Cycle'' to launch a quarterly or annual review.", "Employees and managers complete rating forms and submit comments."], "mobile": ["Tap Profile tab -> Performance Reviews.", "Tap active cycle to submit self-review ratings and view manager feedback."]}'::jsonb
),
(
  'self_service',
  'Employee Self-Service Portal',
  '/self-service',
  'SelfServiceHomeScreen',
  'Bottom Bar -> Home / Profile',
  'both',
  'Personal employee hub for checking leave balances, viewing attendance history, downloading payslips, requesting bank account updates, and tracking personal tasks.',
  '["view_profile", "request_profile_change", "view_my_leave", "view_my_payslip", "view_my_attendance"]'::jsonb,
  '[{"label": "Request Profile Change", "location": "Top right of personal profile card"}, {"label": "Quick Apply", "location": "Leave summary tile button"}]'::jsonb,
  '["view_self_service"]'::jsonb,
  '{"web": ["Navigate to Self-Service (/self-service) from the left dock.", "Review your personal attendance streak, remaining leave days, and latest payslip.", "Click ''Request Profile Change'' to submit updated phone or address details."], "mobile": ["All self-service features are natively accessible from the mobile Home and Profile tabs."]}'::jsonb
),
(
  'documents',
  'Document Vault & Dynamic Letters',
  '/hrms/documents',
  'DocumentVaultScreen',
  'Bottom Bar -> Profile -> Documents',
  'both',
  'Secure document storage for contracts, KYC IDs, and certifications with expiration alerts, plus 1-click issuance of official HR letters with PDF preview.',
  '["upload_document", "verify_document", "generate_letter", "download_letter_pdf", "track_expiring_docs"]'::jsonb,
  '[{"label": "Upload Document", "location": "Top right of Document Vault table"}, {"label": "Generate Letter", "location": "Top right of Letter Templates tab, gold button"}]'::jsonb,
  '["view_documents", "manage_documents"]'::jsonb,
  '{"web": ["Go to HRMS -> Documents (/hrms/documents).", "Click ''Generate Letter'', select template (Offer, Salary Certificate, Contract), pick employee, and click ''Generate & Preview''.", "Click ''Download PDF'' to issue the official letter."], "mobile": ["Tap Profile tab -> Documents.", "Tap ''+'' to upload photo of ID or certification, view verification status."]}'::jsonb
),
(
  'onboarding',
  'Onboarding & Offboarding Lifecycle',
  '/hrms/onboarding',
  'OnboardingScreen',
  'Bottom Bar -> Profile -> Onboarding Checklist',
  'both',
  'Manage new hire task checklists, document collection, IT equipment provisioning, probation reviews, and exit interviews with asset return verification.',
  '["start_onboarding", "complete_task", "submit_exit_interview", "complete_probation_review"]'::jsonb,
  '[{"label": "Start Onboarding", "location": "Top right of Onboarding dashboard"}, {"label": "Complete Task", "location": "Checkbox next to each checklist item"}]'::jsonb,
  '["view_onboarding", "manage_onboarding"]'::jsonb,
  '{"web": ["Go to HRMS -> Onboarding (/hrms/onboarding).", "Click ''Start Onboarding'', select the newly created employee and template.", "Track task progress across HR, IT, and Manager checklist groups."], "mobile": ["New employees tap Profile -> Onboarding to complete their assigned checklist tasks."]}'::jsonb
),
(
  'recruitment',
  'Recruitment & ATS',
  '/hrms/recruitment',
  'RecruitmentJobsScreen',
  'Bottom Bar -> Menu -> Recruitment & ATS',
  'both',
  'Publish job postings, track candidates across pipeline stages (Applied, Screening, Interview, Offer, Hired), schedule interviews, and view funnel analytics.',
  '["create_job", "add_candidate", "move_pipeline_stage", "schedule_interview", "generate_offer"]'::jsonb,
  '[{"label": "Post New Job", "location": "Top right of Jobs tab, gold button"}, {"label": "Add Candidate", "location": "Top right of Candidates tab"}]'::jsonb,
  '["view_recruitment", "manage_recruitment"]'::jsonb,
  '{"web": ["Go to HRMS -> Recruitment (/hrms/recruitment).", "Click ''Post New Job'' to open a vacancy.", "Open the Candidate Pipeline tab to drag candidate cards across recruitment stages."], "mobile": ["Open Menu -> Recruitment & ATS.", "Browse jobs, inspect candidate resumes, and update hiring stage."]}'::jsonb
),
(
  'approvals',
  'Dynamic Approval Engine',
  '/approvals',
  'ApprovalCenterScreen',
  'Bottom Bar -> Requests -> Approvals tab',
  'both',
  'Centralized multi-tiered approval center for leave requests, expenses, loan applications, purchase requisitions, and document signing.',
  '["approve_request", "reject_request", "view_audit_trail", "configure_approval_rules"]'::jsonb,
  '[{"label": "Approve", "location": "Green button on request card or detail modal"}, {"label": "Reject", "location": "Red outline button next to Approve"}]'::jsonb,
  '["view_approvals", "manage_approvals"]'::jsonb,
  '{"web": ["Navigate to Approvals (/approvals) from the top dock or notification badge.", "Filter by type (Leave, Expense, Loan, Purchase).", "Click ''Approve'' or ''Reject'' with optional review comments."], "mobile": ["Tap Requests tab -> Approvals.", "Review pending request summary and tap 1-click ''Approve'' or ''Reject''."]}'::jsonb
),
(
  'devices',
  'Biometric Hardware & ADMS',
  '/devices',
  'BiometricDevicesScreen',
  'Bottom Bar -> Profile -> Admin -> Devices',
  'both',
  'Configure ZKTeco and IP biometric attendance terminals, monitor online/offline heartbeat, push employee biometric credentials, and trigger manual log sync.',
  '["add_device", "sync_attendance_logs", "push_users_to_device", "reboot_device", "ping_device"]'::jsonb,
  '[{"label": "Add Device", "location": "Top right of Devices page, gold button"}, {"label": "Sync Logs", "location": "Action button on individual device row"}]'::jsonb,
  '["view_devices", "manage_devices"]'::jsonb,
  '{"web": ["Go to HRMS -> Devices (/devices).", "Click ''Add Device'', specify Device Name, Serial Number, IP Address, Port, and assign Company/Branch.", "Click ''Sync Logs'' to pull latest biometric check-ins into attendance tables."], "mobile": ["Admins navigate to Profile -> Devices to monitor terminal online health status."]}'::jsonb
),
(
  'grievances',
  'Grievance & Whistleblower Hub',
  '/hrms/grievances',
  'GrievancesScreen',
  'Bottom Bar -> Requests -> Grievances',
  'both',
  'Secure, confidential channel for employees to file grievances or whistleblower complaints with optional anonymity and SLA resolution tracking.',
  '["file_grievance", "investigate_grievance", "update_grievance_status", "close_case"]'::jsonb,
  '[{"label": "File Grievance", "location": "Top right gold button on Grievances page"}]'::jsonb,
  '["view_grievances", "manage_grievances"]'::jsonb,
  '{"web": ["Navigate to HRMS -> Grievances (/hrms/grievances).", "Click ''File Grievance'', toggle ''File Anonymously'' if desired, enter details, and submit.", "Assigned HR officers review case notes, record findings, and close the issue."], "mobile": ["Tap Requests -> Grievances -> ''+'' to submit a confidential incident report."]}'::jsonb
),
(
  'benefits',
  'Benefits & Insurance Hub',
  '/hrms/benefits',
  'BenefitsScreen',
  'Bottom Bar -> Profile -> My Benefits',
  'both',
  'Manage health insurance policies, retirement plans, wellness allowances, employee enrollments, coverage tiers, and payroll benefit deductions.',
  '["create_plan", "enroll_employee", "view_my_coverage", "manage_deductions"]'::jsonb,
  '[{"label": "Add Plan", "location": "Top right of Benefit Plans tab"}, {"label": "Enroll", "location": "Action button on employee enrollment row"}]'::jsonb,
  '["view_benefits", "manage_benefits"]'::jsonb,
  '{"web": ["Navigate to HRMS -> Benefits (/hrms/benefits).", "Create medical or life insurance plans with company vs employee contribution ratios.", "Enroll employees into their chosen plan."], "mobile": ["Tap Profile -> My Benefits to view active coverage cards and claim procedures."]}'::jsonb
),
(
  'training',
  'Training & LMS Engine',
  '/hrms/training',
  'TrainingScreen',
  'Bottom Bar -> Profile -> Training',
  'both',
  'Employee learning management system with course catalogs, compliance training modules, enrollment tracking, certificate issuance, and skill matrices.',
  '["create_course", "enroll_employees", "mark_course_complete", "issue_certificate"]'::jsonb,
  '[{"label": "Create Course", "location": "Top right of Courses tab"}, {"label": "Enroll Now", "location": "Course card action button"}]'::jsonb,
  '["view_training", "manage_training"]'::jsonb,
  '{"web": ["Go to HRMS -> Training (/hrms/training).", "Click ''Create Course'', define lessons, quiz criteria, and passing score.", "Enroll individual employees or entire departments."], "mobile": ["Tap Profile -> Training to view assigned courses and track completion %."]}'::jsonb
),
(
  'expenses',
  'Expense Management',
  '/hrms/expenses',
  'ExpensesScreen',
  'Bottom Bar -> Requests -> Expenses',
  'both',
  'Submit business expense claims with receipt upload, multi-currency support, tax calculation, and approval routing to payroll reimbursement.',
  '["submit_expense", "approve_expense", "reject_expense", "export_expense_report"]'::jsonb,
  '[{"label": "New Expense Claim", "location": "Top right of Expense Claims page"}, {"label": "Upload Receipt", "location": "File drop zone in expense claim dialog"}]'::jsonb,
  '["view_expenses", "manage_expenses"]'::jsonb,
  '{"web": ["Go to HRMS -> Expenses (/hrms/expenses).", "Click ''New Expense Claim'', enter category, amount, currency, and attach receipt.", "Submit for manager approval."], "mobile": ["Tap Requests -> Expenses -> ''+'', snap a receipt photo, enter amount, and submit."]}'::jsonb
),
(
  'assets',
  'Asset & Equipment Tracking',
  '/hrms/assets',
  'AssetsScreen',
  'Bottom Bar -> Profile -> My Assets',
  'both',
  'Inventory and custody tracking of company hardware, laptops, monitors, SIM cards, and vehicles assigned to employees, with warranty and maintenance logs.',
  '["add_asset", "assign_asset", "return_asset", "log_maintenance", "retire_asset"]'::jsonb,
  '[{"label": "Add Asset", "location": "Top right of Asset Inventory table"}, {"label": "Assign", "location": "Action button on asset row"}]'::jsonb,
  '["view_assets", "manage_assets"]'::jsonb,
  '{"web": ["Go to HRMS -> Assets (/hrms/assets).", "Click ''Add Asset'', specify serial number, purchase cost, asset tag, and category.", "Click ''Assign'' to hand over custody to an active employee."], "mobile": ["Tap Profile -> My Assets to inspect custody tags and report hardware faults."]}'::jsonb
),
(
  'surveys',
  'Pulse Surveys & Engagement (eNPS)',
  '/hrms/surveys',
  'SurveysScreen',
  'Bottom Bar -> Home -> Active Surveys card',
  'both',
  'Launch anonymous employee pulse surveys, calculate Employee Net Promoter Score (eNPS), analyze sentiment across departments, and track engagement trends.',
  '["create_survey", "submit_survey_response", "view_survey_analytics", "close_survey"]'::jsonb,
  '[{"label": "Create Survey", "location": "Top right of Surveys page"}, {"label": "Take Survey", "location": "Action button on active survey tile"}]'::jsonb,
  '["view_surveys", "manage_surveys"]'::jsonb,
  '{"web": ["Go to HRMS -> Surveys (/hrms/surveys).", "Click ''Create Survey'', select question templates or add custom rating/text questions.", "Publish to target departments and view real-time eNPS score cards."], "mobile": ["Tap Home -> Active Survey card to answer questions and submit anonymously."]}'::jsonb
),
(
  'import_export',
  'Bulk Data Import/Export',
  '/settings/import-export',
  'ImportExportScreen',
  'Bottom Bar -> Profile -> Admin -> Import/Export',
  'both',
  'Bulk import/export employees, attendance logs, payroll components, and PMS tasks via CSV/Excel templates with validation pre-checks.',
  '["download_template", "upload_csv_import", "run_bulk_export", "view_job_history"]'::jsonb,
  '[{"label": "Import Data", "location": "Primary gold button in Import tab"}, {"label": "Export Data", "location": "Primary button in Export tab"}]'::jsonb,
  '["manage_import_export"]'::jsonb,
  '{"web": ["Go to Settings -> Import/Export (/settings/import-export).", "Download sample CSV template for target entity (e.g. Users, Attendance).", "Upload populated file and review validation errors before committing."], "mobile": ["Admin users tap Profile -> Admin -> Import/Export to inspect background job progress."]}'::jsonb
),
(
  'notifications',
  'Notification Engine & Preferences',
  '/settings/notifications',
  'NotificationPreferencesScreen',
  'Bottom Bar -> Profile -> Settings -> Notification Preferences',
  'both',
  'Configure granular notification channels (In-App, Email, Push) across personal, approval, and administrative alert categories.',
  '["update_channel_preference", "test_notification_dispatch", "mark_all_read"]'::jsonb,
  '[{"label": "Save Preferences", "location": "Sticky footer or auto-saved toggles"}, {"label": "Mark all as read", "location": "Top right of Notification Bell popup"}]'::jsonb,
  '["view_notifications", "manage_notifications"]'::jsonb,
  '{"web": ["Go to Settings -> Notifications (/settings/notifications).", "Toggle channel switches (In-App, Email, Push) per category.", "Preferences apply instantaneously across all user sessions."], "mobile": ["Tap Profile -> Settings -> Notification Preferences to toggle push alerts."]}'::jsonb
),
(
  'developer_api',
  'Developer API & Webhooks',
  '/settings/developer-api',
  'DeveloperApiScreen',
  'Bottom Bar -> Profile -> Admin -> Developer API',
  'both',
  'Manage enterprise API keys (shown once upon creation) and configure HMAC-SHA256 authenticated webhook subscriptions with delivery retries.',
  '["generate_api_key", "revoke_api_key", "create_webhook", "test_webhook_ping", "retry_failed_delivery"]'::jsonb,
  '[{"label": "Generate Key", "location": "Top right of API Keys tab"}, {"label": "Create Webhook", "location": "Top right of Webhooks tab"}]'::jsonb,
  '["view_developer_api", "manage_developer_api"]'::jsonb,
  '{"web": ["Go to Settings -> Developer API (/settings/developer-api).", "Click ''Generate Key'', label it, copy secret token immediately.", "Switch to Webhooks tab to register endpoints for system events."], "mobile": ["Admins navigate to Profile -> Admin -> Developer API to manage tokens and webhooks."]}'::jsonb
),
(
  'organization',
  'Multi-Company & Multi-Branch Structure',
  '/settings/organization',
  'OrganizationSettingsScreen',
  'Bottom Bar -> Home -> Company/Branch Switcher dialog',
  'both',
  'Manage corporate subsidiaries, branch locations, operating currencies, and assign users to company/branch isolation units.',
  '["create_company", "create_branch", "switch_active_scope", "assign_user_unit"]'::jsonb,
  '[{"label": "Add Company", "location": "Top right of Companies tab"}, {"label": "Add Branch", "location": "Top right of Branches tab"}]'::jsonb,
  '["view_companies", "manage_companies", "view_branches", "manage_branches"]'::jsonb,
  '{"web": ["Go to Settings -> Organization (/settings/organization).", "Add legal entities and operational branches.", "Use the Top Header switcher to change active scope and instantly refresh cached views."], "mobile": ["Tap the Company/Branch dropdown in the Home screen AppBar to switch branch context."]}'::jsonb
),
(
  'access_control',
  'RBAC Matrix & Permissions',
  '/accesscontrol',
  'AccessControlScreen',
  'Bottom Bar -> Profile -> Admin -> Access Control',
  'both',
  'Granular enterprise role creation, permission assignment across modules, and AI capability tier gating (use_ai, ai_help, ai_actions, ai_documents).',
  '["create_role", "edit_role_permissions", "assign_role_to_user", "clone_role"]'::jsonb,
  '[{"label": "New Role", "location": "Top right of Roles list"}, {"label": "Save Permissions", "location": "Bottom right of permissions matrix"}]'::jsonb,
  '["view_roles", "edit_roles"]'::jsonb,
  '{"web": ["Go to Settings -> Access Control (/accesscontrol).", "Select a role or click ''New Role''.", "Check or uncheck granular module permissions and click ''Save Changes''."], "mobile": ["Admins view roles and user permission assignments under Profile -> Admin -> Access Control."]}'::jsonb
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
