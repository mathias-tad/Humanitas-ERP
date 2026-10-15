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
import { Checkbox } from '@/components/ui/checkbox';
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
  Calendar,
  DollarSign,
  BarChart3,
  Package,
  FileText,
  Briefcase,
} from 'lucide-react';
import type { Tenant } from '@/types/tenant';

// Available services/modules for tenants
const AVAILABLE_SERVICES = [
  { id: 'hr', name: 'HR Management', description: 'Employee records, departments, positions', icon: Users },
  { id: 'pms', name: 'Project Management', description: 'Projects, tasks, team collaboration', icon: ClipboardList },
  { id: 'attendance', name: 'Attendance', description: 'Time tracking, clock in/out, schedules', icon: Calendar },
  { id: 'leave', name: 'Leave Management', description: 'Leave requests, approvals, balances', icon: Briefcase },
  { id: 'payroll', name: 'Payroll', description: 'Salary processing, payslips, deductions', icon: DollarSign },
  { id: 'reports', name: 'Advanced Reports', description: 'Custom reports, analytics, exports', icon: BarChart3 },
  { id: 'inventory', name: 'Inventory', description: 'Stock management, warehouses (coming soon)', icon: Package, comingSoon: true },
  { id: 'accounting', name: 'Accounting', description: 'Ledger, invoicing, expenses (coming soon)', icon: FileText, comingSoon: true },
];

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
    enabled_features: ['hr', 'attendance', 'leave'] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    // Reset form on close - parent handles closing on success
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
      enabled_features: ['hr', 'attendance', 'leave'],
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
      const nextFeatures = checked
        ? Array.from(new Set([...current, serviceId]))
        : current.filter((id) => id !== serviceId);
      return { ...prev, enabled_features: nextFeatures };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
                  const isChecked = formData.enabled_features.includes(service.id);
                  const isDisabled = service.comingSoon;
                  
                  return (
                    <div
                      key={service.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                        isDisabled
                          ? 'bg-gray-50 opacity-60 cursor-not-allowed'
                          : isChecked
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50 cursor-pointer'
                      }`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return;
                        if (!isDisabled) handleServiceChange(service.id, !isChecked);
                      }}
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={isDisabled}
                        onCheckedChange={(checked) => handleServiceChange(service.id, checked === true)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${isChecked ? 'text-blue-600' : 'text-gray-500'}`} />
                          <span
                            className={`text-sm font-medium leading-none cursor-pointer ${
                              isChecked ? 'text-blue-900' : ''
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
