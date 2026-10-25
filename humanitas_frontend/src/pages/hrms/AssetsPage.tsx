import { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import {
  Laptop,
  CheckCircle2,
  Wrench,
  Search,
  Plus,
  Eye,
  UserCheck,
  QrCode,
  X,
  DollarSign,
  Tag,
} from 'lucide-react';
import {
  useAssets,
  useAsset,
  useAssetCategories,
  useMyAssets,
  useAssetAnalytics,
  useAssetMaintenanceLogs,
  useCreateAsset,
  useAssignAsset,
  useReturnAsset,
  useAcknowledgeAsset,
  useLogAssetMaintenance,
  useCreateAssetCategory,
  type CompanyAsset,
} from '@/hooks/useAssets';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const STATUS_BADGES: Record<string, string> = {
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
  repair: 'bg-rose-50 text-rose-700 border-rose-200',
  retired: 'bg-slate-100 text-slate-700 border-slate-200',
  lost: 'bg-red-100 text-red-800 border-red-300',
};

const CONDITION_BADGES: Record<string, string> = {
  new: 'bg-teal-50 text-teal-700 border-teal-200',
  excellent: 'bg-green-50 text-green-700 border-green-200',
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  fair: 'bg-amber-50 text-amber-700 border-amber-200',
  damaged: 'bg-rose-50 text-rose-700 border-rose-200',
  missing: 'bg-red-50 text-red-700 border-red-200',
};

export default function AssetsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('manage_assets') || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner';
  const canAssign = hasPermission('assign_assets') || canManage;

  const [activeTab, setActiveTab] = useState<'catalog' | 'my' | 'history' | 'maintenance'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<CompanyAsset | null>(null);

  // Form States
  const [newAsset, setNewAsset] = useState({
    name: '',
    category_id: '',
    model: '',
    serial_number: '',
    purchase_cost: 0,
    purchase_date: '',
    warranty_expiry: '',
    condition: 'good',
    location: '',
    notes: '',
  });

  const [assignForm, setAssignForm] = useState({
    user_id: '',
    expected_return_date: '',
    notes: '',
  });

  const [returnForm, setReturnForm] = useState({
    return_condition: 'good',
    returned_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    title: '',
    description: '',
    cost: 0,
    service_provider: '',
    service_date: new Date().toISOString().split('T')[0],
    next_service_date: '',
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: '',
  });

  // Queries
  const { data: assets = [], isLoading: assetsLoading } = useAssets({
    category_id: selectedCategory,
    status: selectedStatus,
    search: searchQuery,
  });
  const { data: categories = [] } = useAssetCategories();
  const { data: myAssets = [] } = useMyAssets();
  const { data: analytics } = useAssetAnalytics();
  const { data: maintenanceLogs = [] } = useAssetMaintenanceLogs();
  const { data: detailedAsset } = useAsset(selectedAsset?.id || '');
  const { data: users = [] } = useUsers();

  // Mutations
  const createAssetMutation = useCreateAsset();
  const assignAssetMutation = useAssignAsset();
  const returnAssetMutation = useReturnAsset();
  const acknowledgeMutation = useAcknowledgeAsset();
  const logMaintenanceMutation = useLogAssetMaintenance();
  const createCategoryMutation = useCreateAssetCategory();

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.name || !newAsset.category_id) {
      toast.error('Asset Name and Category are required');
      return;
    }
    try {
      await createAssetMutation.mutateAsync(newAsset as any);
      toast.success('Asset created successfully');
      setShowAddModal(false);
      setNewAsset({
        name: '',
        category_id: '',
        model: '',
        serial_number: '',
        purchase_cost: 0,
        purchase_date: '',
        warranty_expiry: '',
        condition: 'good',
        location: '',
        notes: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create asset');
    }
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !assignForm.user_id) {
      toast.error('Please select an employee');
      return;
    }
    try {
      await assignAssetMutation.mutateAsync({
        assetId: selectedAsset.id,
        ...assignForm,
      });
      toast.success('Asset assigned successfully');
      setShowAssignModal(false);
      setSelectedAsset(null);
      setAssignForm({ user_id: '', expected_return_date: '', notes: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign asset');
    }
  };

  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      await returnAssetMutation.mutateAsync({
        assetId: selectedAsset.id,
        ...returnForm,
      });
      toast.success('Asset checked in successfully');
      setShowReturnModal(false);
      setSelectedAsset(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to return asset');
    }
  };

  const handleLogMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !maintenanceForm.title) {
      toast.error('Service title is required');
      return;
    }
    try {
      await logMaintenanceMutation.mutateAsync({
        assetId: selectedAsset.id,
        ...maintenanceForm,
      });
      toast.success('Maintenance record added');
      setShowMaintenanceModal(false);
      setSelectedAsset(null);
      setMaintenanceForm({
        title: '',
        description: '',
        cost: 0,
        service_provider: '',
        service_date: new Date().toISOString().split('T')[0],
        next_service_date: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to log maintenance');
    }
  };

  const handleAcknowledge = async (assignmentId: string) => {
    try {
      await acknowledgeMutation.mutateAsync(assignmentId);
      toast.success('Asset receipt acknowledged');
    } catch (err: any) {
      toast.error(err.message || 'Failed to acknowledge asset');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name) {
      toast.error('Category name is required');
      return;
    }
    try {
      await createCategoryMutation.mutateAsync(categoryForm);
      toast.success('Category created');
      setShowCategoryModal(false);
      setCategoryForm({ name: '', code: '', description: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Asset & Equipment Tracking"
        description="Enterprise lifecycle custody, QR tag inventory, check-in/out workflows, and scheduled maintenance."
        actions={
          <div className="flex gap-2">
            {canManage && (
              <>
                <Button variant="outline" onClick={() => setShowCategoryModal(true)}>
                  <Tag className="w-4 h-4 mr-2" /> Add Category
                </Button>
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add Asset
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KPITile
          title="Total Assets"
          value={analytics?.total_assets || 0}
          icon={Laptop}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <KPITile
          title="Available"
          value={analytics?.available_count || 0}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <KPITile
          title="In Custody"
          value={analytics?.assigned_count || 0}
          icon={UserCheck}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
        <KPITile
          title="Maintenance/Repair"
          value={analytics?.maintenance_count || 0}
          icon={Wrench}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <KPITile
          title="Inventory Valuation"
          value={`$${(analytics?.total_valuation || 0).toLocaleString()}`}
          icon={DollarSign}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-4">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'catalog'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          All Assets ({assets.length})
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'my'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          My Assets ({myAssets.length})
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'maintenance'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Service & Maintenance
        </button>
      </div>

      {/* TAB 1: ALL ASSETS */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search name, tag, serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-md text-sm bg-background"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="all">All Statuses</option>
                <option value="available">Available</option>
                <option value="assigned">Assigned</option>
                <option value="maintenance">Maintenance</option>
                <option value="repair">Repair</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>

          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Asset & Model</th>
                    <th className="px-4 py-3 text-left font-medium">Tag / Serial</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Condition</th>
                    <th className="px-4 py-3 text-left font-medium">Assigned To</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assetsLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        Loading assets...
                      </td>
                    </tr>
                  ) : assets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No company assets found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    assets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">
                          <div>{asset.name}</div>
                          {asset.model && <div className="text-xs text-muted-foreground">{asset.model}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs">{asset.asset_tag}</div>
                          {asset.serial_number && (
                            <div className="text-xs text-muted-foreground font-mono">SN: {asset.serial_number}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{asset.category_name || 'General'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs border font-medium ${
                              STATUS_BADGES[asset.status] || 'bg-slate-50 text-slate-700'
                            }`}
                          >
                            {asset.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs border font-medium ${
                              CONDITION_BADGES[asset.current_condition] || 'bg-slate-50 text-slate-700'
                            }`}
                          >
                            {asset.current_condition.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {asset.first_name ? (
                            <div>
                              <div className="font-medium text-xs">
                                {asset.first_name} {asset.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground">{asset.assigned_user_department}</div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAsset(asset);
                                setShowDetailModal(true);
                              }}
                              title="View Asset Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canAssign && asset.status === 'available' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowAssignModal(true);
                                }}
                              >
                                Check Out
                              </Button>
                            )}
                            {canAssign && asset.status === 'assigned' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowReturnModal(true);
                                }}
                              >
                                Check In
                              </Button>
                            )}
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setShowMaintenanceModal(true);
                                }}
                                title="Log Maintenance"
                              >
                                <Wrench className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY ASSIGNED ASSETS */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          {myAssets.length === 0 ? (
            <div className="border rounded-lg p-12 text-center text-muted-foreground bg-card">
              <Laptop className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <div className="font-medium text-base">No Assets Currently Assigned</div>
              <p className="text-sm mt-1">Company laptops, mobile devices, and tools in your custody will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAssets.map((asset) => (
                <div key={asset.id} className="border rounded-lg p-5 bg-card space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-base">{asset.name}</div>
                      <div className="text-xs text-muted-foreground">{asset.model || asset.category_name}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs border font-medium bg-blue-50 text-blue-700 border-blue-200">
                      IN CUSTODY
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Tag:</span>
                      <span className="font-mono font-medium text-foreground">{asset.asset_tag}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assigned Date:</span>
                      <span className="text-foreground">{asset.assigned_date}</span>
                    </div>
                    {asset.expected_return_date && (
                      <div className="flex justify-between">
                        <span>Expected Return:</span>
                        <span className="text-foreground">{asset.expected_return_date}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t flex justify-between items-center">
                    {asset.acknowledged_at ? (
                      <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full"
                        onClick={() => asset.assignment_id && handleAcknowledge(asset.assignment_id)}
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-1.5" /> Acknowledge Custody
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MAINTENANCE & SERVICE LOGS */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="p-4 border-b font-medium">Recent Service & Maintenance Records</div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Asset</th>
                  <th className="px-4 py-3 text-left font-medium">Service Title</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Cost</th>
                  <th className="px-4 py-3 text-left font-medium">Service Date</th>
                  <th className="px-4 py-3 text-left font-medium">Next Due</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {maintenanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No maintenance records logged yet.
                    </td>
                  </tr>
                ) : (
                  maintenanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{log.asset_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{log.asset_tag}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">{log.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{log.service_provider || 'Internal'}</td>
                      <td className="px-4 py-3">${log.cost}</td>
                      <td className="px-4 py-3">{log.service_date}</td>
                      <td className="px-4 py-3">{log.next_service_date || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs border font-medium bg-emerald-50 text-emerald-700">
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD ASSET */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Add New Asset</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAsset} className="space-y-4">
              <div>
                <label className="text-xs font-medium">Asset Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MacBook Pro 16-inch M3"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Category *</label>
                  <select
                    required
                    value={newAsset.category_id}
                    onChange={(e) => setNewAsset({ ...newAsset, category_id: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Model</label>
                  <input
                    type="text"
                    placeholder="e.g. A2991"
                    value={newAsset.model}
                    onChange={(e) => setNewAsset({ ...newAsset, model: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Serial Number</label>
                  <input
                    type="text"
                    placeholder="e.g. C02G90..."
                    value={newAsset.serial_number}
                    onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Purchase Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newAsset.purchase_cost}
                    onChange={(e) => setNewAsset({ ...newAsset, purchase_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Purchase Date</label>
                  <input
                    type="date"
                    value={newAsset.purchase_date}
                    onChange={(e) => setNewAsset({ ...newAsset, purchase_date: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Warranty Expiry</label>
                  <input
                    type="date"
                    value={newAsset.warranty_expiry}
                    onChange={(e) => setNewAsset({ ...newAsset, warranty_expiry: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Initial Condition</label>
                  <select
                    value={newAsset.condition}
                    onChange={(e) => setNewAsset({ ...newAsset, condition: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  >
                    <option value="new">Brand New</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Storage Location</label>
                  <input
                    type="text"
                    placeholder="e.g. IT Locker B4"
                    value={newAsset.location}
                    onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Asset</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGN ASSET (CHECK OUT) */}
      {showAssignModal && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Check Out Asset</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-muted/40 p-3 rounded-lg text-sm">
              <div className="font-medium">{selectedAsset.name}</div>
              <div className="text-xs font-mono text-muted-foreground">{selectedAsset.asset_tag}</div>
            </div>
            <form onSubmit={handleAssignAsset} className="space-y-4">
              <div>
                <label className="text-xs font-medium">Assign To Employee *</label>
                <select
                  required
                  value={assignForm.user_id}
                  onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                >
                  <option value="">Select Employee</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.department || 'No Dept'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Expected Return Date</label>
                <input
                  type="date"
                  value={assignForm.expected_return_date}
                  onChange={(e) => setAssignForm({ ...assignForm, expected_return_date: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Custody Notes / Purpose</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Remote work hardware bundle"
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Confirm Check Out</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RETURN ASSET (CHECK IN) */}
      {showReturnModal && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Check In Asset</h3>
              <button onClick={() => setShowReturnModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-muted/40 p-3 rounded-lg text-sm">
              <div className="font-medium">{selectedAsset.name}</div>
              <div className="text-xs text-muted-foreground">
                Currently with: {selectedAsset.first_name} {selectedAsset.last_name}
              </div>
            </div>
            <form onSubmit={handleReturnAsset} className="space-y-4">
              <div>
                <label className="text-xs font-medium">Returned Condition *</label>
                <select
                  value={returnForm.return_condition}
                  onChange={(e) => setReturnForm({ ...returnForm, return_condition: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                >
                  <option value="excellent">Excellent - No cosmetic or functional flaws</option>
                  <option value="good">Good - Normal minor wear</option>
                  <option value="fair">Fair - Visible wear but operational</option>
                  <option value="damaged">Damaged - Needs repair / maintenance</option>
                  <option value="missing">Missing / Stolen / Lost</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Return Date</label>
                <input
                  type="date"
                  value={returnForm.returned_date}
                  onChange={(e) => setReturnForm({ ...returnForm, returned_date: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Inspection Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Power adapter returned, minor scratch on lid"
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowReturnModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Complete Check In</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: LOG MAINTENANCE */}
      {showMaintenanceModal && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Log Maintenance / Service</h3>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleLogMaintenance} className="space-y-4">
              <div>
                <label className="text-xs font-medium">Service Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Battery Replacement & Screen Calibration"
                  value={maintenanceForm.title}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, title: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={maintenanceForm.cost}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Service Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. Apple Care / Official"
                    value={maintenanceForm.service_provider}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, service_provider: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Service Date</label>
                  <input
                    type="date"
                    value={maintenanceForm.service_date}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, service_date: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Next Due Date</label>
                  <input
                    type="date"
                    value={maintenanceForm.next_service_date}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, next_service_date: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowMaintenanceModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Log Service</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ASSET DETAILS & QR TAG */}
      {showDetailModal && selectedAsset && detailedAsset && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">{detailedAsset.name}</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Tag Header */}
            <div className="p-4 rounded-lg border bg-muted/20 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Digital Asset Tag</div>
                <div className="text-lg font-mono font-bold">{detailedAsset.asset_tag}</div>
                <div className="text-xs text-muted-foreground font-mono">SN: {detailedAsset.serial_number || 'N/A'}</div>
              </div>
              <div className="bg-white p-2 rounded border shadow-sm">
                <QrCode className="w-12 h-12 text-slate-800" />
              </div>
            </div>

            {/* Asset Specs */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Category:</span>
                <span className="ml-2 font-medium">{detailedAsset.category_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-medium uppercase">{detailedAsset.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Condition:</span>
                <span className="ml-2 font-medium capitalize">{detailedAsset.current_condition}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Purchase Cost:</span>
                <span className="ml-2 font-medium">${detailedAsset.purchase_cost}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Warranty Expiry:</span>
                <span className="ml-2 font-medium">{detailedAsset.warranty_expiry || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Location:</span>
                <span className="ml-2 font-medium">{detailedAsset.location || 'N/A'}</span>
              </div>
            </div>

            {/* Custody Chain History */}
            <div className="space-y-2 pt-2 border-t">
              <div className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                Custody Chain & Assignment History
              </div>
              {detailedAsset.assignment_history && detailedAsset.assignment_history.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {detailedAsset.assignment_history.map((hist) => (
                    <div key={hist.id} className="p-2.5 rounded border bg-muted/10 text-xs flex justify-between items-center">
                      <div>
                        <div className="font-medium">
                          {hist.first_name} {hist.last_name} ({hist.department || 'General'})
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          {hist.assigned_date} → {hist.returned_date || 'Present (In Custody)'}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          hist.is_active ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {hist.is_active ? 'ACTIVE CUSTODY' : 'RETURNED'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">No historical assignments.</div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CREATE CATEGORY */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Add Asset Category</h3>
              <button onClick={() => setShowCategoryModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="text-xs font-medium">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Drones & Audio Gear"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Short Code</label>
                <input
                  type="text"
                  placeholder="e.g. DRN-AUD"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes about equipment classification"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowCategoryModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Category</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
