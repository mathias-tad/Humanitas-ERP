import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Users,
  HardDrive,
  Globe,
  Ban,
  CheckCircle,
  Loader2,
  RefreshCw,
  Mail,
  Copy,
  Check,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { Tenant } from '@/types/tenant';
import { CreateTenantModal } from '@/components/tenants/CreateTenantModal';
import { DeleteTenantModal } from '@/components/tenants/DeleteTenantModal';
import { SuspendTenantModal, ReactivateTenantModal } from '@/components/tenants/SuspendTenantModal';

const statusColors = {
  active: 'success',
  trial: 'warning',
  suspended: 'destructive',
  canceled: 'secondary',
} as const;

const planColors = {
  basic: 'secondary',
  professional: 'default',
  enterprise: 'default',
} as const;

function formatStorageDisplay(usedGb: number, limitGb: number): string {
  const numUsed = Number(usedGb) || 0;
  const numLimit = Number(limitGb) || 10;
  if (numUsed > 0 && numUsed < 0.1) {
    const mb = numUsed * 1024;
    return `${mb >= 1 ? mb.toFixed(1) : mb.toFixed(2)} MB / ${numLimit} GB`;
  }
  return `${numUsed.toFixed(2)} / ${numLimit} GB`;
}

export default function Tenants() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteModalTenant, setDeleteModalTenant] = useState<Tenant | null>(null);
  const [suspendModalTenant, setSuspendModalTenant] = useState<Tenant | null>(null);
  const [reactivateModalTenant, setReactivateModalTenant] = useState<Tenant | null>(null);
  const [resendingTenantId, setResendingTenantId] = useState<string | null>(null);
  const [setupEmailModal, setSetupEmailModal] = useState<{
    isOpen: boolean;
    tenant: Tenant | null;
    success: boolean;
    message: string;
    setup_link?: string;
  }>({
    isOpen: false,
    tenant: null,
    success: false,
    message: '',
  });
  const [isCopied, setIsCopied] = useState(false);

  const fetchTenants = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (planFilter !== 'all') params.plan = planFilter;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get<{ data: Tenant[]; total: number }>('/tenants', { params });
      setTenants(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tenants');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, [statusFilter, planFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTenants();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCreateTenant = async (data: Partial<Tenant>) => {
    try {
      await api.post('/tenants', data);
      toast.success('Tenant created successfully', {
        description: `${data.company_name} has been added. Setup email sent to ${data.contact_email}`,
      });
      fetchTenants();
      setIsCreateModalOpen(false);
    } catch (err: unknown) {
      console.error('Failed to create tenant:', err);
      const errorMessage = err instanceof Error ? err.message : 
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create tenant';
      toast.error('Failed to create tenant', {
        description: errorMessage,
      });
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    try {
      await api.delete(`/tenants/${tenant.id}`);
      toast.success('Tenant deleted', {
        description: `${tenant.company_name} has been removed`,
      });
      fetchTenants();
      setDeleteModalTenant(null);
    } catch (err: unknown) {
      console.error('Failed to delete tenant:', err);
      const errorMessage = err instanceof Error ? err.message : 
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete tenant';
      toast.error('Failed to delete tenant', {
        description: errorMessage,
      });
    }
  };

  const handleSuspendTenant = async (tenant: Tenant, _reason: string, _notes: string) => {
    try {
      await api.patch(`/tenants/${tenant.id}/suspend`);
      toast.success('Tenant suspended', {
        description: `${tenant.company_name} has been suspended`,
      });
      fetchTenants();
      setSuspendModalTenant(null);
    } catch (err: unknown) {
      console.error('Failed to suspend tenant:', err);
      const errorMessage = err instanceof Error ? err.message : 
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to suspend tenant';
      toast.error('Failed to suspend tenant', {
        description: errorMessage,
      });
    }
  };

  const handleReactivateTenant = async (tenant: Tenant, _notes: string) => {
    try {
      await api.patch(`/tenants/${tenant.id}/reactivate`);
      toast.success('Tenant reactivated', {
        description: `${tenant.company_name} is now active`,
      });
      fetchTenants();
      setReactivateModalTenant(null);
    } catch (err: unknown) {
      console.error('Failed to reactivate tenant:', err);
      const errorMessage = err instanceof Error ? err.message : 
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to reactivate tenant';
      toast.error('Failed to reactivate tenant', {
        description: errorMessage,
      });
    }
  };

  const handleResendSetupEmail = async (tenant: Tenant) => {
    try {
      setResendingTenantId(tenant.id);
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
        tenant,
        success: res.success,
        message: res.message,
        setup_link: res.setup_link,
      });
    } catch (err: unknown) {
      console.error('Failed to resend setup email:', err);
      const errorMessage = err instanceof Error ? err.message : 
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to resend setup email';
      toast.error('Failed to resend setup email', {
        description: errorMessage,
      });
    } finally {
      setResendingTenantId(null);
    }
  };

  const copySetupLink = () => {
    if (setupEmailModal.setup_link) {
      navigator.clipboard.writeText(setupEmailModal.setup_link);
      setIsCopied(true);
      toast.success('Setup link copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
            <p className="text-gray-500 mt-1">Manage all tenant organizations</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchTenants}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              className="gap-2"
              style={{ backgroundColor: '#2563eb', color: 'white' }}
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Tenant
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by company name, slug, or email..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Tenants Table */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">
              All Tenants ({tenants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Devices</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((tenant) => (
                      <TableRow key={tenant.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 flex items-center gap-1.5">
                                {tenant.company_name}
                                {tenant.is_setup_complete === false && (
                                  <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px] px-1.5 py-0 font-normal">
                                    Setup Pending
                                  </Badge>
                                )}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Globe className="h-3 w-3" />
                                {tenant.slug}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={planColors[tenant.subscription_plan]} className="capitalize">
                            {tenant.subscription_plan}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColors[tenant.subscription_status]} className="capitalize">
                            {tenant.subscription_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span>
                              {tenant.current_users} / {tenant.max_users === 999999 ? '∞' : tenant.max_users}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-600">
                            {tenant.current_devices} / {tenant.max_devices}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <HardDrive className="h-4 w-4 text-gray-400" />
                            <span>
                              {formatStorageDisplay(tenant.storage_used_gb, tenant.storage_limit_gb)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(tenant.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/tenants/${tenant.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/tenants/${tenant.id}/edit`)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {!tenant.is_setup_complete && (
                                <DropdownMenuItem
                                  onClick={() => handleResendSetupEmail(tenant)}
                                  disabled={resendingTenantId === tenant.id}
                                >
                                  {resendingTenantId === tenant.id ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                                  ) : (
                                    <Mail className="h-4 w-4 mr-2 text-blue-600" />
                                  )}
                                  Resend Setup Email
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {tenant.subscription_status === 'suspended' ? (
                                <DropdownMenuItem
                                  className="text-green-600"
                                  onClick={() => setReactivateModalTenant(tenant)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Reactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-orange-600"
                                  onClick={() => setSuspendModalTenant(tenant)}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspend
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setDeleteModalTenant(tenant)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {!isLoading && tenants.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No tenants found. Create your first tenant to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateTenantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateTenant}
      />

      <DeleteTenantModal
        tenant={deleteModalTenant}
        onClose={() => setDeleteModalTenant(null)}
        onConfirm={handleDeleteTenant}
      />

      <SuspendTenantModal
        tenant={suspendModalTenant}
        onClose={() => setSuspendModalTenant(null)}
        onConfirm={handleSuspendTenant}
      />

      <ReactivateTenantModal
        tenant={reactivateModalTenant}
        onClose={() => setReactivateModalTenant(null)}
        onConfirm={handleReactivateTenant}
      />

      {/* Resend Setup Email Modal */}
      <Dialog
        open={setupEmailModal.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSetupEmailModal((prev) => ({ ...prev, isOpen: false }));
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-blue-600" />
              Tenant Setup Link
            </DialogTitle>
            <DialogDescription>
              {setupEmailModal.tenant?.company_name} ({setupEmailModal.tenant?.contact_email})
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
    </>
  );
}
