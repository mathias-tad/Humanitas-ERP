import { useState, useEffect } from 'react';
import { Check, Zap, Users, Building2, HardDrive, Loader2, Plus, ArrowRight, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { SubscriptionPackage } from './BillingPackages';

const FEATURE_NAMES: Record<string, string> = {
  has_hrms: 'Core HRMS & Workforce',
  has_attendance: 'Attendance & Biometrics',
  has_leave: 'Leave Management',
  has_payroll: 'Automated Payroll Engine',
  has_recruitment: 'Recruitment & ATS',
  has_pms: 'Projects & Tasks (PMS)',
  has_products: 'Products & QR Catalog',
  has_inventory: 'Multi-Warehouse Inventory',
  has_purchasing: 'Purchasing & Vendors',
  has_sales: 'Sales, CRM & Invoicing',
  has_pos: 'Point of Sale (POS)',
  has_accounting: 'General Ledger & Accounting',
  has_ai_help: 'AI Help & Guidance',
  has_ai_documents: 'AI Document Preparation',
  has_ai_actions: 'AI System Actions',
  has_ai_full: 'Full AI Suite',
  has_system_logs: 'System Diagnostics & Health',
  has_custom_reports: 'Custom Reports',
  has_api_access: 'Developer REST API',
};

export default function Subscriptions() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const pkgs = await api.get<SubscriptionPackage[]>('/admin/packages');
        setPackages(pkgs);
      } catch (err) {
        console.error('Failed to load packages', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SaaS Subscription Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of configured subscription tiers, feature allocations, and tenant packages.
          </p>
        </div>
        <Button
          onClick={() => navigate('/billing-packages')}
          className="gold-gradient text-slate-950 font-bold hover:opacity-95 shadow-md"
        >
          <Plus className="w-4 h-4 mr-2" /> Manage Packages
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : packages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-muted-foreground">No subscription packages found.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate('/billing-packages')}
            >
              Configure Packages in Package Builder
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((plan) => {
            const activeFeatures = Object.entries(plan.features || {}).filter(([_, v]) => !!v);
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between border ${
                  plan.is_popular
                    ? 'border-primary/60 shadow-lg ring-1 ring-primary/30'
                    : 'border-border'
                } bg-card`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gold-gradient text-slate-950 font-bold px-3 py-0.5 text-xs shadow-sm flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" /> Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pt-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-foreground">{plan.name}</CardTitle>
                    {!plan.is_active && (
                      <Badge variant="outline" className="text-xs text-rose-500">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {plan.description && (
                    <CardDescription className="text-xs">{plan.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-foreground">
                        ${Number(plan.price_usd).toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground">/{plan.billing_cycle}</span>
                    </div>

                    <div className="space-y-2 mt-4 pt-4 border-t border-border text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-primary" /> Max Users
                        </span>
                        <Badge variant="secondary" className="font-mono">
                          {plan.max_employees}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-primary" /> Warehouses
                        </span>
                        <Badge variant="secondary" className="font-mono">
                          {plan.max_warehouses || 1}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-primary" /> Storage
                        </span>
                        <Badge variant="secondary" className="font-mono">
                          {plan.storage_gb || 10} GB
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500" /> AI Tokens
                        </span>
                        <Badge variant="secondary" className="font-mono">
                          {Number(plan.ai_token_limit_per_period).toLocaleString()}/mo
                        </Badge>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 mt-4">
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                        Included Entitlements ({activeFeatures.length})
                      </p>
                      <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {activeFeatures.map(([key]) => (
                          <li key={key} className="flex items-center gap-2 text-xs text-foreground/80">
                            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate">{FEATURE_NAMES[key] || key}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <Button
                    onClick={() => navigate('/billing-packages')}
                    className="w-full mt-4 text-xs font-bold"
                    variant={plan.is_popular ? 'default' : 'outline'}
                  >
                    Edit Package Config <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

