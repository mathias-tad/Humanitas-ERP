import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/config/api.config';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, GitBranch, ChevronDown, Lock, Check, X } from 'lucide-react';

interface Company { id: string; name: string; is_default: boolean; }
interface Branch { id: string; company_id: string; company_name?: string; name: string; is_default: boolean; }

export const CompanyBranchSwitcher: React.FC = () => {
  const {
    hasAnyPermission,
    user,
    activeCompanyIds,
    activeBranchIds,
    setActiveCompanies,
    setActiveBranches,
    toggleCompany,
    toggleBranch,
    clearCompanyScope,
    clearBranchScope,
  } = useAuth();
  
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
    const url = activeCompanyIds.length > 0
      ? `${API_BASE_URL}/settings/branches?company_id=${activeCompanyIds.join(',')}`
      : `${API_BASE_URL}/settings/branches`;
    fetch(url, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setBranches)
      .catch(() => {});
  }, [canViewAllBranches, activeCompanyIds]);

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

  const getCompanyLabel = () => {
    if (activeCompanyIds.length === 0) return 'All Companies';
    if (activeCompanyIds.length === 1) {
      const match = companies.find(c => c.id === activeCompanyIds[0]);
      return match ? match.name : '1 Company';
    }
    return `${activeCompanyIds.length} Companies`;
  };

  const getBranchLabel = () => {
    if (activeBranchIds.length === 0) return 'All Branches';
    if (activeBranchIds.length === 1) {
      const match = branches.find(b => b.id === activeBranchIds[0]);
      return match ? match.name : '1 Branch';
    }
    return `${activeBranchIds.length} Branches`;
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Multi-Company Switcher */}
      {canViewAllCompanies && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 gap-1.5 px-2 text-xs rounded-lg border transition-all ${
                activeCompanyIds.length > 0
                  ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10'
                  : 'border-border hover:bg-surface-2 text-foreground'
              }`}
            >
              <Building2 className={`h-3.5 w-3.5 shrink-0 ${activeCompanyIds.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="truncate max-w-[110px] font-medium">{getCompanyLabel()}</span>
              {activeCompanyIds.length > 1 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-semibold bg-primary/15 text-primary">
                  {activeCompanyIds.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 p-1.5">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Company Scope (Multi-Select)
              </span>
              {activeCompanyIds.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearCompanyScope();
                    toast.info('Switched scope: All Companies');
                  }}
                  className="text-[10px] text-primary hover:underline font-medium flex items-center gap-0.5"
                >
                  <X className="h-2.5 w-2.5" /> Clear
                </button>
              )}
            </div>
            <DropdownMenuSeparator />

            {/* All Companies option */}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                clearCompanyScope();
                toast.info('Switched scope: All Companies');
              }}
              className="text-xs gap-2.5 py-1.5 px-2 cursor-pointer font-medium"
            >
              <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                activeCompanyIds.length === 0 ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
              }`}>
                {activeCompanyIds.length === 0 && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>All Companies</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {companies.map((c) => {
                const isSelected = activeCompanyIds.includes(c.id);
                return (
                  <DropdownMenuItem
                    key={c.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      toggleCompany(c.id);
                      const nextCount = isSelected ? activeCompanyIds.length - 1 : activeCompanyIds.length + 1;
                      toast.info(nextCount === 0 ? 'Switched scope: All Companies' : `Updated company scope (${nextCount} selected)`);
                    }}
                    className="text-xs flex items-center justify-between py-1.5 px-2 cursor-pointer rounded-md hover:bg-surface-2 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-1">
                      <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 group-hover:border-primary/50'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className="truncate font-medium">{c.name}</span>
                      {c.is_default && (
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0 font-normal">
                          Default
                        </Badge>
                      )}
                    </div>
                    {/* Quick "Only" button to isolate this company */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCompanies([c.id]);
                        setActiveBranches([]);
                        toast.info(`Switched company scope: ${c.name}`);
                      }}
                      className="text-[10px] text-muted-foreground hover:text-primary px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-medium"
                      title={`Select only ${c.name}`}
                    >
                      Only
                    </button>
                  </DropdownMenuItem>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Multi-Branch Switcher */}
      {canViewAllBranches && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 gap-1.5 px-2 text-xs rounded-lg border transition-all ${
                activeBranchIds.length > 0
                  ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10'
                  : 'border-border hover:bg-surface-2 text-foreground'
              }`}
            >
              <GitBranch className={`h-3.5 w-3.5 shrink-0 ${activeBranchIds.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="truncate max-w-[110px] font-medium">{getBranchLabel()}</span>
              {activeBranchIds.length > 1 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-semibold bg-primary/15 text-primary">
                  {activeBranchIds.length}
                </Badge>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 p-1.5">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Branch Scope (Multi-Select)
              </span>
              {activeBranchIds.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearBranchScope();
                    toast.info('Switched scope: All Branches');
                  }}
                  className="text-[10px] text-primary hover:underline font-medium flex items-center gap-0.5"
                >
                  <X className="h-2.5 w-2.5" /> Clear
                </button>
              )}
            </div>
            <DropdownMenuSeparator />

            {/* All Branches option */}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                clearBranchScope();
                toast.info('Switched scope: All Branches');
              }}
              className="text-xs gap-2.5 py-1.5 px-2 cursor-pointer font-medium"
            >
              <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                activeBranchIds.length === 0 ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
              }`}>
                {activeBranchIds.length === 0 && <Check className="h-3 w-3 stroke-[3]" />}
              </div>
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span>All Branches</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {branches.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                  No branches found for selected companies
                </div>
              ) : (
                branches.map((b) => {
                  const isSelected = activeBranchIds.includes(b.id);
                  return (
                    <DropdownMenuItem
                      key={b.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        toggleBranch(b.id);
                        const nextCount = isSelected ? activeBranchIds.length - 1 : activeBranchIds.length + 1;
                        toast.info(nextCount === 0 ? 'Switched scope: All Branches' : `Updated branch scope (${nextCount} selected)`);
                      }}
                      className="text-xs flex items-center justify-between py-1.5 px-2 cursor-pointer rounded-md hover:bg-surface-2 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 group-hover:border-primary/50'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{b.name}</span>
                          {b.company_name && activeCompanyIds.length !== 1 && (
                            <span className="text-[10px] text-muted-foreground truncate">{b.company_name}</span>
                          )}
                        </div>
                        {b.is_default && (
                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0 font-normal ml-auto">
                            Default
                          </Badge>
                        )}
                      </div>
                      {/* Quick "Only" button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBranches([b.id]);
                          toast.info(`Switched branch scope: ${b.name}`);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-primary px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-medium ml-1"
                        title={`Select only ${b.name}`}
                      >
                        Only
                      </button>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
