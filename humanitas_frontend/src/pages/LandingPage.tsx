import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    Users,
    DollarSign,
    Target,
    Clock,
    CheckCircle,
    Menu,
    X,
    CreditCard,
    ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ModeToggle } from "@/components/mode-toggle";

export default function LandingPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                            <img src="/humanitas.svg" alt="Humanitas" className="w-10 h-10" />
                            <span className="text-xl font-bold text-brand-blue">
                                Humanitas
                            </span>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center gap-8">
                            <button onClick={() => navigate('/features')} className="text-muted-foreground hover:text-primary font-medium transition-colors">Features</button>
                            <button onClick={() => scrollTo('modules')} className="text-muted-foreground hover:text-primary font-medium transition-colors">Modules</button>
                            <button onClick={() => scrollTo('benefits')} className="text-muted-foreground hover:text-primary font-medium transition-colors">Benefits</button>
                            <ModeToggle />
                            <Button
                                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6"
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
                        <button onClick={() => navigate('/features')} className="block w-full text-left py-2 font-medium text-muted-foreground">Features</button>
                        <button onClick={() => scrollTo('modules')} className="block w-full text-left py-2 font-medium text-muted-foreground">Modules</button>
                        <button onClick={() => scrollTo('benefits')} className="block w-full text-left py-2 font-medium text-muted-foreground">Benefits</button>
                        <Button
                            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                            className="w-full bg-primary text-primary-foreground"
                        >
                            {isAuthenticated ? "Go to Dashboard" : "Login"}
                        </Button>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/20 rounded-full blur-3xl -z-10 opacity-60 pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 animate-fade-in-up">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        New Generation HRMS
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
                        Simplify Your <span className="text-primary">Workforce</span> <br /> Management
                    </h1>

                    <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                        Humanitas brings HR, Payroll, Performance, and Attendance together in one powerful, intuitive platform designed for modern teams.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            size="lg"
                            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                            className="w-full sm:w-auto text-lg h-14 px-8 rounded-full shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            {isAuthenticated ? "Open App" : "Get Started Now"}
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => navigate('/features')}
                            className="w-full sm:w-auto text-lg h-14 px-8 rounded-full border-input hover:bg-accent text-foreground hover:text-accent-foreground"
                        >
                            Explore Features
                        </Button>
                    </div>

                    {/* Hero Image / Mockup */}
                    <div className="mt-20 relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 h-20 bottom-0" />
                        <div className="rounded-2xl border-8 border-gray-900 shadow-2xl overflow-hidden bg-gray-900 mx-auto max-w-5xl">
                            <div className="bg-gray-800 p-4 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                            </div>
                            <img
                                src="/dashboard-preview.png"
                                alt="Humanitas Dashboard Preview"
                                className="w-full h-auto opacity-90"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Modules Grid */}
            <section id="modules" className="py-20 bg-muted/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-foreground mb-4">Complete Modules Suite</h2>
                        <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to manage your organization efficiently, all in one place.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <ModuleCard
                            icon={<Users className="w-8 h-8 text-primary" />}
                            title="HR Management"
                            description="Full employee lifecycle management, document repository, and automated onboarding workflows."
                        />
                        <ModuleCard
                            icon={<DollarSign className="w-8 h-8 text-green-600" />}
                            title="Payroll Automation"
                            description="One-click payroll processing, tax calculations, payslip generation, and bank integrations."
                        />
                        <ModuleCard
                            icon={<Target className="w-8 h-8 text-primary" />}
                            title="Performance (PMS)"
                            description="Set goals, track KPIs, conduct reviews, and manage probations with data-driven insights."
                        />
                        <ModuleCard
                            icon={<Clock className="w-8 h-8 text-orange-600" />}
                            title="Time & Attendance"
                            description="Biometric integration, shift scheduling, overtime calculation, and leave management."
                        />
                        <ModuleCard
                            icon={<CreditCard className="w-8 h-8 text-pink-600" />}
                            title="Expense Management"
                            description="Streamlined per diem claims, reimbursements, and multi-level approval workflows."
                        />
                        <ModuleCard
                            icon={<ShieldCheck className="w-8 h-8 text-indigo-600" />}
                            title="Access Control"
                            description="Granular permission settings, role-based access control (RBAC), and audit logs."
                        />
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section id="benefits" className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-foreground mb-6">Why Choose Humanitas?</h2>
                            <div className="space-y-6">
                                <BenefitRow
                                    title="Enterprise Grade Security"
                                    desc="Bank-level encryption and secure data handling procedures."
                                />
                                <BenefitRow
                                    title="Real-time Analytics"
                                    desc="Make informed decisions with live dashboards and customizable reports."
                                />
                                <BenefitRow
                                    title="Seamless Integration"
                                    desc="Connects with biometric devices, accounting software, and more."
                                />
                                <BenefitRow
                                    title="Mobile Friendly"
                                    desc="Employees can access payslips and request leave from any device."
                                />
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/10 rounded-3xl rotate-3" />
                            <div className="relative bg-card p-8 rounded-3xl shadow-xl border border-border">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 rounded-full bg-muted" />
                                    <div>
                                        <div className="h-4 w-32 bg-muted rounded mb-2" />
                                        <div className="h-3 w-20 bg-muted/60 rounded" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${i === 1 ? 'bg-green-100 text-green-600' : i === 2 ? 'bg-primary/20 text-primary' : 'bg-purple-100 text-purple-600'}`}>
                                                    {i === 1 ? <CheckCircle size={16} /> : i === 2 ? <DollarSign size={16} /> : <Target size={16} />}
                                                </div>
                                                <div className="h-3 w-24 bg-muted rounded" />
                                            </div>
                                            <div className="h-3 w-12 bg-muted rounded" />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 pt-8 border-t border-border">
                                    <div className="flex justify-between items-center bg-primary/10 p-4 rounded-xl">
                                        <span className="font-semibold text-primary">Efficiency Gain</span>
                                        <span className="font-bold text-primary text-xl">+45%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-primary text-primary-foreground">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your HR?</h2>
                    <p className="text-primary-foreground/90 text-xl mb-10">Join thousands of companies using Humanitas to streamline their workforce management.</p>
                    <Button
                        size="lg"
                        onClick={() => navigate("/setup-account")}
                        className="bg-background text-foreground hover:bg-background/90 h-14 px-10 rounded-full text-lg font-semibold"
                    >
                        Create Free Account
                    </Button>
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

function ModuleCard({ icon, title, description }: { icon: any, title: string, description: string }) {
    return (
        <div className="bg-card p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-border group">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
            <p className="text-muted-foreground leading-relaxed">{description}</p>
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
                <h4 className="font-semibold text-foreground">{title}</h4>
                <p className="text-muted-foreground text-sm">{desc}</p>
            </div>
        </div>
    );
}
