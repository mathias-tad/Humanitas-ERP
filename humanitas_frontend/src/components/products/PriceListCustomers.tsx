import { Loader2, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EntityPicker } from '@/components/platform/EntityPicker';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { usePriceListCustomers, useSetPriceListCustomers } from '@/hooks/useProductExtras';

/** Customers who buy at this list's prices. A customer is on one list at most; a person buys at the company's list. */
export function PriceListCustomers({ listId, listName, isDefault, canEdit }: { listId: string; listName: string; isDefault: boolean; canEdit: boolean }) {
  const { hasPermission } = useAuth();
  const q = usePriceListCustomers(listId);
  const setCustomers = useSetPriceListCustomers(listId);
  const rows = q.data ?? [];
  const editable = canEdit && hasPermission('view_contacts');

  const change = async (ids: string[], ok: string) => {
    try {
      await setCustomers.mutateAsync(ids);
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section aria-label="Customers on this list" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" /> Customers on this list</h3>
        {setCustomers.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        {isDefault
          ? 'Customers on no list buy at this default list. Add customers to make sure they stay on it.'
          : `These customers buy at ${listName} prices in Sales and POS. Adding a customer moves them from any other list.`}
      </p>
      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{errorMessage(q.error)}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{[c.code, c.phone, c.city].filter(Boolean).join(' · ')}</span>
              </span>
              {editable && (
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Take ${c.name} off the list`}
                  onClick={() => change(rows.filter((r) => r.id !== c.id).map((r) => r.id), `${c.name} taken off ${listName}`)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
          {!rows.length && <li className="px-3 py-4 text-center text-sm text-muted-foreground">No customers on this list.</li>}
        </ul>
      )}
      {editable && (
        <EntityPicker type="customer" value={null} placeholder="Add a customer…" allowClear={false} excludeIds={rows.map((r) => r.id)}
          onChange={(id, rec) => {
            if (!id) return;
            const name = (rec as { name?: string } | undefined)?.name ?? 'Customer';
            change([...rows.map((r) => r.id), id], `${name} now buys at ${listName} prices`);
          }} />
      )}
    </section>
  );
}
