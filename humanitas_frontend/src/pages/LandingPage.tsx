import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Scale,
    Boxes,
    ShoppingCart,
    Store,
    DollarSign,
    Target,
    Clock,
    CheckCircle,
    Menu,
    X,
    Bot,
    Sparkles,
    LineChart
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ModeToggle } from "@/components/mode-toggle";
import LandingAiAssistant from "@/components/landing/LandingAiAssistant";

export default function LandingPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

    // Scroll to section
    const scrollTo = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            setMobileMenuOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
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
                                <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground -mt-1">
                                    Enterprise Operating System
                                </span>
                            </div>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center gap-8">
                            <button onClick={() => navigate('/features')} className="text-muted-foreground hover:text-primary font-medium transition-colors">Features & Architecture</button>
                            <button onClick={() => scrollTo('erp-modules')} className="text-muted-foreground hover:text-primary font-medium transition-colors">ERP Modules</button>
                            <button onClick={() => scrollTo('enterprise-benefits')} className="text-muted-foreground hover:text-primary font-medium transition-colors">Enterprise Benefits</button>
                            <button onClick={() => { setAiAssistantOpen(true); window.dispatchEvent(new CustomEvent('open-landing-ai')); }} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                                Help & AI
                            </button>
                            <ModeToggle />
                            <Button
                                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6 shadow-md"
                            >
                                {isAuthenticated ? "Go to ERP Dashboard" : "Sign In to ERP"}
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
                        <button onClick={() => navigate('/features')} className="block w-full text-left py-2 font-medium text-muted-foreground">Features & Architecture</button>
                        <button onClick={() => scrollTo('erp-modules')} className="block w-full text-left py-2 font-medium text-muted-foreground">ERP Modules</button>
                        <button onClick={() => scrollTo('enterprise-benefits')} className="block w-full text-left py-2 font-medium text-muted-foreground">Enterprise Benefits</button>
                        <button
                            onClick={() => { setAiAssistantOpen(true); setMobileMenuOpen(false); window.dispatchEvent(new CustomEvent('open-landing-ai')); }}
                            className="block w-full text-left py-2 font-semibold text-blue-600 flex items-center gap-2"
                        >
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            Help & AI Assistant
                        </button>
                        <Button
                            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                            className="w-full bg-primary text-primary-foreground"
                        >
                            {isAuthenticated ? "Go to ERP Dashboard" : "Sign In to ERP"}
                        </Button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-blue-600/15 rounded-full blur-3xl -z-10 opacity-60 pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-semibold mb-6 animate-fade-in-up border border-blue-500/20">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        Complete Cloud ERP & Business Intelligence Suite
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
                        One Single Platform.<br />
                        <span className="text-primary">Your Entire Enterprise</span>, Connected.
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
                        Humanitas-ERP bridges Double-Entry Financials, Multi-Warehouse Supply Chain, Purchasing, Sales, Retail POS, Agile PMS, and Human Capital with autonomous AI workflows and isolated tenant architecture.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            size="lg"
                            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                            className="w-full sm:w-auto text-lg h-14 px-8 rounded-full shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                        >
                            {isAuthenticated ? "Open ERP Hub" : "Deploy Enterprise ERP"}
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => navigate('/features')}
                            className="w-full sm:w-auto text-lg h-14 px-8 rounded-full border-input hover:bg-accent text-foreground hover:text-accent-foreground font-semibold"
                        >
                            Explore Full Architecture
                        </Button>
                    </div>

                    {/* Highlights Badges */}
                    <div className="mt-12 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> Double-Entry Ledger & Chart of Accounts
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> FIFO / AVCO Inventory Costing Queues
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> 3-Way Matching Purchasing & Vendor POs
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> Retail POS & Cash Drawer Audits
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/60 border">
                            <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> Full HRMS, Biometric Attendance & Payroll
                        </span>
                    </div>

                    {/* Hero Image / Mockup */}
                    <div className="mt-16 relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 h-24 bottom-0" />
                        <div className="rounded-2xl border-8 border-gray-900 shadow-2xl overflow-hidden bg-gray-900 mx-auto max-w-5xl">
                            <div className="bg-gray-800 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                </div>
                                <span className="text-xs text-gray-400 font-mono">Humanitas-ERP Enterprise Operations Command Center</span>
                                <div className="w-12" />
                            </div>
                            <img
                                src="/dashboard-preview.png"
                                alt="Humanitas-ERP Enterprise Suite Preview"
                                className="w-full h-auto opacity-90"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Modules Grid */}
            <section id="erp-modules" className="py-20 bg-muted/40 border-t border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <Badge variant="outline" className="mb-3 text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                            Comprehensive ERP Capability
                        </Badge>
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Complete Enterprise Modules</h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">
                            Eliminate fragmented software stacks. Manage financials, supply chain, retail sales, project delivery, and human capital on a single unified database.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <ModuleCard
                            icon={<Scale className="w-8 h-8 text-emerald-600" />}
                            title="Double-Entry Financials & General Ledger"
                            description="Hierarchical Chart of Accounts, auto-balancing journal vouchers, real-time Trial Balance, Balance Sheet, P&L, and fixed asset depreciation."
                        />
                        <ModuleCard
                            icon={<Boxes className="w-8 h-8 text-blue-600" />}
                            title="Multi-Warehouse Inventory & Costing"
                            description="Real-time stock valuation using FIFO / AVCO queues, inter-warehouse transfers, low-stock thresholds, and batch/lot expiration tracking."
                        />
                        <ModuleCard
                            icon={<ShoppingCart className="w-8 h-8 text-purple-600" />}
                            title="Purchasing & 3-Way Matching"
                            description="Vendor management, Purchase Requisitions, RFQs, Purchase Orders, Goods Receipt Notes (GRN), and 3-way invoice matching."
                        />
                        <ModuleCard
                            icon={<LineChart className="w-8 h-8 text-indigo-600" />}
                            title="Sales, CRM & Regional E-Invoicing"
                            description="Customer pipeline tracking, formal quotations, sales orders, automated delivery notes, regional tax calculators, and recurring invoices."
                        />
                        <ModuleCard
                            icon={<Store className="w-8 h-8 text-amber-600" />}
                            title="Retail Point of Sale (POS)"
                            description="High-speed touchscreen POS register, barcode scanning, multiple payment tenders, split bills, cash drawer tracking, and daily shift closes."
                        />
                        <ModuleCard
                            icon={<DollarSign className="w-8 h-8 text-green-600" />}
                            title="Integrated Payroll & Statutory Taxes"
                            description="Direct rollover of payroll expenses into General Ledger vouchers, Ethiopian 2024 tax brackets, 7% pension, and bank transfer exports."
                        />
                        <ModuleCard
                            icon={<Clock className="w-8 h-8 text-orange-600" />}
                            title="Biometric Timekeeping & Workforce Flex"
                            description="ZKTeco/Hikvision ADMS clock-in sync, smart roster shifts, overtime calculation queues, and Voluntary Extra Time (VET/VTO) broadcasts."
                        />
                        <ModuleCard
                            icon={<Target className="w-8 h-8 text-rose-600" />}
                            title="Agile PMS & Capital Projects"
                            description="Manage project work packages, cost centers, sprint backlogs, billable time logs, resource allocation, and project milestone Gantt charts."
                        />
                        <ModuleCard
                            icon={<Bot className="w-8 h-8 text-violet-600" />}
                            title="Enterprise Cross-Module AI Copilot"
                            description="Autonomous enterprise copilot with natural language SQL querying, predictive replenishment alerts, contract drafting, and business forecasting."
                        />
                    </div>
                </div>
            </section>

            {/* Architecture & Reliability Section */}
            <section id="enterprise-benefits" className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <Badge variant="outline" className="mb-3 text-xs bg-primary/10 text-primary border-primary/20">
                                Enterprise Reliability
                            </Badge>
                            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">
                                Architected for Strict Fiscal Integrity & Scale
                            </h2>
                            <p className="text-muted-foreground text-base mb-8">
                                Designed to withstand complex multi-subsidiary corporate demands with zero calculation discrepancies and isolated tenant databases.
                            </p>

                            <div className="space-y-6">
                                <BenefitRow
                                    title="Multi-Company, Multi-Branch & Multi-Currency"
                                    desc="Strict 4-tier organizational isolation (Tenant → Company → Branch → Department) with consolidated enterprise rollups."
                                />
                                <BenefitRow
                                    title="Dedicated Python Calculation Service"
                                    desc="All heavy financial math, FIFO inventory cost queues, depreciation schedules, and tax formulas execute in high-precision Python FastAPI."
                                />
                                <BenefitRow
                                    title="Automated Cross-Module Ledger Rollup"
                                    desc="Payroll runs, sales invoices, vendor payments, and inventory adjustments automatically post balancing journal entries to General Ledger."
                                />
                                <BenefitRow
                                    title="Native Parallel Mobile Development"
                                    desc="Flutter mobile apps for iOS and Android with barcode scanning, mobile approvals, inventory lookups, and employee self-service."
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/10 rounded-3xl rotate-2" />
                            <div className="relative bg-card p-8 rounded-3xl shadow-xl border border-border space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold">
                                            ERP
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm">Humanitas Enterprise Cloud</h4>
                                            <p className="text-xs text-muted-foreground">General Ledger Balance: Exact 0.00 Diff</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                                        Balanced & Audited
                                    </Badge>
                                </div>

                                <div className="space-y-3">
                                    <div className="p-3.5 bg-muted/40 rounded-xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <Scale className="w-4 h-4 text-emerald-600" />
                                            <span className="font-medium">Trial Balance Debit / Credit</span>
                                        </div>
                                        <span className="font-semibold text-emerald-600">Auto-Balancing</span>
                                    </div>
                                    <div className="p-3.5 bg-muted/40 rounded-xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <Boxes className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium">Inventory Valuation (AVCO/FIFO)</span>
                                        </div>
                                        <span className="font-semibold text-blue-600">Reconciled</span>
                                    </div>
                                    <div className="p-3.5 bg-muted/40 rounded-xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="w-4 h-4 text-green-600" />
                                            <span className="font-medium">Payroll Ledger Integration</span>
                                        </div>
                                        <span className="font-semibold text-green-600">Live Post</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border flex justify-between items-center bg-blue-500/5 p-4 rounded-xl">
                                    <span className="font-semibold text-blue-600 dark:text-blue-400 text-sm">Enterprise Operational Speed</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400 text-xl">+75%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-primary text-primary-foreground">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-5xl font-extrabold mb-6">
                        Ready to Unify Your Enterprise?
                    </h2>
                    <p className="text-primary-foreground/90 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
                        Streamline your financials, supply chain, point of sale, and workforce operations on one cohesive platform.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            size="lg"
                            onClick={() => navigate("/setup-account")}
                            className="bg-background text-foreground hover:bg-background/90 h-14 px-10 rounded-full text-lg font-bold shadow-xl"
                        >
                            Provision ERP Tenant
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={() => navigate("/features")}
                            className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 h-14 px-8 rounded-full text-base font-semibold"
                        >
                            Explore All Modules
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-card text-muted-foreground py-12 border-t border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-foreground">
                            <img src="/humanitas.svg" alt="Humanitas ERP" className="w-6 h-6" />
                            <span className="font-bold text-lg">Humanitas ERP</span>
                        </div>
                        <p className="text-sm leading-relaxed">
                            Comprehensive Enterprise Cloud ERP, Supply Chain, Point of Sale, and Human Capital Platform.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold mb-4 text-sm">Financials & Supply</h4>
                        <ul className="space-y-2 text-sm">
                            <li>Double-Entry Accounting & Ledger</li>
                            <li>Multi-Warehouse Inventory & Costing</li>
                            <li>Purchasing & 3-Way Matching</li>
                            <li>Sales, CRM & E-Invoicing</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold mb-4 text-sm">Retail & Workforce</h4>
                        <ul className="space-y-2 text-sm">
                            <li>Point of Sale (POS) Cash Registers</li>
                            <li>Integrated Payroll & Tax Engine</li>
                            <li>Biometric Attendance & Rosters</li>
                            <li>Agile PMS & Project Accounting</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold mb-4 text-sm">Enterprise Intelligence</h4>
                        <ul className="space-y-2 text-sm">
                            <li>Autonomous Enterprise AI Copilot</li>
                            <li>Dynamic Multi-Step Approvals</li>
                            <li>Webhooks & Developer REST API</li>
                            <li>Native Mobile (iOS & Android)</li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center text-sm gap-4">
                    <span>© 2026 Humanitas Enterprise Cloud ERP Platform. All rights reserved.</span>
                    <div className="flex gap-6">
                        <span className="hover:text-foreground cursor-pointer">Security Architecture</span>
                        <span className="hover:text-foreground cursor-pointer">Compliance</span>
                        <span className="hover:text-foreground cursor-pointer">Developer API</span>
                    </div>
                </div>
            </footer>

            {/* Public Landing AI Platform Assistant & Human Help Center */}
            <LandingAiAssistant
                isHrmsOnly={false}
                isOpenExternal={aiAssistantOpen}
                onOpenExternal={() => setAiAssistantOpen(true)}
                onCloseExternal={() => setAiAssistantOpen(false)}
            />
        </div>
    );
}

function ModuleCard({ icon, title, description }: { icon: any, title: string, description: string }) {
    return (
        <div className="bg-card p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-border group flex flex-col justify-between">
            <div>
                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{description}</p>
            </div>
        </div>
    );
}

function BenefitRow({ title, desc }: { title: string, desc: string }) {
    return (
        <div className="flex gap-4">
            <div className="mt-1">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <CheckCircle size={14} />
                </div>
            </div>
            <div>
                <h4 className="font-semibold text-foreground text-sm">{title}</h4>
                <p className="text-muted-foreground text-xs leading-relaxed mt-0.5">{desc}</p>
            </div>
        </div>
    );
}
