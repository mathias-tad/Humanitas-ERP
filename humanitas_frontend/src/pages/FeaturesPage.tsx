import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    ShieldCheck,
    CreditCard,
    Smartphone,
    CheckCircle2,
    Lock,
    ArrowRight,
    Menu,
    X,
    Bot,
    Briefcase,
    Workflow,
    Fingerprint,
    Database,
    Zap,
    MessageSquare,
    DollarSign,
    Target,
    FileCheck,
    Award,
    HeartHandshake,
    GraduationCap,
    PackageCheck,
    Radio,
    FileSpreadsheet,
    Code2,
    UserCheck,
    Scale,
    Boxes,
    ShoppingCart,
    Store,
    Receipt
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ModeToggle } from "@/components/mode-toggle";
import { useState } from "react";

export default function FeaturesPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState("all");

    const categories = [
        // --- 1. ERP & SUPPLY CHAIN ---
        {
            id: "accounting",
            group: "erp",
            title: "Double-Entry Financial Accounting & General Ledger",
            badge: "Financial Core",
            badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
            icon: <Scale className="w-8 h-8 text-emerald-600" />,
            description: "Compliant double-entry bookkeeping with multi-currency Chart of Accounts, real-time Trial Balance, automated journal entries, and fiscal year closing.",
            features: [
                "Hierarchical Chart of Accounts (COA) with sub-accounts and dimension tracking",
                "Automated journal entries with strict debit-credit balancing validation",
                "Real-time Trial Balance, Balance Sheet, and Income Statement generation",
                "Multi-currency transactions with automated forex gain/loss calculations",
                "Bank reconciliation with statement import and automated transaction matching",
                "Fixed asset registry with automated straight-line and declining depreciation schedules"
            ]
        },
        {
            id: "inventory",
            group: "erp",
            title: "Multi-Warehouse Inventory & Costing Engine",
            badge: "Supply Chain",
            badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
            icon: <Boxes className="w-8 h-8 text-blue-600" />,
            description: "Enterprise warehouse stock management with multi-bin locations, serial/batch tracking, automated reorder triggers, and FIFO/AVCO valuation queues.",
            features: [
                "Multi-warehouse, multi-aisle, and bin-level location inventory tracking",
                "Python-delegated real-time inventory costing: AVCO (Weighted Average) and FIFO queues",
                "Serial number and batch/lot expiration tracking with quarantine capabilities",
                "Automated stock replenishment thresholds, safety stock alerts, and min/max triggers",
                "Inter-warehouse stock transfer requisitions with in-transit tracking",
                "Physical stock count reconciliation with adjustment variance journals"
            ]
        },
        {
            id: "purchasing",
            group: "erp",
            title: "Procurement, Vendor Management & 3-Way Match",
            badge: "Procure-to-Pay",
            badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
            icon: <ShoppingCart className="w-8 h-8 text-amber-600" />,
            description: "End-to-end purchasing lifecycle from purchase requisitions and RFQs to PO issuance, Goods Received Notes (GRN), and 3-way invoice matching.",
            features: [
                "Purchase requisition workflow with tiered managerial approval routing",
                "Request for Quotation (RFQ) comparison matrix across competing suppliers",
                "Automated Purchase Order (PO) dispatch with vendor contract pricing",
                "Goods Received Notes (GRN) with barcode scanning and quality inspection notes",
                "Automated 3-way matching: Purchase Order vs. Goods Receipt vs. Vendor Bill",
                "Vendor rating scorecards tracking on-time delivery and quality metrics"
            ]
        },
        {
            id: "sales_crm",
            group: "erp",
            title: "Sales Orders, CRM & Electronic Invoicing",
            badge: "Order-to-Cash",
            badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
            icon: <Receipt className="w-8 h-8 text-indigo-600" />,
            description: "Omnichannel customer pipeline management with price lists, credit limits, sales quotations, commercial invoices, and e-invoicing compliance.",
            features: [
                "Customer Relationship Management (CRM) with deal pipeline stages and contact activity",
                "Dynamic pricing rules, tiered volume discounts, and customer-specific price lists",
                "Sales quotation to sales order 1-click conversion with inventory reservation",
                "Credit limit validation and customer account aging receivables reports",
                "Statutory electronic invoice generation with QR code and tax compliance",
                "Delivery note dispatch and automated billing integration with General Ledger"
            ]
        },
        {
            id: "pos",
            group: "erp",
            title: "Retail Point of Sale (POS) & Cash Drawer",
            badge: "Omnichannel Retail",
            badgeColor: "bg-teal-500/10 text-teal-600 border-teal-500/20",
            icon: <Store className="w-8 h-8 text-teal-600" />,
            description: "High-speed touch-screen retail point of sale with offline operation capability, barcode scanning, split payments, and cash drawer reconciliation.",
            features: [
                "Touch-optimized POS register interface supporting barcode scanners and receipt printers",
                "Offline caching: continuous sales processing during network interruptions",
                "Split payment methods: Cash, Credit Card, Mobile Money, and Customer Credit",
                "Cash drawer opening/closing floats with end-of-day X/Z shift reconciliation",
                "Instant inventory deduction and automated revenue ledger postings",
                "Multi-terminal branch management with cashier session permission locks"
            ]
        },

        // --- 2. WORKFORCE & TALENT ---
        {
            id: "biometrics",
            group: "workforce",
            title: "Biometric Terminal ADMS & Cloud Push",
            badge: "Enterprise Hardware",
            badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
            icon: <Fingerprint className="w-8 h-8 text-blue-600" />,
            description: "Direct ZKTeco & Hikvision ADMS hardware integration over port 80 with multi-tenant domain routing and automated punch sync.",
            features: [
                "Real-Time ZKTeco ADMS & HTTP Push Protocol integration",
                "Port 80 ADMS support with tenant-specific domain routing",
                "Live device heartbeat telemetry & online/offline status monitoring",
                "Automated punch-log synchronization & attendance reconciliation",
                "Quarantine queue for unregistered terminals with 1-click admin approval",
                "IP whitelisting and subnet mask filtering for physical terminals"
            ]
        },
        {
            id: "scheduling",
            group: "workforce",
            title: "Dynamic Shift Scheduling & Rostering",
            badge: "Smart Rostering",
            badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
            icon: <Clock className="w-8 h-8 text-amber-600" />,
            description: "Multi-week cyclic shifts, overnight schedule management, auto-balanced day-offs, and interactive roster boards.",
            features: [
                "Multi-week rotating shift patterns and cyclic schedule assignments",
                "Overnight shift calculation spanning across midnight day-boundaries",
                "Automated day-off distribution & weekend balancing algorithms",
                "Interactive drag-and-drop team roster grid with schedule conflict detection",
                "Configurable grace minutes, tardiness deduction rules & automated lateness alerts",
                "Direct supervisor shift sign-offs and shift-swap request approval workflows"
            ]
        },
        {
            id: "workforce_flex",
            group: "workforce",
            title: "Workforce Flex (VET & VTO Opportunities Hub)",
            badge: "Labor Optimization",
            badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
            icon: <Zap className="w-8 h-8 text-emerald-600" />,
            description: "Intelligent staffing flexibility system to broadcast and claim voluntary extra time (VET) and voluntary time off (VTO).",
            features: [
                "Paid Voluntary Extra Time (VET) shift broadcasting with auto-multiplier sourcing",
                "Excused Voluntary Time Off (VTO) for production flex and workflow balancing",
                "Automated labor law fatigue guardrails: weekly overtime caps & rest period protections",
                "FCFS, Seniority, and Fairness claim prioritization algorithms",
                "Auto-approval thresholds and manager claim review queue",
                "Automatic payroll deduction or PTO balance funding for unpaid VTO"
            ]
        },
        {
            id: "recruitment",
            group: "workforce",
            title: "End-to-End Recruitment & Applicant Tracking",
            badge: "Talent Acquisition",
            badgeColor: "bg-teal-500/10 text-teal-600 border-teal-500/20",
            icon: <Briefcase className="w-8 h-8 text-teal-600" />,
            description: "Complete candidate hiring pipeline with job requisitions, stage transitions, evaluation scorecards, and offer letters.",
            features: [
                "Interactive visual Kanban pipeline (Applied → Screened → Interviewed → Offered → Hired)",
                "Public job portal generation with custom question forms and resume uploads",
                "Multi-interviewer feedback scorecards and structured rating criteria",
                "Automated candidate email alerts, interview invitations, and rejection notifications",
                "1-click candidate conversion into active employee master records",
                "Offer letter generation with salary breakdown and expiry dates"
            ]
        },
        {
            id: "document_vault",
            group: "workforce",
            title: "Document Vault & Electronic Signatures",
            badge: "Compliance & Legal",
            badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
            icon: <FileCheck className="w-8 h-8 text-indigo-600" />,
            description: "Encrypted organizational document repository, dynamic legal letter templates, and digital signature signing.",
            features: [
                "Employee document storage with expiry reminders (passports, IDs, certifications)",
                "Dynamic letter generator with placeholder merges (contracts, promotions, warning memos)",
                "In-app touch & stylus digital signature pad with legal timestamp audit metadata",
                "QR code verification generation for tamper-proof certificate authenticity",
                "Employee Self-Service (ESS) document downloads and upload requests",
                "Strict role-based access control protecting confidential personal records"
            ]
        },
        {
            id: "onboarding",
            group: "workforce",
            title: "Onboarding & Offboarding Lifecycle",
            badge: "Employee Journey",
            badgeColor: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
            icon: <UserCheck className="w-8 h-8 text-cyan-600" />,
            description: "Structured welcome checklists, departmental asset handovers, clearance forms, and structured exit interviews.",
            features: [
                "Role-specific onboarding task checklists with automatic assignees and due dates",
                "New hire welcome dashboard with buddy assignments and team orientation steps",
                "Offboarding asset return verification and department sign-off clearance workflows",
                "Structured confidential exit interview questionnaire with attrition analytics",
                "Automated IT account deprovisioning and permission revocation triggers",
                "Comprehensive onboarding progress tracking dashboards for HR managers"
            ]
        },
        {
            id: "attendance_command",
            group: "workforce",
            title: "Attendance Command Center & Absence Alert Engine",
            badge: "Time & Labor",
            badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
            icon: <UserCheck className="w-8 h-8 text-emerald-600" />,
            description: "Floor presence filters, sticky batch actions, consecutive & monthly unauthorized absence alert engine, and consolidated timecard ledger.",
            features: [
                "Unified Schedule & Timecard ledger merging punch logs, scheduled shifts, and overtime",
                "Floor presence filters: On Floor / Punched In, Late Today, Absent, and Excused",
                "Multi-row selection checkboxes with sticky batch actions (Mark Present, Absent, Excused)",
                "Consecutive & monthly unauthorized absence threshold alert engine with configurable notifications",
                "Direct supervisor lateness excuses, absence remarks modal, and real CSV ledger export"
            ]
        },
        {
            id: "assets",
            group: "workforce",
            title: "Asset & Equipment Tracking",
            badge: "Physical Custody",
            badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20",
            icon: <PackageCheck className="w-8 h-8 text-slate-600" />,
            description: "Enterprise hardware and equipment registry with barcode tracking, employee custody handovers, and condition audits.",
            features: [
                "Hardware catalog tracking laptops, phones, monitors, vehicles, and access tokens",
                "Barcode and serial number lookup with warranty and vendor purchase details",
                "Digital custody handover forms with employee acknowledgment signatures",
                "Routine asset audit scheduling with condition and maintenance logs",
                "Automatic asset return clearance requirement integrated with offboarding workflows",
                "Depreciation tracking and replacement lifecycle forecasting"
            ]
        },

        // --- 3. PAYROLL & EXPENSES ---
        {
            id: "payroll",
            group: "financials",
            title: "Automated Payroll & Python Calculation Engine",
            badge: "High-Precision Math",
            badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
            icon: <DollarSign className="w-8 h-8 text-emerald-600" />,
            description: "High-precision Python calculation engine executing complex regional tax brackets, 7% pensions, and overtime formulas.",
            features: [
                "Dedicated Python FastAPI calculation engine delegation for zero-rounding error",
                "Statutory Ethiopian 2024 progressive tax brackets & 7% employee pension",
                "Pro-rated mid-month hiring and resignation salary split calculations",
                "Dynamic overtime calculation: Normal (1.25x), Night (1.5x), Weekend (2.0x), Holiday (2.5x)",
                "Automated loan installment amortizations and salary advance recovery",
                "1-click electronic bank transfer export (CBE, Awash, Dashen, Bank of Abyssinia formats)"
            ]
        },
        {
            id: "expenses",
            group: "financials",
            title: "Expense Management & Per Diem Claims",
            badge: "Expense Control",
            badgeColor: "bg-pink-500/10 text-pink-600 border-pink-500/20",
            icon: <CreditCard className="w-8 h-8 text-pink-600" />,
            description: "Comprehensive travel authorization, destination-based per diem rates, receipt uploads, and multi-tier approvals.",
            features: [
                "Destination-based regional per diem allowance matrices with policy caps",
                "Multi-category expense claims with receipt image attachments and mileage logging",
                "Multi-level managerial approvals with conditional threshold rerouting",
                "Direct payroll integration for tax-free per diem and taxable expense reimbursements",
                "Budget tracking by department, project, and cost center with spend variance alerts",
                "Audit-ready digital archive of all receipts, comments, and approval timestamps"
            ]
        },
        {
            id: "benefits",
            group: "financials",
            title: "Employee Benefits & Insurance Plans",
            badge: "Total Rewards",
            badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
            icon: <HeartHandshake className="w-8 h-8 text-purple-600" />,
            description: "Corporate medical, life insurance, and benefit plan administration with open enrollment windows and payroll deductions.",
            features: [
                "Multi-tier benefit plan catalog (Medical, Dental, Life Insurance, Commuter)",
                "Configurable employer vs. employee premium cost-sharing percentages",
                "Open enrollment window scheduling with automatic employee notifications",
                "Dependent and beneficiary management with required relationship documentation",
                "Automatic payroll deduction integration for employee-paid premium portions",
                "Benefit claims history and coverage utilization reports"
            ]
        },

        // --- 4. PMS & CULTURE ---
        {
            id: "pms",
            group: "pms_culture",
            title: "Agile Project Management (PMS) & Boards",
            badge: "Agile Delivery",
            badgeColor: "bg-violet-500/10 text-violet-600 border-violet-500/20",
            icon: <Target className="w-8 h-8 text-violet-600" />,
            description: "Full Agile software delivery with multi-sprint backlogs, interactive Kanban boards, time logging, and team velocity metrics.",
            features: [
                "Interactive drag-and-drop Kanban sprint boards with swimlanes and WIP limits",
                "Multi-sprint backlog planning with story point estimation and priority flags",
                "Daily work hour time logging with task level timesheet approvals",
                "Automated sprint velocity charts, burndown analytics & completion forecasting",
                "Project milestone Gantt charts with dependency mapping and critical path tracking",
                "Departmental and individual KPI scorecards mapped to organizational objectives"
            ]
        },
        {
            id: "reviews",
            group: "pms_culture",
            title: "360 Performance Reviews & PIPs",
            badge: "Performance Culture",
            badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/20",
            icon: <Award className="w-8 h-8 text-rose-600" />,
            description: "Structured multi-rater review cycles, self-appraisals, peer feedback, 9-box talent calibration, and formal PIPs.",
            features: [
                "Configurable appraisal cycles (Annual, Bi-Annual, Quarterly, Probationary)",
                "360-degree multi-rater feedback (Self, Manager, Direct Reports, and Peers)",
                "Custom rating scale rubrics with core competency and KPI weighting",
                "9-Box Grid talent calibration matrix for leadership and succession planning",
                "Formal Performance Improvement Plan (PIP) workflows with milestone check-ins",
                "Historical performance progression graphs and promotion readiness indicators"
            ]
        },
        {
            id: "training_lms",
            group: "pms_culture",
            title: "Corporate LMS & Skill Matrix",
            badge: "Learning & Development",
            badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
            icon: <GraduationCap className="w-8 h-8 text-blue-600" />,
            description: "Enterprise learning academy with course catalogs, video/document modules, quizzes, and competency matrices.",
            features: [
                "Course catalog management supporting video lectures, PDF guides, and quizzes",
                "Mandatory compliance training assignments with automatic deadline enforcement",
                "Departmental skill inventory and competency gap analysis matrices",
                "Self-service course enrollment and individual learning progress dashboards",
                "Automated course completion certificates with verifiable credentials",
                "Training expenditure and ROI reporting by department and training provider"
            ]
        },
        {
            id: "surveys",
            group: "pms_culture",
            title: "Pulse Surveys & Employee Engagement",
            badge: "Culture & Voice",
            badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
            icon: <Radio className="w-8 h-8 text-amber-600" />,
            description: "Continuous employee sentiment measurement with anonymous eNPS pulse surveys, response analytics, and action tracking.",
            features: [
                "Scheduled recurring pulse surveys with randomized anonymous respondent tokens",
                "Standard Employee Net Promoter Score (eNPS) calculation and benchmark tracking",
                "Likert scale, multiple choice, and open-ended qualitative question types",
                "Sentiment breakdown by department, tenure bracket, and location",
                "Manager action plan tracking to address low-scoring sentiment areas",
                "Participation rate monitoring with automated non-intrusive response reminders"
            ]
        },
        {
            id: "grievances",
            group: "pms_culture",
            title: "Grievance & Whistleblower Portal",
            badge: "Ethical Workplace",
            badgeColor: "bg-red-500/10 text-red-600 border-red-500/20",
            icon: <Lock className="w-8 h-8 text-red-600" />,
            description: "Confidential incident filing portal with encrypted whistleblower anonymity, investigation steps, and resolution audits.",
            features: [
                "Encrypted confidential incident reporting with optional 100% anonymous whistleblower mode",
                "Categorized complaints: harassment, safety, discrimination, policy violation, ethical concern",
                "Role-isolated investigation assignment restricting access from named subjects",
                "Investigation timeline with evidence attachment repository and witness interview logs",
                "Formal resolution records with corrective action documentation and closure sign-offs",
                "Compliance incident volume and resolution SLA observability dashboards"
            ]
        },

        // --- 5. AI & WORKFLOWS ---
        {
            id: "ai",
            group: "ai_workflows",
            title: "Autonomous Enterprise ERP & HR AI Suite",
            badge: "Autonomous Copilot & Knowledge Vault",
            badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
            icon: <Bot className="w-8 h-8 text-purple-600" />,
            description: "Cross-module business intelligence copilots, tenant policy knowledge vault, verifiable document citations, predictive forecasting, and automated ERP actions.",
            features: [
                "Cross-module AI copilots for Accounting, Inventory, Sales, HRMS, and PMS",
                "Tenant Policy Knowledge Vault: upload PDFs, DOCX, or policy text with automatic semantic chunking",
                "Verifiable legal & policy citation badges pointing to exact document, section, and page (zero data guessing)",
                "Automated legal & HR document drafting (contracts, warnings, appraisal memos, company letters)",
                "Demand forecasting, inventory reorder recommendations & cash flow projections",
                "Strict Two-Layer Security: AI capability tier check + business RBAC permission gate",
                "Zero-data fabrication mandate with direct SQL tenant database tool execution"
            ]
        },
        {
            id: "delegation_acting",
            group: "ai_workflows",
            title: "Universal Authority Delegation & HR Acting Engine",
            badge: "Common Platform Core",
            badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
            icon: <ShieldCheck className="w-8 h-8 text-indigo-600" />,
            description: "Universal on-behalf-of position delegation with dual-attribution audit logs, plus HRMS-linked acting allowance compensation and automatic payroll proration.",
            features: [
                "Universal common module core capability (Directive 22) available across all subscriptions",
                "Scoped temporary authority transfers (ALL, APPROVALS, ATTENDANCE, PMS) with strict time windows",
                "HRMS Acting Assignment Bridge: cover senior positions with official acting titles and allowances",
                "Financial Acting Allowance: percentage of covered basic salary (10%-20%) or fixed monthly amount",
                "Automated payroll proration calculating active days in pay period and adding payslip earnings items",
                "Dual-attribution audit trail (performed_by on behalf of on_behalf_of) with IP and action logging"
            ]
        },
        {
            id: "unified_calendar",
            group: "ai_workflows",
            title: "Unified Multi-Module Enterprise Calendar Hub",
            badge: "Dynamic Integration",
            badgeColor: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
            icon: <Clock className="w-8 h-8 text-cyan-600" />,
            description: "Centralized operational timeline synchronizing company events, holidays, approved leaves, shift rosters, training, interviews, and payroll with dynamic module gating.",
            features: [
                "Multi-source operational event aggregation across all subscribed enterprise modules",
                "Dynamic subscription gating: tenants only see event categories for active licensed modules",
                "Interactive Multi-View: Month grid, Week timeline, Day agenda, and upcoming List views",
                "1-Click event detail modals with deep links to underlying records and workflow approvals",
                "Cross-platform synchronization between web UnifiedCalendar and native Flutter CalendarScreen"
            ]
        },
        {
            id: "approvals",
            group: "ai_workflows",
            title: "Dynamic Multi-Step Approval Engine",
            badge: "Workflow Automation",
            badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
            icon: <Workflow className="w-8 h-8 text-blue-600" />,
            description: "Configurable multi-level approval hierarchies with sequential/parallel steps, amount thresholds, and acting delegations.",
            features: [
                "Custom rule builder by request type, amount threshold, and department hierarchy",
                "Sequential, parallel, and consensus-based approval step execution",
                "Acting approver delegation with scheduled date-bounded authority transfers",
                "Instant approval alerts with 1-click approvals on web and native mobile apps",
                "Immutable step-by-step audit trail with comments, timestamps & actor IDs",
                "Universal integration across Leave, Expenses, Purchases, and Journal Vouchers"
            ]
        },
        {
            id: "messaging",
            group: "ai_workflows",
            title: "Universal Team Chat, Presence & Role Protection",
            badge: "AI Triage & Access Grants",
            badgeColor: "bg-sky-500/10 text-sky-600 border-sky-500/20",
            icon: <MessageSquare className="w-8 h-8 text-sky-600" />,
            description: "Secure enterprise messaging with role-restricted direct chat, AI triage, proactive employee whitelisting, peer bypass, and live presence.",
            features: [
                "1-on-1 direct messaging and department/project-based group channels",
                "Role-Restricted Direct Chat: configure protected leadership roles (HR, CEO, GM, Legal) with custom AI triage prompts",
                "Pre-Chat AI Triage: employees are guided by AI Help first to resolve questions before requesting direct chat access",
                "Timed (1h, 24h, 7d, 30d) or permanent access approvals and 1-click decline with notes",
                "Global Self-Override: leaders can toggle open direct access to all employees at will",
                "Proactive Employee Whitelisting: leaders can pre-authorize specific colleagues with 1-click revocation",
                "Peer Restricted User Bypass: restricted leaders can message each other directly without triage barriers",
                "Real-time WebSocket presence, voice notes, file previews, typing indicators, and read receipts across web and native Flutter mobile"
            ]
        },
        {
            id: "developer_api",
            group: "ai_workflows",
            title: "Developer REST API & Webhooks",
            badge: "Extensibility",
            badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
            icon: <Code2 className="w-8 h-8 text-emerald-600" />,
            description: "Full OpenAPI documentation, secure API key management with scoped permissions, rate limiting, and event webhooks.",
            features: [
                "Granular API key generation with read/write permission scopes and expiry dates",
                "Real-time outgoing webhooks for system events (orders, shipments, payments, HR events)",
                "HMAC SHA-256 signature verification headers for webhook payload integrity",
                "Automated exponential backoff retries and webhook delivery event logs",
                "Interactive Swagger / OpenAPI 3.0 documentation with interactive test console",
                "Tiered rate limiting protecting tenant infrastructure against traffic spikes"
            ]
        },

        // --- 6. SECURITY & INFRASTRUCTURE ---
        {
            id: "import_export",
            group: "security_infra",
            title: "Bulk Import/Export & Rollback Engine",
            badge: "Data Migration",
            badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
            icon: <FileSpreadsheet className="w-8 h-8 text-amber-600" />,
            description: "High-throughput CSV/Excel data ingestion with dry-run validation, background processing, and 1-click transaction rollbacks.",
            features: [
                "Template generation and data validation for Products, Inventory, Users, and Balances",
                "Dry-run simulation mode identifying formatting errors and duplicate records before commit",
                "Asynchronous background ingestion capable of processing 10,000+ rows smoothly",
                "1-Click atomic batch rollback restoring pre-import database state in seconds",
                "Export data engine supporting structured CSV, XLSX, and formatted PDF summaries",
                "Comprehensive audit logs of all import operations including user ID and timestamp"
            ]
        },
        {
            id: "security",
            group: "security_infra",
            title: "Multi-Tenant Architecture & Data Scoping",
            badge: "Zero-Trust Security",
            badgeColor: "bg-red-500/10 text-red-600 border-red-500/20",
            icon: <ShieldCheck className="w-8 h-8 text-red-600" />,
            description: "Isolated per-tenant PostgreSQL schemas, strict 4-tier organizational scoping, and granular zero-trust RBAC.",
            features: [
                "Isolated PostgreSQL database per tenant provisioned via automated migration runners",
                "Strict 4-Tier Data Isolation Hierarchy: Tenant → Company → Branch → Department",
                "Scoped RBAC Permissions: view_all_companies, view_all_branches, view_all_departments",
                "Synchronized header Company & Branch context switcher with global query invalidation",
                "100% of REST endpoints guarded with JwtAuthGuard, ModuleGuard & PermissionsGuard",
                "Comprehensive immutable audit logging tracking every record mutation and IP address"
            ]
        },
        {
            id: "mobile",
            group: "security_infra",
            title: "Parallel Native Flutter Mobile Suite",
            badge: "iOS & Android",
            badgeColor: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
            icon: <Smartphone className="w-8 h-8 text-cyan-600" />,
            description: "Native cross-platform Flutter mobile applications built in lockstep with the web platform for total enterprise mobility.",
            features: [
                "Simultaneous Flutter codebase with 100% feature parity with web platform",
                "Biometric fingerprint & Face ID authentication with secure key storage",
                "GPS geofenced mobile clock-in/out with offline punch queue synchronization",
                "Field sales, mobile warehouse barcode scanning, and receipt generation",
                "Administrative controls: approvals, live terminal monitoring, and roster management",
                "Zero-regression testing policy with automated flutter test & riverpod state validation"
            ]
        }
    ];

    const filterOptions = [
        { id: "all", label: "All Features (30)" },
        { id: "erp", label: "ERP Core & Supply Chain (5)" },
        { id: "workforce", label: "Workforce & Talent (8)" },
        { id: "financials", label: "Payroll & Expenses (3)" },
        { id: "pms_culture", label: "PMS & Culture (5)" },
        { id: "ai_workflows", label: "AI & Workflows (6)" },
        { id: "security_infra", label: "Security & Mobile (3)" }
    ];

    const filteredCategories = activeFilter === "all"
        ? categories
        : categories.filter(c => c.group === activeFilter);

    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                            <img src="/humanitas.svg" alt="Humanitas ERP" className="w-10 h-10" />
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xl font-bold tracking-tight text-brand-blue">
                                        Humanitas
                                    </span>
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 bg-blue-500/10 text-blue-600 border-blue-500/30">
                                        ERP
                                    </Badge>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground -mt-0.5">
                                    Feature Directory
                                </span>
                            </div>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center gap-8">
                            <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-primary font-medium transition-colors">Home</button>
                            <button onClick={() => navigate('/login')} className="text-muted-foreground hover:text-primary font-medium transition-colors">Sign In</button>
                            <ModeToggle />
                            <Button
                                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6"
                            >
                                {isAuthenticated ? "Go to Dashboard" : "Sign In"}
                            </Button>
                        </div>

                        {/* Mobile Menu Button */}
                        <div className="md:hidden flex items-center gap-4">
                            <ModeToggle />
                            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-muted-foreground">
                                {mobileMenuOpen ? <X /> : <Menu />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-background border-b border-border p-4 space-y-4 shadow-xl">
                        <button onClick={() => navigate('/')} className="block w-full text-left py-2 font-medium text-muted-foreground">Home</button>
                        <button onClick={() => navigate('/login')} className="block w-full text-left py-2 font-medium text-muted-foreground">Sign In</button>
                        <Button
                            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                            className="w-full bg-primary text-primary-foreground"
                        >
                            {isAuthenticated ? "Go to Dashboard" : "Sign In"}
                        </Button>
                    </div>
                )}
            </nav>

            {/* Hero Header */}
            <header className="pt-32 pb-14 bg-gradient-to-b from-muted/50 to-background border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <Badge variant="outline" className="mb-4 px-3 py-1 bg-primary/10 text-primary border-primary/20 text-xs">
                        Complete Enterprise ERP Suite
                    </Badge>
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-4">
                        Enterprise Architecture & Capabilities
                    </h1>
                    <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                        Explore all 27 integrated modules spanning Double-Entry Accounting, Multi-Warehouse Inventory, Procure-to-Pay, Order-to-Cash, Point of Sale, HRMS, and Autonomous AI.
                    </p>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap justify-center gap-2 mt-10">
                        {filterOptions.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setActiveFilter(opt.id)}
                                className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-all ${
                                    activeFilter === opt.id
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                                        : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Feature Cards Grid */}
            <main className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredCategories.map((item) => (
                        <div
                            key={item.id}
                            className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-3 bg-muted rounded-xl group-hover:scale-110 transition-transform">
                                        {item.icon}
                                    </div>
                                    <Badge variant="outline" className={`text-xs ${item.badgeColor}`}>
                                        {item.badge}
                                    </Badge>
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                                <p className="text-muted-foreground text-xs leading-relaxed mb-6">
                                    {item.description}
                                </p>
                                <div className="space-y-2.5 pt-4 border-t border-border">
                                    {item.features.map((feat, idx) => (
                                        <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground/90">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                            <span>{feat}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Architecture Guarantees */}
            <section className="py-16 bg-muted/30 border-t border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <Badge variant="outline" className="mb-2 text-xs bg-primary/10 text-primary border-primary/20">
                            Strict Standards
                        </Badge>
                        <h2 className="text-3xl font-bold text-foreground">Engineering Directives Under the Hood</h2>
                        <p className="text-muted-foreground text-sm mt-2">
                            Every module in Humanitas-ERP strictly complies with our enterprise architecture covenants.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-card p-6 rounded-xl border border-border">
                            <Zap className="w-8 h-8 text-amber-500 mb-3" />
                            <h4 className="font-bold text-base mb-1">Delegated Python Math</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Heavy financial ledger rollups, FIFO/AVCO inventory queues, and statutory Ethiopian progressive tax brackets run on an isolated Python FastAPI microservice.
                            </p>
                        </div>
                        <div className="bg-card p-6 rounded-xl border border-border">
                            <Database className="w-8 h-8 text-blue-500 mb-3" />
                            <h4 className="font-bold text-base mb-1">Multi-Company Scoping</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Mandatory 4-tier data isolation (Tenant → Company → Branch → Department) across all accounting ledgers, warehouses, POS terminals, and personnel.
                            </p>
                        </div>
                        <div className="bg-card p-6 rounded-xl border border-border">
                            <Smartphone className="w-8 h-8 text-purple-500 mb-3" />
                            <h4 className="font-bold text-base mb-1">Parallel Flutter Mobile</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Every web feature is developed in parallel with its native mobile counterpart, offering field sales, warehouse barcode scanning, approvals, and offline sync.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 bg-card text-foreground text-center border-t border-border">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-extrabold mb-4">Transform Your Enterprise with Humanitas-ERP</h2>
                    <p className="text-muted-foreground text-sm mb-8">
                        Deploy your dedicated tenant database with integrated financials, supply chain, workforce, and intelligent copilots.
                    </p>
                    <Button
                        size="lg"
                        onClick={() => navigate('/setup-account')}
                        className="rounded-full px-8 h-12 text-sm font-semibold shadow-lg"
                    >
                        Create Tenant Account <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-card text-muted-foreground py-10 border-t border-border text-center text-xs">
                © 2026 Humanitas-ERP. Comprehensive Enterprise Resource Planning Platform. All rights reserved.
            </footer>
        </div>
    );
}
