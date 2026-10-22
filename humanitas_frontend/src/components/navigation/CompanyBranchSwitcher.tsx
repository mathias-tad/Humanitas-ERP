import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api.config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, GitBranch, ChevronDown, Lock, Check } from 'lucide-react';

interface Company { id: string; name: string; is_default: boolean; }
interface Branch { id: string; company_id: string; name: string; is_default: boolean; }

export const CompanyBranchSwitcher: React.FC = () => {
  const { hasAnyPermission, user, activeCompanyId, activeBranchId, setActiveCompany, setActiveBranch } = useAuth();
  
  const canViewAllCompanies = hasAnyPermission(['view_all_companies', 'manage_companies']);
  const canViewAllBranches = hasAnyPermission(['view_all_branches', 'manage_branches']);
  const isLocked = !canViewAllCompanies && !canViewAllBranches;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    if (!canViewAllCompanies) return;
    fetch(`${API_BASE_URL}/settings/companies`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setCompanies)
      .catch(() => {});
  }, [canViewAllCompanies]);

  useEffect(() => {
    if (!canViewAllBranches) return;
    const url = activeCompanyId
      ? `${API_BASE_URL}/settings/branches?company_id=${activeCompanyId}`
      : `${API_BASE_URL}/settings/branches`;
    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setBranches)
      .catch(() => {});
  }, [canViewAllBranches, activeCompanyId]);

  const activeCompany = companies.find(c => c.id === activeCompanyId);
  const activeBranch = branches.find(b => b.id === activeBranchId);

  if (isLocked) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-1 border border-border text-xs text-muted-foreground select-none">
        <Lock className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium truncate max-w-[120px]">
          {user?.company_id ? 'Assigned Unit' : 'Main Organization'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Company Switcher */}
      {canViewAllCompanies && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs rounded-lg border border-border hover:bg-surface-2">
              <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[90px] font-medium">{activeCompany?.name || 'All Companies'}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Switch Company Scope</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setActiveCompany(null); setActiveBranch(null); }} className="text-xs gap-2 cursor-pointer">
              {!activeCompanyId && <Check className="h-3.5 w-3.5 text-primary" />}
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>All Companies</span>
            </DropdownMenuItem>
            {companies.map(c => (
              <DropdownMenuItem key={c.id} onClick={() => { setActiveCompany(c.id); setActiveBranch(null); }} className="text-xs gap-2 cursor-pointer">
                {activeCompanyId === c.id && <Check className="h-3.5 w-3.5 text-primary" />}
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{c.name}</span>
                {c.is_default && <Badge variant="outline" className="text-[9px] ml-auto shrink-0">Default</Badge>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Branch Switcher */}
      {canViewAllBranches && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs rounded-lg border border-border hover:bg-surface-2">
              <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[90px] font-medium">{activeBranch?.name || 'All Branches'}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Switch Branch Scope</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActiveBranch(null)} className="text-xs gap-2 cursor-pointer">
              {!activeBranchId && <Check className="h-3.5 w-3.5 text-primary" />}
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span>All Branches</span>
            </DropdownMenuItem>
            {branches.map(b => (
              <DropdownMenuItem key={b.id} onClick={() => setActiveBranch(b.id)} className="text-xs gap-2 cursor-pointer">
                {activeBranchId === b.id && <Check className="h-3.5 w-3.5 text-primary" />}
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{b.name}</span>
                {b.is_default && <Badge variant="outline" className="text-[9px] ml-auto shrink-0">Default</Badge>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
