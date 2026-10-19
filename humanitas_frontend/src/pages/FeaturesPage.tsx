import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Clock,
    ShieldCheck,
    FileText,
    Calendar,
    Settings,
    Bell,
    Smartphone,
    CheckCircle2,
    Lock,
    ArrowRight,
    Menu,
    X,
    Bot,
    Boxes,
    ShoppingCart,
    Store,
    Briefcase,
    Sparkles,
    Workflow,
    Fingerprint,
    Database,
    Zap,
    MessageSquare,
    DollarSign,
    Target,
    Scale
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
        {
            id: "biometrics",
            group: "workforce",
            title: "Biometric Terminal ADMS & Cloud Push",
            badge: "Enterprise Hardware",
            badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
            icon: <Fingerprint className="w-8 h-8 text-blue-600" />,
            description: "Direct ZKTeco ADMS hardware integration over port 80 with multi-tenant domain routing and automated sync.",
            features: [
                "Real-Time ZKTeco ADMS & HTTP Push Protocol integration",
                "Port 80 ADMS support with tenant-specific domain routing",
                "Live device heartbeat telemetry & online/offline monitoring",
                "Automated punch-log synchronization & attendance reconciliation",
                "Quarantine queue for unregistered terminals with 1-click admin approval",
                "IP whitelisting and subnet mask filtering for physical terminals"
            ]
        },
        {
            id: "ai",
            group: "ai_workflows",
            title: "Enterprise AI Intelligence Engine",
            badge: "Autonomous Copilot",
            badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
            icon: <Bot className="w-8 h-8 text-purple-600" />,
            description: "Deep organizational knowledge assistant with natural language insights, automated drafting, and risk detection.",
            features: [
                "HR & PMS Copilot with real-time organizational knowledge retrieval",
                "Automated legal & HR document drafting (contracts, warnings, appraisal memos)",
                "Employee lifecycle & attrition risk forecasting with sentiment analysis",
                "Cross-module business intelligence copilots & natural language SQL queries",
                "Tier-gated AI security matrix (Help, Documents, Actions, Full Autonomous)",
                "Interactive document generation with instant PDF/DOCX rendering"
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
                "Overtime tracking, overtime cap policies & direct supervisor sign-offs"
            ]
        },
        {
            id: "payroll",
            group: "financials",
            title: "Automated Payroll & Python Engine",
            badge: "High-Precision Math",
            badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
            icon: <DollarSign className="w-8 h-8 text-emerald-600" />,
            description: "Delegated Python calculation engine executing complex regional tax brackets, pensions, and loan amortizations.",
            features: [
                "Dedicated Python FastAPI calculation engine delegation for zero-rounding error",
                "Progressive income tax brackets (Ethiopian tax schedules & exempt thresholds)",
                "Mandatory pension fund automation (7% employee contribution / 11% employer)",
                "Multi-loan amortizations, automated salary advances & recovery installments",
                "Hardship, desert, acting, transport, and custom allowance configurations",
                "1-click batch payroll execution, bank transfer advice files & digital payslip PDFs"
            ]
        },
        {
            id: "messaging",
            group: "workforce",
            title: "Universal Team Chat & Messaging",
            badge: "Real-Time Comms",
            badgeColor: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
            icon: <MessageSquare className="w-8 h-8 text-cyan-600" />,
            description: "High-performance enterprise messaging with direct 1-on-1 conversations, group channels, and push notifications.",
            features: [
                "1-on-1 private messaging and department-wide collaboration channels",
                "Real-time typing indicators, read receipts & user online/offline presence",
                "Secure document, image & file attachments with inline previews",
                "Instant push notifications across web portal and native Flutter mobile apps",
                "100% sovereign in-house messaging architecture with zero third-party dependencies",
                "Searchable conversation history with message audit capabilities"
            ]
        },
        {
            id: "pms",
            group: "workforce",
            title: "Performance Management (PMS) & OKRs",
            badge: "Talent Development",
            badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/20",
            icon: <Target className="w-8 h-8 text-rose-600" />,
            description: "Continuous performance evaluation with weighted KPIs, 360-degree reviews, and 9-box talent matrix calibration.",
            features: [
                "Company, department, and individual Objectives & Key Results (OKRs)",
                "360-degree multi-rater feedback (peers, managers, direct reports, self)",
                "Quarterly & annual review cycles with weighted KPI scoring rubrics",
                "Automated probation review workflows with pass/extend/terminate pathways",
                "Structured Performance Improvement Plans (PIP) with milestone checkpoints",
                "9-Box talent matrix visualization for succession planning and leadership mapping"
            ]
        },
        {
            id: "recruitment",
            group: "workforce",
            title: "Recruitment & Applicant Tracking (ATS)",
            badge: "Talent Acquisition",
            badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
            icon: <Briefcase className="w-8 h-8 text-indigo-600" />,
            description: "Modern recruitment pipeline from public job portal to interactive applicant Kanban and 1-click employee onboarding.",
            features: [
                "Public vacancy portal with custom application questionnaires",
                "Visual applicant Kanban pipeline (Screening → Technical → Interview → Offer)",
                "Collaborative interview scorecards and structured candidate evaluation",
                "Automated candidate email communications and interview scheduling",
                "Digital offer letter generation with candidate acceptance tracking",
                "1-click conversion from accepted candidate into active employee profile"
            ]
        },
        {
            id: "approvals",
            group: "ai_workflows",
            title: "Dynamic Multi-Tier Approval Engine",
            badge: "Configurable Workflows",
            badgeColor: "bg-orange-500/10 text-orange-600 border-orange-500/20",
            icon: <Workflow className="w-8 h-8 text-orange-600" />,
            description: "Universal approval engine supporting multi-level hierarchies, acting approvers, and amount-based conditional rules.",
            features: [
                "Multi-step configurable approval hierarchies (Manager → HOD → HR → Finance)",
                "Amount-based conditional branching for expenses, per diems, and loans",
                "Acting approver delegation with scheduled date-bounded authority transfers",
                "Instant approval alerts with 1-click approvals on web and mobile",
                "Immutable step-by-step audit trail with comments, timestamps & actor IDs",
                "Universal integration across Leave, Overtime, Loans, Expenses & Purchases"
            ]
        },
        {
            id: "accounting",
            group: "erp",
            title: "Double-Entry Accounting & Financials",
            badge: "ERP Financial Core",
            badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
            icon: <Scale className="w-8 h-8 text-emerald-600" />,
            description: "Comprehensive financial ledger with multi-level Chart of Accounts, real-time Trial Balance, and automated statements.",
            features: [
                "Hierarchical multi-currency Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expenses)",
                "Double-entry Journal Vouchers with auto-balancing debit/credit validation",
                "Real-time Trial Balance, Balance Sheet, Profit & Loss (P&L), and Cash Flow statements",
                "Fixed Asset Register with automated monthly depreciation schedules (Straight-Line & Reducing)",
                "Accounts Payable (AP) and Accounts Receivable (AR) aging analysis",
                "Bank account reconciliations and multi-currency exchange rate adjustments"
            ]
        },
        {
            id: "inventory",
            group: "erp",
            title: "Multi-Warehouse Inventory & Costing",
            badge: "Supply Chain",
            badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
            icon: <Boxes className="w-8 h-8 text-blue-600" />,
            description: "Multi-location inventory tracking with FIFO & AVCO valuation queues calculated by the Python service.",
            features: [
                "Multi-warehouse & bin-location tracking with real-time stock levels",
                "FIFO & AVCO (Weighted Average Cost) valuation queues powered by Python engine",
                "Inter-warehouse stock transfer orders with transit tracking and reception receipts",
                "Automated low-stock reorder thresholds and inventory restock alerts",
                "Stock adjustments, cycle count auditing, and damage/wastage write-offs",
                "Barcode and QR code scanning for fast inventory intake and pick-pack dispatch"
            ]
        },
        {
            id: "purchasing",
            group: "erp",
            title: "Purchasing & Vendor Management",
            badge: "Procurement Suite",
            badgeColor: "bg-teal-500/10 text-teal-600 border-teal-500/20",
            icon: <ShoppingCart className="w-8 h-8 text-teal-600" />,
            description: "End-to-end procurement with Purchase Requisitions, RFQs, POs, 3-way matching, and vendor performance scoring.",
            features: [
                "Purchase Requisitions (PR) with department-level approval routing",
                "Request for Quotations (RFQ) with multi-vendor comparison sheets",
                "Official Purchase Order (PO) generation with payment terms and delivery dates",
                "Automated 3-way matching between PO, Goods Received Notes (GRN), and Vendor Bills",
                "Vendor performance rating, on-time delivery tracking & payment history",
                "Automated Accounts Payable bill posting directly into the General Ledger"
            ]
        },
        {
            id: "sales_pos",
            group: "erp",
            title: "Sales, CRM & Point of Sale (POS)",
            badge: "Omnichannel Commerce",
            badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
            icon: <Store className="w-8 h-8 text-amber-600" />,
            description: "Omnichannel commerce from B2B CRM pipeline and standardized E-Invoicing to high-speed retail touchscreen POS.",
            features: [
                "B2B CRM pipeline with deal stages, lead qualification, and customer directory",
                "Sales Quotations, Sales Orders, and compliant E-Invoicing with tax breakdown",
                "High-speed retail touchscreen POS interface with barcode scanner support",
                "Split payment handling (Cash, Credit Card, Bank Transfer, Mobile Money)",
                "Daily cash drawer register reconciliation and POS shift closing summaries",
                "Direct inventory deduction and automatic sales revenue journal entry creation"
            ]
        },
        {
            id: "calendar",
            group: "workforce",
            title: "Universal Company Calendar & Events",
            badge: "Core Platform",
            badgeColor: "bg-green-500/10 text-green-600 border-green-500/20",
            icon: <Calendar className="w-8 h-8 text-green-600" />,
            description: "Consolidated organizational calendar available to all users with shift rosters, leaves, holidays, and training events.",
            features: [
                "Universal calendar accessible to 100% of employees without module gating",
                "Unified view of personal shifts, approved leaves, and official company holidays",
                "Company-wide training events, team workshops, and quarterly milestone dates",
                "Monthly attendance statistics with Present, Absent, Late, and Holiday counters",
                "Synchronized in real-time across the web portal and native mobile applications",
                "Export schedules to iCal, Google Calendar, and Outlook formats"
            ]
        },
        {
            id: "security",
            group: "security_infra",
            title: "Zero-Trust RBAC & Multi-Tenancy",
            badge: "Enterprise Security",
            badgeColor: "bg-red-500/10 text-red-600 border-red-500/20",
            icon: <ShieldCheck className="w-8 h-8 text-red-600" />,
            description: "Strict database-per-tenant isolation, 100+ granular permissions, IP geofencing, and immutable audit logs.",
            features: [
                "Dedicated database-per-tenant isolation with encrypted connection pools",
                "Zero-trust RBAC architecture with 100+ fine-grained permission flags",
                "Custom role builder allowing bespoke administrative and operational profiles",
                "Office network IP restriction & mobile GPS geofencing for attendance check-in",
                "Complete immutable audit logging capturing user, action, timestamp & IP address",
                "Package subscription gating strictly preventing unauthorized module access"
            ]
        },
        {
            id: "mobile",
            group: "security_infra",
            title: "Parallel Native Mobile Applications",
            badge: "Flutter iOS & Android",
            badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
            icon: <Smartphone className="w-8 h-8 text-indigo-600" />,
            description: "Native cross-platform Flutter mobile applications built in lockstep with the web platform for total workforce mobility.",
            features: [
                "Full-featured native Flutter apps for Android and iOS mirroring web features",
                "Biometric fingerprint / face unlock and offline-resilient data caching",
                "Mobile punch-in with QR code scanning and network validation",
                "Instant push notifications for pending approvals, shifts, and team chat",
                "Employee self-service: digital payslip downloads, leave requests & loan tracking",
                "Administrative controls: device management, user approvals & team rosters on mobile"
            ]
        }
    ];

    const filterOptions = [
        { id: "all", label: "All Features" },
        { id: "workforce", label: "Workforce & Talent" },
        { id: "financials", label: "Payroll & Compensation" },
        { id: "ai_workflows", label: "AI & Workflows" },
        { id: "erp", label: "Enterprise ERP" },
        { id: "security_infra", label: "Security & Mobile" }
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
                            <img src="/humanitas.svg" alt="Humanitas" className="w-10 h-10" />
                            <span className="text-xl font-bold text-brand-blue">
                                Humanitas
                            </span>
                        </div>

                        <div className="hidden md:flex items-center gap-4">
                            <Button variant="ghost" onClick={() => navigate('/')}>Home</Button>
                            <ModeToggle />
                            <Button
                                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                                className="bg-primary text-primary-foreground rounded-full hover:bg-primary/90"
                            >
                                {isAuthenticated ? "Go to Dashboard" : "Login"}
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
                        <Button variant="ghost" onClick={() => navigate('/')} className="w-full justify-start">Home</Button>
                        <Button
                            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                            className="w-full bg-primary text-primary-foreground"
                        >
                            {isAuthenticated ? "Go to Dashboard" : "Login"}
                        </Button>
                    </div>
                )}
            </nav>

            {/* Header */}
            <header className="pt-32 pb-14 bg-gradient-to-b from-primary/5 via-background to-background">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
                        <Sparkles className="w-3.5 h-3.5" />
                        Complete Platform Capabilities
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold text-foreground tracking-tight mb-6">
                        Enterprise Architecture. <br />
                        <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                            Limitless Capability.
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                        Explore every core and advanced feature across our Human Resource Management, Biometric Hardware, 
                        Double-Entry Financials, Supply Chain, and Autonomous AI Intelligence Suite.
                    </p>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
                        {filterOptions.map((f) => (
                            <Button
                                key={f.id}
                                variant={activeFilter === f.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveFilter(f.id)}
                                className={`rounded-full transition-all ${
                                    activeFilter === f.id
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "hover:bg-muted"
                                }`}
                            >
                                {f.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Features Grid */}
            <section className="py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredCategories.map((cat) => (
                            <div
                                key={cat.id}
                                className="bg-card p-7 rounded-2xl border border-border shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center group-hover:scale-105 transition-transform">
                                            {cat.icon}
                                        </div>
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cat.badgeColor}`}>
                                            {cat.badge}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                                        {cat.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                                        {cat.description}
                                    </p>
                                    <div className="border-t border-border/60 pt-4 mb-2">
                                        <ul className="space-y-2.5">
                                            {cat.features.map((feature, fIdx) => (
                                                <li key={fIdx} className="flex items-start gap-2.5">
                                                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                                    <span className="text-muted-foreground text-xs leading-normal">
                                                        {feature}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Architectural Highlights Section */}
            <section className="py-16 bg-muted/30 border-y border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <Badge variant="outline" className="mb-3 text-xs uppercase tracking-wider">Enterprise Architecture</Badge>
                        <h2 className="text-3xl font-extrabold text-foreground">Engineered for Scale, Accuracy & Compliance</h2>
                        <p className="text-muted-foreground mt-3 text-sm md:text-base">
                            Under the hood, Humanitas is architected to eliminate financial discrepancies, guarantee hardware uptime, and isolate enterprise tenant data.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-card p-6 rounded-xl border border-border">
                            <Zap className="w-8 h-8 text-amber-500 mb-3" />
                            <h4 className="font-bold text-foreground text-base mb-1">Python Math Delegation</h4>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                All complex arithmetic, FIFO inventory costing queues, and payroll tax equations are executed by our high-precision Python FastAPI calculation microservice.
                            </p>
                        </div>

                        <div className="bg-card p-6 rounded-xl border border-border">
                            <Database className="w-8 h-8 text-blue-500 mb-3" />
                            <h4 className="font-bold text-foreground text-base mb-1">Database-per-Tenant</h4>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                True multi-tenancy with strict logical and database isolation. No co-mingling of tenant schemas, ensuring total GDPR and compliance privacy.
                            </p>
                        </div>

                        <div className="bg-card p-6 rounded-xl border border-border">
                            <Lock className="w-8 h-8 text-emerald-500 mb-3" />
                            <h4 className="font-bold text-foreground text-base mb-1">Zero-Trust RBAC</h4>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                100% of endpoints, mutations, and UI buttons are guarded by strict module subscription checks and fine-grained cryptographic role-based tokens.
                            </p>
                        </div>

                        <div className="bg-card p-6 rounded-xl border border-border">
                            <Smartphone className="w-8 h-8 text-indigo-500 mb-3" />
                            <h4 className="font-bold text-foreground text-base mb-1">Full Mobile Parity</h4>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                Native Flutter apps for iOS & Android built in strict parallel. Offline punch caching, biometric login, and push approvals out of the box.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Additional Capabilities List */}
            <section className="py-16 bg-background">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                    <h2 className="text-3xl font-bold text-center mb-4 text-foreground">Operational Excellence</h2>
                    <p className="text-center text-muted-foreground text-sm max-w-2xl mx-auto mb-12">
                        Every auxiliary system and utility you need to run high-efficiency enterprise operations.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        <FeatureItem icon={<Smartphone />} title="Mobile Responsive & Native Apps" desc="Access payslips, check rosters, and request leave from any mobile device, anywhere." />
                        <FeatureItem icon={<Bell />} title="Real-Time Event Notifications" desc="Instant push alerts and email summaries for approvals, tasks, shift changes, and news." />
                        <FeatureItem icon={<Settings />} title="Configurable Approval Hierarchies" desc="Tailor multi-stage approval chains for leave, loans, per diems, and expense claims." />
                        <FeatureItem icon={<FileText />} title="Comprehensive Audit Trails" desc="Track every record edit, clock-in event, and permission modification with immutable timestamps." />
                        <FeatureItem icon={<Lock />} title="Network & Geofence Protection" desc="Restrict clock-ins by office IP subnets or verified biometric device hardware serials." />
                        <FeatureItem icon={<Calendar />} title="Consolidated Operations Calendar" desc="Visualize employee shifts, public holidays, and approved absences in a unified master calendar." />
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-card text-foreground text-center border-t border-border">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Ready to Modernize Your Enterprise?</h2>
                    <p className="text-muted-foreground text-base mb-8">
                        Deploy Humanitas with complete multi-tenant security, automated compliance, and real-time biometric intelligence.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <Button
                            size="lg"
                            onClick={() => navigate("/setup-account")}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-10 rounded-full text-base font-semibold shadow-md"
                        >
                            Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                            className="h-14 px-8 rounded-full text-base"
                        >
                            {isAuthenticated ? "Go to Dashboard" : "Sign In"}
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-card text-muted-foreground py-12 border-t border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-foreground">
                            <img src="/humanitas.svg" alt="Humanitas" className="w-6 h-6" />
                            <span className="font-bold text-lg">Humanitas</span>
                        </div>
                        <p className="text-sm">Comprehensive Enterprise HRMS, PMS & ERP Ecosystem.</p>
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold mb-4">Core Modules</h4>
                        <ul className="space-y-2 text-sm">
                            <li>Biometric Attendance & Roster</li>
                            <li>Automated Payroll & Taxes</li>
                            <li>Performance Management (PMS)</li>
                            <li>Universal Team Chat</li>
                            <li>AI Knowledge Copilot</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold mb-4">ERP Suite</h4>
                        <ul className="space-y-2 text-sm">
                            <li>Double-Entry Accounting</li>
                            <li>Multi-Warehouse Inventory</li>
                            <li>Purchasing & 3-Way Matching</li>
                            <li>Sales, CRM & Retail POS</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold mb-4">Security & Architecture</h4>
                        <ul className="space-y-2 text-sm">
                            <li>Zero-Trust RBAC</li>
                            <li>Database-per-Tenant</li>
                            <li>Python Calculation Service</li>
                            <li>Flutter Mobile Apps</li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-border text-center text-sm">
                    © 2026 Humanitas. All rights reserved.
                </div>
            </footer>
        </div>
    );
}

function FeatureItem({ icon, title, desc }: { icon: any, title: string, desc: string }) {
    return (
        <div className="flex gap-4">
            <div className="mt-1 text-primary">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-foreground mb-1">{title}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
