import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ACTIVE_BRANCH_KEY, ACTIVE_COMPANY_KEY } from '@/context/AuthContext';

/** Clears the scope keys and tells every non-query part of the page to refetch (rule 17). */
export function clearActiveScope(): void {
  localStorage.removeItem(ACTIVE_COMPANY_KEY);
  localStorage.removeItem(ACTIVE_BRANCH_KEY);
  window.dispatchEvent(new CustomEvent('company-branch-changed'));
}

/**
 * The "Active Scope" banner (AGENTS.md rules 16–17): shown on every page that displays
 * scoped data, with the one-click "Clear Scope / Show All".
 */
export function ActiveScopeBanner() {
  const [companyIds, setCompanyIds] = useState(() => localStorage.getItem(ACTIVE_COMPANY_KEY)?.split(',').filter(Boolean) ?? []);
  const [branchIds, setBranchIds] = useState(() => localStorage.getItem(ACTIVE_BRANCH_KEY)?.split(',').filter(Boolean) ?? []);

  useEffect(() => {
    const read = () => {
      setCompanyIds(localStorage.getItem(ACTIVE_COMPANY_KEY)?.split(',').filter(Boolean) ?? []);
      setBranchIds(localStorage.getItem(ACTIVE_BRANCH_KEY)?.split(',').filter(Boolean) ?? []);
    };
    window.addEventListener('company-branch-changed', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('company-branch-changed', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  const active = companyIds.length > 0 || branchIds.length > 0;
  if (!active) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5 text-sm text-foreground">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span className="font-semibold text-primary">Active Scope Filtering:</span>
        <span>
          {companyIds.length ? `Company: ${companyIds.join(', ')}` : ''}
          {companyIds.length && branchIds.length ? ' | ' : ''}
          {branchIds.length ? `Branch: ${branchIds.join(', ')}` : ''}
        </span>
      </div>
      <Button
        variant="ghost" size="sm"
        onClick={() => {
          clearActiveScope();
          toast.info('Organization scope filter cleared. Showing consolidated enterprise records.');
        }}
        className="h-7 text-xs text-muted-foreground hover:text-foreground"
      >
        Clear Scope / Show All
      </Button>
    </div>
  );
}
