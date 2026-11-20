# 🌟 Humanitas Enterprise ERP — Master Feature & Capability Specification

This document provides a comprehensive, enterprise-grade feature checklist for the **Humanitas Modular Cloud ERP Platform**, designed to rival top-tier global enterprise systems like **Microsoft Dynamics 365, SAP S/4HANA, NetSuite, and Odoo**.

---

> Last updated: 2026-11-20 · Progress counts below are generated from the checkboxes in this file.


## 📊 Overall Progress

| Module | Total | ✅ Done | ⏳ Remaining | % Complete |
|--------|-------|---------|-------------|-----------|
| 0. System Architecture & Core | 73 | 73 | 0 | 100% |
| 1. Products & Catalog Management | 35 | 0 | 35 | 0% |
| 2. Inventory & Warehouse Management | 41 | 0 | 41 | 0% |
| 3. Purchasing & Vendor Management | 39 | 0 | 39 | 0% |
| 4. Enterprise Sales, Quotations & E-Invoicing | 44 | 0 | 44 | 0% |
| 4.1. World-Class Enterprise CRM & Customer Lifecycle Suite | 65 | 0 | 65 | 0% |
| 5. Point of Sale (POS) | 45 | 0 | 45 | 0% |
| 6. Double-Entry Accounting, Financials & Fixed Assets | 61 | 1 | 60 | 2% |
| 7. Decoupled Human Resource Management & Recruitment (HRMS) | 64 | 64 | 0 | 100% |
| 8. Decoupled Project Management System (PMS) | 28 | 28 | 0 | 100% |
| 9. Dynamic Approval Workflow Engine | 12 | 12 | 0 | 100% |
| 10. Webhooks & Developer API Portal | 16 | 16 | 0 | 100% |
| 11. Modern Enterprise UI / UX Architecture | 30 | 30 | 0 | 100% |
| 12. Self-Service Subscription, Billing & Landing Page | 21 | 0 | 21 | 0% |
| 13. AI Intelligence Module | 51 | 51 | 0 | 100% |
| 14. Employee Self-Service Portal | 21 | 21 | 0 | 100% |
| 15. Employee Document Vault & Letter Templates | 19 | 19 | 0 | 100% |
| 16. Onboarding & Offboarding Workflows | 22 | 22 | 0 | 100% |
| 17. Employee Grievance & Complaint System | 17 | 17 | 0 | 100% |
| 18. Benefits & Insurance Management | 17 | 17 | 0 | 100% |
| 19. Training & Learning Management (LMS) | 22 | 22 | 0 | 100% |
| 20. 360 Performance Reviews & Feedback | 27 | 27 | 0 | 100% |
| 21. Expense Management | 19 | 19 | 0 | 100% |
| 22. Employee Asset & Equipment Tracking | 19 | 19 | 0 | 100% |
| 23. Employee Pulse Surveys & Engagement | 19 | 19 | 0 | 100% |
| 24. Bulk Import/Export Engine | 13 | 13 | 0 | 100% |
| 25. Notification Engine — Email, In-App & Push | 39 | 39 | 0 | 100% |
| 26. Multi-Language (i18n) & Localization Support | 16 | 0 | 16 | 0% |
| 28. Modular Packaging, Licensing & Deployment | 23 | 0 | 23 | 0% |
| 29. In-Context Action Framework | 14 | 0 | 14 | 0% |
| 30. Universal Activity Timeline & Interaction Log | 10 | 0 | 10 | 0% |
| 31. Unified Communications — Voice & Video Calls in Chat | 13 | 0 | 13 | 0% |
| 32. VoIP, Cloud PBX & AI Contact Center | 21 | 0 | 21 | 0% |
| 33. MCP & Open AI Connectivity | 10 | 0 | 10 | 0% |
| 34. Online Store & Omnichannel Ordering | 7 | 0 | 7 | 0% |
| 35. Delivery & Last-Mile Logistics | 6 | 0 | 6 | 0% |
| 36. Fleet Management & GPS Telematics | 10 | 0 | 10 | 0% |
| 37. Quality Guardrails & Regression Prevention | 17 | 0 | 17 | 0% |
| 38. Manufacturing (MRP), Quality & Plant Maintenance | 52 | 0 | 52 | 0% |
| **TOTAL** | **1078** | **529** | **549** | **49%** |

---

## 🧭 Part A — Product Vision (Enhanced Brief)

**Mission.** Build the most usable modular business platform for growing companies in Ethiopia, East Africa and beyond:
- every module can be bought on its own or together, as SaaS or installed on the customer's own server;
- it is AI-native, and any AI can connect to it through MCP;
- communications are built in — chat, voice and video calls, VoIP, an AI contact center — and every module can use them;
- users finish any related task without leaving the page they are on.

**Who it is for.** SMEs to enterprises, manufacturers and industrial-park plants, retail and restaurants (POS), distributors and wholesalers, phone- and call-center-driven sellers, field sales teams, logistics and fleet operators, multi-company groups.

**Product principles (apply to every module):**
1. **Sell à la carte, run anywhere** — one, two or many modules; multi-tenant SaaS, dedicated cloud or customer-owned on-prem from one codebase (§28).
2. **Never leave the page** — permission-aware quick-create, side drawers, smart buttons and inline actions everywhere (§29).
3. **Everything is logged** — a time-stamped timeline on every record with each interaction, recording, transcript and status change (§30).
4. **Communications are a platform service** — chat, calls, meetings, VoIP, SMS, WhatsApp and email, usable from any module (§31, §32).
5. **AI everywhere, safely** — built-in AI plus any external AI through MCP, always within the user's permissions and fully audited (§13, §33).
6. **Local first** — Ethio Telecom, Safaricom, telebirr, M-Pesa, ETB, Ethiopian tax rules, local languages and calendar, low-bandwidth and offline operation.
7. **Web + mobile parity**, and per-module reports (Directives 11–12).
8. **Quality bar** — every past issue is now an automated guardrail (§37).

**Benchmark.** The `tewosERP` folder is Odoo 19.0 Community, reviewed from source.
- **Adopted from Odoo:**
  - auto-installing bridge modules between apps;
  - quick-create, "create and edit" and "search more" inside every relation field, gated by create rights;
  - a chatter with tracked changes, activities and activity plans;
  - calls in Discuss with SFU, guests, screen share and camera toggling.
- **Where we go further:**
  - VoIP and AI as standard modules (Enterprise-only in Odoo);
  - GPS telematics (Odoo Fleet has none);
  - an MCP server, so customers can use any AI;
  - interaction timelines with recordings and AI transcripts;
  - local telecom and payment integrations;
  - signed on-prem module licensing.

**Use this brief when starting any new module:**

```text
Build the <MODULE> module for Humanitas-ERP as an independent, separately sellable module.
- Manifest: declare hard dependencies only; put every integration with other modules in auto-activated bridge modules (§28).
- In-context UX: register quick-create and drawer forms so any module can create/open these records without leaving its page, gated by subscription + permission (§29).
- Timeline: emit time-stamped events for every create, change, stage move and interaction (§30).
- Communications: expose call/video/SMS/WhatsApp/email actions on records through the shared communications services (§31, §32).
- AI: register tools once in the shared registry so they appear in the built-in AI, the MCP server and the REST API, within the user's permissions (§33).
- Deliver the full vertical slice: migrations, services, RBAC, subscription gate, web + mobile UI, reports, tests, Knowledge Base entries (Directives 1–12, §37 Definition of Done).
- Must work standalone, together with other modules, in SaaS and on-prem.
```

---

## 🧱 Part B — How the Modules Fit Together

- **Base modules** (Products, Inventory, Sales, POS, CRM, VoIP, Fleet, …) never import each other's code or tables.
- **Bridge modules** hold the cross-module logic and switch on automatically when every module they connect is active. For example, `pos_sales` turns on with POS + Sales, and `crm_voip` with CRM + VoIP.
- **Shared platform services** are available to every module: the timeline (§30), communications (§31–32), the quick-create/drawer framework (§29), approvals, notifications, and the AI/MCP tool registry (§33).
- **Events and contracts** connect modules asynchronously, so a module can be removed, sold alone or deployed on-prem without breaking the others (§28).

---


## 0. 🏗️ System Architecture & Core

- [x] **Role-Restricted Direct Chat & AI Triage Access Grants**:
  - [x] Admin role restrictions configured per role (`hr_manager`, `admin`, `general_manager`, `ceo`, `legal_counsel`) with custom AI triage guidance prompts.
  - [x] Employee direct chat interception modal with instant "Ask AI Assistant" triage button.
  - [x] Permission requests workflow with user-defined urgency/reason and pending state tracking.
  - [x] Requested person timed (1h, 24h, 7d, 30d) or permanent (indefinite) access grants, or decline with note.
  - [x] User self-override toggle allowing restricted users to expose themselves for direct messages from all employees.
  - [x] Proactive specific employee whitelisting with timed or permanent duration and 1-click revocation across web and mobile.
  - [x] Peer restricted user bypass: restricted users can communicate directly with each other without triage or access grant barriers.
- [x] **Multi-Tenancy Foundation**:
  - [x] Isolated per-tenant PostgreSQL database provisioning via `TenantMigrationService`.
  - [x] Tenant-scoped query routing through `DatabaseService.getTenantConnection(databaseName)`.
- [x] **Multi-Company & Multi-Branch Organization Hierarchy** (`Tenant → Company → Branch → Department`):
  - [x] `companies` and `branches` master tables with idempotent schema creation and default seeding.
  - [x] 10 CRUD REST endpoints for Companies and Branches (`GET`, `POST`, `PUT`, `DELETE`) with full RBAC guards (`view_companies`, `manage_companies`, `view_all_companies`, `view_branches`, `manage_branches`, `view_all_branches`).
  - [x] `company_id` and `branch_id` columns added to **all 40+ operational tables** (users, departments, positions, attendance, leave, payroll, PMS, shifts, schedules, devices, announcements, events, and all ERP tables).
  - [x] PL/pgSQL trigger `trg_set_company_branch` auto-inherits `company_id`/`branch_id` from the record's owning user on `BEFORE INSERT`, with fallback to default company/branch.
  - [x] Performance indexes `idx_<table>_company_id` and `idx_<table>_branch_id` on every operational table.
  - [x] **Tenant Migration**: `20261022000001_add_company_branch_to_all_operational_tables.sql` registered and auto-applied on startup.
- [x] **Company & Branch Context Switcher (Web)**:
  - [x] `CompanyBranchSwitcher` header component with dropdown switcher for users with `view_all_companies` / `view_all_branches` permissions.
  - [x] Locked badge (`Assigned Unit 🔒`) for single-entity users automatically scoped to their assigned company/branch.
  - [x] Integrated into `EnterpriseTopHeader.tsx` (Humanitas-ERP) and inline top-bar (Humanitas).
  - [x] Multi-select dropdown switcher supporting simultaneous selection of multiple companies and branches.
  - [x] Multi-scope summaries & metric aggregation across selected companies/branches on dashboards and listings.
- [x] **Company & Branch Context Switcher (Mobile — Flutter)**:
  - [x] `CompanyBranchSwitcher` widget with bottom sheets integrated into HomeScreen AppBar.
  - [x] `OrganizationRepository`, `CompanyModel`, `BranchModel`, and `organization_provider` (Riverpod).
- [x] **Organization Settings UI**:
  - [x] Full CRUD management screen (`OrganizationSettings.tsx`) with tabbed Companies and Branches panels and modal dialogs.
  - [x] `UserModal.tsx` Company and Branch select dropdowns dynamically bound to user creation/edit forms.
- [x] **Automated Tests**: 12/12 backend unit tests passing (`settings.companies.spec.ts`) + 4/4 Flutter widget tests passing + `tsc -b` = 0 errors in both repos.
- [x] **Active Scope Persistence & Cache Management**:
  - [x] Active company/branch scope persisted in `localStorage` with immediate invalidation on scope switch.
  - [x] TanStack Query global 1-minute refresh interval configured via centralized `queryClient` (staleTime/gcTime).
  - [x] `x-company-id` and `x-branch-id` scope headers automatically injected into all API calls via shared Axios interceptor.
  - [x] Immediate `queryClient.invalidateQueries()` triggered on every company/branch context switch to force fresh scoped data.

---

- [x] **Modular Independence & Zero-Coupling Architecture (Directive 22)**:
  - [x] Operational modules (HRMS, PMS/Tasks) architected with zero hard cross-module dependencies, capable of executing standalone or concurrently.
  - [x] Platform common core modules (Common Settings, Accounts, Organization, Announcements, Events, Approvals, Digital Signatures, Chat, Access Control, Logs) auto-injected into all tenant registrations via `COMMON_PLATFORM_MODULES`.
  - [x] Universal Common Settings (`/settings`) decoupled from HR-specific Settings (`/hr/settings`).
  - [x] Dynamic contextual filtering in Approval Rules workflow builder, Access Control permission matrices, and navigation docks based on subscribed modules.
- [x] **Role-Based & Module-Adaptive Dashboards & Universal Reporting**:
  - [x] Role-adaptive landing dashboard (`Home.tsx`) dynamically presenting executive KPI metrics and employee self-service cards gated by active subscriptions (`hasHR`, `hasPMS`).
  - [x] Dedicated Module Reporting Dashboards with unified `ReportExportMenu` supporting CSV, Excel XML, printable PDF summary, and structured JSON across all HR and PMS reporting sections.
- [x] **Universal Cross-Module Calendar Engine (`/calendar` & Mobile `CalendarScreen`)**:
  - [x] Tenant-wide calendar aggregator dynamically collecting events from all subscribed modules (`custom`, `announcements`, `company_events`, `holidays`, `leave`, `shifts`, `payroll`, `pms_tasks`, `milestones`, `crm_meetings`, `sales`, `purchasing`, `accounting_tax`).
  - [x] Full CRUD operations for custom organizational calendar events with multi-company & branch scoping.
  - [x] Frontend `UnifiedCalendar.tsx` with Month, Week, and Agenda views, category filtering (`All Modules`, `HR & Workforce`, `Projects & PMS`, `Commercial ERP`, `Financial & Tax`, `General & Org`), keyword search, and standard `.ics` iCal export.
  - [x] Mobile Flutter `CalendarScreen` with reactive month navigation, interactive day event inspection sheets, category filtering, and 100% test coverage.
- [x] **Enterprise WorkForce Schedule & Attendance Experience (Amazon A to Z Schedule UX)**:
  - [x] Web Schedule & Punch Hub (`/attendance/schedule` / `/attendance/my-schedule` / `MySchedule.tsx`) featuring Amazon A to Z visual calendar grid.
  - [x] Status-coded cell decorations: Punches (Solid Blue `#1D70B8`), Attention/Missed Punches (Solid Red `#DC2626`), Scheduled Shifts (Light blue with 45-degree diagonal hatch/stripes), Payday indicator dot (`•`), and Selected Day golden amber ring border (`#D97706`).
  - [x] Selected day Punch Times accordion card with vertical timeline (`In` / `Out` nodes, duration calculations, and punch edit actions).
  - [x] 0-punch empty state with clock illustration graphic with horizontal speed lines and shift details.
  - [x] "Missed a punch?" correction modal with punch type toggle (In/Out), requested time picker, justification text, and backend correction request integration.
  - [x] Mobile Flutter `SchedulingScreen` with complete WorkForce experience: `My Schedule`, `Timecard`, `Find Shifts`, and `VTO >` tabs, custom `DiagonalStripePainter`, `ClockIllustration`, and automated widget test coverage.
- [x] **Floor Supervisor & Admin Attendance Command Center & Absence Alert Engine**:
  - [x] Web Command Center (`/attendance/view` / `Attendance.tsx` Attendance tab) with Date Mode toggle (Single Day vs. Range/Pay Period with Today, Yesterday, This Week, This Month presets), Department and Branch filters.
  - [x] Floor presence quick chips (`All Records`, `On Floor / Punched In`, `Late Today`, `Absent`, `Excused`).
  - [x] Multi-row selection checkboxes with sticky batch actions bar (Bulk Mark Present, Bulk Mark Absent, Bulk Mark Excused with remarks dialog).
  - [x] Real CSV export of filtered records with timecard metrics.
  - [x] Consecutive & monthly unauthorized absence threshold alert engine with configurable notifications for Employee, Supervisor, and HR Admins (`absence_threshold_alert`).
- [x] **Universal User Position & Authority Delegation Engine ("On Behalf Of")**:
  - [x] `user_delegations` & `delegation_audit_logs` schema tables with tenant, company, branch scoping.
  - [x] REST endpoints (`POST /delegations`, `GET /delegations/my`, `GET /delegations/active`, `GET /delegations/all`, `PUT /delegations/:id/revoke`, `GET /delegations/audit`).
  - [x] Dynamic `PermissionsGuard` integration granting delegator permissions to delegatee with `req.on_behalf_of` context during active windows.
  - [x] Frontend `useDelegations` hook, persistent `DelegationBanner`, and `DelegationModal` (granting, tracking, and audit trail).
  - [x] Parallel Flutter mobile implementation (`DelegationsScreen`, `DelegationBannerWidget`, repository, providers) with 100% test pass rate.
  - [x] Universal Common Module Exemption (Directive 22): delegations registered in core platform modules.
  - [x] HRMS Subscription Bridge for Acting Assignments: position cover with custom acting titles and automatic synchronization with `acting_assignments`.
  - [x] Acting Allowance Financial Compensation: percentage of covered basic salary (e.g. 15%) or fixed monthly amount.
  - [x] Payroll Proration Engine: `getActingAllowancesForPeriod` calculating active day overlap and automatic payslip earnings items.
  - [x] Cross-Platform UI: live allowance preview in `DelegationModal`, acting badge on `DelegationBanner`, and Flutter mobile screen/banner.

---

## 1. 📦 Products & Catalog Management (`/products`)

- [ ] **Product Master Data**:
  - [ ] Standard goods, services, digital items, and composite/bundled kit items.
  - [ ] Multi-level Product Categories with nested tree structures.
  - [ ] Product Attributes & Dynamic Variant Matrix generator (e.g., Size, Color, Style, Material).
  - [ ] SKU & Barcode management with unique constraint validation.
- [ ] **QR & Barcode Automation Engine**:
  - [ ] Automated cryptographic QR code generation with tamper-proof validation.
  - [ ] Standard Barcode generation (Code-128, EAN-13, UPC).
  - [ ] Printable QR/Barcode label templates (customizable label size, price tag, SKU, and barcode sticker printing).
  - [ ] Mobile & Web camera scanner integration for rapid product lookups.
- [ ] **Units of Measure (UOM) Engine**:
  - [ ] Multi-UOM support with defined conversion factors (e.g., 1 Box = 24 Pieces, 1 Pallet = 50 Boxes).
  - [ ] Separate UOM assignment for Purchasing, Sales, and Inventory stocking.
- [ ] **Multi-Tier Price Lists**:
  - [ ] Retail, Wholesale, Distributor, and VIP pricing tiers.
  - [ ] Customer-specific pricing rules and minimum order quantity (MOQ) breaks.
  - [ ] Multi-currency price list bindings with automated exchange rate conversion.
- [ ] **Media & Specifications**:
  - [ ] Multi-image gallery with primary thumbnail selection.
  - [ ] Downloadable technical datasheets, user manuals, and warranty documentation attachments.
- [ ] **Product Reports**:
  - [ ] Product catalog summary (total products, variants, categories, active vs. archived).
  - [ ] Price list comparison report across tiers.
  - [ ] Low-stock products report (linked to Inventory module when subscribed).
  - [ ] QR/Barcode generation audit log.
- [ ] **Odoo-Parity & In-Context Additions**:
  - [ ] Quick-create a product from POS, Sales, Purchasing, Inventory and Online Store lines (name, price, tax, UOM, barcode scan) when the user has `products.create` (§29).
  - [ ] Product types: storable, consumable, service, combo (POS menus), kit/bundle (BoM-ready for future manufacturing).
  - [ ] Packaging levels with their own barcodes (unit, box, pallet) and GS1 barcode nomenclature support.
  - [ ] Attribute values created on the fly; per-variant price extras; archive unused variants.
  - [ ] Vendor price list per product (vendor, price, MOQ, lead time) used by Purchasing replenishment.
  - [ ] Variant grid entry on sales/purchase lines (enter quantities per size × color in one matrix).
  - [ ] Default shelf life and expiry rules feeding Inventory lots.
  - [ ] AI helpers: description and SEO text generation, auto-categorization, image background cleanup.
  - [ ] Product timeline (§30): price changes, cost changes and who made them.

---

## 2. 🏭 Inventory & Warehouse Management (`/inventory`)

- [ ] **Multi-Warehouse & Location Hierarchy**:
  - [ ] Unlimited warehouses with hierarchical internal storage locations (Warehouse -> Zone -> Aisle -> Rack -> Bin).
  - [ ] Virtual transit locations for inter-warehouse transfers.
  - [ ] Scrap and adjustment staging locations.
- [ ] **Real-Time Stock Tracking & Movements**:
  - [ ] Real-time Stock Quant tracking per SKU, Warehouse, and Bin.
  - [ ] Movement ledger recording Inbound, Outbound, Internal Transfer, and Scrapped quantities with timestamp & operator ID.
  - [ ] Low-stock threshold alerts and automated Reorder Point (ROP) suggestions.
- [ ] **Advanced Valuation & Costing (via Python Engine)**:
  - [ ] **FIFO (First-In, First-Out)** costing queue layer calculation.
  - [ ] **AVCO (Weighted Average Cost)** real-time recalculation upon Goods Receipt Notes (GRN).
  - [ ] Standard Costing with variance reporting against actual purchase prices.
- [ ] **Batch, Lot & Expiration Date Management**:
  - [ ] Batch/Lot number assignment during receiving.
  - [ ] Expiration date tracking with automated FEFO (First-Expired-First-Out) picking logic.
  - [ ] Quarantine & recall management for expired or compromised lots.
- [ ] **Serial Number Tracking**:
  - [ ] Unique serial number logging on receipt and dispatch for high-value/warranty items.
  - [ ] Full cradle-to-grave serial history lookup.
- [ ] **Stocktaking & Physical Inventory Audits**:
  - [ ] Cycle counting and annual physical stocktake sessions.
  - [ ] Blind counts vs. system expected counts.
  - [ ] Variance discrepancy reports with multi-level approval workflows for stock adjustments.
- [ ] **Inter-Warehouse Transfers**:
  - [ ] Transfer requisition, pick/pack dispatch, in-transit tracking, and QR scan receiving at the destination warehouse.
- [ ] **Inventory Reports**:
  - [ ] Real-time stock levels by warehouse, location, and product.
  - [ ] Stock valuation report (FIFO layers / AVCO unit costs).
  - [ ] Stock movement history report with date-range filtering.
  - [ ] Batch/Lot expiration forecast report.
  - [ ] Slow-moving and dead-stock analysis.
  - [ ] Stocktake variance and adjustment audit report.
- [ ] **Odoo-Parity & In-Context Additions**:
  - [ ] Routes and rules: 1/2/3-step receipts and deliveries, make-to-order, min/max replenishment, dropship, consignment stock.
  - [ ] Putaway rules and removal strategies (FIFO, FEFO, LIFO, closest location); packages and pallets; batch and wave picking.
  - [ ] Forecast view per product: on hand, reserved, incoming, outgoing, forecast date.
  - [ ] Mobile barcode app for receiving, picking, packing, counting and transfers (camera or rugged scanner).
  - [ ] In-context stock popover on Sales/POS/Online Store lines (per warehouse, forecast, alternatives).
  - [ ] Quick stock adjustment from the product drawer, permission-gated and logged on the timeline.
  - [ ] Replenishment report with one-click RFQ creation.
  - [ ] Scales and RFID readers through a local device bridge (IoT).

---

## 3. 🛒 Purchasing & Vendor Management (`/purchasing`)

- [ ] **Vendor Directory & Portal**:
  - [ ] Vendor profiles, tax registration numbers, payment terms, contact directories, and bank accounts.
  - [ ] Vendor performance scorecard (on-time delivery rate, price competitiveness, quality pass rate).
- [ ] **Purchase Requisitions (PR)**:
  - [ ] Internal employee/department purchase requests.
  - [ ] Budget verification against department allocations.
  - [ ] Multi-level approval hierarchy (Department Manager -> Procurement -> Finance).
- [ ] **Request for Quotation (RFQ)**:
  - [ ] Send RFQs to multiple vendors simultaneously via email.
  - [ ] Side-by-side vendor quotation comparison matrix for bid selection.
- [ ] **Purchase Orders (PO)**:
  - [ ] 1-Click generation from approved PRs or winning RFQs.
  - [ ] Multi-currency POs with fixed exchange rates.
  - [ ] Automated purchase order PDF generation and status lifecycle (`Draft` -> `Sent` -> `Confirmed` -> `Received` -> `Billed` -> `Closed`).
- [ ] **Goods Receipt Notes (GRN)**:
  - [ ] Warehouse receipt recording with barcode/QR verification.
  - [ ] Partial receipt support with back-order tracking.
  - [ ] Quality inspection check before stock is moved to available inventory.
- [ ] **Vendor Bills & Automated 3-Way Matching**:
  - [ ] **3-Way Matching Engine**: Validates quantities and prices across `PO` == `GRN` == `Vendor Bill`.
  - [ ] Price variance tolerance flags and invoice approval workflows.
- [ ] **Landed Cost Distribution**:
  - [ ] Add shipping freight, customs duties, and insurance to purchase receipts.
  - [ ] Pro-rata landed cost allocation by item value, weight, or volume to update real inventory cost.
- [ ] **Debit Notes & Purchase Returns**:
  - [ ] RMA and return workflows with auto-generation of Debit Notes against vendor credit.
- [ ] **Purchasing Reports**:
  - [ ] Purchase order status summary (Draft, Sent, Confirmed, Received, Billed, Closed).
  - [ ] Vendor spend analysis by period, category, and vendor.
  - [ ] 3-Way matching discrepancy report.
  - [ ] Vendor performance scorecard report (on-time delivery, price accuracy, quality).
  - [ ] Outstanding PO and back-order tracking report.
- [ ] **Odoo-Parity & In-Context Additions**:
  - [ ] Automatic RFQs from replenishment rules and make-to-order sales.
  - [ ] Purchase agreements: blanket orders and calls for tender; alternative RFQ comparison.
  - [ ] Vendor portal: vendors confirm POs, update delivery dates and upload invoices.
  - [ ] AI bill capture: OCR of vendor bills into draft bills matched to PO and receipt.
  - [ ] Quick-create vendor and product from a PO line (§29); vendor call/email from the PO (§32).
  - [ ] Automatic reminders to vendors before expected receipt dates; late-delivery alerts.

---

## 4. 💼 Enterprise Sales, Quotations & E-Invoicing (`/sales`)

- [ ] **Sales Quotations & Interactive CPQ**:
  - [ ] Professional quotation generator with multi-tier pricing, discount matrix, and expiry countdown.
  - [ ] Customer quote acceptance web portal with client digital signature.
  - [ ] 1-Click conversion of approved Quotes into Sales Orders and Picking Slips.
  - [ ] Optional item upsells, accessories add-ons, and bundle packages within quotes.
- [ ] **Sales Orders (SO) Lifecycle**:
  - [ ] Automated real-time stock reservation upon SO confirmation with warehouse allocation.
  - [ ] Credit limit and overdue invoice check preventing dispatch to non-compliant accounts.
  - [ ] Complete order state machine (`Quotation` -> `Sales Order` -> `Picking` -> `Packed` -> `Shipped` -> `Invoiced` -> `Paid`).
  - [ ] Backorder and partial fulfillment handling with automated split dispatches.
- [ ] **Delivery Orders (DO) & Logistics Dispatch**:
  - [ ] Warehouse picking list and automated packing slip generation with weight/dimension calculations.
  - [ ] QR code scan dispatch verification ensuring 100% packing accuracy.
  - [ ] Proof of Delivery (POD) capture with recipient mobile signature and photo attachment.
  - [ ] Carrier integration (DHL, FedEx, UPS, local courier tracking).
- [ ] **Sales Invoicing & Automated Tax Calculations**:
  - [ ] Automated invoice generation from Sales Orders or Delivery Orders upon shipment.
  - [ ] Multi-rate regional tax engine (VAT, GST, State Tax, Withholding, Compound taxes) calculated by Python Calculation Service.
  - [ ] Recurring Invoicing engine with flexible billing schedules (monthly, quarterly, annual) for subscription contracts.
  - [ ] Multi-currency billing with live exchange rate conversion and FX gain/loss tracking.
- [ ] **Regulatory E-Invoicing & Fiscalization Compliance**:
  - [ ] Cryptographic hash generation and QR code fiscalization complying with global tax authorities (Ethiopian ERCA / Ministry of Revenues, Saudi ZATCA Phase 2, European PEPPOL / Factur-X, Latin America CFDI).
  - [ ] Tamper-proof digital invoice signature (UBL 2.1 XML / PDF-A3) with digital certificates.
  - [ ] Automated background transmission to government tax clearance portals with retry queues.
- [ ] **Credit Notes, Customer Returns & Refunds**:
  - [ ] Return Merchandise Authorization (RMA) workflow with inspection, restock, or scrap routing.
  - [ ] Automated Credit Note issuance linked to original invoice with accounts receivable offset.
  - [ ] Instant customer refund processing via original payment method or store credit voucher.
- [ ] **Sales Commission & Representative Performance**:
  - [ ] Multi-tier commission plans based on gross sales, gross margin profit, or product category accelerators.
  - [ ] Split commissions across account executives, sales engineers, and territory managers.
  - [ ] Real-time sales rep leaderboard, quota attainment percentages, and payout tracking.
- [ ] **Sales Intelligence & Executive Reports**:
  - [ ] Period-over-period sales velocity and revenue growth trends.
  - [ ] Quotation-to-Order conversion funnel with stage drop-off analysis.
  - [ ] Customer Aged Receivables report (Current, 30, 60, 90+ days overdue).
  - [ ] Top customers, top revenue-generating products, and regional sales distribution heatmaps.
- [ ] **Odoo-Parity & In-Context Additions**:
  - [ ] Quotation templates with optional products and online signature + payment on the quote (telebirr, M-Pesa, card).
  - [ ] Down payments, invoicing policy (ordered vs. delivered quantities), recurring/subscription orders.
  - [ ] One-click quote from a CRM opportunity; deal value updated from the quote.
  - [ ] Per-line stock and margin indicators; quick-create customer with credit-limit check (§29).
  - [ ] Smart buttons for deliveries, invoices, payments and calls (§29).
  - [ ] Phone-order capture through the softphone panel; AI drafts quotes from an email or call transcript (§32).

---

## 4.1 🤝 World-Class Enterprise CRM & Customer Lifecycle Suite (`/crm`)

- [ ] **Handwriting-to-Text & Digital Ink Recognition (Zoho / Apple Pencil Rival)**:
  - [ ] **Interactive Digital Ink Canvas**: Smooth handwriting input area on tablets, touchscreens, mobile, and desktop stylus for sales reps in the field.
  - [ ] **Neural Handwriting-to-Keyboard OCR Engine**: Instant real-time conversion of handwritten customer registration sheets into structured typed text.
  - [ ] **"Handwrite-to-Register" Quick Customer Onboarding**: Sales rep can write customer name, phone number, email, company, and meeting notes with a stylus or finger; 1-click "Convert & Save" parses handwritten notes directly into validated database fields (`name`, `phone`, `email`, `tax_id`, `address`, `notes`).
  - [ ] **Stylus Pressure & Stroke Smoothing**: Bezier stroke smoothing, undo/redo, eraser, and pressure-sensitive digital ink rendering.
  - [ ] **Business Card Camera Scanner (OCR)**: Snap a photo of a paper business card to automatically extract and populate lead/contact fields with AI validation.
- [ ] **360° Customer & Account Master Intelligence**:
  - [ ] Multi-tier corporate account hierarchy (Parent Holding -> Regional Subsidiaries -> Branch Offices -> Individual Contacts).
  - [ ] Unified 360-degree timeline feed: all emails, phone calls, WhatsApp chats, meetings, quotes, orders, invoices, and support tickets in one single chronological view.
  - [ ] AI-driven Customer Health Score & Churn Risk indicator based on communication frequency, order frequency, and payment punctuality.
  - [ ] Dynamic Custom Fields & Layout Designer: drag-and-drop fields (text, number, date, dropdown, formula, multi-select) customizable per industry.
  - [ ] Smart Duplicate Detection & Merge Assistant: Phonetic, email, and phone duplicate detection with automated field-by-field merge wizard.
- [ ] **Omnichannel Communication & Engagement Hub**:
  - [ ] **WhatsApp Business API Integration**: Send approved message templates, 1-on-1 chat directly within the customer card, media attachments, and automated conversation history logging.
  - [ ] **Built-in VoIP WebRTC Softphone**: Click-to-call directly from customer profile, call recording, automated call duration logging, and 1-click voicemail drop.
  - [ ] **Full Two-Way Email Synchronization**: Native IMAP/SMTP and OAuth2 sync for Gmail and Microsoft Outlook 365 with background inbox monitoring.
  - [ ] **Email Open & Link Click Tracking**: Real-time push notifications when a prospect opens an email or clicks proposal links.
  - [ ] **SMS Gateway Integration**: Two-way SMS messaging (Twilio, Infobip) for instant follow-up alerts, meeting reminders, and delivery notices.
  - [ ] **Live Website Chat & AI Lead Bot**: Embeddable website widget that answers FAQs and automatically captures visitor email/phone into CRM leads.
- [ ] **Visual Multi-Pipeline & Deal Opportunity Management**:
  - [ ] Unlimited custom sales pipelines (e.g., Inbound SMB, Outbound Enterprise, Renewal / Up-sell, Channel Partners).
  - [ ] Interactive drag-and-drop Kanban Deal Board with stage win-probability weighting and expected value calculation.
  - [ ] Rotting Deals Alert: Automated visual alert and notification when an opportunity stays in a stage longer than the SLA threshold.
  - [ ] Multi-Currency Deal Valuations with automatic corporate reporting currency conversion.
  - [ ] Deal Split Revenue: Distribute opportunity revenue attribution across multiple team members.
  - [ ] Win / Loss Analysis: Mandatory structured loss reason tracking with automated feedback collection and competitor benchmarking.
- [ ] **Lead Capture, AI Scoring & Automated Distribution**:
  - [ ] Embeddable Web-to-Lead forms with CAPTCHA and auto-tagging by campaign source.
  - [ ] **Predictive AI Lead Scoring**: Dynamic 0-100 score based on demographic profile fit, company size, and behavioral engagement signals (page views, email opens, downloads).
  - [ ] Automated Lead Routing Rules: Round-robin distribution, territory-based routing, or workload-balanced assignment.
  - [ ] Lead Qualification SLA Timers: Countdown timers with automated manager escalation if a new high-priority lead is not contacted within 15 minutes.
- [ ] **Sales Workflow Automation & Playbooks**:
  - [ ] Visual Drag-and-Drop Workflow Automation Builder (`Trigger -> Condition -> Action`).
  - [ ] Automated Multi-Step Email Drip Sequences with automatic cancellation upon prospect reply or booked meeting.
  - [ ] Sales Cadence Playbooks: Predefined structured outreach schedules (Day 1: Phone call, Day 2: Personalized email, Day 4: LinkedIn message, Day 7: WhatsApp follow-up).
  - [ ] Automated task and calendar reminder generation for sales representatives.
- [ ] **Meeting Scheduler & Calendar Synchronization**:
  - [ ] Personalized booking links (similar to Calendly) allowing clients to self-schedule meetings based on rep's Google / Outlook calendar availability.
  - [ ] Video conference link auto-generation (Google Meet, Zoom, Microsoft Teams).
  - [ ] Meeting notes recorder with action items checklist synced to CRM deal card.
- [ ] **AI Sales Copilot & Generative Intelligence**:
  - [ ] AI Sales Email Drafter: Generates personalized cold outreach and follow-up emails using prospect background and past deal context.
  - [ ] Meeting Audio Transcription & Summary: Transcribes recorded calls, highlights key discussion topics, and extracts actionable next steps.
  - [ ] Deal Sentiment Analysis: Analyzes email sentiment and customer tone to alert rep of declining engagement or buyer hesitation.
  - [ ] AI "Next Best Action": Recommends optimal next contact time, suggested talking points, and probability-maximizing deal steps.
- [ ] **Territory & Quota Management**:
  - [ ] Multi-tier territory modeling by geography, industry vertical, or enterprise company size.
  - [ ] Rep and Team Quota Tracking: Monthly and quarterly targets vs. closed revenue vs. weighted pipeline coverage.
  - [ ] Commission Calculator & Accelerator tracking for transparent sales incentive visibility.
- [ ] **Customer Self-Service Portal**:
  - [ ] Dedicated branded customer portal where clients can view pending proposals, approve quotes with digital signatures, track orders, view invoice history, and submit support tickets.
- [ ] **CRM Executive Analytics & Cohort Reports**:
  - [ ] Full-funnel conversion analysis: `Visitor` -> `Lead` -> `Marketing Qualified (MQL)` -> `Sales Qualified (SQL)` -> `Opportunity` -> `Won`.
  - [ ] Sales Velocity Formula report: `Velocity = (Deals in Pipeline × Win Rate × Average Deal Size) / Sales Cycle Length`.
  - [ ] Rep Activity Scorecard: Calls made, emails sent, meetings conducted, and proposals submitted per rep.
  - [ ] Revenue Forecast Matrix (Committed, Best Case, Pipeline, Closed) with historical forecast accuracy tracking.
- [ ] **Interaction Timeline & AI Auto-Fill (see §30, §32)**:
  - [ ] Every touchpoint numbered and time-stamped: 1st call, 2nd call, email, WhatsApp, meeting, visit — channel, direction, duration, outcome, user.
  - [ ] Call recordings, video recordings, transcripts and AI summaries attached to the touchpoint.
  - [ ] Scripted calls: script version and the answer to each step stored with the call.
  - [ ] AI fills and updates lead fields from calls and meetings (need, budget, timeline, decision maker, next step), with a review-before-save option.
  - [ ] Every stage and status change stored with timestamp and time-in-stage.
  - [ ] Leads created automatically from the AI voice agent, website chat, WhatsApp and email (§32, §33).
  - [ ] Activity plans (multi-step cadences assigned in one click) with overdue tracking.
  - [ ] Video meetings with external guest links straight from the deal (§31).

---

## 5. ⚡ Point of Sale (POS) (`/pos`)

- [ ] **Multi-Terminal & Register Architecture**:
  - [ ] Support for multiple cash registers across different stores/branches.
  - [ ] Fast user switching with numerical PIN or NFC/Barcode badge scan.
- [ ] **High-Velocity Touch & Barcode Checkout**:
  - [ ] Touch-friendly catalog with visual categories, favorites, and quick-search.
  - [ ] Instant hardware barcode scanner and camera QR code scanning.
  - [ ] Keyboard shortcuts for 100% mouse-free rapid checkout.
  - [ ] Line-item and order-level discounts with manager override permissions.
  - [ ] Custom item notes, price overrides, and tax exemption toggles.
- [ ] **Payment Methods & Split Checkout**:
  - [ ] Cash with quick change calculator buttons.
  - [ ] Integrated **Telebirr QR** dynamic generation for instant customer scanning.
  - [ ] Credit/Debit card terminal integration.
  - [ ] Customer account credit / Layaway / On-account sales.
  - [ ] Multi-tender split payments (e.g. 50% Cash + 50% Telebirr).
- [ ] **Register Session & Cash Control**:
  - [ ] Opening Float entry and denomination counter.
  - [ ] Mid-shift Cash-In, Cash-Out, and safe drops with audit notes.
  - [ ] End-of-shift Blind Close and automated **Z-Report** reconciliation against system expected cash.
- [ ] **Offline-First Resilience**:
  - [ ] IndexedDB and Service Worker caching allowing uninterrupted sales during internet outages.
  - [ ] Background automated sync queue when connectivity is restored.
- [ ] **Hardware & Peripheral Support**:
  - [ ] Thermal receipt printer support (ESC/POS 80mm & 58mm) with customizable logo and header/footer.
  - [ ] Customer-facing secondary display (live cart total & payment QR).
  - [ ] Electronic cash drawer kick-out pulse via printer RJ11.
  - [ ] Weight scale integration for products sold by weight/volume.
- [ ] **Hospitality / Food Service Mode (Configurable)**:
  - [ ] Table management and floor layout designer.
  - [ ] Kitchen Order Ticket (KOT) printing to kitchen and bar printers.
  - [ ] Hold cart, resume cart, and bill split by seat or item.
- [ ] **POS Reports**:
  - [ ] Daily / Weekly / Monthly sales summary by register, cashier, and payment method.
  - [ ] Z-Report history with expected vs. actual cash reconciliation.
  - [ ] Top-selling items and product category performance.
  - [ ] Discount and void audit report (who, when, how much).
  - [ ] Hourly sales heatmap for staffing optimization.
- [ ] **Odoo-Parity & In-Context Additions**:
  - [ ] Product not found → create it inside POS when the cashier has `products.create`, otherwise "request product" to a manager (§29).
  - [ ] Quick-create customer at checkout; settle a customer's open invoices at the register.
  - [ ] Order presets (dine-in, takeaway, delivery) and combo products.
  - [ ] Self-ordering kiosk and table QR menu; kitchen display system (KDS) alongside printed tickets.
  - [ ] Loyalty, gift cards and e-wallet shared with the Online Store.
  - [ ] Phone and online orders arrive in the POS order queue; dispatch to Delivery from the register.
  - [ ] Mobile POS on Android/iOS with the same offline queue.

---

## 6. 📊 Double-Entry Accounting, Financials & Fixed Assets (`/accounting`)

- [ ] **Chart of Accounts (COA)**:
  - [ ] Standard hierarchical multi-tier Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expenses).
  - [ ] Pre-packaged localized COA templates with custom account creation.
  - [ ] Account numbering system and sub-account grouping.
- [ ] **General Ledger & Journal Entries**:
  - [ ] Double-entry bookkeeping enforcing Balanced Debits = Credits for every transaction.
  - [ ] Manual General Journal entries with multi-line splits, references, and attachment uploads.
  - [ ] Recurring Journal Entries (e.g. monthly depreciation, prepaid rent amortization).
  - [ ] Automated sub-ledger journal generation triggered by:
    - [ ] Sales Invoices (Debit AR, Credit Sales Revenue, Credit Tax Payable)
    - [ ] Delivery Notes / COGS (Debit Cost of Goods Sold, Credit Inventory Asset)
    - [ ] Vendor Bills (Debit Expense / Asset, Debit Tax Input, Credit AP)
    - [ ] POS Daily Z-Reports (Debit Cash / Bank / Payment Clearing, Credit POS Revenue)
    - [ ] Payroll Pay Runs (Debit Salary Expense, Credit Bank, Credit Tax / Pension Payable)
    - [ ] Fixed Asset Depreciation (Debit Depreciation Expense, Credit Accumulated Depreciation)
- [ ] **Fixed Asset Management & Depreciation Engine (`/accounting/assets`)**:
  - [ ] Fixed Asset Registry (Machinery, Vehicles, IT Hardware, Buildings, Furniture) with QR asset tagging.
  - [ ] Depreciation methods computed via Python Calculation Engine:
    - [ ] Straight-Line Method
    - [ ] Declining Balance / Double Declining Balance Method
    - [ ] Units of Production Method
  - [ ] Automated monthly depreciation schedule and journal post trigger.
  - [ ] Asset revaluations, impairment adjustments, and disposal/scrap write-offs with automatic gain/loss calculation.
  - [ ] Asset maintenance logs, warranty tracking, and custodian assignment.
  - [ ] Fixed Asset Reports:
    - [ ] Fixed Asset Register: acquisition cost, accumulated depreciation, net book value.
    - [ ] Depreciation forecast schedule (monthly projections by asset class).
    - [ ] Asset disposal and write-off audit log.
- [ ] **Multi-Company & Branch Financial Consolidation**:
  - [x] Multi-entity and branch transaction tagging.
  - [ ] Inter-company transfer journals and elimination entries.
  - [ ] Consolidated Balance Sheet, P&L, and Trial Balance across subsidiaries or branch entities.
- [ ] **Accounts Receivable (AR) & Credit Management**:
  - [ ] Customer balances, statement generation, and payment matching.
  - [ ] Aged Receivables Analysis (Current, 1-30, 31-60, 61-90, 90+ days).
  - [ ] Automated dunning letters and overdue payment reminders.
- [ ] **Accounts Payable (AP) & Disbursement**:
  - [ ] Vendor ledger, invoice payment scheduling, and partial payment allocation.
  - [ ] Aged Payables Analysis and cash outflow forecast.
- [ ] **Bank & Cash Management**:
  - [ ] Bank accounts, petty cash registers, and clearing accounts.
  - [ ] Bank Statement import (CSV / OFX) with automated rule-based transaction reconciliation.
  - [ ] Bank transfer entries between internal accounts.
- [ ] **Real-Time Financial Reports (Computed via Python Engine)**:
  - [ ] **Balance Sheet**: Assets vs. Liabilities + Equity with comparative periods.
  - [ ] **Profit & Loss (Income Statement)**: Gross Margin, Operating Income, EBITDA, Net Profit.
  - [ ] **Cash Flow Statement**: Operating, Investing, and Financing cash flows.
  - [ ] **Trial Balance**: Debit/Credit validation across all ledger accounts.
  - [ ] **General Ledger & Journal Reports**: Transaction-level drilldowns.
  - [ ] **Tax Summary Reports**: Output VAT, Input VAT, Net VAT liability computation.
  - [ ] **Fixed Asset Register & Depreciation Report**: Acquisition cost, accumulated depreciation, net book value.
- [ ] **Fiscal Year & Multi-Currency Controls**:
  - [ ] Fiscal year definition, accounting period locks (closing past months to prevent unauthorized edits).
  - [ ] Multi-currency revaluation with automatic Realized and Unrealized Foreign Exchange Gain/Loss journals.
- [ ] **Odoo-Parity Additions**:
  - [ ] Bank feeds/statement sync with reconciliation models and AI-suggested matches.
  - [ ] AI OCR for vendor bills and receipts into draft entries.
  - [ ] Analytic accounting (multiple plans: project, department, vehicle, branch) and budgets vs. actuals.
  - [ ] Payment terms with early-payment discounts; batch payments; cash-basis taxes.
  - [ ] Follow-up levels for overdue customers combining email, SMS and a VoIP call step (§32).
  - [ ] Lock dates and audit reports; Ethiopian VAT, withholding and TOT reporting; IFRS-ready statements.

---

## 7. 👥 Decoupled Human Resource Management & Recruitment (HRMS) (`/hrms`)

- [x] **Organization Settings — Companies & Branches (`/settings/organization`)**:
  - [x] Companies CRUD: create, view, edit, and delete companies with name, code, address, and status fields.
  - [x] Branches CRUD: create, view, edit, and delete branches tied to their parent company.
  - [x] Active company/branch scope banner displayed at the top of the OrganizationSettings page; list filtered to the current scope context.
- [x] **Employee Lifecycle & Profiles**:
  - [x] Comprehensive digital employee profile: Personal info, emergency contacts, employment contracts, salary grade, bank details, and compliance documents.
  - [x] Visual Organizational Chart with reporting manager hierarchy.
  - [x] Onboarding & Offboarding task checklists.
- [x] **Recruitment & Applicant Tracking System (ATS) (`/hrms/recruitment`)**:
  - [x] Job Requisition creation with budget approval workflow.
  - [x] Job Postings management & public career portal page.
  - [x] Candidate Pipeline Kanban (`Applied` -> `Screening` -> `Interview` -> `Offer` -> `Hired` -> `Rejected`).
  - [x] Candidate Resume/CV storage, applicant scoring, and interview scheduling with calendar sync.
  - [x] Offer letter generation and digital acceptance workflow.
  - [x] **1-Click Candidate-to-Employee Conversion**: Auto-provisions employee profile, contract, and onboarding checklist upon hire.
  - [x] Recruitment Reports:
    - [x] Hiring funnel conversion rates (Applied -> Screened -> Interviewed -> Offered -> Hired).
    - [x] Time-to-hire and cost-per-hire analytics by department and role.
    - [x] Open vs. filled positions summary.
- [x] **Biometric & Mobile Attendance**:
  - [x] Integration with ZKTeco & Hikvision hardware biometric devices.
  - [x] Mobile Geofenced & QR Code Clock-In / Clock-Out with anti-spoofing checks.
  - [x] Shift pattern assignment, night shift allowances, and grace-period management.
  - [x] Cursor-based batch pagination for instant absent processing across 100,000+ employees.
  - [x] **5-Minute Automated Biometric Cooldown & Debounce**: Hardware and mobile double-punches within 5 minutes automatically ignored and deduplicated into `biometric_punch_logs`.
  - [x] **Overnight & Cross-Midnight Shift Continuity**: Spanning shifts (e.g. 21:00 Day D to 02:00 Day D+1) anchor seamlessly to shift work date (Day D) without splitting into 2 days.
  - [x] **Shift Midpoint Missed Punch Detection**: Single punch before midpoint marked as clock-in (missed clock-out); single punch after midpoint marked as clock-out (missed clock-in).
  - [x] **Midnight & Overnight Auto-Day Close**: Open day shifts auto-close at midnight (00:00) with `overtime_hours = 0` (0 OT credit); overnight shifts auto-close at 06:00 buffer with 0 OT.
  - [x] **Pre-Midnight Shift Close Warnings**: Automated 23:15 alerts warning employees and notifying supervisors with active employee session rosters.
  - [x] **Mobile Urgent Grace-Period Alarm**: Repeated urgent ringing notification during morning grace period with 1-tap [Dismiss / Ignore] button that silences the phone and updates `attendance_alarm_dismissals`.
  - [x] **Employee Attendance Regularization & Manager Review**: Self-service regularization requests with reason/time adjustments and 1-click supervisor review routed to immutable `attendance_correction_logs`.
  - [x] **Live Overtime Monitor with Force Clock-Out OT Decision**: `/attendance/overtime-monitor` live OT dashboard with explicit manager choice to grant or withhold overtime credit upon manual force-close.
  - [x] **VET/VTO Shift Completion Push Notifications**: Automated 5-minute and 1-minute pre-shift end push reminders for standard and Voluntary Extra Time (VET) shifts.
  - [x] **Offline Biometric Batch Synchronization & Natural Key Deduplication**: Non-volatile hardware buffering with chronological sorting (`punch_time ASC`) per employee and natural key deduplication `UNIQUE(device_serial_number, pin, punch_time)`.
  - [x] **Historical Shift Reconciliation & USB Backup Import**: Reopening auto-closed past records upon delayed offline punch sync with supervisory overtime approval gate and USB/CSV/TXT offline log import modal.
- [x] **Leave & Absence Management**:
  - [x] Configurable leave types (Annual, Sick, Maternity, Paternity, Compassionate, Unpaid).
  - [x] Automated leave accrual rules, carry-over limits, and encashment calculators.
  - [x] Multi-level leave approval workflows and team leave calendars.
- [x] **Overtime & Per Diem Monitoring**:
  - [x] Overtime pre-approval, actual clock-out verification, and overtime rate multipliers (Standard, Weekend, Holiday).
  - [x] Travel Per Diem claim submissions with receipt uploads and expense validation.
- [x] **Payroll & Compensation Engine (Python Powered)**:
  - [x] Multi-component salary structures (Base, Housing, Transport, Performance bonuses).
  - [x] Progressive income tax brackets, pension contributions, and statutory deduction calculation via Python Engine.
  - [x] Automated deductions for employee loans, salary advances, and disciplinary penalties.
  - [x] Bulk monthly payroll execution, approval workflow, and one-click payslip generation with email delivery.
  - [x] Direct Bank Transfer export files (ABA, NACHA, local bank CSV formats).
- [x] **HRMS Reports**:
  - [x] Headcount and demographic analysis (by department, gender, age band, tenure).
  - [x] Recruitment velocity & hiring funnel conversion report.
  - [x] Attendance summary report (present, absent, late, early departure rates).
  - [x] Leave utilization report by type and department.
  - [x] Overtime cost analysis by department and period.
  - [x] Payroll cost breakdown report (gross, deductions, net by department).
  - [x] Employee turnover and retention rate analysis.
- [x] **Workforce Management (WFM) — Voluntary Extra Time (VET) & Voluntary Time Off (VTO)**:
  - [x] Broadcast opportunities engine for managers to post extra overtime shifts (VET) or excused voluntary time-off (VTO) with slots and multipliers (1.25x - 2.5x).
  - [x] Self-service claim portal on Web and Mobile with instant auto-approval or manager review workflows.
  - [x] Fatigue and labor compliance guardrails enforcing max weekly overtime hours and minimum rest intervals between consecutive shifts.
  - [x] Automated scheduling integration updating `schedules` table with shift assignments and excused absence flags.
  - [x] Automated payroll overtime integration calculating hourly rates, multipliers, and upserting into `overtime_entries`.
  - [x] Multi-channel notification dispatch to all department users on broadcast, claim submission, decision, and slot re-opening via WebSocket in-app and FCM push.
  - [x] Flexible tenant configuration for claim strategies (FCFS, Seniority, Fairness), auto-approvals, PTO funding for VTO, and cancellation cutoffs.

---

## 8. 🚀 Decoupled Project Management System (PMS) (`/pms`)

- [x] **Multi-Project Workspace**:
  - [x] Portfolio dashboard with project progress, health status, deadlines, and budget burn rates.
  - [x] Public vs. Private project confidentiality permissions.
- [x] **Agile Sprints & Backlog**:
  - [x] Sprint planning, velocity charts, story points, and sprint burndown/burnup graphs.
  - [x] Backlog prioritization with drag-and-drop hierarchy.
- [x] **Interactive Views**:
  - [x] **Kanban Board**: Customizable column workflows (To Do, In Progress, Code Review, QA, Done) with WIP limits.
  - [x] **Gantt Chart**: Interactive timeline with milestone markers and critical path visualization.
  - [x] **List & Grid View**: High-density table with custom filtering, sorting, and inline editing.
  - [x] **Calendar View**: Task deadline and milestone calendar.
- [x] **Comprehensive Task Management**:
  - [x] Subtasks, checklists, task dependencies (`Finish-to-Start`, `Start-to-Start`, etc.).
  - [x] Custom task fields (Dropdowns, Numbers, Dates, Text).
  - [x] Rich text descriptions, file attachments, and @mention task comment threads.
  - [x] Review Queues & Task Sign-off approvals.
- [x] **Time Tracking & Billing**:
  - [x] Live task stopwatch timer and manual time log entries.
  - [x] Billable vs. Non-Billable hour segregation.
  - [x] Direct conversion of billable timesheets into Sales Invoices.
- [x] **KPI & Appraisal Engine (Python Powered)**:
  - [x] Automated KPI score computation based on task completion velocity, on-time delivery rate, and peer reviews.
- [x] **PMS Reports**:
  - [x] Project health summary (on-track, at-risk, overdue) with budget burn rate.
  - [x] Sprint velocity and burndown/burnup charts.
  - [x] Team workload distribution and capacity planning.
  - [x] Billable hours vs. non-billable hours by project and team member.
  - [x] Task completion rates and average cycle time analysis.

---

## 9. 🔀 Dynamic Approval Workflow Engine (`/settings/approvals`)

- [x] **Configurable Multi-Tier Approval Rules**:
  - [x] User-defined approval hierarchies across all operational workflows:
    - [x] Purchase Requisitions & Purchase Orders (threshold-based: e.g. <$1,000 Manager, >$5,000 Director, >$25,000 CFO)
    - [x] Sales Quotation & Order Discounts (e.g. >10% Team Lead, >20% Sales VP)
    - [x] Customer Credit Limit overrides
    - [x] Leave Requests & Overtime Claims
    - [x] Inventory Write-offs & Stock Adjustments
    - [x] Fixed Asset disposals and write-offs
    - [x] General Journal Postings
  - [x] Support for parallel (all must approve) and sequential (stepped approval) routes.
  - [x] Automated email and push notification alerts with 1-click Approve / Reject action links.
  - [x] Complete approval audit trail with timestamp, approver comments, and full status history.

---

## 10. 🔌 Webhooks & Developer API Portal (`/settings/developer-api`)

- [x] **Tenant API Key Management**:
  - [x] Generation of scoped, revocable REST API keys for external ERP integrations.
  - [x] Granular permission assignment per API key (e.g. read-only products, create sales orders).
  - [x] Rate limiting and request throttling per API token.
  - [x] API key activity log (last used, request count).
- [x] **Outgoing Event Webhooks**:
  - [x] Real-time HTTP POST event dispatch to external URLs upon ERP triggers:
    - [x] `invoice.created`, `invoice.paid`, `invoice.overdue`
    - [x] `inventory.low_stock`, `inventory.stock_received`
    - [x] `order.confirmed`, `order.dispatched`, `order.delivered`
    - [x] `employee.hired`, `employee.terminated`
    - [x] `payroll.run_completed`
    - [x] `leave.approved`, `leave.rejected`
  - [x] HMAC SHA-256 signature verification for secure webhook delivery.
  - [x] Automated retry queue with exponential backoff for failed webhook deliveries.
  - [x] Interactive Webhook delivery log viewer (request payload, HTTP status, response body).

---

## 11. 🎨 Modern Enterprise UI / UX Architecture

- [x] **Design Language & Aesthetics**:
  - [x] Clean, high-performance, clutter-free design inspired by Microsoft Dynamics 365, SAP Fiori, and modern SaaS standards.
  - [x] Crisp typography, harmonious neutral palettes (Zinc/Slate), and strict accessibility contrast ratios.
  - [x] Elimination of dense nested menus in favor of flat contextual docks and instant command search.
- [x] **Header & Workspace Command Center**:
  - [x] **Global App Launcher (9-Dot)**: Instant modal switch between enabled modules.
  - [x] **Universal Search & Command Palette (`Ctrl/Cmd + K`)**: Instant search for tasks, products, invoices, customers, and navigation shortcuts.
  - [x] **Quick Action "+ Create" Button**: Contextual instant creation of PO, Invoice, Employee, Task, or Product from anywhere in the app.
  - [x] **AI Assistant Button**: Opens the AI conversational panel (if tenant has AI module enabled) for help, document generation, and action execution.
  - [x] **Real-Time Communication Drawer**: Slide-out drawer for instant access to Chat channels and DMs without leaving the current workspace.
- [x] **Contextual Left Rail Dock**:
  - [x] Slim icon rail with expandable module-specific submenu.
  - [x] Keeps navigation focused purely on the active module, eliminating menu clutter.
- [x] **Company & Branch Context Switcher**:
  - [x] Synchronized Company & Branch dropdown in navigation header; users with `view_all_companies` / `view_all_branches` can switch context freely.
  - [x] Locked indicator (`Assigned Unit 🔒`) auto-applied for users scoped to a single company/branch.
  - [x] Selected scope persisted in `localStorage` and restored on page reload with no visual flash.
  - [x] Switching scope instantly invalidates all cached queries so every data grid and KPI reflects the new company/branch without a manual refresh.
- [x] **Adaptive Navigation Layout Mode (Sidebar vs. Topbar)**:
  - [x] User-level layout toggle between vertical sidebar/dock navigation and horizontal topbar navigation.
  - [x] Option accessible directly from user profile dropdown menu next to "My Profile" and "Log out".
  - [x] Preference persisted across sessions via `localStorage` (`user_navigation_layout`) with zero layout flicker.
  - [x] Immediate reactive re-render via custom event `navigation-layout-changed` without requiring full browser reload.
  - [x] Full horizontal topbar navbar (`TopbarModuleNavigation.tsx`) with primary module links and dynamic "More" overflow dropdown.
  - [x] Parity in Humanitas (`TopbarNavigation.tsx`) and `EnterpriseLayout.tsx`.
- [x] **High-Density Enterprise Data Grids**:
  - [x] Resizable and reorderable table columns.
  - [x] Column pinning (freeze left/right), sorting, and multi-condition filtering.
  - [x] Multi-row selection for bulk actions (Bulk Delete, Bulk Export, Bulk Status Update).
  - [x] Instant 1-click Export to CSV, Excel, and PDF.

---


## 12. 💳 Self-Service Subscription, Billing & Landing Page

- [ ] **Interactive SaaS Landing Page**:
  - [ ] Hero showcase displaying Humanitas ERP modules with live animated workflow previews.
  - [ ] **Interactive Modular Pricing Calculator**:
    - [ ] Real-time toggles for each module (HRMS, PMS, Inventory, Sales, Purchasing, POS, Accounting, Recruitment, Fixed Assets, AI).
    - [ ] AI capability tier add-ons (AI Help, AI Documents, AI Actions, Full AI) with per-tier pricing.
    - [ ] Dynamic base plan + per-user + selected module add-on live total calculator.
    - [ ] Monthly vs. Annual discount selector.
    - [ ] Multi-currency price display (USD, EUR, ETB).
- [ ] **Payment Gateway Integrations**:
  - [ ] **LemonSqueezy Gateway**:
    - [ ] Hosted checkout for Credit/Debit cards, Apple Pay, Google Pay, and PayPal.
    - [ ] Webhook receiver for recurring subscription lifecycle (created, renewed, updated, cancelled).
    - [ ] Automated module feature flag activation upon successful webhook verification.
    - [ ] Customer self-service billing portal for managing payment methods and viewing tax receipts.
  - [ ] **Telebirr Gateway**:
    - [ ] Direct H5 / QR Code checkout for Ethiopian Birr transactions.
    - [ ] Instant callback validation and auto-provisioning of tenant module licenses.
- [ ] **Redesigned Tenant Admin Workspace (`tenant-admin_frontend`)**:
  - [ ] Visual module subscription manager: 1-click upgrade, add new modules, or add user seat licenses.
  - [ ] Invoices and payment receipts download center.
  - [ ] Platform usage metrics (storage, active users, API requests).

---

## 13. 🤖 AI Intelligence Module (`/ai`)

### Subscribable AI Capability Tiers
- [x] **AI Help (`ai.help`)**: Conversational assistant that answers questions about how to use Humanitas. Knows every page, route, button, and action in the system via the AI Knowledge Base.
- [x] **AI Document Creation (`ai.documents`)**: Generates formatted PDF and DOCX documents from database data. Supports user-uploaded sample/template documents — AI extracts the format structure and produces output in that exact layout.
- [x] **AI Actions (`ai.actions`)**: Executes system actions on behalf of the user if the user has the required permissions. Examples: "Approve all pending leave requests", "Create a purchase order for 500 units of Product X", "Run payroll for July 2026".
- [x] **Full AI Module (`ai.full`)**: All AI capabilities unlocked (Help + Documents + Actions).

### AI Knowledge Base (Always Up-to-Date)
- [x] Every page, route, button, and action in the system is registered in the `ai_knowledge_entries` table.
- [x] Registration includes: route path, page purpose, available actions, button locations and labels, required permissions, and step-by-step how-to instructions.
- [x] Knowledge base is updated automatically every time a new feature, page, or action is created or modified.
- [x] AI uses this knowledge to provide accurate contextual help, navigation guidance, and action execution.

### AI Chat / Help Interface
- [x] Conversational panel accessible from the global header AI button.
- [x] Users ask natural language questions about how to use the system.
- [x] AI responds with accurate step-by-step instructions, links to relevant pages, and descriptions of button locations.
- [x] Context-aware: AI knows which module the user is currently in and tailors responses accordingly.

### AI Action Executor
- [x] Receives natural language commands from the user.
- [x] Maps commands to system actions (create record, approve request, generate report, navigate to page).
- [x] **Permission enforcement (Two-Layer)**: AI verifies the user has both the AI capability tier permission (`use_ai`, `ai_actions`) AND the underlying RBAC business permission. Responds with explicit deny messages if either check fails.
- [x] **Zero fake action confirmation**: AI only reports success after the action tool returns a confirmed result.
- [x] **Strict zero-guessing**: AI always queries real database data; never fabricates or estimates any factual values.
- [x] Action types supported:
  - [x] CRUD operations on any entity (Create employee, Update product price, Delete draft PO).
  - [x] Approval workflows (Approve leave request, Confirm purchase order).
  - [x] Report generation (Generate sales report for Q3, Run trial balance).
  - [x] Navigation assistance (Open the inventory settings page, Show me all overdue invoices).
- [x] Execution audit trail: All AI-executed actions are logged in the system audit log with `executed_by: 'ai_on_behalf'` and the originating user ID.

### AI Document Preparation Engine
- [x] Generates professional formatted documents from tenant database data.
- [x] **Supported formats**: PDF (via WeasyPrint) and DOCX (via python-docx).
- [x] **Data access**: AI queries the tenant database through the Python calculation service to gather all required data.
- [x] **Template matching**: User can upload a sample document (PDF/DOCX). AI analyzes its structure (headers, tables, fonts, margins, logos) and generates new documents in that exact format with fresh data.
- [x] **Pre-built document types**:
  - [x] Payroll summary reports and individual payslips.
  - [x] Sales invoices and quotations.
  - [x] Purchase orders and delivery notes.
  - [x] Inventory stock reports and valuation summaries.
  - [x] Financial statements (P&L, Balance Sheet, Trial Balance).
  - [x] Employee contracts and offer letters.
  - [x] Attendance and leave summary reports.
- [x] **Custom freeform documents**: User describes any document in natural language, AI composes it from available data.

### Tenant AI Knowledge Vault (Policies, Proclamations & Legal Agreement RAG)
- [x] **File & Text Ingestion**: Tenant admins upload PDF, DOCX, TXT policy handbooks, employment agreements, and labor proclamations or write policies directly into the knowledge vault.
- [x] **Intelligent Auto-Chunking & Indexing**: Automatic section, article, chapter detection with token-bounded chunking and company/branch scoping.
- [x] **Strict Zero-Guessing RAG**: AI tool `search_company_knowledge` answers legal/policy queries strictly from verified uploaded company sources, providing exact document and section citations without hallucinating.
- [x] **Direct Citation Cards & Quick Prompts**: Chat responses display verified citation badges `[Reference: Document, Section, Page]` and quick policy prompt chips on web and mobile.

### Public Landing Page AI Assistant, Platform Knowledge & Support Ticketing
- [x] **Public Landing Page AI Copilot**: Floating interactive 24/7 AI platform assistant embedded on public landing pages in both Humanitas-ERP and Humanitas.
- [x] **Strict Zero-Guessing Grounding**: In-depth verified knowledge of all modules, architecture, SLA, pricing, trial, and tenant isolation with strict zero-guessing policy.
- [x] **HRMS Cross-Platform ERP Routing**: In HRMS (`Humanitas`), questions regarding ERP modules (Inventory, Sales, Purchasing, POS, Accounting) automatically direct the user to Humanitas ERP at `humanitas-erp.ziontech.tech`.
- [x] **Platform Knowledge & SaaS Provider Info UI (`/platform-knowledge`)**: Dedicated Tenant Admin management UI for SaaS provider corporate profiles, system facts, FAQs, and 1-click seeding.
- [x] **Human Support Center & Ticket Escalation (`/support-tickets`)**: Multi-origin ticketing system distinguishing `🤖 Created by AI on behalf` vs `👤 Tenant Direct` with KPI metrics, filters, and admin resolution notes.
- [x] **AI Autonomous Ticket Drafting & Confirmation**: If a question is beyond AI knowledge or user asks for human support, AI drafts a ticket card, prompts for confirmation with email, and submits on behalf of tenant with full conversation summary attached.
- [x] **Public Ticket Tracking**: Real-time ticket status tracking for prospective and active tenants by ticket number (`TICK-YYYYMM-XXXX`) and email.

### AI Settings (`/ai/settings`)
- [x] Enable/disable individual AI capability tiers.
- [x] Configure AI action execution limits (e.g., max records per bulk action).
- [x] AI response language preference.
- [x] AI document default branding (logo, colors, fonts for generated documents).

---

## 14. 🏠 Employee Self-Service Portal (`/self-service`)

- [x] **Unified "My HR" Dashboard**:
  - [x] Personal summary cards: leave balance, next payslip date, attendance streak, pending requests count.
  - [x] Quick-action shortcuts: Request Leave, Log Overtime, Submit Expense, View Payslip.
- [x] **Personal Payslip Center**:
  - [x] Payslip history viewer with month-by-month breakdown.
  - [x] Bulk PDF download of payslips by date range.
  - [x] Year-to-date earnings and deductions summary.
- [x] **Personal Attendance & Leave Tracker**:
  - [x] Attendance history calendar heatmap (present, late, absent, leave).
  - [x] Leave balance dashboard with accrual projections.
  - [x] Leave request submission with team calendar conflict visibility.
- [x] **Profile Self-Edit**:
  - [x] Employee-editable personal fields (address, phone, emergency contacts, bank details).
  - [x] Approval workflow for sensitive field changes (bank account, tax ID) requiring HR sign-off.
- [x] **Personal Tax & Benefits Portal**:
  - [x] Tax declaration submission and viewing.
  - [x] Benefits enrollment and current coverage summary.
- [x] **Self-Service Reports**:
  - [x] Personal attendance and punctuality summary.
  - [x] Personal leave usage and accrual history.
  - [x] Personal payslip and compensation trend chart.

---

## 15. 📂 Employee Document Vault & Letter Templates (`/hrms/documents`)

- [x] **Per-Employee Document Repository**:
  - [x] Centralized storage for contracts, certifications, ID copies, disciplinary records, and compliance documents.
  - [x] Document versioning with full audit trail (who uploaded, when, what changed).
  - [x] Role-based document access (HR full access, managers team-only, employees own-only).
- [x] **Document Expiry & Compliance Tracking**:
  - [x] Expiry date tracking for visas, certifications, medical exams, and licenses.
  - [x] Automated email/push reminders at 90, 60, 30, and 7 days before expiry.
  - [x] Missing required document alerts per employee (e.g., no signed contract on file).
- [x] **Template-Based Letter Generation Engine**:
  - [x] Pre-built templates: Offer letters, employment verification, experience certificates, warning letters, termination letters, salary certificates.
  - [x] Dynamic field merge from employee database (name, position, salary, dates, department).
  - [x] Tenant-branded letterhead with configurable logo, header, footer, and signature block.
  - [x] Digital signature capture for employee acknowledgment (physical upload + 3rd-party e-sign provider config: DocuSign, HelloSign, Adobe).
- [x] **Bulk Document Operations**:
  - [x] Bulk generation of letters (e.g., generate all employee tax certificates for year-end).
  - [x] Bulk download of employee documents by department or document type.
- [x] **Document Reports**:
  - [x] Document compliance dashboard (expired, expiring soon, missing required documents by department).
  - [x] Letter generation audit log with template used, generated by, and recipient.

---

## 16. 🚀 Onboarding & Offboarding Workflows (`/hrms/onboarding`)

- [x] **Onboarding Checklist Engine**:
  - [x] Configurable onboarding checklist templates per department, role, and employment type.
  - [x] Automated task assignment on new hire creation: IT provisioning, equipment allocation, badge creation, policy acknowledgment, workspace setup.
  - [x] Task assignee designation (HR, IT, Department Manager, Buddy/Mentor).
  - [x] Progress tracker with completion percentage and overdue task alerts.
- [x] **New Hire Welcome Portal**:
  - [x] Guided portal for new employees: document upload, policy acceptance, orientation video viewing, personal info completion.
  - [x] Digital contract signing with e-signature.
  - [x] Welcome packet with company handbook, org chart, and key contacts.
- [x] **Probation Management**:
  - [x] Probation period tracking with configurable duration per employment type.
  - [x] Automated review reminders at probation midpoint and end date.
  - [x] Probation outcome recording (Confirmed, Extended, Terminated) with supporting notes.
- [x] **Offboarding Workflow**:
  - [x] Configurable offboarding checklist: equipment return, access revocation, knowledge transfer, exit interview, final settlement.
  - [x] 1-Click employee separation with automated final pay calculation (remaining leave encashment, prorated salary, pending loans).
  - [x] Knowledge transfer task assignment and handover document tracking.
  - [x] Exit interview questionnaire with anonymous feedback option.
- [x] **Onboarding & Offboarding Reports**:
  - [x] Onboarding completion rates and average time-to-productivity by department.
  - [x] Offboarding checklist compliance report (percentage of items completed before last day).
  - [x] New hire retention rate at 30, 60, 90, and 180-day milestones.

---

## 17. ⚖️ Employee Grievance & Complaint System (`/hrms/grievances`)

- [x] **Grievance Submission Portal**:
  - [x] Formal grievance filing with category classification (harassment, discrimination, safety, policy violation, workplace conflict, compensation dispute).
  - [x] Anonymous complaint option with masked identity — only designated HR officers can view.
  - [x] Supporting evidence upload (documents, photos, screenshots).
- [x] **Investigation & Resolution Workflow**:
  - [x] Multi-stage lifecycle: `Filed` → `Acknowledged` → `Investigating` → `Resolution Proposed` → `Closed`.
  - [x] Assigned investigator and committee management with conflict-of-interest checks.
  - [x] Resolution tracking with escalation rules and SLA timers (e.g., acknowledge within 48 hours, resolve within 14 days).
  - [x] Confidential case file with restricted-access notes and attachments.
- [x] **Grievance Outcome & Follow-Up**:
  - [x] Resolution outcome recording with action items and responsible parties.
  - [x] Employee satisfaction feedback on resolution.
  - [x] Retaliation monitoring flag for sensitive cases.
- [x] **Grievance Reports**:
  - [x] Grievance volume and average resolution time analytics.
  - [x] Category breakdown and trend analysis by department and period.
  - [x] SLA compliance report (percentage resolved within target timelines).

---

## 18. 🏥 Benefits & Insurance Management (`/hrms/benefits`)

- [x] **Benefits Plan Catalog**:
  - [x] Plan types: medical insurance, dental, vision, life insurance, pension/retirement, housing allowance, transport allowance, education assistance.
  - [x] Multi-tier plan options per benefit type (e.g., Basic, Standard, Premium medical plans).
  - [x] Employer vs. employee contribution split configuration per plan.
- [x] **Employee Benefits Enrollment**:
  - [x] Eligibility rules engine based on tenure, grade, employment type, and department.
  - [x] Dependent management for family coverage plans (spouse, children, parents).
  - [x] Open enrollment period management with automated start/end notifications.
  - [x] Mid-year enrollment changes with qualifying life event documentation (marriage, birth, etc.).
- [x] **Benefits Integration with Payroll**:
  - [x] Automated payroll deduction calculation for employee benefit contributions.
  - [x] Employer contribution booking as payroll expense.
- [x] **Benefits Reports**:
  - [x] Benefits enrollment summary by plan type and department.
  - [x] Employer total benefits cost analysis by period.
  - [x] Dependent coverage breakdown report.
  - [x] Benefits utilization rate analysis.

---

## 19. 🎓 Training & Learning Management (LMS) (`/hrms/training`)

- [x] **Training Course Catalog**:
  - [x] Course creation with categories, description, prerequisites, capacity limits, and delivery method (in-person, online, blended).
  - [x] Training material uploads: videos, PDF documents, presentations, and quizzes.
  - [x] External training provider and venue management.
- [x] **Training Enrollment & Scheduling**:
  - [x] Employee self-enrollment and manager-nominated enrollment.
  - [x] Training calendar with session scheduling, instructor assignment, and room/venue booking.
  - [x] Waitlist management for oversubscribed sessions.
  - [x] Attendance tracking with check-in confirmation.
- [x] **Mandatory Compliance Training**:
  - [x] Compliance training assignments with due date enforcement per role, department, or regulation.
  - [x] Automated escalation for overdue mandatory training.
  - [x] Re-certification scheduling at configurable intervals.
- [x] **Certification & Skills Management**:
  - [x] Certification tracking per employee with expiry dates and automated renewal reminders.
  - [x] Skills matrix per employee with proficiency levels (Beginner, Intermediate, Advanced, Expert).
  - [x] Skills gap analysis against role requirements.
- [x] **Training Reports**:
  - [x] Training completion rates by course, department, and employee.
  - [x] Certification expiry forecast and compliance gap report.
  - [x] Training cost analysis and budget utilization.
  - [x] Skills matrix heatmap by department.

---

## 20. 🔄 360 Performance Reviews & Feedback (`/pms/reviews`)

- [x] **Review Cycle Management**:
  - [x] Configurable review cycles: quarterly, semi-annual, annual, or custom periods.
  - [x] Review cycle creation wizard with timeline, participants, and form selection.
  - [x] Automated launch and deadline reminders via email and push notifications.
- [x] **Multi-Source Feedback Collection**:
  - [x] Self-assessment questionnaire.
  - [x] Manager/supervisor review form.
  - [x] Peer feedback nominations and collection (configurable: 2-5 peers per employee).
  - [x] Direct report upward feedback (for managers being reviewed).
  - [x] Optional external stakeholder/client feedback.
- [x] **Review Forms & Competencies**:
  - [x] Review form builder with rating scales (1-5, 1-10, descriptive), competency matrices, and open-ended questions.
  - [x] Pre-built competency libraries (leadership, communication, technical skills, teamwork, innovation).
  - [x] Goal setting and alignment with organizational OKRs/KPIs.
- [x] **Calibration & Normalization**:
  - [x] Calibration sessions for manager alignment on rating distribution.
  - [x] Forced distribution/bell curve visualization with adjustment tools.
  - [x] Cross-department rating comparison dashboard.
- [x] **Performance Improvement Plans (PIP)**:
  - [x] PIP creation with specific goals, milestones, support resources, and timeline.
  - [x] Progress check-in scheduling with manager sign-off.
  - [x] PIP outcome recording (Completed Successfully, Extended, Terminated).
- [x] **Review Reports**:
  - [x] Review cycle completion status by department and manager.
  - [x] Performance distribution analysis (bell curve, rating breakdown by department/grade).
  - [x] Goal attainment rates and trend analysis across review cycles.
  - [x] Historical performance trend per employee (review-over-review comparison).

---

## 21. 💰 Expense Management (`/hrms/expenses`)

- [x] **Expense Claim Submission**:
  - [x] Employee expense claim form with category selection, amount, date, description, and receipt photo upload.
  - [x] AI-powered receipt OCR scanning for auto-extraction of vendor, amount, date, and category (via Python Engine).
  - [x] Multi-line expense reports grouping multiple expenses into a single submission.
  - [x] Draft saving and submission workflow.
- [x] **Expense Categories & Policies**:
  - [x] Configurable expense categories: Travel, Meals, Accommodation, Office Supplies, Client Entertainment, Transportation, Communication.
  - [x] Department and role-based spending limits per category.
  - [x] Policy rule engine: auto-flag expenses exceeding limits, require additional justification for high-value claims.
- [x] **Approval & Reimbursement**:
  - [x] Multi-tier approval workflow with configurable thresholds (e.g., <$100 auto-approve, <$500 Manager, >$500 Finance).
  - [x] Mileage and travel expense calculators with configurable per-km/per-mile rates.
  - [x] Reimbursement integration with payroll cycle (auto-add approved expenses to next pay run).
  - [x] Corporate credit card transaction reconciliation and matching.
- [x] **Expense Reports**:
  - [x] Expense summary by category, department, employee, and period.
  - [x] Budget vs. actual expense comparison by department.
  - [x] Reimbursement processing time and pending claims aging report.
  - [x] Top expense categories and policy violation frequency report.

---

## 22. 🖥️ Employee Asset & Equipment Tracking (`/hrms/assets`)

- [x] **Asset Registry**:
  - [x] Asset catalog: laptops, monitors, phones, tablets, vehicles, access cards, keys, uniforms, tools.
  - [x] Unique asset tags with QR code generation for physical labeling.
  - [x] Asset details: serial number, purchase date, warranty expiry, purchase cost, current condition.
- [x] **Asset Assignment & Lifecycle**:
  - [x] Asset checkout to employee with digital acknowledgment signature.
  - [x] Asset return workflow with condition assessment (Good, Fair, Damaged, Missing).
  - [x] Asset transfer between employees with full custody chain history.
  - [x] Automatic asset return enforcement during offboarding.
- [x] **Maintenance & Warranty**:
  - [x] Maintenance scheduling and service history logging.
  - [x] Warranty expiry tracking with automated reminders.
  - [x] Repair request submission and status tracking.
  - [x] Asset decommission and disposal workflow with write-off approval.
- [x] **Asset Reports**:
  - [x] Asset inventory summary by type, status, and assigned department.
  - [x] Asset assignment history per employee (all assets ever assigned).
  - [x] Warranty expiry and maintenance schedule forecast.
  - [x] Outstanding asset returns report (overdue check-ins).

---

## 23. 📊 Employee Pulse Surveys & Engagement (`/hrms/surveys`)

- [x] **Survey Builder**:
  - [x] Quick-deploy pulse survey builder with question types: rating scale, multiple choice, NPS, open text, matrix/grid.
  - [x] Survey template library with pre-built engagement, satisfaction, and culture surveys.
  - [x] Branching logic for conditional follow-up questions.
- [x] **Survey Distribution & Collection**:
  - [x] Anonymous response collection with aggregate-only reporting (minimum response threshold before results visible).
  - [x] Scheduled recurring surveys: weekly, monthly, quarterly, or one-time.
  - [x] Target audience selection: all employees, specific departments, grades, or locations.
  - [x] Multi-channel distribution: in-app notification, email, and mobile push.
- [x] **Engagement Analytics**:
  - [x] Employee Net Promoter Score (eNPS) tracking with historical trend line.
  - [x] Engagement index scoring with benchmarking against historical data.
  - [x] AI-powered sentiment analysis word cloud from open-text responses (via Python Engine).
  - [x] Action plan creation and tracking based on survey insights.
- [x] **Survey Reports**:
  - [x] Survey response rates by department, location, and grade.
  - [x] eNPS and engagement score trends over time.
  - [x] Question-by-question breakdown with comparative analysis across departments.
  - [x] Survey impact tracking: improvement measurement between survey cycles.

---

## 24. 📤 Bulk Import/Export Engine (`/settings/import-export`)

- [x] **Bulk Import**:
  - [x] CSV and Excel import for: employees, attendance records, leave balances, payroll adjustments, assets, training records.
  - [x] Import validation preview with error highlighting, row-by-row correction, and duplicate detection before committing.
  - [x] Downloadable import templates per entity type with column headers, data type hints, and example data.
  - [x] Incremental import support: update existing records or create new ones based on unique key matching.
- [x] **Bulk Export**:
  - [x] 1-click export of any data grid to CSV, Excel, and PDF with current filters and column selection preserved.
  - [x] Scheduled bulk exports with automatic delivery via email.
  - [x] Custom report builder: select fields, apply filters, and save as reusable export templates.
- [x] **Import/Export Governance**:
  - [x] Import/export audit log: who imported/exported what, when, with row count and status.
  - [x] Rollback capability for imports within a configurable time window.
  - [x] Permission-gated import/export by entity type (e.g., only HR Admin can import payroll data).

---

## 25. 🔔 Notification Engine — Email, In-App & Push (`/notifications`)

- [x] **Email Notification Service**:
  - [x] Centralized transactional email engine for: leave approvals/rejections, payroll ready, password resets, task assignments, review cycle launches, document expiry alerts, and grievance status updates.
  - [x] Email template engine with tenant branding: configurable logo, colors, header/footer, and reply-to address.
  - [x] HTML email rendering with plain-text fallback.
- [x] **In-App Notification Center**:
  - [x] Unified notification feed with read/unread status, category filters, and mark-all-as-read.
  - [x] Real-time WebSocket delivery for instant notification updates.
  - [x] Notification deep-links navigating directly to the relevant page/record.
- [x] **Mobile Push Notifications**:
  - [x] Firebase Cloud Messaging (FCM) integration for Android push notifications.
  - [x] Apple Push Notification Service (APNs) integration for iOS.
  - [x] Push notification payload with action buttons (Approve/Reject for leave, View for payslips).
- [x] **User Notification Preferences**:
  - [x] Per-user configurable preferences: per notification category, per channel (email, push, both, none).
  - [x] `user_notification_preferences` PostgreSQL table with unique `(user_id, category)` constraint.
  - [x] `GET /notifications/preferences` — returns permission-filtered categories + saved channels.
  - [x] `PUT /notifications/preferences` — upsert single preference.
  - [x] `PUT /notifications/preferences/bulk` — batch save all preference changes.
  - [x] 18 notification categories mapped: 9 employee-level, 5 manager-level, 4 admin-level.
  - [x] Permission-filtered: employees only see categories relevant to their role; admins see all.
  - [x] `NotificationPreferencesPage.tsx` — grouped category matrix, channel pill selector, batch save.
  - [x] Route `/settings/notifications` + redirect from `/notifications/preferences`.
  - [x] Link from existing `NotificationSettings.tsx` to per-category page.
  - [x] `useNotifications.ts` TanStack Query hook with `getAuthHeaders()`.
  - [x] Flutter `NotificationSettingsScreen` — permission gate, grouped ListView, animated channel pills.
  - [x] Flutter widget tests: 4/4 passing in both repos.
  - [x] AI permission permissions seeded: `use_ai`, `ai_help`, `ai_documents`, `ai_actions`, `ai_full`, `view_notification_preferences`, `manage_notification_preferences`.
  - [x] AI & Notification permissions in `AccessControl.tsx` (tenant-level capability management).
  - [x] Notification digest mode: instant delivery vs. daily/weekly summary email.
- [x] **Automated Employee Birthday Greetings & Colleague Celebration Alerts**:
  - [x] Automated employee birthday greeting emails (`birthday-greeting.hbs` Handlebars template with brand styling and warm wishes).
  - [x] Daily 8:00 AM celebration cron service (`BirthdayGreetingsCron` with scheduled dispatch).
  - [x] Automated colleague celebration alert broadcasting (in-app, push, and notification feed alert to wish the employee a happy birthday).
  - [x] Default active celebration settings with tenant-level deactivation toggle (`GET` / `PUT` `/notifications/settings/birthday`).
  - [x] Birthday notification categories registered in notification preferences (`birthday_greeting`, `colleague_birthday_alert`) across web and mobile.
- [x] **Notification Reports**:
  - [x] Notification delivery rates and failure tracking by channel.
  - [x] User notification preference distribution summary.
  - [x] Email bounce and open rate analytics.

---

## 26. 🌍 Multi-Language (i18n) & Localization Support

- [ ] **Frontend Internationalization**:
  - [ ] i18n framework integration with language switcher accessible from user profile/settings.
  - [ ] All UI labels, messages, error texts, and placeholders stored in translation files.
  - [ ] Right-to-Left (RTL) layout support for Arabic, Hebrew, and Farsi.
- [ ] **Language Packs**:
  - [ ] Pre-packaged language packs: English, Amharic (አማርኛ), Arabic (العربية), French (Français), Spanish (Español).
  - [ ] Tenant-configurable default language with per-user override.
  - [ ] Community translation contribution portal for additional languages.
- [ ] **Localization & Formatting**:
  - [ ] Date format localization per locale (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD).
  - [ ] Number and currency format localization (decimal separators, thousands grouping, currency symbol placement).
  - [ ] Multi-currency payroll support: configurable country-specific tax brackets, pension rules, and statutory deductions beyond Ethiopian defaults.
- [ ] **Local Languages & Calendars**:
  - [ ] Amharic, Afaan Oromo, Tigrinya, Somali and Swahili UI translations, plus Arabic with right-to-left layout.
  - [ ] Ethiopian (Ge'ez) calendar display and date entry alongside Gregorian, per user.
  - [ ] AI features (voice agent, captions, transcripts) in the same languages (§31, §32).

---

## 27. ⚙️ Humanitas Global Engineering & Architecture Directives

To maintain unwavering code quality, security, and zero-rework consistency during development, the following principles are strictly enforced across every prompt and file edit:

```markdown
# Humanitas Global Engineering & Architecture Directives

1. ZERO-TRUST ACCESS CONTROL ON 100% OF ENDPOINTS & ACTIONS:
   - NEVER leave any controller, route, mutation, query, or UI action button unprotected.
   - Every single backend endpoint MUST be guarded from day one with `@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)` and `@RequirePermissions('permission.name')`.
   - Every UI view and action button MUST check `hasPermission('permission.name')` and `isModuleSubscribed('module_name')`.
   - Never implement features with "temporary bypasses" or plan to add permissions later.

2. MANDATORY PACKAGE & SUBSCRIPTION MODULE GATING:
   - All modules (HRMS, PMS, Inventory, Sales, Purchasing, POS, Accounting, AI, Recruitment, Fixed Assets) are bound to tenant package subscriptions and tenant admin module selections.
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
```

---

## 28. 🧩 Modular Packaging, Licensing & Deployment (`/platform/modules`)

> Goal: any customer can buy **one, two or any combination** of modules — as SaaS, as a dedicated cloud, or installed on **their own server that they own** — from the same codebase.

- [ ] **Module Manifest Standard** (every module ships one `module.json`):
  - [ ] Key, version, hard dependencies (`depends`), optional integrations, permissions, tenant migrations, menus/routes, settings schema, reports, timeline event types, quick-create forms, AI tools and MCP tools.
  - [ ] Hard dependencies resolved automatically at subscription time (e.g. Inventory pulls in Products); dependency graph validated in CI (no cycles, no undeclared imports between modules).
  - [ ] Semantic versioning per module with a compatibility range against the platform core.
- [ ] **Bridge (Integration) Modules — auto-activated** (the Odoo `auto_install` pattern, e.g. `sale_stock`, `pos_sale`):
  - [ ] All cross-module logic lives in bridge modules (`sales_inventory`, `pos_sales`, `purchase_inventory`, `inventory_accounting`, `crm_voip`, `sales_delivery`, `delivery_fleet`, `ecommerce_inventory`, `hr_fleet`, …), never inside a base module.
  - [ ] A bridge switches on automatically when all of its parent modules are active and switches off cleanly when one is removed — data is kept, features are hidden.
  - [ ] Every base module works fully standalone; CI tests each module alone and with each of its bridges.
- [ ] **Event & Contract Layer between modules**:
  - [ ] Domain events (`sales.order.confirmed`, `inventory.stock.moved`, `voip.call.ended`, `fleet.geofence.exited`, …) on an internal event bus with an outbox table (no lost events).
  - [ ] Versioned event and API contracts; a module only talks to another through its public service interface or events — never its tables.
- [ ] **Commercial Packaging**:
  - [ ] Sell any module alone or in suites: Retail (Products + Inventory + POS + Accounting), Trade (Products + Inventory + Purchasing + Sales + Accounting), Contact Center (VoIP + CRM + AI), Logistics (Delivery + Fleet), Manufacturing (Products + Inventory + Manufacturing + Purchasing + Accounting), People (HRMS + PMS).
  - [ ] Pricing meters per module, per seat and per usage (call minutes, AI tokens, GPS devices, SMS, storage).
  - [ ] Per-module trials, upgrade/downgrade with proration, usage dashboard for the tenant.
- [ ] **Deployment Targets (same codebase)**:
  - [ ] Multi-tenant SaaS (current).
  - [ ] Dedicated single-tenant cloud.
  - [ ] Customer-owned on-premise: Docker Compose or Kubernetes (Helm) bundle containing only the licensed modules; one-command installer; air-gapped install option.
  - [ ] Signed offline license file (modules, seats, expiry) verified without internet, with grace period and renewal by file or online.
  - [ ] On-prem update channel: signed releases, automatic migrations with pre-update backup and one-click rollback.
  - [ ] Tenant move SaaS ⇄ on-prem (full export/import with integrity check).
- [ ] **Extension SDK & Marketplace**: third-party modules use the same manifest, sandboxed permissions and a review process.

---

## 29. 🔗 In-Context Action Framework — "Finish the Task Without Leaving the Page"

> Example: a cashier in **POS** (or a rep in **Sales**) searches for a product that does not exist. If the tenant has the Products module and the user has `products.create`, they create it right there — name, price, tax, barcode scan — and it lands in the cart. No page change, no lost work.

- [ ] **Quick-Create Anywhere (permission-aware)**:
  - [ ] Every relation picker (product, customer, vendor, employee, vehicle, driver, warehouse, location, account, tax, UOM, category, project, …) offers type-to-search, **"Create '…'"** in one step, **"Create & edit…"** (full form in a side drawer) and **"Search more…"** (advanced search dialog).
  - [ ] Shown only when the target module is subscribed **and** the user has its create permission; otherwise **"Request creation"** sends a pre-filled request through the Approval Engine to someone who can.
  - [ ] The new record is selected in the original field automatically; the original form keeps all unsaved input.
  - [ ] Built-in flows: POS/Sales → new product → added to cart/line · Sales → new customer with credit-limit check · Purchase → new vendor/product · Expense → new category · Delivery → new address with map pin · Fleet → new driver · CRM → new company/contact.
  - [ ] Duplicate guard during quick-create (similar names, phones, emails, barcodes shown before saving).
- [ ] **Side Peek & Stacked Drawers**: open any linked record (customer, invoice, product, stock, call, vehicle) in a right-side drawer; drawers stack with a breadcrumb; `Esc` returns to where the user was with state intact.
- [ ] **Smart Buttons (related counters)** on every record across subscribed modules (Orders 12 · Invoices 8 · Calls 5 · Deliveries 3 · Tickets 1); each opens in a drawer.
- [ ] **Inline actions on any record**: call (VoIP or app), video call, chat, email, SMS, WhatsApp, schedule activity, create task, create quote/order, register payment, print/send — each gated by module subscription and permission.
- [ ] **Embedded cross-module widgets**: stock availability and margin on Sales/POS lines, customer balance and credit on POS/Sales, live vehicle position on deliveries, softphone panel on CRM/Sales/POS/Support.
- [ ] **Command palette actions in context** (`Ctrl/Cmd + K`): "create invoice for this order", "call this customer", "assign this delivery to Abebe".
- [ ] **Inline grid editing** with validation and undo; bulk actions without leaving the list.
- [ ] **Draft safety**: auto-saved drafts on every form, leave-page warning, draft recovery after a crash or lost connection.
- [ ] **Developer contract**: one shared `EntityPicker` + `QuickCreateRegistry` + `RecordDrawer` (web and Flutter). A module registers its quick-create form once and every other module gets it automatically — no copy-paste.

---

## 30. 🕒 Universal Activity Timeline & Interaction Log

> Every action and status change is time-stamped. For a lead: 1st call (scripted, recorded, transcript, AI summary), 2nd call, email, WhatsApp, meeting, quote sent — all on one timeline with date, channel, direction, who, and what was said.

- [ ] Every business record (lead, contact, account, deal, order, invoice, PO, product, delivery, vehicle, employee, candidate, ticket, project, task) has a timeline panel.
- [ ] **Automatic, immutable, time-stamped entries**: creation, every tracked field change (old → new, who, when, through UI/API/AI/MCP), stage changes with time-in-stage, approvals, generated documents.
- [ ] **Interaction log (touchpoints)**: channel (VoIP call, app voice call, video call, email, SMS, WhatsApp, chat, meeting, visit), direction, sequence number (1st, 2nd … contact), start/end time, duration, outcome/disposition, participants, user, description.
- [ ] **Attachments on interactions**: call or video recording, transcript, AI summary, call script used (with version and answers per step), files, screenshots.
- [ ] Manual entries for past interactions (backdated, flagged in the audit trail).
- [ ] **Scheduled activities**: call, meeting, email, to-do with due dates, reminders, overdue badges and **activity plans** (multi-step sequences assigned in one click).
- [ ] Internal notes vs. customer-visible messages, @mentions, followers with per-event notification preferences.
- [ ] Filters (channel, user, type, date), search, export; roll-up view on parent records (an account shows its contacts' interactions).
- [ ] Privacy: recording consent flags, per-tenant retention policies, PII redaction in transcripts, legal hold.
- [ ] One shared `activity_events` service used by all modules; modules only emit events (works standalone and on-prem).

---

## 31. 📹 Unified Communications — Voice & Video Calls in Chat (`/chat`)

- [ ] 1-to-1 and group **voice calls**; 1-to-1 and group **video calls**.
- [ ] Switch freely during a call: turning the camera on makes it a video call, turning it off makes it voice-only — per participant, without reconnecting.
- [ ] **Screen sharing** (screen, window or tab) alongside the camera, with presenter control.
- [ ] Media architecture: peer-to-peer for small calls, self-hostable SFU (LiveKit or mediasoup) for groups, TURN relay for restrictive networks, adaptive bitrate and a low-bandwidth audio-only mode.
- [ ] **External guest links**: secure invite link (expiry, optional PIN, lobby/waiting room, host admits) for people outside the platform, in the browser, no account needed.
- [ ] Scheduled meetings from Calendar, Chat, CRM, Recruitment (interviews), Projects — link generated automatically.
- [ ] In-call: mute, raise hand, reactions, chat, participant list, host controls (mute all, remove, lock), background blur, noise suppression, picture-in-picture, device switching, network-quality indicator.
- [ ] Recording with consent notice; AI transcript, summary and action items posted to the linked record's timeline (deal, ticket, project, candidate).
- [ ] Call history, missed-call notifications, native incoming-call screen on mobile (CallKit / ConnectionService).
- [ ] Live captions and translation (Amharic, Afaan Oromo, Tigrinya, Swahili, English, Arabic …) — AI tier.
- [ ] "Start a call about this record" from any record — logged to that record's timeline.
- [ ] End-to-end encryption option for 1-to-1 calls; recordings encrypted at rest.
- [ ] Full mobile parity (Flutter).

---

## 32. ☎️ VoIP, Cloud PBX & AI Contact Center (`/voip`)

- [ ] **Provider-agnostic telephony layer**:
  - [ ] SIP trunk connectors: **Ethio Telecom** (SIP / hosted PBX), **Safaricom** (Kenya and Ethiopia), **Twilio** (Programmable Voice / Elastic SIP), Telnyx, Vonage, Africa's Talking, Plivo, and generic SIP for any carrier.
  - [ ] Connect an existing PBX (Asterisk/FreePBX, 3CX, Yeastar, Grandstream) over SIP or AMI/ARI.
  - [ ] One adapter interface (dial, answer, transfer, record, DTMF, events) — modules never depend on a specific carrier.
  - [ ] Self-hostable media/PBX core (FreeSWITCH or Asterisk) for on-prem; managed mode for SaaS.
  - [ ] Number management: DIDs, toll-free and short codes per company/branch/team; caller ID rules; least-cost routing and automatic failover between providers.
- [ ] **Softphone everywhere**: WebRTC softphone on web and mobile, SIP desk-phone registration, click-to-call on every phone number in every module, **screen pop** on incoming calls showing the matching customer/lead/order/delivery with quick actions.
- [ ] **PBX features**: extensions, ring groups, drag-and-drop IVR (multi-language, business hours, holidays), queues with skills-based routing, voicemail with transcription, blind/attended transfer, hold music, conference/merge, park/pickup, DND, follow-me to mobile.
- [ ] **Recording & compliance**: rules per queue/user, consent announcement, pause during card payments, encrypted storage, retention policies.
- [ ] **Contact center**: agent states (available/busy/wrap-up), wallboards, live monitoring, supervisor whisper/barge, scheduled callbacks, outbound campaigns (preview, progressive, predictive) with do-not-call lists, after-call forms, dispositions and SLAs.
- [ ] **AI Voice Agent** (AI tier):
  - [ ] Answers calls 24/7 or on overflow, in Amharic, Afaan Oromo, Tigrinya, Swahili, English, Arabic …; handles interruptions; hands over to a human with a summary.
  - [ ] **Takes orders by phone**: identifies the caller, checks products, stock and prices, creates the Sales/POS/online order, sends a payment link (telebirr, M-Pesa, card), and books a delivery slot when Delivery is subscribed.
  - [ ] Answers order status, delivery ETA (from Delivery/Fleet), invoice balance, appointment booking and FAQs from the Knowledge Vault.
  - [ ] **Creates/updates CRM leads automatically** from the conversation: name, company, need, budget, timeline, sentiment, next step.
  - [ ] Guardrails: reads the order back for confirmation before committing, per-tenant limits, permissioned tools only, full audio + transcript on the timeline, `executed_by: ai_on_behalf` audit.
- [ ] **AI Copilot for human agents**: live transcription, suggested answers, script guidance, auto-filled after-call form, automatic summary to the timeline.
- [ ] **Bridges into modules**: CRM (sales calls, lead auto-fill, cadences), Sales & POS (phone orders), Online Store, Delivery (masked driver ↔ customer calls), Support tickets, Recruitment (phone screens), Accounting (collection calls in dunning), Fleet (driver hotline, alert calls).
- [ ] SMS and WhatsApp from the same numbers where the provider supports it.
- [ ] Analytics: volumes, average handle time, first-call resolution, abandonment, wait time, agent performance, cost per provider, AI containment rate.
- [ ] Usage metering for billing: minutes per provider, recording storage, AI minutes.

---

## 33. 🔌 MCP & Open AI Connectivity (`/settings/ai-connections`)

> Customers can connect **any AI they want** (Claude, ChatGPT, Gemini, Copilot, or their own local model) to their Humanitas data — safely, with the same permissions as the user.

- [ ] **Humanitas MCP Server** (remote, Streamable HTTP, MCP spec `2026-07-28`, stateless and horizontally scalable; SaaS and on-prem):
  - [ ] OAuth 2.1 authorization with per-user consent and tenant-admin approval of client apps; scopes mapped to RBAC permissions and module subscriptions — an AI can never do more than its user.
  - [ ] Tools generated from module manifests (one registry shared with the built-in AI Action Executor): search/read records, create/update with validation, run reports, approvals, start a call, send SMS — only for subscribed modules.
  - [ ] Resources (records, reports, documents, Knowledge Vault) and prompts (module playbooks).
  - [ ] Destructive actions require explicit human confirmation; optional read-only mode; rate limits; per-client token revocation.
  - [ ] Full audit of every MCP call (client, user, tool, arguments, result) for admins, with anomaly alerts.
- [ ] **MCP client for the built-in AI**: tenant admins connect external MCP servers (Google Drive, Slack, GitHub, banks, e-commerce, …) to an allow-list the Humanitas AI may use.
- [ ] **Bring your own model**: provider per capability (OpenAI, Anthropic, Google, Azure, or local Ollama/vLLM for on-prem), keys stored encrypted, cost tracking per tenant.
- [ ] **One tool registry → three surfaces**: MCP tools, public REST API (OpenAPI docs) and webhooks stay in sync automatically.
- [ ] **AI Agent Builder**: tenants create agents (sales assistant, collections agent, HR helpdesk, delivery dispatcher) with chosen tools, knowledge and channels (chat, voice, WhatsApp, website).

---

## 34. 🛍️ Online Store & Omnichannel Ordering (`/ecommerce`)

- [ ] Storefront with themes, product pages from Products, live stock from Inventory, cart and checkout.
- [ ] Payments: telebirr, M-Pesa, Chapa, cards, bank transfer, cash on delivery.
- [ ] **One order queue for every channel**: web store, phone (agent or AI voice agent), WhatsApp, POS, sales reps, marketplaces.
- [ ] Customer accounts, order tracking page, reorder, wishlists, reviews.
- [ ] Promotions, coupons, gift cards and loyalty shared with POS.
- [ ] Delivery options and slot booking from Delivery; click-and-collect from a store.
- [ ] SEO, multi-language, multi-currency.

---

## 35. 🚚 Delivery & Last-Mile Logistics (`/delivery`)

- [ ] Delivery orders created from Sales, POS, Online Store and phone orders.
- [ ] Delivery zones, rates, time slots and capacity; in-house fleet or third-party couriers.
- [ ] Dispatch board: assign driver and vehicle, AI route optimization (multi-stop, time windows, vehicle capacity), live map from Fleet GPS.
- [ ] Driver mobile app: route and navigation, masked call/SMS to the customer through VoIP, package scanning, proof of delivery (signature, photo, OTP), cash-on-delivery collection reconciled into Accounting.
- [ ] Customer live-tracking link and ETA by SMS/WhatsApp; failed-delivery reasons and rescheduling; return pickups.
- [ ] KPIs: on-time rate, cost per drop, failed deliveries, COD variance.

---

## 36. 🚗 Fleet Management & GPS Telematics (`/fleet`)

- [ ] **Fleet core** (Odoo Fleet parity): vehicle registry (models, brands, categories, plate, VIN), documents (insurance, registration, inspection) with expiry alerts, driver/department assignment history, contracts (lease, insurance, service) with costs, odometer log, fuel log (cards and receipts), preventive maintenance by km/time/engine hours, tires, accidents/incidents, traffic fines.
- [ ] **GPS device management**: tracker registry (IMEI, SIM, model, install date) and an ingestion gateway supporting 200+ tracker protocols through Traccar (open source, Apache 2.0) or direct decoders (Teltonika, Concox/GT06, Queclink, Coban, SinoTrack, phone apps via OsmAnd).
- [ ] **Live tracking**: live map, trip history and playback, stops, geofences with enter/exit alerts, speeding, harsh braking/acceleration, idling, after-hours use, ignition status.
- [ ] **Sensors and commands**: fuel level, temperature (cold chain), panic button, driver ID (RFID/iButton); remote immobilizer command — permissioned, confirmed and audited.
- [ ] Driver behaviour scores and working hours.
- [ ] Alerts in app, by SMS, email or automated VoIP call, with escalation rules.
- [ ] Odometer updated from GPS automatically; maintenance scheduled automatically from mileage or engine hours.
- [ ] Cost analytics: total cost of ownership per vehicle, fuel efficiency, utilization, cost per km, fuel-theft detection.
- [ ] Bridges: Delivery (live position, ETA), HRMS (drivers, licences), Fixed Assets/Accounting (costs, depreciation), Inventory (spare parts), Purchasing (service vendors).
- [ ] Scale: time-series storage (TimescaleDB or partitioned tables) with retention policies; map provider choice (self-hosted OpenStreetMap for on-prem, Google/Mapbox for cloud).

---

## 37. 🛡️ Quality Guardrails & Regression Prevention

> Every issue fixed in the November 2026 audit becomes a rule with an automated check, so it cannot come back in new modules.

- [ ] **Secrets**: secret scanning (gitleaks) in CI and pre-commit; example env files hold placeholders for new variables; documented rotation runbook. *(Lesson: real secrets in example files and chat.)*
- [ ] **Auth fails closed**: every guard verifies tokens cryptographically, refresh tokens are rejected as access tokens, and every guard has unit tests. *(Lesson: a guard decoded tokens without verifying them.)*
- [ ] **Admin safety**: least-privilege role defaults, last-super-admin protection, sessions revoked on role, status or password change.
- [ ] **No destructive surprises**: deletes are soft, confirmed by typing the name, with a retention window before purge; nothing drops a database on an error path. *(Lesson: tenant creation could drop an existing database.)*
- [ ] **Schema drift check**: every entity change ships with a tenant migration; CI compares entities against migrations.
- [ ] **Time zones**: containers pinned to `TZ=UTC`; the test suite runs in a non-UTC zone to catch wall-clock bugs. *(Lesson: clock-in times depended on the server zone.)*
- [ ] **Money and tax math**: continuous tax brackets (no gaps), half-up rounding once per component, totals from rounded parts, boundary tests (e.g. 600.50, 1650.50). *(Lesson: bracket gaps taxed some incomes at 0.)*
- [ ] **Encryption keys are versioned** (current + previous) with re-encryption tooling before any rotation.
- [ ] **Deploy safety**: deploys never run in parallel, tests gate every deploy, stale-container recovery, health checks and rollback. *(Lesson: overlapping deploys collided on container names.)*
- [ ] **Refactors start with characterization (golden-master) tests**, as done for the attendance split.
- [ ] **Types**: `no-explicit-any` is an error for new code and the existing count may only go down; typed request objects everywhere.
- [ ] **Mobile**: release builds never point at localhost, no cleartext traffic in release, no `BuildContext` across async gaps, analyzer warnings may only go down.
- [ ] **Dependencies**: Node LTS only; high/critical `npm audit` findings fail CI; weekly automated dependency PRs.
- [ ] **Network exposure**: databases and admin tools are never published on `0.0.0.0` in new compose files; a compose lint check enforces it.
- [ ] **Tests are never deleted without a replacement**: CI fails if the test count drops.
- [ ] **Shared code stays mirrored**: CI diffs shared modules between `Humanitas` and `Humanitas-ERP`.
- [ ] **Per-module Definition of Done**: manifest, migrations, RBAC, subscription gate, timeline events, quick-create form, AI/MCP tools, reports, mobile screens, unit + end-to-end tests, Knowledge Base entries.

---

## 38. 🏭 Manufacturing (MRP), Quality & Plant Maintenance (`/manufacturing`)

> World-class discrete, process and batch manufacturing (Odoo MRP/Quality/Maintenance/PLM parity and beyond), built for Ethiopian plants: agro-processing, food and beverage, pharmaceuticals, textile and garment, leather, cement and construction materials, plastics and packaging, metal works and assembly.

- [ ] **Bills of Materials (BoM) & Engineering**:
  - [ ] Multi-level BoMs with components, by-products, co-products, scrap factors and yield; phantom/kit BoMs; variant-specific lines (one BoM for all sizes/colors).
  - [ ] Process recipes/formulas with percentages and batch sizes (food, beverage, pharma, chemicals, paint).
  - [ ] Routings: operations, work centers, setup/run/cleanup times, operator instructions with images/videos, quality checkpoints per step.
  - [ ] PLM: engineering change orders (ECO) with approval, BoM/routing versioning and effective dates, document control (drawings, specs, SOPs).
  - [ ] BoM cost roll-up (materials + labor + machine + overhead) through the Python calculation engine; what-if costing.
- [ ] **Production Planning (MPS / MRP)**:
  - [ ] Master production schedule from sales forecasts, confirmed orders and safety stock.
  - [ ] MRP run: net requirements, planned manufacturing orders, planned purchases with lead times; make-to-order and make-to-stock.
  - [ ] Finite-capacity scheduling with drag-and-drop Gantt per work center, shift calendars (from HRMS shifts) and holidays (Ethiopian calendar).
  - [ ] Material availability check before release; shortage list with one-click RFQ or transfer.
- [ ] **Manufacturing Orders & Shop Floor**:
  - [ ] MO lifecycle (Draft → Confirmed → In progress → Done → Closed) with partial production, split/merge and backorders.
  - [ ] Work orders per operation; tablet/kiosk shop-floor app (offline-capable) with start/pause/finish, barcode/QR scanning and Amharic/Afaan Oromo/Tigrinya UI.
  - [ ] Real-time material consumption (backflush or manual), lot/serial capture, scrap and rework recording with reasons.
  - [ ] Labor time tracking per operator feeding payroll (piece-rate and overtime according to the Labour Proclamation via HRMS).
  - [ ] Subcontracting (send components, receive finished goods, pay service fee) and toll/contract manufacturing for customers.
  - [ ] Disassembly/unbuild orders and repairs.
  - [ ] Quick-create from the shop floor when permitted (missing component, new lot, scrap reason) — §29.
- [ ] **Quality Management (QMS)**:
  - [ ] Quality control points (incoming, in-process, final) with pass/fail, measurement (with tolerances) and photo checks.
  - [ ] Sampling plans (AQL), statistical process control charts, certificates of analysis (CoA).
  - [ ] Non-conformance reports, quarantine, deviations and CAPA workflows with root-cause analysis.
  - [ ] Lab information: test methods, specifications, stability studies, retained samples.
  - [ ] Full batch genealogy (raw lot → batch → finished lot → customer), with mock-recall and recall execution.
- [ ] **Plant Maintenance (CMMS)**:
  - [ ] Equipment registry linked to Fixed Assets; preventive maintenance by calendar, run-hours or cycles; corrective requests from the shop floor.
  - [ ] Spare parts from Inventory, maintenance costs to Accounting, technician scheduling.
  - [ ] OEE (availability × performance × quality), downtime capture with reasons — including **power outage** and **generator** events with fuel consumption tracking.
  - [ ] IoT/PLC data (counters, temperatures, energy meters) through a local device bridge (MQTT/OPC UA).
- [ ] **Costing & Accounting Integration**:
  - [ ] Standard, average and actual costing per MO; variances (material, labor, overhead, yield) posted automatically.
  - [ ] Work-in-progress valuation, overhead absorption rates per work center, by-product cost allocation.
  - [ ] Energy and utility cost allocation (electricity, water, steam, generator fuel) per work center.
- [ ] **Ethiopia-Specific Compliance & Localization**:
  - [ ] **EFDA** regulated plants (food, medicines, cosmetics): GMP, GDP and GSP-ready records — electronic batch records, cleaning/line clearance logs, environmental monitoring, equipment calibration, deviation/CAPA, product registration and marketing-authorization tracking.
  - [ ] **Institute of Ethiopian Standards (IES)**: product standard references (ES numbers) per product, Ethiopian Standards mark authorization and renewal tracking; conformity certificates from **ECAE**; calibration records traceable to the **Ethiopian Metrology Institute**; accredited lab results (EAS).
  - [ ] **Excise tax** (Proclamation 1186/2020) computed at production/removal for excisable goods (beverages, edible oil, sugar products, tobacco, vehicles …), plus VAT and withholding; excise stamps/marking where required.
  - [ ] Imported raw materials: letter-of-credit (LC) and forex allocation tracking, customs declarations and duty, landed cost into material cost (with Purchasing).
  - [ ] Export production: duty-drawback/voucher scheme records, export permits, buyer compliance documents; coffee traceability (ECX grades, washing station, farm geolocation for EU deforestation-regulation due diligence).
  - [ ] Industrial-park operations (e.g. Hawassa, Bole Lemi, Kilinto, Dire Dawa): park-specific reporting, environmental and effluent monitoring logs.
  - [ ] Sector templates: flour/feed mills, edible oil, beverages and water bottling, dairy, coffee and tea processing, pharmaceuticals, textile/garment (cut-make-trim with size-color bundles), tannery and leather goods, cement/blocks, plastics, furniture.
  - [ ] Production planning in the Ethiopian (Ge'ez) calendar, ETB costing with multi-currency imported inputs.
- [ ] **AI & Communications**:
  - [ ] AI production planner (suggests schedule from demand, capacity, power-outage history and material ETAs).
  - [ ] AI quality assistant: anomaly detection on measurements, CAPA drafting, SOP Q&A from the Knowledge Vault.
  - [ ] Machine-down alerts by app/SMS/VoIP call to maintenance on duty; video call from the shop floor to a remote technician with screen/camera share (§31, §32).
  - [ ] MCP tools for production status, material shortages and quality results (§33).
- [ ] **Manufacturing Reports**:
  - [ ] Production vs. plan, OEE and downtime Pareto, yield and scrap, cost variance per product, WIP valuation.
  - [ ] Quality KPIs (first-pass yield, NCR/CAPA ageing), batch genealogy report, maintenance compliance.
  - [ ] Energy cost per unit, generator hours and fuel per period.
