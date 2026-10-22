import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api.config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  Star,
  Lock,
  Globe,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  legal_name?: string;
  registration_number?: string;
  tax_number?: string;
  industry?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  is_default: boolean;
  is_active: boolean;
}

interface Branch {
  id: string;
  company_id: string;
  company_name?: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  is_default: boolean;
  is_active: boolean;
}

const emptyCompany: Partial<Company> = { name: '' };
const emptyBranch: Partial<Branch> = { name: '', company_id: '' };

export default function OrganizationSettings() {
  const {
    hasAnyPermission,
    activeCompanyIds,
    activeBranchIds,
    setActiveCompanies,
    setActiveBranches,
  } = useAuth();

  const canManageCompanies = hasAnyPermission(['manage_companies']);
  const canManageBranches = hasAnyPermission(['manage_branches']);
  const canViewCompanies = hasAnyPermission(['view_companies', 'manage_companies', 'view_all_companies']);
  const canViewBranches = hasAnyPermission(['view_branches', 'manage_branches', 'view_all_branches']);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterToActiveCompany, setFilterToActiveCompany] = useState<boolean>(true);

  // Company modal state
  const [companyModal, setCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<Company>>(emptyCompany);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Branch modal state
  const [branchModal, setBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Partial<Branch>>(emptyBranch);
  const [branchId, setBranchId] = useState<string | null>(null);

  // Delete confirm state
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'company' | 'branch'; id: string; name: string } | null>(null);

  const fetchCompanies = useCallback(async () => {
    if (!canViewCompanies) return;
    try {
      const res = await fetch(`${API_BASE_URL}/settings/companies`, { 
        credentials: 'include',
      });
      if (res.ok) setCompanies(await res.json());
    } catch (e) { console.error(e); }
  }, [canViewCompanies]);

  const fetchBranches = useCallback(async () => {
    if (!canViewBranches) return;
    try {
      const url = activeCompanyIds.length > 0
        ? `${API_BASE_URL}/settings/branches?company_id=${activeCompanyIds.join(',')}`
        : `${API_BASE_URL}/settings/branches`;
      const res = await fetch(url, { 
        credentials: 'include',
      });
      if (res.ok) setBranches(await res.json());
    } catch (e) { console.error(e); }
  }, [canViewBranches, activeCompanyIds]);

  useEffect(() => {
    fetchCompanies();
    fetchBranches();
  }, [fetchCompanies, fetchBranches, activeCompanyIds, activeBranchIds]);

  // Listen for immediate company/branch switch events
  useEffect(() => {
    const handleSwitch = () => {
      fetchCompanies();
      fetchBranches();
    };
    window.addEventListener('company-branch-changed', handleSwitch);
    return () => window.removeEventListener('company-branch-changed', handleSwitch);
  }, [fetchCompanies, fetchBranches]);

  // Company CRUD
  const openCreateCompany = () => { setEditingCompany(emptyCompany); setCompanyId(null); setCompanyModal(true); };
  const openEditCompany = (c: Company) => { setEditingCompany({ ...c }); setCompanyId(c.id); setCompanyModal(true); };
  const saveCompany = async () => {
    if (!editingCompany.name?.trim()) {
      toast.error('Company name is required');
      return;
    }
    setLoading(true);
    try {
      const url = companyId ? `${API_BASE_URL}/settings/companies/${companyId}` : `${API_BASE_URL}/settings/companies`;
      const method = companyId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCompany),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save company');
      }
      toast.success(companyId ? 'Company updated' : 'Company created');
      setCompanyModal(false);
      fetchCompanies();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };
  const deleteCompany = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings/companies/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete');
      }
      toast.success('Company deleted');
      setDeleteConfirm(null);
      fetchCompanies();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  // Branch CRUD
  const openCreateBranch = () => { setEditingBranch(emptyBranch); setBranchId(null); setBranchModal(true); };
  const openEditBranch = (b: Branch) => { setEditingBranch({ ...b }); setBranchId(b.id); setBranchModal(true); };
  const saveBranch = async () => {
    if (!editingBranch.name?.trim()) {
      toast.error('Branch name is required');
      return;
    }
    if (!editingBranch.company_id) {
      toast.error('Company is required');
      return;
    }
    setLoading(true);
    try {
      const url = branchId ? `${API_BASE_URL}/settings/branches/${branchId}` : `${API_BASE_URL}/settings/branches`;
      const method = branchId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBranch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save branch');
      }
      toast.success(branchId ? 'Branch updated' : 'Branch created');
      setBranchModal(false);
      fetchBranches();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };
  const deleteBranch = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings/branches/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete');
      }
      toast.success('Branch deleted');
      setDeleteConfirm(null);
      fetchBranches();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  if (!canViewCompanies && !canViewBranches) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">You do not have permission to view organization settings.</p>
      </div>
    );
  }

  const displayedCompanies = (activeCompanyIds.length > 0 && filterToActiveCompany)
    ? companies.filter(c => activeCompanyIds.includes(c.id))
    : companies;

  const displayedBranches = branches.filter(b => {
    if (activeCompanyIds.length > 0 && !activeCompanyIds.includes(b.company_id)) return false;
    if (activeBranchIds.length > 0 && !activeBranchIds.includes(b.id)) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" /> Organization Structure
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your companies and branches. Users, attendance, payroll, and reports are scoped by company and branch.
        </p>
      </div>

      {/* Active Scope Banner */}
      {(activeCompanyIds.length > 0 || activeBranchIds.length > 0) && (
        <div className="flex flex-wrap items-center justify-between p-3.5 bg-primary/10 border border-primary/20 rounded-xl gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-semibold text-primary">Active Scope Filter:</span>
            {activeCompanyIds.length === 0 ? (
              <Badge variant="secondary" className="text-xs font-medium bg-primary/20 text-primary">All Companies</Badge>
            ) : activeCompanyIds.length === 1 ? (
              <Badge variant="secondary" className="text-xs font-medium bg-primary/20 text-primary">
                {companies.find(c => c.id === activeCompanyIds[0])?.name || '1 Company'}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs font-medium bg-primary/20 text-primary">
                {activeCompanyIds.length} Companies Selected
              </Badge>
            )}
            {activeBranchIds.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground">•</span>
                {activeBranchIds.length === 1 ? (
                  <Badge variant="outline" className="text-xs font-medium">
                    {branches.find(b => b.id === activeBranchIds[0])?.name || '1 Branch'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs font-medium">
                    {activeBranchIds.length} Branches Selected
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Views automatically filtered by active scope</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/20"
              onClick={() => {
                setActiveCompanies([]);
                setActiveBranches([]);
              }}
            >
              Clear Scope / Show All
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="companies">
        <TabsList className="mb-4">
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" /> Companies
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-2">
            <GitBranch className="h-4 w-4" /> Branches
          </TabsTrigger>
        </TabsList>

        {/* Companies Tab */}
        <TabsContent value="companies">
          <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">
                Companies ({displayedCompanies.length}{displayedCompanies.length !== companies.length ? ` of ${companies.length}` : ''})
              </h2>
              {activeCompanyIds.length > 0 && (
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs">
                  <Button
                    variant={filterToActiveCompany ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setFilterToActiveCompany(true)}
                  >
                    Active Scope Only
                  </Button>
                  <Button
                    variant={!filterToActiveCompany ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setFilterToActiveCompany(false)}
                  >
                    All Companies
                  </Button>
                </div>
              )}
            </div>
            {canManageCompanies && (
              <Button size="sm" className="gap-2" onClick={openCreateCompany}>
                <Plus className="h-4 w-4" /> Add Company
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedCompanies.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base truncate">{c.name}</span>
                      {c.is_default && <Badge variant="default" className="text-[10px] shrink-0"><Star className="h-2.5 w-2.5 mr-1" />Default</Badge>}
                      {activeCompanyIds.includes(c.id) ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 shrink-0">
                          Active Scope
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setActiveCompanies([c.id]);
                            setActiveBranches([]);
                          }}
                        >
                          Switch Scope
                        </Button>
                      )}
                    </div>
                    {c.legal_name && <p className="text-xs text-muted-foreground truncate">{c.legal_name}</p>}
                    {c.industry && <p className="text-xs text-muted-foreground">{c.industry}</p>}
                  </div>
                  {canManageCompanies && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditCompany(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {!c.is_default && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ type: 'company', id: c.id, name: c.name })}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {(c.city || c.country) && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{[c.city, c.country].filter(Boolean).join(', ')}</span>}
                  {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{c.email}</span>}
                  {c.website && <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" />{c.website}</span>}
                </div>
                <div className="text-xs text-muted-foreground border-t border-border pt-2">
                  {branches.filter(b => b.company_id === c.id).length} branch(es)
                </div>
              </div>
            ))}
            {displayedCompanies.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No companies found in this scope.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Branches Tab */}
        <TabsContent value="branches">
          <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
            <div>
              <h2 className="text-lg font-semibold">
                Branches ({displayedBranches.length}{displayedBranches.length !== branches.length ? ` of ${branches.length}` : ''})
              </h2>
              {activeCompanyIds.length === 1 && (
                <p className="text-xs text-muted-foreground">Filtered to {companies.find(c => c.id === activeCompanyIds[0])?.name}</p>
              )}
              {activeCompanyIds.length > 1 && (
                <p className="text-xs text-muted-foreground">Filtered to {activeCompanyIds.length} companies</p>
              )}
            </div>
            {canManageBranches && (
              <Button size="sm" className="gap-2" onClick={openCreateBranch}>
                <Plus className="h-4 w-4" /> Add Branch
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedBranches.map((b) => (
              <div key={b.id} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base truncate">{b.name}</span>
                      {b.is_default && <Badge variant="default" className="text-[10px] shrink-0"><Star className="h-2.5 w-2.5 mr-1" />Default</Badge>}
                      {b.code && <Badge variant="outline" className="text-[10px]">{b.code}</Badge>}
                      {activeBranchIds.includes(b.id) ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 shrink-0">
                          Active Scope
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={() => setActiveBranches([b.id])}
                        >
                          Switch Scope
                        </Button>
                      )}
                    </div>
                    {b.company_name && <p className="text-xs text-primary font-medium">{b.company_name}</p>}
                  </div>
                  {canManageBranches && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditBranch(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {!b.is_default && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ type: 'branch', id: b.id, name: b.name })}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {(b.city || b.country) && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{[b.city, b.country].filter(Boolean).join(', ')}</span>}
                  {b.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{b.phone}</span>}
                  {b.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{b.email}</span>}
                </div>
              </div>
            ))}
            {displayedBranches.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">
                <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No branches found in this scope.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Company Modal */}
      <Dialog open={companyModal} onOpenChange={setCompanyModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{companyId ? 'Edit Company' : 'Add Company'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Company Name *</Label>
              <Input value={editingCompany.name || ''} onChange={e => setEditingCompany(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Corp" />
            </div>
            <div>
              <Label>Legal Name</Label>
              <Input value={editingCompany.legal_name || ''} onChange={e => setEditingCompany(p => ({ ...p, legal_name: e.target.value }))} />
            </div>
            <div>
              <Label>Industry</Label>
              <Input value={editingCompany.industry || ''} onChange={e => setEditingCompany(p => ({ ...p, industry: e.target.value }))} />
            </div>
            <div>
              <Label>Registration No.</Label>
              <Input value={editingCompany.registration_number || ''} onChange={e => setEditingCompany(p => ({ ...p, registration_number: e.target.value }))} />
            </div>
            <div>
              <Label>Tax Number</Label>
              <Input value={editingCompany.tax_number || ''} onChange={e => setEditingCompany(p => ({ ...p, tax_number: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={editingCompany.address || ''} onChange={e => setEditingCompany(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={editingCompany.city || ''} onChange={e => setEditingCompany(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={editingCompany.country || ''} onChange={e => setEditingCompany(p => ({ ...p, country: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editingCompany.phone || ''} onChange={e => setEditingCompany(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editingCompany.email || ''} onChange={e => setEditingCompany(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={editingCompany.website || ''} onChange={e => setEditingCompany(p => ({ ...p, website: e.target.value }))} />
            </div>
            <div className="col-span-2 flex items-center gap-2 mt-2">
              <input type="checkbox" id="company-default" checked={!!editingCompany.is_default} onChange={e => setEditingCompany(p => ({ ...p, is_default: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="company-default" className="cursor-pointer">Set as Default Company</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyModal(false)}>Cancel</Button>
            <Button onClick={saveCompany} disabled={loading}>{loading ? 'Saving...' : (companyId ? 'Update' : 'Create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Modal */}
      <Dialog open={branchModal} onOpenChange={setBranchModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{branchId ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Company *</Label>
              <Select value={editingBranch.company_id || ''} onValueChange={v => setEditingBranch(p => ({ ...p, company_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch Name *</Label>
              <Input value={editingBranch.name || ''} onChange={e => setEditingBranch(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Main Branch" />
            </div>
            <div>
              <Label>Branch Code</Label>
              <Input value={editingBranch.code || ''} onChange={e => setEditingBranch(p => ({ ...p, code: e.target.value }))} placeholder="e.g. HQ-001" />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={editingBranch.address || ''} onChange={e => setEditingBranch(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={editingBranch.city || ''} onChange={e => setEditingBranch(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={editingBranch.country || ''} onChange={e => setEditingBranch(p => ({ ...p, country: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={editingBranch.phone || ''} onChange={e => setEditingBranch(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editingBranch.email || ''} onChange={e => setEditingBranch(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="col-span-2 flex items-center gap-2 mt-2">
              <input type="checkbox" id="branch-default" checked={!!editingBranch.is_default} onChange={e => setEditingBranch(p => ({ ...p, is_default: e.target.checked }))} className="h-4 w-4" />
              <Label htmlFor="branch-default" className="cursor-pointer">Set as Default Branch for this Company</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchModal(false)}>Cancel</Button>
            <Button onClick={saveBranch} disabled={loading}>{loading ? 'Saving...' : (branchId ? 'Update' : 'Create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirm Delete
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (!deleteConfirm) return;
              if (deleteConfirm.type === 'company') deleteCompany(deleteConfirm.id);
              else deleteBranch(deleteConfirm.id);
            }} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
