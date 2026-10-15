import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertTriangle,
  Users,
  ClipboardList,
  Calendar,
  DollarSign,
  BarChart3,
  Package,
  FileText,
  Briefcase,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { Tenant } from '@/types/tenant';

const AVAILABLE_SERVICES = [
  { id: 'hr', name: 'HRMS & Workforce Directory', description: 'Employee records, departments, positions & org chart', icon: Users },
  { id: 'attendance', name: 'Attendance & Biometrics', description: 'Time tracking, shift schedules & biometric hardware sync', icon: Calendar },
  { id: 'leave', name: 'Leave Management', description: 'Leave requests, multi-tier approvals & balances', icon: Briefcase },
  { id: 'payroll', name: 'Payroll Processing', description: 'Automated salary runs, tax deductions & payslips', icon: DollarSign },
  { id: 'recruitment', name: 'Recruitment & ATS', description: 'Job openings, candidates & interview pipelines', icon: Users },
  { id: 'pms', name: 'Projects & Tasks (PMS)', description: 'Sprint planning, Kanban boards & employee KPIs', icon: ClipboardList },
  { id: 'products', name: 'Products & QR Catalog', description: 'Product variants, dynamic pricing & QR/barcode labels', icon: Package },
  { id: 'inventory', name: 'Multi-Warehouse Inventory', description: 'Stock quant, batch/lot tracking & FIFO/AVCO valuation', icon: Package },
  { id: 'purchasing', name: 'Purchasing & Vendors', description: 'Vendor RFQs, purchase orders & 3-way match validation', icon: Briefcase },
  { id: 'sales', name: 'Sales & CRM Invoicing', description: 'CRM leads, sales quotations, orders & deliveries', icon: BarChart3 },
  { id: 'pos', name: 'Point of Sale (POS)', description: 'Offline POS checkout, barcode scanning & cash shifts', icon: DollarSign },
  { id: 'accounting', name: 'General Ledger & Financials', description: 'Double-entry journals, chart of accounts & balance sheet', icon: FileText },
  { id: 'ai', name: 'AI Intelligence Suite', description: 'AI contextual help, document generator & autonomous actions', icon: BarChart3 },
  { id: 'reports', name: 'Advanced Reports & Export', description: 'Executive summary dashboards & per-module analytics', icon: BarChart3 },
];

export default function TenantEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_email: '',
    contact_phone: '',
    city: '',
    country: '',
    subscription_plan: 'basic' as Tenant['subscription_plan'],
    timezone: 'UTC',
    currency: 'USD',
    enabled_features: [] as string[],
  });

  useEffect(() => {
    const fetchTenant = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const tenant = await api.get<Tenant>(`/tenants/${id}`);
        setFormData({
          company_name: tenant.company_name,
          contact_email: tenant.contact_email,
          contact_phone: tenant.contact_phone || '',
          city: tenant.city || '',
          country: tenant.country || '',
          subscription_plan: tenant.subscription_plan,
          timezone: tenant.timezone,
          currency: tenant.currency,
          enabled_features: tenant.enabled_features || [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tenant');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTenant();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await api.patch(`/tenants/${id}`, formData);
      navigate(`/tenants/${id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save tenant');
    } finally {
      setIsSaving(false);
    }
  };

  const handleServiceChange = (serviceId: string, checked: boolean) => {
    setFormData((prev) => {
      const current = prev.enabled_features;
      const nextFeatures = checked
        ? Array.from(new Set([...current, serviceId]))
        : current.filter((id) => id !== serviceId);
      return { ...prev, enabled_features: nextFeatures };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">{error}</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/tenants')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tenants
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Tenant</h1>
          <p className="text-gray-500">Update tenant information and settings</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Contact Email *</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Plan & Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Plan & Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Subscription Plan</Label>
                  <Select
                    value={formData.subscription_plan}
                    onValueChange={(value: Tenant['subscription_plan']) =>
                      setFormData({ ...formData, subscription_plan: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New York</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los Angeles</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                      <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                      <SelectItem value="Africa/Addis_Ababa">Africa/Addis Ababa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="ETB">ETB (Br)</SelectItem>
                      <SelectItem value="JPY">JPY (¥)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardHeader>
              <CardTitle>Enabled Services & Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVAILABLE_SERVICES.map((service) => {
                  const Icon = service.icon;
                  const isChecked = formData.enabled_features.includes(service.id);

                  return (
                    <div
                      key={service.id}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleServiceChange(service.id, !isChecked);
                        }
                      }}
                      onClick={() => handleServiceChange(service.id, !isChecked)}
                      className={`flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                          : 'bg-card border-border text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-input bg-background'
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${isChecked ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-semibold ${isChecked ? 'text-foreground' : 'text-foreground/80'}`}>
                            {service.name}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{service.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              style={{ backgroundColor: '#2563eb', color: 'white' }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
