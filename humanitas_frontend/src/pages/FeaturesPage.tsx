import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Users,
    DollarSign,
    Target,
    Clock,
    ShieldCheck,
    CreditCard,
    FileText,
    Calendar,
    Settings,
    Bell,
    Smartphone,
    CheckCircle2,
    Lock,
    ArrowRight,
    Menu,
    X
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ModeToggle } from "@/components/mode-toggle";
import { useState } from "react";

export default function FeaturesPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const categories = [
        {
            title: "Core HR & Employee Management",
            icon: <Users className="w-8 h-8 text-primary" />,
            features: [
                "Employee Database & Profiles",
                "Document Repository (Contracts, IDs)",
                "Onboarding & Offboarding Workflows",
                "Organization Chart & Hierarchy",
                "Digital Asset Management (Laptops, etc.)"
            ]
        },
        {
            title: "Payroll Automation",
            icon: <DollarSign className="w-8 h-8 text-green-600" />,
            features: [
                "One-Click Payroll Processing",
                "Automated Tax Calculations (Ethiopian Tax Rules)",
                "Pension Reports (7% / 11%)",
                "Digital Payslip Generation & Emailing",
                "Bank Advice & Transfer Reports"
            ]
        },
        {
            title: "Performance Management (PMS)",
            icon: <Target className="w-8 h-8 text-primary" />,
            features: [
                "Goal Setting (OKRs / KPIs)",
                "Quarterly & Annual Reviews",
                "360-Degree Feedback",
                "Probation Evaluation Workflows",
                "Performance Improvement Plans (PIP)"
            ]
        },
        {
            title: "Time & Attendance",
            icon: <Clock className="w-8 h-8 text-orange-600" />,
            features: [
                "Biometric Device Integration",
                "Shift Scheduling & Rostering",
                "Overtime Calculation & Approval",
                "Leave Management & Accruals",
                "Lateness & Absence Tracking"
            ]
        },
        {
            title: "Finance & Expenses",
            icon: <CreditCard className="w-8 h-8 text-pink-600" />,
            features: [
                "Per Diem & Travel Claims",
                "Expense Reimbursement",
                "Loan Management & Deductions",
                "Acting Allowances",
                "Hardship & Desert Allowances"
            ]
        },
        {
            title: "Security & Administration",
            icon: <ShieldCheck className="w-8 h-8 text-indigo-600" />,
            features: [
                "Role-Based Access Control (RBAC)",
                "Detailed Audit Logs",
                "Multi-Tenant Architecture",
                "Customizable Permissions",
                "Secure Data Encryption"
            ]
        }
    ];

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
            <header className="pt-32 pb-16 bg-background">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6">
                        Powerful Features for <br /> <span className="text-primary">Modern Teams</span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Discover the comprehensive suite of tools designed to streamline every aspect of your workforce management.
                    </p>
                </div>
            </header>

            {/* Features Grid */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {categories.map((cat, idx) => (
                            <div key={idx} className="bg-card p-8 rounded-2xl shadow-sm border border-border hover:shadow-xl transition-all duration-300 group">
                                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    {cat.icon}
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-4">{cat.title}</h3>
                                <ul className="space-y-3">
                                    {cat.features.map((feature, fIdx) => (
                                        <li key={fIdx} className="flex items-start gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                            <span className="text-muted-foreground text-sm">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Additional Features List */}
            <section className="py-16 bg-background border-t border-border">
                <div className="max-w-4xl mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center mb-12 text-foreground">More Capabilities</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        <FeatureItem icon={<Smartphone />} title="Mobile Responsive" desc="Access payslips and request leave from any device, anywhere." />
                        <FeatureItem icon={<Bell />} title="Real-time Notifications" desc="Instant alerts for approvals, tasks, and shift assignments." />
                        <FeatureItem icon={<Settings />} title="Customizable Workflows" desc="Tailor approval chains for leave, loans, and expenses." />
                        <FeatureItem icon={<FileText />} title="Audit Trails" desc="Track every change with detailed logs for compliance." />
                        <FeatureItem icon={<Lock />} title="Data Privacy" desc="Advanced encryption ensures your employee data remains secure." />
                        <FeatureItem icon={<Calendar />} title="Team Calendar" desc="Visualize leave, shifts, and events in a unified view." />
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-card text-foreground text-center border-t border-border">
                <h2 className="text-3xl font-bold mb-6">Ready to experience these features?</h2>
                <Button
                    size="lg"
                    onClick={() => navigate("/setup-account")}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-10 rounded-full text-lg"
                >
                    Get Started for Free <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
            </section>

            {/* Footer */}
            <footer className="bg-card text-muted-foreground py-12 border-t border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <div className="flex items-center gap-2 mb-4 text-foreground">
                            <img src="/humanitas.svg" alt="Humanitas" className="w-6 h-6" />
                            <span className="font-bold text-lg">Humanitas</span>
                        </div>
                        <p className="text-sm">Modern HR for modern teams.</p>
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold mb-4">Product</h4>
                        <ul className="space-y-2 text-sm">
                            <li>Features</li>
                            <li>Pricing</li>
                            <li>Demo</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold mb-4">Company</h4>
                        <ul className="space-y-2 text-sm">
                            <li>About</li>
                            <li>Careers</li>
                            <li>Contact</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold mb-4">Legal</h4>
                        <ul className="space-y-2 text-sm">
                            <li>Privacy</li>
                            <li>Terms</li>
                            <li>Security</li>
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
                <p className="text-muted-foreground text-sm">{desc}</p>
            </div>
        </div>
    );
}
