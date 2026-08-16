# Humanitas System Architecture Guide

This document explains the architectural structure, deployment strategy, and database design for the Humanitas SaaS ERP.

---

## 1. High-Level Architecture
The system follows a **Microservices-lite** approach with a separated Frontend:

1.  **Frontend (`humanitas_frontend`):**
    *   React + Vite application.
    *   Single web interface that dynamically connects to either Admin or Tenant APIs based on the user's login.
    *   **Proxy Logic:** `proxy.js` dynamically routes requests to the correct backend using `VITE_API_URL`.

2.  **Admin Backend (`admin-backend`):**
    *   NestJS + TypeORM.
    *   Manages the **Master Database** (`humanitas_db`).
    *   Responsible for Tenant Creation, Subscription Management, and System-wide Settings.
    *   **Port:** 3000 (Internal), Exposed via Render Web Service.

3.  **Tenant Backend (`tenant-backend/main_rest_apis`):**
    *   NestJS + TypeORM.
    *   Manages individual **Tenant Databases** (`tenant_{slug}`).
    *   Handles all business logic: Auth, Attendance, Payroll, PMS, etc.
    *   **Port:** 3001 (Internal), Exposed via Render Web Service.

4.  **Worker Service (`tenant-backend` - Worker Mode):**
    *   Handles background jobs (Cron, Email Reports).
    *   Runs as a generic "Web Service" (with a dummy HTTP server) on Render Free Tier to avoid sleeping.
    *   **Port:** 3002.

---

## 2. Database Architecture (Multi-Tenancy)

We use a **Database-per-Tenant** isolation strategy for maximum security and scalability.

### Master Database (`humanitas_db`)
*   **Managed by:** Admin Backend.
*   **Tables:**
    *   `tenants`: Stores tenant metadata (slug, db_name, subscription status).
    *   `admin_users`: Super admins who manage the platform.
*   **Schema Management:**
    *   Uses **Manual Patching** on startup (`admin-backend/src/main.ts`) to guarantee critical columns like `logo_url` exist, bypassing potentially unreliable ORM syncs.

### Tenant Databases (`tenant_{slug}`)
*   **Managed by:** Tenant Backend.
*   **Created by:** Admin Backend (during tenant registration).
*   **Tables:** `users`, `attendance`, `payroll`, `departments`, etc.
*   **Connection Factory:**
    *   `DatabaseService` dynamically creates connection pools to specific tenant databases based on the request's context.

---

## 3. Critical Deployment Logic (The "Fixes")

To ensure reliability on cloud platforms like Render, we implemented robust connection handling:

### A. Database Connection Parsing
*   **Issue:** Cloud providers give a single `DATABASE_URL` string, but old code expected split `HOST`, `USER`, `PASSWORD` variables.
*   **Solution:** We implemented a `parseDatabaseUrl` helper in both `TenantService` and `DatabaseService`. It intelligently extracts credentials from the URL if provided, falling back to individual env variables if not.

### B. SSL Enforcement
*   **Issue:** Render Managed PostgreSQL rejects non-SSL connections.
*   **Solution:** The code now forces `ssl: { rejectUnauthorized: false }` whenever a `DATABASE_URL` is detected. This ensures secure connections without needing manual certificate file management.

### C. Schema Reliability (The "Zombie" Fix)
*   **Issue:** Failed tenant modifications left "Zombie Databases" (corrupted schemas) that caused subsequent interactions to crash with `23502` or `42703` errors.
*   **Solution:**
    1.  **Creation:** The Admin API now checks if a database exists before creating it. If found, it **Terminates Connections** and **DROPS** the old DB to ensure a clean slate.
    2.  **Deletion:** The Delete function uses Raw SQL to force-delete records and drop databases, ignoring schema mismatches.
    3.  **Sync:** The Tenant API runs with `synchronize: false` (Auto-Sync Disabled) to prevent startup crashes. It relies on robust `initializeTenantTables` SQL scripts for schema correctness.

---

## 4. Batch Processing for Attendance
**Location:** `tenant-backend/src/modules/attendance/attendance.service.ts`

### How it works
*   **The Problem:** Loading 200,000+ users into RAM caused Out-Of-Memory crashes.
*   **The Solution:** `processAbsentUsers` uses **Cursor-based Pagination** (SQL `LIMIT`/`OFFSET`). It processes users in chunks of 500, keeping memory usage constant regardless of user count.

---

## 5. Render Deployment Configuration

### `render.yaml` Structure
*   **Frontend:** Static Site, Rewrites all routes to `index.html`.
*   **Admin API:** Web Service, Node environment.
*   **Tenant API:** Web Service, Node environment.
*   **Worker:** Web Service (Workaround for Free Tier), pinged every 14 mins by `KeepAliveService` to prevent sleep.

### Recommended Production Changes
For a true Production environment (Paid Tier):
1.  Change **Worker** from `type: web` to `type: worker`.
2.  Remove `KeepAliveService`.
3.  Enable `synchronize: false` permanently and switch to TypeORM Migrations for schema updates.

---

# Humanitas System Architecture Guide

This document explains the architectural structure, deployment strategy, and database design for the Humanitas SaaS ERP.

---

## 1. High-Level Architecture
The system follows a **Microservices-lite** approach with a separated Frontend:

1.  **Frontend (`humanitas_frontend`):**
    *   React + Vite application.
    *   Single web interface that dynamically connects to either Admin or Tenant APIs based on the user's login.
    *   **Proxy Logic:** `proxy.js` dynamically routes requests to the correct backend using `VITE_API_URL`.

2.  **Admin Backend (`admin-backend`):**
    *   NestJS + TypeORM.
    *   Manages the **Master Database** (`humanitas_db`).
    *   Responsible for Tenant Creation, Subscription Management, and System-wide Settings.
    *   **Port:** 3000 (Internal), Exposed via Render Web Service.

3.  **Tenant Backend (`tenant-backend/main_rest_apis`):**
    *   NestJS + TypeORM.
    *   Manages individual **Tenant Databases** (`tenant_{slug}`).
    *   Handles all business logic: Auth, Attendance, Payroll, PMS, etc.
    *   **Port:** 3001 (Internal), Exposed via Render Web Service.

4.  **Worker Service (`tenant-backend` - Worker Mode):**
    *   Handles background jobs (Cron, Email Reports).
    *   Runs as a generic "Web Service" (with a dummy HTTP server) on Render Free Tier to avoid sleeping.
    *   **Port:** 3002.

---

## 2. Database Architecture (Multi-Tenancy)

We use a **Database-per-Tenant** isolation strategy for maximum security and scalability.

### Master Database (`humanitas_db`)
*   **Managed by:** Admin Backend.
*   **Tables:**
    *   `tenants`: Stores tenant metadata (slug, db_name, subscription status).
    *   `admin_users`: Super admins who manage the platform.
*   **Schema Management:**
    *   Uses **Manual Patching** on startup (`admin-backend/src/main.ts`) to guarantee critical columns like `logo_url` exist, bypassing potentially unreliable ORM syncs.

### Tenant Databases (`tenant_{slug}`)
*   **Managed by:** Tenant Backend.
*   **Created by:** Admin Backend (during tenant registration).
*   **Tables:** `users`, `attendance`, `payroll`, `departments`, etc.
*   **Connection Factory:**
    *   `DatabaseService` dynamically creates connection pools to specific tenant databases based on the request's context.

---

## 3. Critical Deployment Logic (The "Fixes")

To ensure reliability on cloud platforms like Render, we implemented robust connection handling:

### A. Database Connection Parsing
*   **Issue:** Cloud providers give a single `DATABASE_URL` string, but old code expected split `HOST`, `USER`, `PASSWORD` variables.
*   **Solution:** We implemented a `parseDatabaseUrl` helper in both `TenantService` and `DatabaseService`. It intelligently extracts credentials from the URL if provided, falling back to individual env variables if not.

### B. SSL Enforcement
*   **Issue:** Render Managed PostgreSQL rejects non-SSL connections.
*   **Solution:** The code now forces `ssl: { rejectUnauthorized: false }` whenever a `DATABASE_URL` is detected. This ensures secure connections without needing manual certificate file management.

### C. Schema Reliability (The "Zombie" Fix)
*   **Issue:** Failed tenant modifications left "Zombie Databases" (corrupted schemas) that caused subsequent interactions to crash with `23502` or `42703` errors.
*   **Solution:**
    1.  **Creation:** The Admin API now checks if a database exists before creating it. If found, it **Terminates Connections** and **DROPS** the old DB to ensure a clean slate.
    2.  **Deletion:** The Delete function uses Raw SQL to force-delete records and drop databases, ignoring schema mismatches.
    3.  **Sync:** The Tenant API runs with `synchronize: false` (Auto-Sync Disabled) to prevent startup crashes. It relies on robust `initializeTenantTables` SQL scripts for schema correctness.

---

## 4. Batch Processing for Attendance
**Location:** `tenant-backend/src/modules/attendance/attendance.service.ts`

### How it works
*   **The Problem:** Loading 200,000+ users into RAM caused Out-Of-Memory crashes.
*   **The Solution:** `processAbsentUsers` uses **Cursor-based Pagination** (SQL `LIMIT`/`OFFSET`). It processes users in chunks of 500, keeping memory usage constant regardless of user count.

---

## 5. Render Deployment Configuration

### `render.yaml` Structure
*   **Frontend:** Static Site, Rewrites all routes to `index.html`.
*   **Admin API:** Web Service, Node environment.
*   **Tenant API:** Web Service, Node environment.
*   **Worker:** Web Service (Workaround for Free Tier), pinged every 14 mins by `KeepAliveService` to prevent sleep.

### Recommended Production Changes
For a true Production environment (Paid Tier):
1.  Change **Worker** from `type: web` to `type: worker`.
2.  Remove `KeepAliveService`.
3.  Enable `synchronize: false` permanently and switch to TypeORM Migrations for schema updates.

---

## 6. Advanced HR & Payroll Engine

We have overhauled the payroll engine to support complex, hierarchical allowance rules and strict validations.

### 6.2 Data Model Extensions
*   **Employee Categories (`employee_categories`)**: Classifies users (e.g., Management, Field) to drive default allowances.
*   **Category Allowances (`category_allowances`)**: Maps `income_types` to `employee_categories`.
*   **Acting Assignments (`acting_assignments`)**: Tracks temporary role assignments.
    *   `actor_user_id`, `target_user_id`, `start_date`, `end_date`.
    *   Used to calculate **Acting Allowance** (automatically 1/10th of target's basic salary, tax-free).
*   **Income Types (`income_types`)**:
    *   Added `calculation_type`: `'fixed'` (default) or `'percentage'`.
    *   Allows defining allowances like "Desert Allowance" or "Hardship" as a % of Basic Salary (e.g., 40%, 60%).

### 6.3 Dynamic Payroll Calculation Logic
The `runPayroll` method (`payroll.service.ts`) has been refactored to specific local requirements:
1.  **Allowance Cascade**:
    *   **Individual Override**: `user_incomes` (highest priority).
    *   **Category Default**: `category_allowances`.
    *   **Logic Based**:
        *   **Acting Allowance**: 10% of Target User's Basic Salary (Tax Free) if active assignment exists.
        *   **Per Diem**: Formula based (`max(Fixed, % of Basic)`).
        *   **Percentage Allowances**: If `income_type` is percentage, calculate `Basic * (Value / 100)`.
2.  **Tax & Deductions**:
    *   **Tax Rules**: Dynamically fetched from `tax_rules` table (defaulting to Ethiopian rates).
    *   **Loans**: Validated to ensure total monthly deduction <= 1/3 Net Salary.

### C. Loan Validation Logic
To prevent predatory lending or accidental over-deduction, the `createLoan` logic enforces a strict **1/3 Net Salary Rule**:
*   It estimates the user's Net Salary by projecting tax and pension deductions on their current Basic Salary.
*   It ensures `Monthly Deduction <= (Net Salary * 33%)`.
