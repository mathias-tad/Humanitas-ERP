import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { companyScopeKey, useCompanyScope } from '@/hooks/useCompanyScope';

export interface AccessRow { company_id: string; all_branches: boolean; branch_ids: string[]; is_default: boolean }
interface AccessResponse { all_companies: boolean; all_branches: boolean; companies: AccessRow[] }

/** Toggle a company in the list; the first one becomes the default. */
export function toggleCompanyAccess(rows: AccessRow[], companyId: string): AccessRow[] {
  if (rows.some((r) => r.company_id === companyId)) {
    const next = rows.filter((r) => r.company_id !== companyId);
    if (next.length && !next.some((r) => r.is_default)) next[0] = { ...next[0], is_default: true };
    return next;
  }
  return [...rows, { company_id: companyId, all_branches: true, branch_ids: [], is_default: rows.length === 0 }];
}

/**
 * Settings -> Users -> Company access: which companies (and branches in each) the user may work in,
 * and their default. Only companies and branches the editor can access are offered.
 */
export function UserCompanyAccessEditor({ userId }: { userId: string }) {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const mine = useCompanyScope();
  const access = useQuery({
    queryKey: ['users', userId, 'company-access'],
    queryFn: () => api.get<AccessResponse>(`/users/${userId}/company-access`),
  });
  const [rows, setRows] = useState<AccessRow[]>([]);
  useEffect(() => {
    if (access.data) setRows(access.data.companies);
  }, [access.data]);
  const save = useMutation({
    mutationFn: () => api.put<AccessResponse>(`/users/${userId}/company-access`, { companies: rows }),
    onSuccess: () => {
      toast.success('Company access saved');
      qc.invalidateQueries({ queryKey: ['users', userId, 'company-access'] });
      qc.invalidateQueries({ queryKey: companyScopeKey });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const canEdit = hasPermission('edit_users');

  if (mine.isLoading || access.isLoading) {
    return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (access.isError) return <p className="py-6 text-sm text-destructive">{errorMessage(access.error)}</p>;

  const set = (companyId: string, patch: Partial<AccessRow>) =>
    setRows((rs) => rs.map((r) => (r.company_id === companyId ? { ...r, ...patch } : patch.is_default ? { ...r, is_default: false } : r)));

  return (
    <div className="space-y-4">
      {access.data?.all_companies ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          This user's role gives access to every company{access.data.all_branches ? ' and branch' : ''}. The list below sets their default.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          The user can work only in the companies ticked here. In each, all branches or only the chosen ones. The default is where they start.
        </p>
      )}
      <div className="space-y-3">
        {(mine.data?.companies ?? []).map((c) => {
          const row = rows.find((r) => r.company_id === c.id);
          return (
            <section key={c.id} className="rounded-md border p-3" aria-label={c.name}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={!!row} disabled={!canEdit} onChange={() => setRows((rs) => toggleCompanyAccess(rs, c.id))} /> {c.name}
                </label>
                {row && (
                  <label className="flex items-center gap-2 text-xs">
                    <input type="radio" name="default-company" checked={row.is_default} disabled={!canEdit} onChange={() => set(c.id, { is_default: true })} /> Default
                  </label>
                )}
              </div>
              {row && c.branches.length > 0 && (
                <div className="mt-2 space-y-2 pl-6">
                  {mine.data?.all_branches && (
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={row.all_branches} disabled={!canEdit}
                        onChange={(e) => set(c.id, { all_branches: e.target.checked, branch_ids: e.target.checked ? [] : row.branch_ids })} /> All branches
                    </label>
                  )}
                  {!row.all_branches && (
                    <div className="flex flex-wrap gap-2">
                      {c.branches.map((b) => {
                        const on = row.branch_ids.includes(b.id);
                        return (
                          <button key={b.id} type="button" disabled={!canEdit} aria-pressed={on}
                            onClick={() => set(c.id, { branch_ids: on ? row.branch_ids.filter((x) => x !== b.id) : [...row.branch_ids, b.id] })}
                            className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                            {b.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!row.all_branches && !row.branch_ids.length && <p className="text-xs text-destructive">Choose at least one branch.</p>}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button type="button" onClick={() => save.mutate()}
            disabled={save.isPending || rows.some((r) => !r.all_branches && !r.branch_ids.length)}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save company access
          </Button>
        </div>
      )}
    </div>
  );
}
