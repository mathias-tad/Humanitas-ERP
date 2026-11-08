import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertTriangle,
  Users,
  ClipboardList,
  DollarSign,
  BarChart3,
  Package,
  FileText,
  Check,
  Sparkles,
  MessageSquare,
  Zap,
  ScrollText,
  Boxes,
  ShoppingCart,
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

interface ServiceItem {
  id: string;
  name: string;
  description: string;
  icon: any;
  comingSoon?: boolean;
}

const AVAILABLE_SERVICES: ServiceItem[] = [
  {
    id: 'hrms',
    name: 'Human Capital (HRMS & Payroll)',
    description: 'Unified employee directory, attendance, biometric sync, shifts, leave, automated payroll & recruitment ATS',
    icon: Users,
  },
  {
    id: 'pms',
    name: 'Projects & Tasks (PMS)',
    description: 'Sprint planning, Kanban boards, time tracking & KPI performance scorecards',
    icon: ClipboardList,
  },
  {
    id: 'products',
    name: 'Products & QR Catalog',
    description: 'Product variants, dynamic pricing matrix & automated QR/barcode label printing',
    icon: Package,
  },
  {
    id: 'inventory',
    name: 'Multi-Warehouse Inventory',
    description: 'Multi-location stock quant, batch/lot tracking & Python FIFO/AVCO valuation queues',
    icon: Boxes,
  },
  {
    id: 'purchasing',
    name: 'Purchasing & Vendors',
    description: 'Vendor RFQs, purchase orders, goods receipts (GRN) & automated 3-way match',
    icon: ShoppingCart,
  },
  {
    id: 'sales',
    name: 'Sales, CRM & Invoicing',
    description: 'CRM leads, sales quotations, orders, delivery notes & ZATCA/e-invoicing',
    icon: BarChart3,
  },
  {
    id: 'pos',
    name: 'Point of Sale (POS)',
    description: 'Offline POS checkout, barcode scanning, shift cash registers & thermal receipts',
    icon: DollarSign,
  },
  {
    id: 'accounting',
    name: 'General Ledger & Financials',
    description: 'Double-entry journals, chart of accounts, trial balance, balance sheet & P&L',
    icon: FileText,
  },
];

// AI capability tiers
const AI_TIERS = [
  {
    id: 'ai.help',
    name: 'AI Chat Help',
    description: 'Conversational assistant for navigation, how-to guidance, and read-only ERP knowledge base queries.',
    icon: MessageSquare,
  },
  {
    id: 'ai.actions',
    name: 'AI Action Executor',
    description: 'Executes ERP actions on behalf of the user (approve requests, run payroll, create records) — gated by user RBAC.',
    icon: Zap,
  },
  {
    id: 'ai.documents',
    name: 'AI Document Studio',
    description: 'Generates formatted PDF/DOCX documents from DB data. Supports built-in templates & user-uploaded reference files.',
    icon: ScrollText,
  },
] as const;

const AI_TIER_IDS = AI_TIERS.map((t) => t.id);
const AI_FULL_ID = 'ai.full';

function getAiTierState(features: string[]): { isFull: boolean; selected: string[] } {
  if (features.includes(AI_FULL_ID)) {
    return { isFull: true, selected: [AI_FULL_ID, ...AI_TIER_IDS] };
  }
  const selected = AI_TIER_IDS.filter((id) => features.includes(id));
  return { isFull: false, selected };
}

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
      const finalFeatures = [...formData.enabled_features];
      if (finalFeatures.includes('hrms') && !finalFeatures.includes('hr')) {
        finalFeatures.push('hr');
      }
      await api.patch(`/tenants/${id}`, { ...formData, enabled_features: finalFeatures });
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
      let nextFeatures: string[];
      if (serviceId === 'hrms') {
        if (checked) {
          nextFeatures = Array.from(new Set([...current, 'hrms', 'hr']));
        } else {
          nextFeatures = current.filter(
            (id) => !['hrms', 'hr', 'attendance', 'leave', 'payroll', 'recruitment'].includes(id),
          );
        }
      } else {
        nextFeatures = checked
          ? Array.from(new Set([...current, serviceId]))
          : current.filter((id) => id !== serviceId);
      }
      return { ...prev, enabled_features: nextFeatures };
    });
  };

  const handleAiTierChange = (tierId: string, checked: boolean) => {
    setFormData((prev) => {
      let features = prev.enabled_features.filter(
        (f) => f !== AI_FULL_ID && !AI_TIER_IDS.includes(f as any),
      );
      if (tierId === AI_FULL_ID) {
        if (checked) {
          features = [...features, AI_FULL_ID, ...AI_TIER_IDS];
        }
      } else {
        const currentTiers = prev.enabled_features.filter((f) =>
          AI_TIER_IDS.includes(f as any),
        );
        const nextTiers = checked
          ? Array.from(new Set([...currentTiers, tierId]))
          : currentTiers.filter((id) => id !== tierId);
        if (nextTiers.length === AI_TIER_IDS.length) {
          features = [...features, AI_FULL_ID, ...AI_TIER_IDS];
        } else {
          features = [...features, ...nextTiers];
        }
      }
      return { ...prev, enabled_features: features };
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AVAILABLE_SERVICES.map((service) => {
                  const Icon = service.icon;
                  const isChecked = service.id === 'hrms'
                    ? formData.enabled_features.some((id) => ['hrms', 'hr', 'attendance', 'leave', 'payroll', 'recruitment'].includes(id))
                    : formData.enabled_features.includes(service.id);

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

              {/* ─── AI Intelligence Module ─── */}
              {(() => {
                const aiState = getAiTierState(formData.enabled_features);
                const hasAnyAi = aiState.selected.length > 0;
                return (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-violet-600" />
                      <span className="text-sm font-semibold">AI Intelligence Module</span>
                      {hasAnyAi && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                          {aiState.isFull ? 'Full Copilot' : `${aiState.selected.length} tier${aiState.selected.length !== 1 ? 's' : ''}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select AI capability tiers. Selecting all 3 auto-upgrades to <strong>ai.full</strong>.
                    </p>

                    {/* ai.full shortcut */}
                    <div
                      role="checkbox"
                      aria-checked={aiState.isFull}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleAiTierChange(AI_FULL_ID, !aiState.isFull);
                        }
                      }}
                      onClick={() => handleAiTierChange(AI_FULL_ID, !aiState.isFull)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors cursor-pointer select-none ${
                        aiState.isFull
                          ? 'bg-violet-50 border-violet-400'
                          : 'bg-white border-dashed border-gray-300 hover:border-violet-300'
                      }`}
                    >
                      <div
                        className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                          aiState.isFull ? 'bg-violet-600 border-violet-600 text-white' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {aiState.isFull && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <Sparkles className={`h-4 w-4 ${aiState.isFull ? 'text-violet-600' : 'text-gray-400'}`} />
                      <div>
                        <span className={`text-sm font-semibold ${aiState.isFull ? 'text-violet-900' : 'text-gray-700'}`}>
                          Full AI Copilot (ai.full)
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">— unlocks all capabilities</span>
                      </div>
                    </div>

                    {/* Individual AI tiers */}
                    <div className="grid grid-cols-1 gap-2 pl-2">
                      {AI_TIERS.map((tier) => {
                        const Icon = tier.icon;
                        const isSelected = aiState.selected.includes(tier.id);
                        const colorCls = isSelected
                          ? tier.id === 'ai.help'
                            ? 'bg-blue-50 border-blue-200 text-blue-900'
                            : tier.id === 'ai.actions'
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-violet-50 border-violet-200 text-violet-900'
                          : 'bg-card border-border hover:bg-muted/50 text-foreground';
                        const checkCls = isSelected
                          ? tier.id === 'ai.help'
                            ? 'bg-blue-600 border-blue-600'
                            : tier.id === 'ai.actions'
                            ? 'bg-amber-500 border-amber-500'
                            : 'bg-violet-600 border-violet-600'
                          : 'border-input bg-background';
                        const iconCls = isSelected
                          ? tier.id === 'ai.help'
                            ? 'text-blue-600'
                            : tier.id === 'ai.actions'
                            ? 'text-amber-500'
                            : 'text-violet-600'
                          : 'text-muted-foreground';

                        return (
                          <div
                            key={tier.id}
                            role="checkbox"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                handleAiTierChange(tier.id, !isSelected);
                              }
                            }}
                            onClick={() => handleAiTierChange(tier.id, !isSelected)}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer select-none transition-colors ${colorCls}`}
                          >
                            <div
                              className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center text-white transition-colors ${checkCls}`}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconCls}`} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{tier.name}</span>
                                <code className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                                  {tier.id}
                                </code>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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
