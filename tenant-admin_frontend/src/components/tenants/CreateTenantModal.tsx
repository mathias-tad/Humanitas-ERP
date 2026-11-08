import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
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
import type { Tenant } from '@/types/tenant';

interface ServiceItem {
  id: string;
  name: string;
  description: string;
  icon: any;
  comingSoon?: boolean;
}

// Available consolidated ERP operational modules for tenants (AI excluded — handled separately below)
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

// AI capability tiers — stored as individual feature flags
const AI_TIERS = [
  {
    id: 'ai.help',
    name: 'AI Chat Help',
    description: 'Conversational assistant for navigation, how-to guidance, and read-only ERP knowledge base queries.',
    icon: MessageSquare,
    color: 'blue',
  },
  {
    id: 'ai.actions',
    name: 'AI Action Executor',
    description: 'Executes ERP actions on behalf of the user (approve requests, run payroll, create records) — gated by user RBAC.',
    icon: Zap,
    color: 'amber',
  },
  {
    id: 'ai.documents',
    name: 'AI Document Studio',
    description: 'Generates formatted PDF/DOCX documents from DB data. Supports 5 built-in templates & user-uploaded reference files.',
    icon: ScrollText,
    color: 'violet',
  },
] as const;

const AI_TIER_IDS = AI_TIERS.map((t) => t.id);
const AI_FULL_ID = 'ai.full';

// Helper: given the feature list, derive current AI selection state
function getAiTierState(features: string[]): {
  isFull: boolean;
  selected: string[];
} {
  if (features.includes(AI_FULL_ID)) {
    return { isFull: true, selected: [AI_FULL_ID, ...AI_TIER_IDS] };
  }
  const selected = AI_TIER_IDS.filter((id) => features.includes(id));
  return { isFull: false, selected };
}

interface CreateTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Tenant>) => void;
}

export function CreateTenantModal({ isOpen, onClose, onSave }: CreateTenantModalProps) {
  const [formData, setFormData] = useState({
    company_name: '',
    slug: '',
    contact_email: '',
    contact_phone: '',
    city: '',
    country: '',
    subscription_plan: 'basic' as Tenant['subscription_plan'],
    timezone: 'UTC',
    currency: 'USD',
    enabled_features: ['hrms', 'hr'] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalFeatures = [...formData.enabled_features];
    if (finalFeatures.includes('hrms') && !finalFeatures.includes('hr')) {
      finalFeatures.push('hr');
    }
    onSave({ ...formData, enabled_features: finalFeatures });
    setFormData({
      company_name: '',
      slug: '',
      contact_email: '',
      contact_phone: '',
      city: '',
      country: '',
      subscription_plan: 'basic',
      timezone: 'UTC',
      currency: 'USD',
      enabled_features: ['hrms', 'hr'],
    });
  };

  const handleSlugChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, slug: sanitized });
  };

  const generateSlugFromName = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    setFormData({ ...formData, company_name: name, slug });
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

  // AI tier toggle — handles mutual exclusivity with ai.full
  const handleAiTierChange = (tierId: string, checked: boolean) => {
    setFormData((prev) => {
      // Remove all AI flags first
      let features = prev.enabled_features.filter(
        (f) => f !== AI_FULL_ID && !AI_TIER_IDS.includes(f as any),
      );

      if (tierId === AI_FULL_ID) {
        // Toggle full: if enabling, add ai.full + all tiers; else remove all AI
        if (checked) {
          features = [...features, AI_FULL_ID, ...AI_TIER_IDS];
        }
        // else features already stripped of AI flags
      } else {
        // Toggle individual tier
        const currentTiers = prev.enabled_features.filter((f) =>
          AI_TIER_IDS.includes(f as any),
        );
        const nextTiers = checked
          ? Array.from(new Set([...currentTiers, tierId]))
          : currentTiers.filter((id) => id !== tierId);

        if (nextTiers.length === AI_TIER_IDS.length) {
          // All 3 selected → upgrade to ai.full
          features = [...features, AI_FULL_ID, ...AI_TIER_IDS];
        } else {
          features = [...features, ...nextTiers];
        }
      }

      return { ...prev, enabled_features: features };
    });
  };

  const aiState = getAiTierState(formData.enabled_features);
  const hasAnyAi = aiState.selected.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Tenant</DialogTitle>
          <DialogDescription>
            Add a new company/organization to your SaaS platform. They will start with a 14-day trial.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Company Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  placeholder="Acme Corporation"
                  value={formData.company_name}
                  onChange={(e) => generateSlugFromName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Tenant ID (slug) *</Label>
                <Input
                  id="slug"
                  placeholder="acme"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier for API calls.
                </p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email *</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="admin@company.com"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  placeholder="+1-555-0100"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="New York"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="USA"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
            </div>

            {/* Plan & Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan">Subscription Plan</Label>
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
                    <SelectItem value="basic">Basic ($99/mo)</SelectItem>
                    <SelectItem value="professional">Professional ($299/mo)</SelectItem>
                    <SelectItem value="enterprise">Enterprise ($999/mo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
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
                    <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                    <SelectItem value="Africa/Addis_Ababa">Africa/Addis Ababa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
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

            {/* Services Selection */}
            <div className="space-y-3 pt-2">
              <Label className="text-base font-semibold">Enabled Services</Label>
              <p className="text-sm text-muted-foreground">
                Select the modules/services this tenant will have access to.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {AVAILABLE_SERVICES.map((service) => {
                  const Icon = service.icon;
                  const isChecked = service.id === 'hrms'
                    ? formData.enabled_features.some((id) => ['hrms', 'hr', 'attendance', 'leave', 'payroll', 'recruitment'].includes(id))
                    : formData.enabled_features.includes(service.id);
                  const isDisabled = !!service.comingSoon;

                  return (
                    <div
                      key={service.id}
                      role="checkbox"
                      aria-checked={isChecked}
                      aria-disabled={isDisabled}
                      tabIndex={isDisabled ? -1 : 0}
                      onKeyDown={(e) => {
                        if (isDisabled) return;
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleServiceChange(service.id, !isChecked);
                        }
                      }}
                      onClick={() => {
                        if (!isDisabled) {
                          handleServiceChange(service.id, !isChecked);
                        }
                      }}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors select-none ${
                        isDisabled
                          ? 'bg-gray-50 opacity-60 cursor-not-allowed'
                          : isChecked
                          ? 'bg-blue-50 border-blue-200 cursor-pointer'
                          : 'hover:bg-gray-50 border-gray-200 cursor-pointer'
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                          isDisabled
                            ? 'border-gray-300 bg-gray-100'
                            : isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${isChecked ? 'text-blue-600' : 'text-gray-500'}`} />
                          <span
                            className={`text-sm font-medium leading-none ${
                              isChecked ? 'text-blue-900' : 'text-gray-900'
                            }`}
                          >
                            {service.name}
                          </span>
                          {service.comingSoon && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                              Soon
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {service.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── AI Intelligence Module ─── */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2 pt-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                <Label className="text-base font-semibold">AI Intelligence Module</Label>
                {hasAnyAi && (
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                    {aiState.isFull ? 'Full Copilot' : `${aiState.selected.length} tier${aiState.selected.length !== 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Subscribe this tenant to individual AI capability tiers. Selecting all 3 automatically upgrades to <strong>ai.full</strong>.
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
                    aiState.isFull
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {aiState.isFull && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
                <Sparkles className={`h-4 w-4 ${aiState.isFull ? 'text-violet-600' : 'text-gray-400'}`} />
                <div>
                  <span className={`text-sm font-semibold ${aiState.isFull ? 'text-violet-900' : 'text-gray-700'}`}>
                    Full AI Copilot (ai.full)
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">— unlocks all capabilities below</span>
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
                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800';
                  const checkCls = isSelected
                    ? tier.id === 'ai.help'
                      ? 'bg-blue-600 border-blue-600'
                      : tier.id === 'ai.actions'
                      ? 'bg-amber-500 border-amber-500'
                      : 'bg-violet-600 border-violet-600'
                    : 'border-gray-300 bg-white';
                  const iconCls = isSelected
                    ? tier.id === 'ai.help'
                      ? 'text-blue-600'
                      : tier.id === 'ai.actions'
                      ? 'text-amber-500'
                      : 'text-violet-600'
                    : 'text-gray-400';

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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" style={{ backgroundColor: '#2563eb', color: 'white' }}>
              Create Tenant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
