# Humanitas Global Engineering & Architecture Directives

## ðŸ“ Repository Structure & Dual-Folder Separation

The workspace contains two distinct, purposefully separated folder trees:

1. **`Humanitas`** â€” **HR & PMS Management System ONLY**
   - Contains exclusively the Human Resource Management System (HRMS), Performance Management System (PMS), Attendance, Leave Management, Shifts & Scheduling, Payroll, Biometric Devices, Announcements, Events, Universal Chat/Messaging, and the **HR & PMS AI Intelligence Engine** (AI Assistant copilot, document generation, employee lifecycle analysis, and HR knowledge base).
   - Does **NOT** contain full ERP business modules (no Products, Inventory, Sales, Purchasing, POS, or Accounting).

2. **`Humanitas-ERP`** â€” **The Comprehensive ERP Platform**
   - Contains the complete enterprise ERP ecosystem: HRMS, PMS, Products & Catalog, Multi-Warehouse Inventory, Purchasing, Sales & CRM, Point of Sale (POS), Double-Entry Accounting & Financials, the **Full Enterprise AI Intelligence Suite** (cross-module business intelligence, forecasting, and ERP copilots), and Subscription Package Billing.

---

## âš™ï¸ Core Engineering Directives

### 1. PRIMARY WORKSPACE & DUAL-REPO SYNC DISCIPLINE
- **All primary development work is performed in `Humanitas-ERP`**.
- When changes touch HRMS, PMS, Attendance, Leave, Payroll, Scheduling, Chat/Messaging, or HR/PMS AI capabilities, those exact changes **MUST ALSO be mirrored and applied to the `Humanitas` repository**.
- ERP-exclusive modules (Products, Inventory, Purchasing, Sales, POS, Accounting, and full ERP-wide AI analytics) are **NEVER** copied or synced to `Humanitas`.

### 2. MANDATORY PARALLEL MOBILE DEVELOPMENT
- **Mobile application development in `humanitas_mobile` / `humanitas-ERP_mobile` MUST ALWAYS happen in parallel with the web version**.
- Mobile development is not an afterthought or a secondary phase. Every new feature, page, form, data grid, report, and action built on the web frontend must simultaneously have its corresponding mobile Flutter implementation.

### 3. ZERO-TRUST ACCESS CONTROL ON 100% OF ENDPOINTS & ACTIONS
- **NEVER leave any controller, route, mutation, query, or UI action button unprotected.**
- Every single backend endpoint MUST be guarded from day one with `@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)` and `@RequirePermissions('permission.name')`.
- Every UI view and action button MUST check `hasPermission('permission.name')` and `isModuleSubscribed('module_name')`.
- Never implement features with "temporary bypasses" or plan to add permissions later â€” always add permissions to the seeder immediately.

### 4. MANDATORY PACKAGE & SUBSCRIPTION MODULE GATING
- All modules (HRMS, PMS, Inventory, Sales, Purchasing, POS, Accounting, AI) are bound to tenant package subscriptions and tenant admin module selections.
- AI capabilities are further sub-gated by capability tier (`ai.help`, `ai.documents`, `ai.actions`, `ai.full`).
- If a tenant has not subscribed to a module or if it is disabled in their package, the backend MUST reject requests with HTTP 403 Forbidden, and the frontend MUST hide all associated routes, navigation items, and permission checkboxes.

### 5. COMPLETE ONE-PASS END-TO-END INTEGRATION (NO BACK-AND-FORTH REWORK)
- When building any module, implement the full vertical slice in a single pass:
  1. Database entities & schema migrations
  2. DTO validation & business logic services
  3. Python calculation engine integration (if math/aggregations involved)
  4. Controllers with full ModuleGuard and RBAC permissions
  5. Dynamic permission registry entries in the Access Control module
  6. Frontend responsive UI using the established Design System with data grids, forms, and permission checks
  7. Module Reporting Dashboard with charts, KPIs, and exportable reports
  8. Mobile (Flutter) implementation mirroring the web feature
  9. AI Knowledge Base registry update (document all new routes, buttons, actions, and capabilities)

### 6. DESIGN-FIRST ENTERPRISE UI/UX FIDELITY
- The Enterprise UI/UX Design System, layout shell, and navigation architecture are strictly preserved:
  - Always follow the Dynamics 365 App Launcher (9-dot switcher) & Contextual Dock navigation paradigm.
  - Every module MUST use established design tokens, layout components, data grid systems, form components, and modals.
  - Never use raw HTML or ad-hoc inline styling.
  - Keep forms clean with consistent input validation, numeric formatting, and currency symbols.

### 7. AI KNOWLEDGE SYNCHRONIZATION
- Every time a new page, route, button, action, or feature is created or modified, the AI Knowledge Base MUST be updated with:
  - Route path and module key
  - Page purpose and user workflows
  - Available actions and button locations
  - Required permissions and tier entitlements
  - Step-by-step how-to operational instructions
- The AI module must always have complete, up-to-date knowledge of every part of the system.

### 8. PYTHON CALCULATION SERVICE DELEGATION
- **ALL heavy computational math MUST be delegated to the Python service (`calculation_service` with FastAPI/Celery):**
  - FIFO / AVCO inventory costing queues and valuations
  - Double-entry accounting ledger rollups and trial balance aggregations
  - Sales, purchase, and regional tax calculation rules
  - Complex payroll salary bands, tax brackets, and pension equations
  - Project KPI scores and performance metrics
  - AI document generation (PDF/DOCX rendering)
- Never write raw financial or inventory valuation arithmetic directly inside NestJS controllers or frontend components.

### 9. SHELL & COMMAND COMPATIBILITY
- All terminal commands and scripts MUST be 100% compatible with **Windows PowerShell**.
- Do NOT use Linux/Bash-specific builtins (like `export FOO=bar`, `touch`, or raw `rm -rf` without PowerShell syntax).

### 10. MULTI-TENANCY DATA INTEGRITY
- All tenant database queries MUST run through `DatabaseService.getTenantConnection(databaseName)` or `getTenantConnectionById(tenantId)`.
- Never use raw unsanitized SQL. Always use TypeORM parameterized queries.
- Keep all schema updates tracked and managed in `TenantMigrationService`.

### 11. PER-MODULE REPORTING DASHBOARDS
- Every module MUST include a dedicated **Reports** sub-section with relevant analytics charts, KPIs, and exportable data summaries (CSV, Excel, PDF).
- Never ship a module without its reporting dashboard.

### 12. SYSTEM HEALTH & OBSERVABILITY
- Expose microservice health endpoints and failed job queues to tenant technical admins.
- Provide 1-click retry for failed calculation service tasks.
- Log all API errors, background task failures, and connection pool issues.
- Tenant Admin must have full system logs, health indicators, and alerting capabilities.

### 13. UNIMPLEMENTED FEATURE UX (COMING SOON & BLUR)
- Any module, system, or feature displayed on the UI that is not yet fully implemented **MUST display a "Coming Soon" badge with a backdrop blur overlay**.

### 14. FEATURE COMPLETION TRACKING (featureslist.md MUST ALWAYS BE UP TO DATE)
- **Every time a feature, page, endpoint, or capability is fully implemented and working**, the corresponding checkbox in `featureslist.md` MUST be marked from `- [ ]` to `- [x]` immediately.
- After marking any items, the **Progress Summary table at the top of `featureslist.md` MUST be recalculated and updated** to reflect the latest counts:
  - Total features defined
  - Total features completed (`[x]`)
  - Total features remaining (`[ ]`)
  - Completion percentage per module and overall
- The progress table uses the following format at the top of `featureslist.md`:

```
## ðŸ“Š Overall Progress

| Module | Total | âœ… Done | â³ Remaining | % Complete |
|--------|-------|---------|-------------|-----------|
| System Architecture & Core | N | N | N | N% |
| Products & Catalog | N | N | N | N% |
| Inventory & Warehouse | N | N | N | N% |
| Purchasing & Vendors | N | N | N | N% |
| Sales, CRM & E-Invoicing | N | N | N | N% |
| Point of Sale (POS) | N | N | N | N% |
| Accounting & Fixed Assets | N | N | N | N% |
| HRMS & Recruitment | N | N | N | N% |
| Project Management (PMS) | N | N | N | N% |
| Dynamic Approval Engine | N | N | N | N% |
| Webhooks & Developer API | N | N | N | N% |
| Enterprise UI/UX | N | N | N | N% |
| Billing & Subscriptions | N | N | N | N% |
| AI Intelligence Module | N | N | N | N% |
| **TOTAL** | **N** | **N** | **N** | **N%** |
```

- **Never skip this step.** A completed feature that is not marked in `featureslist.md` is considered incomplete.
- Both `Humanitas-ERP/featureslist.md` and `Humanitas/featureslist.md` must be updated simultaneously when a shared module feature is completed.

