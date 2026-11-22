import { useEffect } from 'react';
import { Lock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { defaultBranchFor, defaultCompanyFor, useCompanyScope } from '@/hooks/useCompanyScope';

const SHARED = '__shared__';
const ANY_BRANCH = '__any__';

interface Props {
  /** undefined = not chosen yet (the field shows and reports the default); null = shared by all companies */
  companyId: string | null | undefined;
  onCompanyChange: (id: string | null) => void;
  branchId?: string | null;
  onBranchChange?: (id: string | null) => void;
  /** Catalog records (products, categories…) can be shared by every company, for users with every company. */
  allowShared?: boolean;
  showBranch?: boolean;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * The company (and branch) of a record (AGENTS.md rule 16): starts in the switcher's current
 * company and branch, offers only the user's allowed ones, and is shown locked when there is
 * just one choice.
 */
export function CompanyBranchSelect({
  companyId, onCompanyChange, branchId, onBranchChange, allowShared = false, showBranch = false, disabled, idPrefix = 'scope',
}: Props) {
  const { activeCompanyIds, activeBranchIds } = useAuth();
  const scopeQ = useCompanyScope();
  const scope = scopeQ.data;
  const canShare = allowShared && !!scope?.all_companies;

  // A new record reports its starting company/branch once the user's access is known.
  useEffect(() => {
    if (!scope || companyId !== undefined) return;
    onCompanyChange(defaultCompanyFor(scope, activeCompanyIds));
  }, [scope, companyId, activeCompanyIds, onCompanyChange]);
  useEffect(() => {
    if (!scope || !showBranch || !onBranchChange || branchId !== undefined || companyId === undefined) return;
    onBranchChange(defaultBranchFor(scope, companyId, activeBranchIds));
  }, [scope, showBranch, onBranchChange, branchId, companyId, activeBranchIds]);

  if (!scope) return null;
  const company = scope.companies.find((c) => c.id === companyId);
  const companyLocked = disabled || (scope.companies.length <= 1 && !canShare);
  const branches = company?.branches ?? [];
  const branchLocked = disabled || (branches.length <= 1 && !company?.all_branches);

  return (
    <div className={showBranch ? 'grid grid-cols-2 gap-3' : ''}>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-company`}>Company</Label>
        {companyLocked ? (
          <p id={`${idPrefix}-company`} className="flex h-9 items-center gap-1.5 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden /> {companyId === null ? 'Shared by all companies' : company?.name ?? scope.companies[0]?.name ?? '—'}
          </p>
        ) : (
          <Select value={companyId === null ? SHARED : companyId ?? undefined}
            onValueChange={(v) => {
              onCompanyChange(v === SHARED ? null : v);
              onBranchChange?.(null);
            }}>
            <SelectTrigger id={`${idPrefix}-company`} className="w-full"><SelectValue placeholder="Choose a company" /></SelectTrigger>
            <SelectContent>
              {canShare && <SelectItem value={SHARED}>Shared by all companies</SelectItem>}
              {scope.companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      {showBranch && onBranchChange && companyId !== null && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-branch`}>Branch</Label>
          {branchLocked ? (
            <p id={`${idPrefix}-branch`} className="flex h-9 items-center gap-1.5 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
              <Lock className="h-3 w-3" aria-hidden /> {branches.find((b) => b.id === branchId)?.name ?? branches[0]?.name ?? '—'}
            </p>
          ) : (
            <Select value={branchId ?? ANY_BRANCH} onValueChange={(v) => onBranchChange(v === ANY_BRANCH ? null : v)}>
              <SelectTrigger id={`${idPrefix}-branch`} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {company?.all_branches && <SelectItem value={ANY_BRANCH}>No specific branch</SelectItem>}
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
