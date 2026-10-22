# 🌟 Humanitas Enterprise ERP — Master Feature & Capability Specification

This document provides a comprehensive, enterprise-grade feature checklist for the **Humanitas Modular Cloud ERP Platform**, designed to rival top-tier global enterprise systems like **Microsoft Dynamics 365, SAP S/4HANA, NetSuite, and Odoo**.

---

## 📊 Overall Progress

| Module | Total | ✅ Done | ⏳ Remaining | % Complete |
|--------|-------|---------|-------------|-----------|
| System Architecture & Core | 28 | 28 | 0 | 100% |
| Products & Catalog | 25 | 0 | 25 | 0% |
| Inventory & Warehouse | 32 | 0 | 32 | 0% |
| Purchasing & Vendors | 32 | 0 | 32 | 0% |
| Sales, CRM & E-Invoicing | 34 | 0 | 34 | 0% |
| Point of Sale (POS) | 37 | 0 | 37 | 0% |
| Accounting & Fixed Assets | 54 | 1 | 53 | 2% |
| HRMS & Recruitment | 45 | 33 | 12 | 73% |
| Project Management (PMS) | 28 | 16 | 12 | 57% |
| Dynamic Approval Engine | 12 | 0 | 12 | 0% |
| Webhooks & Developer API | 16 | 0 | 16 | 0% |
| Enterprise UI/UX | 23 | 18 | 5 | 78% |
| Billing & Subscriptions | 21 | 0 | 21 | 0% |
| AI Intelligence Module | 38 | 6 | 32 | 16% |
| Employee Self-Service Portal | 21 | 0 | 21 | 0% |
| Document Vault & Letters | 19 | 0 | 19 | 0% |
| Onboarding & Offboarding | 22 | 0 | 22 | 0% |
| Grievance & Complaints | 17 | 0 | 17 | 0% |
| Benefits & Insurance | 17 | 0 | 17 | 0% |
| Training & LMS | 22 | 0 | 22 | 0% |
| 360 Performance Reviews | 27 | 0 | 27 | 0% |
| Expense Management | 19 | 0 | 19 | 0% |
| Asset & Equipment Tracking | 19 | 0 | 19 | 0% |
| Pulse Surveys & Engagement | 19 | 0 | 19 | 0% |
| Bulk Import/Export | 13 | 0 | 13 | 0% |
| Notification Engine | 19 | 3 | 16 | 16% |
| Multi-Language (i18n) | 12 | 0 | 12 | 0% |
| **TOTAL** | **671** | **105** | **566** | **16%** |

---

## 0. 🏗️ System Architecture & Core

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

---

## 4. 💼 Sales, CRM & Invoicing (`/sales`)

- [ ] **Customer Relationship Management (CRM)**:
  - [ ] Lead capture, qualification, and interactive Kanban sales opportunity pipeline.
  - [ ] Customer master data (credit limits, tax ID, payment terms, delivery addresses).
  - [ ] Activity log (calls, meetings, notes, and emails logged per customer).
- [ ] **Sales Quotations**:
  - [ ] Professional quotation generator with discount rules, price lists, and expiration dates.
  - [ ] Customer quote acceptance portal / digital signature.
  - [ ] 1-Click conversion of approved Quotes into Sales Orders.
- [ ] **Sales Orders (SO)**:
  - [ ] Automated stock reservation upon SO confirmation.
  - [ ] Credit limit validation preventing dispatch to overdue accounts.
  - [ ] Order lifecycle management (`Quotation` -> `Sales Order` -> `Picking` -> `Shipped` -> `Invoiced` -> `Paid`).
- [ ] **Delivery Orders (DO) & Dispatch**:
  - [ ] Warehouse picking and packing slip generation.
  - [ ] QR scan dispatch verification and proof-of-delivery tracking.
- [ ] **Sales Invoicing & Tax Calculations**:
  - [ ] Automated invoice generation from Sales Orders or Delivery Orders.
  - [ ] Multi-rate tax engine (VAT, GST, State Tax, Withholding) calculated by Python Engine.
  - [ ] Recurring Invoicing engine for subscription-based sales.
- [ ] **Regulatory E-Invoicing & Fiscalization**:
  - [ ] Cryptographic hash generation and QR code fiscalization complying with tax authorities (e.g., Ethiopian ERCA/Ministry of Revenues, ZATCA Phase 2, European e-invoicing).
  - [ ] Tamper-proof digital invoice signature and audit validation.
  - [ ] Automated transmission to government tax portals where supported.
- [ ] **Credit Notes & Returns**:
  - [ ] Customer return processing, stock re-entry, and Credit Note issuance against customer ledger.
- [ ] **Sales Commission & Analytics**:
  - [ ] Sales rep commission tracking based on sales volume or gross profit margin.
  - [ ] Sales performance leaderboards and forecasting dashboards.
- [ ] **Sales Reports**:
  - [ ] Sales summary by period, customer, product, and sales rep.
  - [ ] Quotation conversion rate analysis (Quotes → Orders → Invoices).
  - [ ] Revenue and gross margin trend reports.
  - [ ] Customer aged receivables summary.
  - [ ] Top customers, top products, and sales pipeline forecast.

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

---

## 7. 👥 Decoupled Human Resource Management & Recruitment (HRMS) (`/hrms`)

- [x] **Organization Settings — Companies & Branches (`/settings/organization`)**:
  - [x] Companies CRUD: create, view, edit, and delete companies with name, code, address, and status fields.
  - [x] Branches CRUD: create, view, edit, and delete branches tied to their parent company.
  - [x] Active company/branch scope banner displayed at the top of the OrganizationSettings page; list filtered to the current scope context.
- [x] **Employee Lifecycle & Profiles**:
  - [x] Comprehensive digital employee profile: Personal info, emergency contacts, employment contracts, salary grade, bank details, and compliance documents.
  - [x] Visual Organizational Chart with reporting manager hierarchy.
  - [ ] Onboarding & Offboarding task checklists.
- [x] **Recruitment & Applicant Tracking System (ATS) (`/hrms/recruitment`)**:
  - [x] Job Requisition creation with budget approval workflow.
  - [x] Job Postings management & public career portal page.
  - [x] Candidate Pipeline Kanban (`Applied` -> `Screening` -> `Interview` -> `Offer` -> `Hired` -> `Rejected`).
  - [ ] Candidate Resume/CV storage, applicant scoring, and interview scheduling with calendar sync.
  - [ ] Offer letter generation and digital acceptance workflow.
  - [ ] **1-Click Candidate-to-Employee Conversion**: Auto-provisions employee profile, contract, and onboarding checklist upon hire.
  - [ ] Recruitment Reports:
    - [ ] Hiring funnel conversion rates (Applied -> Screened -> Interviewed -> Offered -> Hired).
    - [ ] Time-to-hire and cost-per-hire analytics by department and role.
    - [ ] Open vs. filled positions summary.
- [x] **Biometric & Mobile Attendance**:
  - [x] Integration with ZKTeco & Hikvision hardware biometric devices.
  - [x] Mobile Geofenced & QR Code Clock-In / Clock-Out with anti-spoofing checks.
  - [x] Shift pattern assignment, night shift allowances, and grace-period management.
  - [x] Cursor-based batch pagination for instant absent processing across 100,000+ employees.
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
  - [ ] Direct Bank Transfer export files (ABA, NACHA, local bank CSV formats).
- [x] **HRMS Reports**:
  - [ ] Headcount and demographic analysis (by department, gender, age band, tenure).
  - [ ] Recruitment velocity & hiring funnel conversion report.
  - [x] Attendance summary report (present, absent, late, early departure rates).
  - [x] Leave utilization report by type and department.
  - [x] Overtime cost analysis by department and period.
  - [x] Payroll cost breakdown report (gross, deductions, net by department).
  - [ ] Employee turnover and retention rate analysis.

---

## 8. 🚀 Decoupled Project Management System (PMS) (`/pms`)

- [x] **Multi-Project Workspace**:
  - [x] Portfolio dashboard with project progress, health status, deadlines, and budget burn rates.
  - [ ] Public vs. Private project confidentiality permissions.
- [ ] **Agile Sprints & Backlog**:
  - [ ] Sprint planning, velocity charts, story points, and sprint burndown/burnup graphs.
  - [ ] Backlog prioritization with drag-and-drop hierarchy.
- [x] **Interactive Views**:
  - [x] **Kanban Board**: Customizable column workflows (To Do, In Progress, Code Review, QA, Done) with WIP limits.
  - [ ] **Gantt Chart**: Interactive timeline with milestone markers and critical path visualization.
  - [x] **List & Grid View**: High-density table with custom filtering, sorting, and inline editing.
  - [ ] **Calendar View**: Task deadline and milestone calendar.
- [x] **Comprehensive Task Management**:
  - [x] Subtasks, checklists, task dependencies (`Finish-to-Start`, `Start-to-Start`, etc.).
  - [x] Custom task fields (Dropdowns, Numbers, Dates, Text).
  - [x] Rich text descriptions, file attachments, and @mention task comment threads.
  - [x] Review Queues & Task Sign-off approvals.
- [x] **Time Tracking & Billing**:
  - [x] Live task stopwatch timer and manual time log entries.
  - [ ] Billable vs. Non-Billable hour segregation.
  - [ ] Direct conversion of billable timesheets into Sales Invoices.
- [ ] **KPI & Appraisal Engine (Python Powered)**:
  - [ ] Automated KPI score computation based on task completion velocity, on-time delivery rate, and peer reviews.
- [x] **PMS Reports**:
  - [x] Project health summary (on-track, at-risk, overdue) with budget burn rate.
  - [ ] Sprint velocity and burndown/burnup charts.
  - [x] Team workload distribution and capacity planning.
  - [ ] Billable hours vs. non-billable hours by project and team member.
  - [x] Task completion rates and average cycle time analysis.

---

## 9. 🔀 Dynamic Approval Workflow Engine (`/settings/approvals`)

- [ ] **Configurable Multi-Tier Approval Rules**:
  - [ ] User-defined approval hierarchies across all operational workflows:
    - [ ] Purchase Requisitions & Purchase Orders (threshold-based: e.g. <$1,000 Manager, >$5,000 Director, >$25,000 CFO)
    - [ ] Sales Quotation & Order Discounts (e.g. >10% Team Lead, >20% Sales VP)
    - [ ] Customer Credit Limit overrides
    - [ ] Leave Requests & Overtime Claims
    - [ ] Inventory Write-offs & Stock Adjustments
    - [ ] Fixed Asset disposals and write-offs
    - [ ] General Journal Postings
  - [ ] Support for parallel (all must approve) and sequential (stepped approval) routes.
  - [ ] Automated email and push notification alerts with 1-click Approve / Reject action links.
  - [ ] Complete approval audit trail with timestamp, approver comments, and full status history.

---

## 10. 🔌 Webhooks & Developer API Portal (`/settings/developer-api`)

- [ ] **Tenant API Key Management**:
  - [ ] Generation of scoped, revocable REST API keys for external ERP integrations.
  - [ ] Granular permission assignment per API key (e.g. read-only products, create sales orders).
  - [ ] Rate limiting and request throttling per API token.
  - [ ] API key activity log (last used, request count).
- [ ] **Outgoing Event Webhooks**:
  - [ ] Real-time HTTP POST event dispatch to external URLs upon ERP triggers:
    - [ ] `invoice.created`, `invoice.paid`, `invoice.overdue`
    - [ ] `inventory.low_stock`, `inventory.stock_received`
    - [ ] `order.confirmed`, `order.dispatched`, `order.delivered`
    - [ ] `employee.hired`, `employee.terminated`
    - [ ] `payroll.run_completed`
    - [ ] `leave.approved`, `leave.rejected`
  - [ ] HMAC SHA-256 signature verification for secure webhook delivery.
  - [ ] Automated retry queue with exponential backoff for failed webhook deliveries.
  - [ ] Interactive Webhook delivery log viewer (request payload, HTTP status, response body).

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
- [ ] **High-Density Enterprise Data Grids**:
  - [ ] Resizable and reorderable table columns.
  - [ ] Column pinning (freeze left/right), sorting, and multi-condition filtering.
  - [ ] Multi-row selection for bulk actions (Bulk Delete, Bulk Export, Bulk Status Update).
  - [ ] Instant 1-click Export to CSV, Excel, and PDF.

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
- [ ] Registration includes: route path, page purpose, available actions, button locations and labels, required permissions, and step-by-step how-to instructions.
- [ ] Knowledge base is updated automatically every time a new feature, page, or action is created or modified.
- [ ] AI uses this knowledge to provide accurate contextual help, navigation guidance, and action execution.

### AI Chat / Help Interface
- [x] Conversational panel accessible from the global header AI button.
- [ ] Users ask natural language questions about how to use the system.
- [ ] AI responds with accurate step-by-step instructions, links to relevant pages, and descriptions of button locations.
- [ ] Context-aware: AI knows which module the user is currently in and tailors responses accordingly.

### AI Action Executor
- [ ] Receives natural language commands from the user.
- [ ] Maps commands to system actions (create record, approve request, generate report, navigate to page).
- [ ] **Permission enforcement**: Before executing any action, AI verifies the user has the required RBAC permissions. If not, AI explains what permissions are needed.
- [ ] Action types supported:
  - [ ] CRUD operations on any entity (Create employee, Update product price, Delete draft PO).
  - [ ] Approval workflows (Approve leave request, Confirm purchase order).
  - [ ] Report generation (Generate sales report for Q3, Run trial balance).
  - [ ] Navigation assistance (Open the inventory settings page, Show me all overdue invoices).
- [ ] Execution audit trail: All AI-executed actions are logged in the system audit log with `executed_by: 'ai_on_behalf'` and the originating user ID.

### AI Document Preparation Engine
- [ ] Generates professional formatted documents from tenant database data.
- [ ] **Supported formats**: PDF (via WeasyPrint) and DOCX (via python-docx).
- [ ] **Data access**: AI queries the tenant database through the Python calculation service to gather all required data.
- [ ] **Template matching**: User can upload a sample document (PDF/DOCX). AI analyzes its structure (headers, tables, fonts, margins, logos) and generates new documents in that exact format with fresh data.
- [ ] **Pre-built document types**:
  - [ ] Payroll summary reports and individual payslips.
  - [ ] Sales invoices and quotations.
  - [ ] Purchase orders and delivery notes.
  - [ ] Inventory stock reports and valuation summaries.
  - [ ] Financial statements (P&L, Balance Sheet, Trial Balance).
  - [ ] Employee contracts and offer letters.
  - [ ] Attendance and leave summary reports.
- [ ] **Custom freeform documents**: User describes any document in natural language, AI composes it from available data.

### AI Settings (`/ai/settings`)
- [ ] Enable/disable individual AI capability tiers.
- [ ] Configure AI action execution limits (e.g., max records per bulk action).
- [ ] AI response language preference.
- [ ] AI document default branding (logo, colors, fonts for generated documents).

---

## 14. 🏠 Employee Self-Service Portal (`/self-service`)

- [ ] **Unified "My HR" Dashboard**:
  - [ ] Personal summary cards: leave balance, next payslip date, attendance streak, pending requests count.
  - [ ] Quick-action shortcuts: Request Leave, Log Overtime, Submit Expense, View Payslip.
- [ ] **Personal Payslip Center**:
  - [ ] Payslip history viewer with month-by-month breakdown.
  - [ ] Bulk PDF download of payslips by date range.
  - [ ] Year-to-date earnings and deductions summary.
- [ ] **Personal Attendance & Leave Tracker**:
  - [ ] Attendance history calendar heatmap (present, late, absent, leave).
  - [ ] Leave balance dashboard with accrual projections.
  - [ ] Leave request submission with team calendar conflict visibility.
- [ ] **Profile Self-Edit**:
  - [ ] Employee-editable personal fields (address, phone, emergency contacts, bank details).
  - [ ] Approval workflow for sensitive field changes (bank account, tax ID) requiring HR sign-off.
- [ ] **Personal Tax & Benefits Portal**:
  - [ ] Tax declaration submission and viewing.
  - [ ] Benefits enrollment and current coverage summary.
- [ ] **Self-Service Reports**:
  - [ ] Personal attendance and punctuality summary.
  - [ ] Personal leave usage and accrual history.
  - [ ] Personal payslip and compensation trend chart.

---

## 15. 📂 Employee Document Vault & Letter Templates (`/hrms/documents`)

- [ ] **Per-Employee Document Repository**:
  - [ ] Centralized storage for contracts, certifications, ID copies, disciplinary records, and compliance documents.
  - [ ] Document versioning with full audit trail (who uploaded, when, what changed).
  - [ ] Role-based document access (HR full access, managers team-only, employees own-only).
- [ ] **Document Expiry & Compliance Tracking**:
  - [ ] Expiry date tracking for visas, certifications, medical exams, and licenses.
  - [ ] Automated email/push reminders at 90, 60, 30, and 7 days before expiry.
  - [ ] Missing required document alerts per employee (e.g., no signed contract on file).
- [ ] **Template-Based Letter Generation Engine**:
  - [ ] Pre-built templates: Offer letters, employment verification, experience certificates, warning letters, termination letters, salary certificates.
  - [ ] Dynamic field merge from employee database (name, position, salary, dates, department).
  - [ ] Tenant-branded letterhead with configurable logo, header, footer, and signature block.
  - [ ] Digital signature capture for employee acknowledgment.
- [ ] **Bulk Document Operations**:
  - [ ] Bulk generation of letters (e.g., generate all employee tax certificates for year-end).
  - [ ] Bulk download of employee documents by department or document type.
- [ ] **Document Reports**:
  - [ ] Document compliance dashboard (expired, expiring soon, missing required documents by department).
  - [ ] Letter generation audit log with template used, generated by, and recipient.

---

## 16. 🚀 Onboarding & Offboarding Workflows (`/hrms/onboarding`)

- [ ] **Onboarding Checklist Engine**:
  - [ ] Configurable onboarding checklist templates per department, role, and employment type.
  - [ ] Automated task assignment on new hire creation: IT provisioning, equipment allocation, badge creation, policy acknowledgment, workspace setup.
  - [ ] Task assignee designation (HR, IT, Department Manager, Buddy/Mentor).
  - [ ] Progress tracker with completion percentage and overdue task alerts.
- [ ] **New Hire Welcome Portal**:
  - [ ] Guided portal for new employees: document upload, policy acceptance, orientation video viewing, personal info completion.
  - [ ] Digital contract signing with e-signature.
  - [ ] Welcome packet with company handbook, org chart, and key contacts.
- [ ] **Probation Management**:
  - [ ] Probation period tracking with configurable duration per employment type.
  - [ ] Automated review reminders at probation midpoint and end date.
  - [ ] Probation outcome recording (Confirmed, Extended, Terminated) with supporting notes.
- [ ] **Offboarding Workflow**:
  - [ ] Configurable offboarding checklist: equipment return, access revocation, knowledge transfer, exit interview, final settlement.
  - [ ] 1-Click employee separation with automated final pay calculation (remaining leave encashment, prorated salary, pending loans).
  - [ ] Knowledge transfer task assignment and handover document tracking.
  - [ ] Exit interview questionnaire with anonymous feedback option.
- [ ] **Onboarding & Offboarding Reports**:
  - [ ] Onboarding completion rates and average time-to-productivity by department.
  - [ ] Offboarding checklist compliance report (percentage of items completed before last day).
  - [ ] New hire retention rate at 30, 60, 90, and 180-day milestones.

---

## 17. ⚖️ Employee Grievance & Complaint System (`/hrms/grievances`)

- [ ] **Grievance Submission Portal**:
  - [ ] Formal grievance filing with category classification (harassment, discrimination, safety, policy violation, workplace conflict, compensation dispute).
  - [ ] Anonymous complaint option with masked identity — only designated HR officers can view.
  - [ ] Supporting evidence upload (documents, photos, screenshots).
- [ ] **Investigation & Resolution Workflow**:
  - [ ] Multi-stage lifecycle: `Filed` → `Acknowledged` → `Investigating` → `Resolution Proposed` → `Closed`.
  - [ ] Assigned investigator and committee management with conflict-of-interest checks.
  - [ ] Resolution tracking with escalation rules and SLA timers (e.g., acknowledge within 48 hours, resolve within 14 days).
  - [ ] Confidential case file with restricted-access notes and attachments.
- [ ] **Grievance Outcome & Follow-Up**:
  - [ ] Resolution outcome recording with action items and responsible parties.
  - [ ] Employee satisfaction feedback on resolution.
  - [ ] Retaliation monitoring flag for sensitive cases.
- [ ] **Grievance Reports**:
  - [ ] Grievance volume and average resolution time analytics.
  - [ ] Category breakdown and trend analysis by department and period.
  - [ ] SLA compliance report (percentage resolved within target timelines).

---

## 18. 🏥 Benefits & Insurance Management (`/hrms/benefits`)

- [ ] **Benefits Plan Catalog**:
  - [ ] Plan types: medical insurance, dental, vision, life insurance, pension/retirement, housing allowance, transport allowance, education assistance.
  - [ ] Multi-tier plan options per benefit type (e.g., Basic, Standard, Premium medical plans).
  - [ ] Employer vs. employee contribution split configuration per plan.
- [ ] **Employee Benefits Enrollment**:
  - [ ] Eligibility rules engine based on tenure, grade, employment type, and department.
  - [ ] Dependent management for family coverage plans (spouse, children, parents).
  - [ ] Open enrollment period management with automated start/end notifications.
  - [ ] Mid-year enrollment changes with qualifying life event documentation (marriage, birth, etc.).
- [ ] **Benefits Integration with Payroll**:
  - [ ] Automated payroll deduction calculation for employee benefit contributions.
  - [ ] Employer contribution booking as payroll expense.
- [ ] **Benefits Reports**:
  - [ ] Benefits enrollment summary by plan type and department.
  - [ ] Employer total benefits cost analysis by period.
  - [ ] Dependent coverage breakdown report.
  - [ ] Benefits utilization rate analysis.

---

## 19. 🎓 Training & Learning Management (LMS) (`/hrms/training`)

- [ ] **Training Course Catalog**:
  - [ ] Course creation with categories, description, prerequisites, capacity limits, and delivery method (in-person, online, blended).
  - [ ] Training material uploads: videos, PDF documents, presentations, and quizzes.
  - [ ] External training provider and venue management.
- [ ] **Training Enrollment & Scheduling**:
  - [ ] Employee self-enrollment and manager-nominated enrollment.
  - [ ] Training calendar with session scheduling, instructor assignment, and room/venue booking.
  - [ ] Waitlist management for oversubscribed sessions.
  - [ ] Attendance tracking with check-in confirmation.
- [ ] **Mandatory Compliance Training**:
  - [ ] Compliance training assignments with due date enforcement per role, department, or regulation.
  - [ ] Automated escalation for overdue mandatory training.
  - [ ] Re-certification scheduling at configurable intervals.
- [ ] **Certification & Skills Management**:
  - [ ] Certification tracking per employee with expiry dates and automated renewal reminders.
  - [ ] Skills matrix per employee with proficiency levels (Beginner, Intermediate, Advanced, Expert).
  - [ ] Skills gap analysis against role requirements.
- [ ] **Training Reports**:
  - [ ] Training completion rates by course, department, and employee.
  - [ ] Certification expiry forecast and compliance gap report.
  - [ ] Training cost analysis and budget utilization.
  - [ ] Skills matrix heatmap by department.

---

## 20. 🔄 360 Performance Reviews & Feedback (`/pms/reviews`)

- [ ] **Review Cycle Management**:
  - [ ] Configurable review cycles: quarterly, semi-annual, annual, or custom periods.
  - [ ] Review cycle creation wizard with timeline, participants, and form selection.
  - [ ] Automated launch and deadline reminders via email and push notifications.
- [ ] **Multi-Source Feedback Collection**:
  - [ ] Self-assessment questionnaire.
  - [ ] Manager/supervisor review form.
  - [ ] Peer feedback nominations and collection (configurable: 2-5 peers per employee).
  - [ ] Direct report upward feedback (for managers being reviewed).
  - [ ] Optional external stakeholder/client feedback.
- [ ] **Review Forms & Competencies**:
  - [ ] Review form builder with rating scales (1-5, 1-10, descriptive), competency matrices, and open-ended questions.
  - [ ] Pre-built competency libraries (leadership, communication, technical skills, teamwork, innovation).
  - [ ] Goal setting and alignment with organizational OKRs/KPIs.
- [ ] **Calibration & Normalization**:
  - [ ] Calibration sessions for manager alignment on rating distribution.
  - [ ] Forced distribution/bell curve visualization with adjustment tools.
  - [ ] Cross-department rating comparison dashboard.
- [ ] **Performance Improvement Plans (PIP)**:
  - [ ] PIP creation with specific goals, milestones, support resources, and timeline.
  - [ ] Progress check-in scheduling with manager sign-off.
  - [ ] PIP outcome recording (Completed Successfully, Extended, Terminated).
- [ ] **Review Reports**:
  - [ ] Review cycle completion status by department and manager.
  - [ ] Performance distribution analysis (bell curve, rating breakdown by department/grade).
  - [ ] Goal attainment rates and trend analysis across review cycles.
  - [ ] Historical performance trend per employee (review-over-review comparison).

---

## 21. 💰 Expense Management (`/hrms/expenses`)

- [ ] **Expense Claim Submission**:
  - [ ] Employee expense claim form with category selection, amount, date, description, and receipt photo upload.
  - [ ] AI-powered receipt OCR scanning for auto-extraction of vendor, amount, date, and category (via Python Engine).
  - [ ] Multi-line expense reports grouping multiple expenses into a single submission.
  - [ ] Draft saving and submission workflow.
- [ ] **Expense Categories & Policies**:
  - [ ] Configurable expense categories: Travel, Meals, Accommodation, Office Supplies, Client Entertainment, Transportation, Communication.
  - [ ] Department and role-based spending limits per category.
  - [ ] Policy rule engine: auto-flag expenses exceeding limits, require additional justification for high-value claims.
- [ ] **Approval & Reimbursement**:
  - [ ] Multi-tier approval workflow with configurable thresholds (e.g., <$100 auto-approve, <$500 Manager, >$500 Finance).
  - [ ] Mileage and travel expense calculators with configurable per-km/per-mile rates.
  - [ ] Reimbursement integration with payroll cycle (auto-add approved expenses to next pay run).
  - [ ] Corporate credit card transaction reconciliation and matching.
- [ ] **Expense Reports**:
  - [ ] Expense summary by category, department, employee, and period.
  - [ ] Budget vs. actual expense comparison by department.
  - [ ] Reimbursement processing time and pending claims aging report.
  - [ ] Top expense categories and policy violation frequency report.

---

## 22. 🖥️ Employee Asset & Equipment Tracking (`/hrms/assets`)

- [ ] **Asset Registry**:
  - [ ] Asset catalog: laptops, monitors, phones, tablets, vehicles, access cards, keys, uniforms, tools.
  - [ ] Unique asset tags with QR code generation for physical labeling.
  - [ ] Asset details: serial number, purchase date, warranty expiry, purchase cost, current condition.
- [ ] **Asset Assignment & Lifecycle**:
  - [ ] Asset checkout to employee with digital acknowledgment signature.
  - [ ] Asset return workflow with condition assessment (Good, Fair, Damaged, Missing).
  - [ ] Asset transfer between employees with full custody chain history.
  - [ ] Automatic asset return enforcement during offboarding.
- [ ] **Maintenance & Warranty**:
  - [ ] Maintenance scheduling and service history logging.
  - [ ] Warranty expiry tracking with automated reminders.
  - [ ] Repair request submission and status tracking.
  - [ ] Asset decommission and disposal workflow with write-off approval.
- [ ] **Asset Reports**:
  - [ ] Asset inventory summary by type, status, and assigned department.
  - [ ] Asset assignment history per employee (all assets ever assigned).
  - [ ] Warranty expiry and maintenance schedule forecast.
  - [ ] Outstanding asset returns report (overdue check-ins).

---

## 23. 📊 Employee Pulse Surveys & Engagement (`/hrms/surveys`)

- [ ] **Survey Builder**:
  - [ ] Quick-deploy pulse survey builder with question types: rating scale, multiple choice, NPS, open text, matrix/grid.
  - [ ] Survey template library with pre-built engagement, satisfaction, and culture surveys.
  - [ ] Branching logic for conditional follow-up questions.
- [ ] **Survey Distribution & Collection**:
  - [ ] Anonymous response collection with aggregate-only reporting (minimum response threshold before results visible).
  - [ ] Scheduled recurring surveys: weekly, monthly, quarterly, or one-time.
  - [ ] Target audience selection: all employees, specific departments, grades, or locations.
  - [ ] Multi-channel distribution: in-app notification, email, and mobile push.
- [ ] **Engagement Analytics**:
  - [ ] Employee Net Promoter Score (eNPS) tracking with historical trend line.
  - [ ] Engagement index scoring with benchmarking against historical data.
  - [ ] AI-powered sentiment analysis word cloud from open-text responses (via Python Engine).
  - [ ] Action plan creation and tracking based on survey insights.
- [ ] **Survey Reports**:
  - [ ] Survey response rates by department, location, and grade.
  - [ ] eNPS and engagement score trends over time.
  - [ ] Question-by-question breakdown with comparative analysis across departments.
  - [ ] Survey impact tracking: improvement measurement between survey cycles.

---

## 24. 📤 Bulk Import/Export Engine (`/settings/import-export`)

- [ ] **Bulk Import**:
  - [ ] CSV and Excel import for: employees, attendance records, leave balances, payroll adjustments, assets, training records.
  - [ ] Import validation preview with error highlighting, row-by-row correction, and duplicate detection before committing.
  - [ ] Downloadable import templates per entity type with column headers, data type hints, and example data.
  - [ ] Incremental import support: update existing records or create new ones based on unique key matching.
- [ ] **Bulk Export**:
  - [ ] 1-click export of any data grid to CSV, Excel, and PDF with current filters and column selection preserved.
  - [ ] Scheduled bulk exports with automatic delivery via email.
  - [ ] Custom report builder: select fields, apply filters, and save as reusable export templates.
- [ ] **Import/Export Governance**:
  - [ ] Import/export audit log: who imported/exported what, when, with row count and status.
  - [ ] Rollback capability for imports within a configurable time window.
  - [ ] Permission-gated import/export by entity type (e.g., only HR Admin can import payroll data).

---

## 25. 🔔 Notification Engine — Email, In-App & Push (`/notifications`)

- [ ] **Email Notification Service**:
  - [ ] Centralized transactional email engine for: leave approvals/rejections, payroll ready, password resets, task assignments, review cycle launches, document expiry alerts, and grievance status updates.
  - [ ] Email template engine with tenant branding: configurable logo, colors, header/footer, and reply-to address.
  - [ ] HTML email rendering with plain-text fallback.
- [x] **In-App Notification Center**:
  - [x] Unified notification feed with read/unread status, category filters, and mark-all-as-read.
  - [x] Real-time WebSocket delivery for instant notification updates.
  - [ ] Notification deep-links navigating directly to the relevant page/record.
- [ ] **Mobile Push Notifications**:
  - [ ] Firebase Cloud Messaging (FCM) integration for Android push notifications.
  - [ ] Apple Push Notification Service (APNs) integration for iOS.
  - [ ] Push notification payload with action buttons (Approve/Reject for leave, View for payslips).
- [ ] **User Notification Preferences**:
  - [ ] Per-user configurable preferences: enable/disable per notification type, per channel (email, in-app, push).
  - [ ] Notification digest mode: instant delivery vs. daily/weekly summary email.
- [ ] **Notification Reports**:
  - [ ] Notification delivery rates and failure tracking by channel.
  - [ ] User notification preference distribution summary.
  - [ ] Email bounce and open rate analytics.

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
