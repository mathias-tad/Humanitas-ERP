# Humanitas Global Engineering & Architecture Directives

1. ZERO-TRUST ACCESS CONTROL ON 100% OF ENDPOINTS & ACTIONS:
   - NEVER leave any controller, route, mutation, query, or UI action button unprotected.
   - Every single backend endpoint MUST be guarded from day one with `@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)` and `@RequirePermissions('permission.name')`.
   - Every UI view and action button MUST check `hasPermission('permission.name')` and `isModuleSubscribed('module_name')`.
   - Never implement features with "temporary bypasses" or plan to add permissions later add permissions to the seeder immediately.

2. MANDATORY PACKAGE & SUBSCRIPTION MODULE GATING:
   - All modules (HRMS, PMS, Inventory, Sales, Purchasing, POS, Accounting, AI) are bound to tenant package subscriptions and tenant admin module selections.
   - AI capabilities are further sub-gated by capability tier (ai.help, ai.documents, ai.actions, ai.full).
   - If a tenant has not subscribed to a module or if it's disabled in their package, the backend MUST reject requests with HTTP 403 Forbidden, and the frontend MUST hide all associated routes, navigation items, and permission checkboxes.

3. COMPLETE ONE-PASS END-TO-END INTEGRATION (NO BACK-AND-FORTH REWORK):
   - When building any module, implement the full vertical slice in a single pass:
     * Database entities & schema migrations
     * DTO validation & business logic services
     * Python calculation engine integration (if math/aggregations involved)
     * Controllers with full ModuleGuard and RBAC permissions
     * Dynamic permission registry entries in the Access Control module
     * Frontend responsive UI using the established Design System with data grids, forms, and permission checks
     * Module Reporting Dashboard with charts, KPIs, and exportable reports
     * Mobile (Flutter) implementation mirroring the web feature
     * AI Knowledge Base registry update (document all new routes, buttons, actions, and capabilities)

4. DESIGN-FIRST DEVELOPMENT:
   - The Enterprise UI/UX Design System, layout shell, and navigation architecture are built FIRST (Phase 1) before any module work begins.
   - Every module built afterward MUST use the established design tokens, layout components, data grid system, form components, and navigation dock — no ad-hoc or one-off styling.
   - Every new page, table, form, and modal MUST use the shared design system components — never raw HTML or inline styles.

5. AI KNOWLEDGE SYNCHRONIZATION:
   - Every time a new page, route, button, action, or feature is created or modified, the AI Knowledge Base MUST be updated with: route path, page purpose, available actions, button locations, required permissions, and step-by-step how-to instructions.
   - The AI module must always have complete, up-to-date knowledge of every part of the system.

6. DUAL-REPO SYNC DISCIPLINE:
   - All development happens in `Humanitas-ERP`.
   - When changes touch HRMS, PMS, or Chat/Messaging modules, those same changes MUST also be applied to the original `Humanitas` repo.
   - ERP-only modules (Products, Inventory, Purchasing, Sales, POS, Accounting, AI) are NEVER synced to `Humanitas`.

7. PYTHON CALCULATION SERVICE DELEGATION:
   - ALL heavy financial calculations, FIFO/AVCO inventory valuations, sales/purchase tax rules, payroll band equations, and KPI scores MUST be calculated in the Python service (`calculation_service`).
   - AI document generation (PDF/DOCX) rendering MUST also be handled by the Python service.
   - Never write raw financial or inventory valuation math directly inside NestJS controllers or frontend components.

8. SHELL COMPATIBILITY:
   - All proposed terminal commands MUST be 100% compatible with Windows PowerShell.
   - Do NOT use Bash-specific builtins (like 'export FOO=bar', 'touch', or raw 'rm -rf' without PowerShell syntax).

9. MULTI-TENANCY DATA INTEGRITY:
   - All tenant queries MUST run through `DatabaseService.getTenantConnection(databaseName)` or `getTenantConnectionById(tenantId)`.
   - Never use raw unsanitized SQL. Always use TypeORM parameterized queries.
   - Keep schema updates tracked in `TenantMigrationService`.

10. ENTERPRISE UI/UX FIDELITY:
    - Always follow the Dynamics 365 App Launcher & Contextual Dock navigation paradigm established in Phase 1.
    - Keep forms clean with consistent input validation, numeric formatting, and currency symbols.
    - Every new page, table, form, and modal MUST use the shared design system components — never raw HTML or ad-hoc styles.

11. FULL MOBILE PARITY:
    - Every feature, page, report, and action built on the web frontend MUST have a corresponding mobile implementation in `humanitas_mobile` / `humanitas-ERP_mobile`.
    - Mobile builds happen alongside web builds — not as a separate phase.

12. PER-MODULE REPORTING:
    - Every module MUST include a dedicated Reports sub-section with relevant charts, KPIs, and exportable data summaries.
    - Never ship a module without its reporting dashboard.

13. SYSTEM HEALTH & DEBUGGING:
    - Expose microservice health endpoints and failed job queues to tenant technical admins.
    - Provide 1-click retry for failed calculation service tasks.
    - Log all API errors, background task failures, and connection pool issues.
    - Tenant Admin must have full system logs, health indicators, and alerting capabilities.
