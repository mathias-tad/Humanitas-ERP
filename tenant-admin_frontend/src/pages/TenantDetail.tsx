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
  Database,
  Play,
  RefreshCw,
  GitBranch,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
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

  // Migration status state
  const [migrationStatus, setMigrationStatus] = useState<{
    database: string;
    totalFiles: number;
    appliedCount: number;
    pendingCount: number;
    applied: string[];
    pending: string[];
  } | null>(null);
  const [isLoadingMigrations, setIsLoadingMigrations] = useState(false);
  const [isRunningMigration, setIsRunningMigration] = useState(false);
  const [isSyncingPermissions, setIsSyncingPermissions] = useState(false);

  // Setup email resend state (must be at top level before early returns)
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [setupEmailModal, setSetupEmailModal] = useState<{
    isOpen: boolean;
    success: boolean;
    message: string;
    setup_link?: string;
  }>({
    isOpen: false,
    success: false,
    message: '',
  });
  const [isCopied, setIsCopied] = useState(false);

  const fetchTenantMigrations = async (slug: string) => {
    try {
      setIsLoadingMigrations(true);
      const data = await api.get<any[]>(`/tenants/migrations/status?tenantSlug=${slug}`);
      if (Array.isArray(data) && data.length > 0) {
        setMigrationStatus(data[0]);
      }
    } catch (err) {
      console.error('Failed to load migration status:', err);
    } finally {
      setIsLoadingMigrations(false);
    }
  };

  const handleRunTenantMigration = async () => {
    if (!tenant?.slug) return;
    try {
      setIsRunningMigration(true);
      const res: any = await api.post(`/tenants/migrations/run?tenantSlug=${tenant.slug}`);
      const appliedCount = res.migrated?.[0]?.applied?.length || 0;
      alert(appliedCount > 0 
        ? `Successfully applied ${appliedCount} migration(s) for ${tenant.company_name}!`
        : `Database is already up to date for ${tenant.company_name}.`
      );
      await fetchTenantMigrations(tenant.slug);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to run migration');
    } finally {
      setIsRunningMigration(false);
    }
  };

  const handleSyncTenantPermissions = async () => {
    if (!tenant?.slug) return;
    try {
      setIsSyncingPermissions(true);
      await api.post(`/tenants/migrations/sync-permissions?tenantSlug=${tenant.slug}`);
      alert(`Permissions synced successfully for ${tenant.company_name}!`);
      await fetchTenantMigrations(tenant.slug);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sync permissions');
    } finally {
      setIsSyncingPermissions(false);
    }
  };

  useEffect(() => {
    const fetchTenant = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const data = await api.get<Tenant>(`/tenants/${id}`);
        setTenant(data);
        if (data?.slug) {
          fetchTenantMigrations(data.slug);
        }
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

  const handleResendSetupEmail = async () => {
    if (!tenant?.id) return;
    try {
      setIsResendingEmail(true);
      const res = await api.post<{ success: boolean; message: string; setup_link?: string }>(
        `/tenants/${tenant.id}/resend-setup-email`
      );

      if (res.success) {
        toast.success('Setup email sent!', {
          description: res.message,
        });
      } else {
        toast.error('Email delivery warning', {
          description: res.message,
        });
      }

      setSetupEmailModal({
        isOpen: true,
        success: res.success,
        message: res.message,
        setup_link: res.setup_link,
      });
    } catch (err: unknown) {
      console.error('Failed to resend setup email:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Failed to resend setup email';
      toast.error('Failed to resend setup email', {
        description: errorMessage,
      });
    } finally {
      setIsResendingEmail(false);
    }
  };

  const copySetupLink = () => {
    if (setupEmailModal.setup_link) {
      navigator.clipboard.writeText(setupEmailModal.setup_link);
      setIsCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
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
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-gray-900">{tenant.company_name}</h1>
                {tenant.is_setup_complete === false ? (
                  <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 text-xs">
                    Setup Pending
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-700 bg-green-50 border-green-300 text-xs">
                    Setup Complete
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Globe className="h-4 w-4" />
                <span>{tenant.slug}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!tenant.is_setup_complete && (
            <Button
              variant="outline"
              className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={handleResendSetupEmail}
              disabled={isResendingEmail}
            >
              {isResendingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Resend Setup Email
            </Button>
          )}
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
          <TabsTrigger value="migrations">Migrations & Seeds</TabsTrigger>
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
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Setup Status:</span>
                  {tenant.is_setup_complete ? (
                    <span className="inline-flex items-center gap-1.5 text-green-600 font-medium text-xs">
                      <CheckCircle className="h-4 w-4" /> Complete
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-xs">
                        <Clock className="h-3.5 w-3.5" /> Pending
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={handleResendSetupEmail}
                        disabled={isResendingEmail}
                      >
                        {isResendingEmail ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Resend
                      </Button>
                    </div>
                  )}
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

        <TabsContent value="migrations" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  Database Migrations & Seeds for {tenant.company_name}
                </CardTitle>
                <p className="text-xs text-gray-500 mt-1 font-mono">Database: {tenant.database_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => tenant.slug && fetchTenantMigrations(tenant.slug)}
                  disabled={isLoadingMigrations}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingMigrations ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncTenantPermissions}
                  disabled={isSyncingPermissions || isLoadingMigrations}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  {isSyncingPermissions ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Sync Permissions
                </Button>
                <Button
                  size="sm"
                  onClick={handleRunTenantMigration}
                  disabled={isRunningMigration || isLoadingMigrations || (migrationStatus?.pendingCount === 0)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isRunningMigration ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Run Pending Migrations
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingMigrations ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : migrationStatus ? (
                <>
                  {/* Status Banner */}
                  <div className={`p-4 rounded-lg flex items-center justify-between ${
                    migrationStatus.pendingCount === 0
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-amber-50 border border-amber-200 text-amber-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      {migrationStatus.pendingCount === 0 ? (
                        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-sm">
                          {migrationStatus.pendingCount === 0
                            ? 'All Migrations & Seeds Up to Date'
                            : `${migrationStatus.pendingCount} Migration(s) Pending Execution`}
                        </p>
                        <p className="text-xs opacity-80">
                          {migrationStatus.pendingCount === 0
                            ? `All ${migrationStatus.appliedCount} schema and seed migrations are applied to ${tenant.database_name}.`
                            : `New changes exist that need to be manually applied to this tenant database.`}
                        </p>
                      </div>
                    </div>
                    <Badge variant={migrationStatus.pendingCount === 0 ? 'secondary' : 'default'} className={
                      migrationStatus.pendingCount === 0
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-amber-600 text-white'
                    }>
                      {migrationStatus.pendingCount === 0 ? '✓ Current' : `${migrationStatus.pendingCount} Pending`}
                    </Badge>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 font-medium">Total Migrations</p>
                      <p className="text-xl font-bold mt-1">{migrationStatus.totalFiles}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-700 font-medium">Applied Migrations</p>
                      <p className="text-xl font-bold text-green-700 mt-1">{migrationStatus.appliedCount}</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <p className="text-xs text-amber-700 font-medium">Pending Migrations</p>
                      <p className="text-xl font-bold text-amber-700 mt-1">{migrationStatus.pendingCount}</p>
                    </div>
                  </div>

                  {/* Pending Migrations List */}
                  {migrationStatus.pendingCount > 0 && (
                    <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/40">
                      <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Pending Migration Files to be Applied
                      </h4>
                      <div className="space-y-1.5">
                        {migrationStatus.pending.map((file) => (
                          <div
                            key={file}
                            className="flex items-center justify-between text-xs font-mono bg-white border border-amber-200 rounded p-2 text-amber-900"
                          >
                            <span>{file}</span>
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                              PENDING
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Applied Migrations List */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-gray-500" />
                      Applied Migrations History ({migrationStatus.appliedCount})
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border bg-gray-50 p-2">
                      {migrationStatus.applied.length > 0 ? (
                        migrationStatus.applied.map((file) => (
                          <div
                            key={file}
                            className="flex items-center justify-between text-xs font-mono bg-white rounded p-2 border border-gray-200 text-gray-800"
                          >
                            <span className="truncate">{file}</span>
                            <span className="text-[10px] text-green-600 font-sans font-semibold">APPLIED</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500 text-center py-4">No migrations recorded in schema_migrations yet</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Could not retrieve migration status for this tenant database.</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => tenant.slug && fetchTenantMigrations(tenant.slug)}>
                    Retry
                  </Button>
                </div>
              )}
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

      {/* Setup Link Modal */}
      <Dialog
        open={setupEmailModal.isOpen}
        onOpenChange={(open) => setSetupEmailModal((prev) => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Tenant Setup Link
            </DialogTitle>
            <DialogDescription>
              Setup link for <span className="font-semibold text-gray-900">{tenant.company_name}</span> ({tenant.contact_email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div
              className={`p-3.5 rounded-lg text-sm border flex items-start gap-2.5 ${
                setupEmailModal.success
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {setupEmailModal.success ? (
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <div className="text-xs leading-relaxed">{setupEmailModal.message}</div>
            </div>

            {setupEmailModal.setup_link && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Setup URL (Valid for 7 days):</label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={setupEmailModal.setup_link}
                    className="font-mono text-xs bg-gray-50 select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={copySetupLink}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">
                  You can copy this link and share it directly with the tenant admin.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSetupEmailModal((prev) => ({ ...prev, isOpen: false }))}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
