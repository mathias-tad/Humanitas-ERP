import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  Users,
  HardDrive,
  Calendar,
  Clock,
  CreditCard,
  Settings,
  AlertTriangle,
  CheckCircle,
  Ban,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import type { Tenant } from '@/types/tenant';

const statusColors = {
  active: 'success',
  trial: 'warning',
  suspended: 'destructive',
  canceled: 'secondary',
} as const;

const featureLabels: Record<string, string> = {
  pms: 'Project Management',
  attendance: 'Attendance',
  leave: 'Leave Management',
  payroll: 'Payroll',
  reports: 'Advanced Reports',
  advanced_analytics: 'Analytics',
};

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTenant = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const data = await api.get<Tenant>(`/tenants/${id}`);
        setTenant(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tenant');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenant();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">{error || 'Tenant not found'}</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/tenants')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tenants
        </Button>
      </div>
    );
  }

  const maxUsers = tenant.max_users === 999999 ? 1000 : tenant.max_users;
  const usagePercentage = {
    users: (tenant.current_users / maxUsers) * 100,
    devices: (tenant.current_devices / tenant.max_devices) * 100,
    storage: (Number(tenant.storage_used_gb) / Number(tenant.storage_limit_gb)) * 100,
  };

  const handleSuspend = async () => {
    try {
      await api.patch(`/tenants/${tenant.id}/suspend`);
      const updated = await api.get<Tenant>(`/tenants/${id}`);
      setTenant(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to suspend tenant');
    }
  };

  const handleReactivate = async () => {
    try {
      await api.patch(`/tenants/${tenant.id}/reactivate`);
      const updated = await api.get<Tenant>(`/tenants/${id}`);
      setTenant(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reactivate tenant');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tenants')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tenant.company_name}</h1>
              <div className="flex items-center gap-2 text-gray-500">
                <Globe className="h-4 w-4" />
                <span>{tenant.slug}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusColors[tenant.subscription_status]} className="capitalize text-sm px-3 py-1">
            {tenant.subscription_status}
          </Badge>
          {tenant.subscription_status === 'suspended' ? (
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleReactivate}
            >
              <CheckCircle className="h-4 w-4" />
              Reactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={handleSuspend}
            >
              <Ban className="h-4 w-4" />
              Suspend
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{tenant.contact_email}</span>
                </div>
                {tenant.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{tenant.contact_phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">
                    {[tenant.city, tenant.state, tenant.country].filter(Boolean).join(', ') || 'N/A'}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{tenant.timezone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{tenant.currency}</span>
                </div>
              </CardContent>
            </Card>

            {/* Usage Stats */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Usage Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <Users className="h-4 w-4" />
                      Users
                    </div>
                    <p className="text-2xl font-bold">
                      {tenant.current_users}
                      <span className="text-sm font-normal text-gray-500">
                        {' '}/ {tenant.max_users === 999999 ? '∞' : tenant.max_users}
                      </span>
                    </p>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.min(usagePercentage.users, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <Settings className="h-4 w-4" />
                      Devices
                    </div>
                    <p className="text-2xl font-bold">
                      {tenant.current_devices}
                      <span className="text-sm font-normal text-gray-500"> / {tenant.max_devices}</span>
                    </p>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full"
                        style={{ width: `${Math.min(usagePercentage.devices, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <HardDrive className="h-4 w-4" />
                      Storage
                    </div>
                    <p className="text-2xl font-bold">
                      {Number(tenant.storage_used_gb) > 0 && Number(tenant.storage_used_gb) < 0.1
                        ? `${(Number(tenant.storage_used_gb) * 1024).toFixed(1)} MB`
                        : `${Number(tenant.storage_used_gb).toFixed(2)} GB`}
                      <span className="text-sm font-normal text-gray-500"> / {tenant.storage_limit_gb} GB</span>
                    </p>
                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full"
                        style={{ width: `${Math.min(usagePercentage.storage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enabled Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {tenant.enabled_features && tenant.enabled_features.length > 0 ? (
                  tenant.enabled_features.map((feature) => (
                    <Badge key={feature} variant="secondary" className="px-3 py-1">
                      {featureLabels[feature] || feature}
                    </Badge>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">No features enabled</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {tenant.subscription_started_at && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Subscription Started</p>
                      <p className="text-sm font-medium">
                        {new Date(tenant.subscription_started_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                {tenant.trial_ends_at && tenant.subscription_status === 'trial' && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-xs text-gray-500">Trial Ends</p>
                      <p className="text-sm font-medium text-orange-600">
                        {new Date(tenant.trial_ends_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Last Updated</p>
                    <p className="text-sm font-medium">
                      {new Date(tenant.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <h3 className="text-lg font-semibold capitalize">{tenant.subscription_plan} Plan</h3>
                  <p className="text-sm text-gray-600">
                    {tenant.monthly_fee ? `$${tenant.monthly_fee}/month` : 'Trial period'}
                    {tenant.per_user_fee && ` + $${tenant.per_user_fee}/user`}
                  </p>
                </div>
                <Button variant="outline">Change Plan</Button>
              </div>
            </CardContent>
          </Card>

          {/* Plan Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan Limits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Max Users</p>
                  <p className="text-xl font-bold">{tenant.max_users === 999999 ? 'Unlimited' : tenant.max_users}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Max Devices</p>
                  <p className="text-xl font-bold">{tenant.max_devices}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Storage Limit</p>
                  <p className="text-xl font-bold">{tenant.storage_limit_gb} GB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Database Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Database Name</p>
                  <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                    {tenant.database_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date Format</p>
                  <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                    {tenant.date_format}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tenant ID</p>
                  <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                    {tenant.id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Active</p>
                  <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                    {tenant.is_active ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-red-800">Delete Tenant</h4>
                  <p className="text-sm text-red-600">
                    This action cannot be undone. All data will be permanently deleted.
                  </p>
                </div>
                <Button variant="destructive">Delete Tenant</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
