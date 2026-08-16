import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Zap, Users, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
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

interface SubscriptionPackage {
  id: string;
  name: string;
  price_usd: number;
  billing_cycle: string;
  max_employees: number;
  ai_token_limit_per_period: number;
  features: Record<string, boolean>;
  is_active: boolean;
  lemonsqueezy_variant_id?: string;
}

const FEATURE_LABELS: Record<string, string> = {
  has_payroll: 'Payroll Processing',
  has_recruitment: 'Recruitment Module',
  has_attendance: 'Attendance Tracking',
  has_performance: 'Performance Reviews',
  has_analytics: 'Advanced Analytics',
  has_api_access: 'API Access',
};

const defaultForm = {
  name: '',
  price_usd: 0,
  billing_cycle: 'monthly',
  max_employees: 50,
  ai_token_limit_per_period: 100000,
  features: {} as Record<string, boolean>,
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

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  function openCreate() {
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(pkg: SubscriptionPackage) {
    setEditId(pkg.id);
    setForm({
      name: pkg.name,
      price_usd: pkg.price_usd,
      billing_cycle: pkg.billing_cycle,
      max_employees: pkg.max_employees,
      ai_token_limit_per_period: pkg.ai_token_limit_per_period,
      features: pkg.features || {},
      is_active: pkg.is_active,
      lemonsqueezy_variant_id: pkg.lemonsqueezy_variant_id || '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Package name is required'); return; }
    try {
      setSaving(true);
      const payload = {
        ...form,
        price_usd: Number(form.price_usd),
        max_employees: Number(form.max_employees),
        ai_token_limit_per_period: Number(form.ai_token_limit_per_period),
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
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function toggleFeature(key: string) {
    setForm(f => ({ ...f, features: { ...f.features, [key]: !f.features[key] } }));
  }

  const tierColors: Record<string, string> = {
    Free: 'bg-gray-100 text-gray-700',
    Starter: 'bg-blue-100 text-blue-700',
    Pro: 'bg-purple-100 text-purple-700',
    Enterprise: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Packages</h1>
          <p className="text-gray-500 mt-1">Create and manage subscription packages for your tenants</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> New Package
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 text-center">
            <Zap className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No packages yet</p>
            <p className="text-sm text-gray-400 mt-1">Click "New Package" to create your first subscription tier</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {packages.map(pkg => (
            <Card key={pkg.id} className={!pkg.is_active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${tierColors[pkg.name] ?? 'bg-blue-100 text-blue-700'}`}>
                      {pkg.name}
                    </span>
                    <CardTitle className="mt-2 text-2xl">
                      ${Number(pkg.price_usd).toFixed(2)}
                      <span className="text-sm font-normal text-gray-500">/{pkg.billing_cycle}</span>
                    </CardTitle>
                    <CardDescription>{pkg.billing_cycle} billing</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {!pkg.is_active && <Badge variant="secondary">Inactive</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(pkg)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span>Up to <strong>{pkg.max_employees}</strong> employees</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span><strong>{Number(pkg.ai_token_limit_per_period).toLocaleString()}</strong> AI tokens/{pkg.billing_cycle}</span>
                </div>
                <div className="border-t pt-3 space-y-1">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${pkg.features?.[key] ? 'bg-green-500' : 'bg-gray-200'}`} />
                      <span className={pkg.features?.[key] ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Package' : 'Create New Package'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Package Name</Label>
                <Input placeholder="e.g. Pro, Enterprise" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Price (USD)</Label>
                <Input type="number" min="0" value={form.price_usd} onChange={e => setForm(f => ({ ...f, price_usd: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Billing Cycle</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.billing_cycle}
                  onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <Label>Max Employees</Label>
                <Input type="number" min="1" value={form.max_employees} onChange={e => setForm(f => ({ ...f, max_employees: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>AI Token Limit / Period</Label>
                <Input type="number" min="0" value={form.ai_token_limit_per_period} onChange={e => setForm(f => ({ ...f, ai_token_limit_per_period: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <Label>LemonSqueezy Variant ID (optional)</Label>
                <Input placeholder="variant_123" value={form.lemonsqueezy_variant_id} onChange={e => setForm(f => ({ ...f, lemonsqueezy_variant_id: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Features</Label>
              <div className="space-y-2">
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className="flex items-center gap-3 w-full text-left"
                    onClick={() => toggleFeature(key)}
                  >
                    {form.features[key]
                      ? <ToggleRight className="w-6 h-6 text-blue-600" />
                      : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    <span className="text-sm text-gray-700">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}>
                {form.is_active
                  ? <ToggleRight className="w-6 h-6 text-blue-600" />
                  : <ToggleLeft className="w-6 h-6 text-gray-400" />}
              </button>
              <Label>{form.is_active ? 'Active' : 'Inactive'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editId ? 'Save Changes' : 'Create Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
