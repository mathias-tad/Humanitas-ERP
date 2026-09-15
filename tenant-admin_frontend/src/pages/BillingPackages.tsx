import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Zap,
  Users,
  Building2,
  ShoppingCart,
  HardDrive,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Sparkles,
  Bot,
  Layers,
  Star,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';

export interface SubscriptionPackage {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  billing_cycle: string;
  max_employees: number;
  max_warehouses?: number;
  max_pos_terminals?: number;
  storage_gb?: number;
  ai_token_limit_per_period: number;
  features: Record<string, boolean>;
  is_popular?: boolean;
  sort_order?: number;
  is_active: boolean;
  lemonsqueezy_variant_id?: string;
}

interface FeatureGroup {
  name: string;
  icon: any;
  features: { key: string; label: string; desc: string }[];
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    name: 'HRMS Human Capital Suite',
    icon: Users,
    features: [
      { key: 'has_hrms', label: 'Core HRMS & Directory', desc: 'Employee master data, org charts & roles' },
      { key: 'has_attendance', label: 'Attendance & Biometrics', desc: 'Shift scheduling, clock-in & biometric sync' },
      { key: 'has_leave', label: 'Leave Management', desc: 'Leave requests, multi-tier approvals & balances' },
      { key: 'has_payroll', label: 'Automated Payroll', desc: 'Tax calculations, payslips & bank export' },
      { key: 'has_recruitment', label: 'Recruitment & ATS', desc: 'Job postings, applicant pipeline & hiring' },
      { key: 'has_pms', label: 'Projects & Tasks (PMS)', desc: 'Sprints, Kanban boards & team KPIs' },
    ],
  },
  {
    name: 'ERP Operations Core',
    icon: Layers,
    features: [
      { key: 'has_products', label: 'Products & QR Catalog', desc: 'Multi-variant matrix, barcodes & label printing' },
      { key: 'has_inventory', label: 'Multi-Warehouse Inventory', desc: 'Stock movements, FIFO/AVCO costing & batches' },
      { key: 'has_purchasing', label: 'Purchasing & Vendors', desc: 'Vendor RFQs, Purchase Orders & 3-way match' },
      { key: 'has_sales', label: 'Sales, CRM & Invoicing', desc: 'Quotations, sales orders & delivery notes' },
      { key: 'has_pos', label: 'Point of Sale (POS)', desc: 'Offline POS cache, barcode scanning & shifts' },
      { key: 'has_accounting', label: 'General Ledger & Accounting', desc: 'Double-entry journals, trial balance & P&L' },
    ],
  },
  {
    name: 'AI Intelligence Suite',
    icon: Bot,
    features: [
      { key: 'has_ai_help', label: 'AI Help & Guidance', desc: 'Interactive how-to assistant with full system knowledge' },
      { key: 'has_ai_documents', label: 'AI Document Engine', desc: 'Generate styled PDF/DOCX templates from DB data' },
      { key: 'has_ai_actions', label: 'AI System Actions', desc: 'Execute system tasks on behalf of permitted users' },
      { key: 'has_ai_full', label: 'Full AI Suite', desc: 'Unlocks all current & future AI capabilities' },
    ],
  },
  {
    name: 'System & Platform Extras',
    icon: Sparkles,
    features: [
      { key: 'has_system_logs', label: 'System Health & Diagnostics', desc: 'Microservice status, failed queues & retries' },
      { key: 'has_custom_reports', label: 'Custom Reports & Analytics', desc: 'Cross-module executive reporting dashboards' },
      { key: 'has_api_access', label: 'Developer REST API Access', desc: 'Webhook events and external API keys' },
    ],
  },
];

const defaultForm = {
  name: '',
  description: '',
  price_usd: 0,
  billing_cycle: 'monthly',
  max_employees: 50,
  max_warehouses: 1,
  max_pos_terminals: 1,
  storage_gb: 10,
  ai_token_limit_per_period: 100000,
  features: {
    has_hrms: true,
    has_attendance: true,
    has_leave: true,
    has_payroll: false,
    has_recruitment: false,
    has_pms: false,
    has_products: false,
    has_inventory: false,
    has_purchasing: false,
    has_sales: false,
    has_pos: false,
    has_accounting: false,
    has_ai_help: false,
    has_ai_documents: false,
    has_ai_actions: false,
    has_ai_full: false,
    has_system_logs: true,
  } as Record<string, boolean>,
  is_popular: false,
  sort_order: 0,
  is_active: true,
  lemonsqueezy_variant_id: '',
};

export default function BillingPackages() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<SubscriptionPackage[]>('/admin/packages');
      setPackages(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load packages';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  function openCreate() {
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(pkg: SubscriptionPackage) {
    setEditId(pkg.id);
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      price_usd: pkg.price_usd,
      billing_cycle: pkg.billing_cycle,
      max_employees: pkg.max_employees || 50,
      max_warehouses: pkg.max_warehouses || 1,
      max_pos_terminals: pkg.max_pos_terminals || 1,
      storage_gb: pkg.storage_gb || 10,
      ai_token_limit_per_period: pkg.ai_token_limit_per_period || 100000,
      features: pkg.features || {},
      is_popular: !!pkg.is_popular,
      sort_order: pkg.sort_order || 0,
      is_active: pkg.is_active,
      lemonsqueezy_variant_id: pkg.lemonsqueezy_variant_id || '',
    });
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to deactivate this package?')) return;
    try {
      await api.delete(`/admin/packages/${id}`);
      toast.success('Package deactivated');
      fetchPackages();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Package name is required');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        price_usd: Number(form.price_usd),
        max_employees: Number(form.max_employees),
        max_warehouses: Number(form.max_warehouses),
        max_pos_terminals: Number(form.max_pos_terminals),
        storage_gb: Number(form.storage_gb),
        ai_token_limit_per_period: Number(form.ai_token_limit_per_period),
        sort_order: Number(form.sort_order),
      };

      if (editId) {
        await api.patch(`/admin/packages/${editId}`, payload);
        toast.success('Package updated successfully');
      } else {
        await api.post('/admin/packages', payload);
        toast.success('Package created successfully');
      }
      setDialogOpen(false);
      fetchPackages();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function toggleFeature(key: string) {
    setForm((f) => ({
      ...f,
      features: {
        ...f.features,
        [key]: !f.features[key],
      },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscription & ERP Packages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure tiered bundles, module entitlements, resource limits, and pricing for all tenants.
          </p>
        </div>
        <Button onClick={openCreate} className="gold-gradient text-slate-950 font-bold hover:opacity-95 shadow-md">
          <Plus className="w-4 h-4 mr-2" /> Create Package
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : packages.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-56 text-center">
            <Layers className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <p className="text-foreground font-semibold text-base">No subscription packages found</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Click &quot;Create Package&quot; to build your first modular ERP tier.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`relative flex flex-col justify-between transition-all duration-200 border ${
                pkg.is_popular
                  ? 'border-primary/60 shadow-lg ring-1 ring-primary/30'
                  : 'border-border'
              } ${!pkg.is_active ? 'opacity-60 bg-muted/20' : 'bg-card'}`}
            >
              {pkg.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gold-gradient text-slate-950 font-bold px-3 py-0.5 text-xs shadow-sm flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                      {pkg.name}
                      {!pkg.is_active && (
                        <Badge variant="outline" className="text-xs text-rose-500 border-rose-300">
                          Inactive
                        </Badge>
                      )}
                    </CardTitle>
                    {pkg.description && (
                      <CardDescription className="mt-1 text-xs">{pkg.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(pkg)} title="Edit Package">
                      <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(pkg.id)} title="Deactivate Package">
                      <Trash2 className="w-4 h-4 text-rose-500 hover:text-rose-600" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">${Number(pkg.price_usd).toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground">/{pkg.billing_cycle}</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1">
                {/* Resource Limits */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span><strong>{pkg.max_employees}</strong> Users</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span><strong>{pkg.max_warehouses || 1}</strong> Warehouse</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                    <span><strong>{pkg.max_pos_terminals || 1}</strong> POS Point</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <HardDrive className="w-3.5 h-3.5 text-primary" />
                    <span><strong>{pkg.storage_gb || 10}</strong> GB Storage</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground pt-1 border-t border-border/40">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span><strong>{Number(pkg.ai_token_limit_per_period).toLocaleString()}</strong> AI tokens/mo</span>
                  </div>
                </div>

                {/* Subscribed Modules Summary */}
                <div className="space-y-3 pt-2">
                  {FEATURE_GROUPS.map((group) => {
                    const activeCount = group.features.filter((f) => pkg.features?.[f.key]).length;
                    return (
                      <div key={group.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <group.icon className="w-3.5 h-3.5 text-primary" />
                            {group.name}
                          </span>
                          <span className="text-[11px] font-mono text-foreground/70">
                            {activeCount}/{group.features.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {group.features.map((f) => {
                            const isEnabled = !!pkg.features?.[f.key];
                            return (
                              <div
                                key={f.key}
                                className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded transition-colors ${
                                  isEnabled
                                    ? 'bg-primary/10 text-foreground font-medium border border-primary/20'
                                    : 'text-muted-foreground/50 opacity-60'
                                }`}
                              >
                                {isEnabled ? (
                                  <Check className="w-3 h-3 text-primary shrink-0" />
                                ) : (
                                  <span className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0" />
                                )}
                                <span className="truncate">{f.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Package Create / Edit Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {editId ? 'Edit Subscription Package' : 'Create Modular ERP Package'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* General Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-xl border border-border">
              <div className="md:col-span-2 space-y-1.5">
                <Label>Package Name *</Label>
                <Input
                  placeholder="e.g. Professional ERP Suite, Enterprise Max"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                />
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <Label>Short Description / Tagline</Label>
                <Input
                  placeholder="e.g. Complete manufacturing, inventory, payroll & AI suite for scaling firms"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Price (USD) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_usd}
                  onChange={(e) => setForm((f) => ({ ...f, price_usd: Number(e.target.value) }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Billing Cycle</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={form.billing_cycle}
                  onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value }))}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>LemonSqueezy Variant ID</Label>
                <Input
                  placeholder="variant_12345"
                  value={form.lemonsqueezy_variant_id}
                  onChange={(e) => setForm((f) => ({ ...f, lemonsqueezy_variant_id: e.target.value }))}
                />
              </div>
            </div>

            {/* Resource Quotas */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" /> Resource Quotas & Limits
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-muted/20 p-4 rounded-xl border border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Max Users</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_employees}
                    onChange={(e) => setForm((f) => ({ ...f, max_employees: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Warehouses</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_warehouses}
                    onChange={(e) => setForm((f) => ({ ...f, max_warehouses: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">POS Terminals</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.max_pos_terminals}
                    onChange={(e) => setForm((f) => ({ ...f, max_pos_terminals: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Storage (GB)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.storage_gb}
                    onChange={(e) => setForm((f) => ({ ...f, storage_gb: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">AI Tokens / Mo</Label>
                  <Input
                    type="number"
                    min="0"
                    step="10000"
                    value={form.ai_token_limit_per_period}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ai_token_limit_per_period: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Modular Entitlements Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Module Entitlements & Permissions
              </h3>

              <div className="space-y-4">
                {FEATURE_GROUPS.map((group) => (
                  <div key={group.name} className="border border-border rounded-xl p-3.5 bg-card space-y-2.5">
                    <div className="flex items-center gap-2 font-semibold text-xs text-foreground uppercase tracking-wider">
                      <group.icon className="w-4 h-4 text-primary" />
                      {group.name}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {group.features.map((feat) => {
                        const checked = !!form.features[feat.key];
                        return (
                          <button
                            key={feat.key}
                            type="button"
                            onClick={() => toggleFeature(feat.key)}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all border ${
                              checked
                                ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                                : 'bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/60'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {checked ? (
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                              ) : (
                                <XCircle className="w-4 h-4 text-muted-foreground/40" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold leading-tight">{feat.label}</div>
                              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                                {feat.desc}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Toggles */}
            <div className="flex items-center gap-6 bg-muted/20 p-3 rounded-lg border border-border">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_popular}
                  onChange={(e) => setForm((f) => ({ ...f, is_popular: e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span>Mark as &quot;Most Popular&quot; tier</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span>Active for new subscribers</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gold-gradient text-slate-950 font-bold hover:opacity-95 shadow-md"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editId ? 'Save Package Changes' : 'Create Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

