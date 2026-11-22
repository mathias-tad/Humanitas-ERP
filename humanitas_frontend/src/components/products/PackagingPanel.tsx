import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import type { Product } from '@/hooks/useProducts';
import {
  PACKAGING_LEVELS, isValidGtin, packagingListProblem, usePackagings, useSavePackagings, type Packaging, type PackagingLevel,
} from '@/hooks/useProductExtras';

const blank = (): Packaging => ({ name: '', level: 'case', quantity: '', gtin: '', weight_kg: '', can_sell: true, can_buy: true });

/** Packaging levels (GS1): how many base units each package holds and its own GTIN, which scans as that quantity. */
export function PackagingPanel({ product }: { product: Product }) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('edit_products') && product.is_active && !product.has_variants;
  const q = usePackagings(product.id);
  const save = useSavePackagings(product.id);
  const [rows, setRows] = useState<Packaging[]>([]);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (q.data) {
      setRows(q.data.map((r) => ({ ...r, quantity: String(Number(r.quantity)), gtin: r.gtin ?? '', weight_kg: r.weight_kg == null ? '' : String(Number(r.weight_kg)) })));
      setDirty(false);
    }
  }, [q.data]);

  if (product.has_variants) {
    return <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">Each variant has its own packaging: open a variant from the Variants tab.</p>;
  }
  if (q.isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;
  if (q.isError) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>;

  const unit = product.uom_symbol ?? product.uom_name;
  const set = (i: number, patch: Partial<Packaging>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const problem = packagingListProblem(rows);

  const submit = async () => {
    if (problem) return toast.error(problem);
    try {
      await save.mutateAsync(rows);
      toast.success('Packaging saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Quantities are in the base unit ({unit}). A package's GTIN scans as its quantity at the till, in receiving and in stock counts.
      </p>
      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_8rem_5rem_9.5rem_5rem_auto_auto_auto] gap-2 text-xs font-medium text-muted-foreground">
            <span>Name</span><span>Level</span><span>Qty ({unit})</span><span>GTIN</span><span>Weight kg</span><span>Sell</span><span>Buy</span><span />
          </div>
          {rows.map((r, i) => {
            const g = (r.gtin ?? '').trim();
            return (
              <div key={i} className="grid grid-cols-[1fr_8rem_5rem_9.5rem_5rem_auto_auto_auto] items-center gap-2">
                <Input aria-label={`Packaging name ${i + 1}`} value={r.name} placeholder="Box of 12" disabled={!canEdit} onChange={(e) => set(i, { name: e.target.value })} />
                <Select value={r.level} onValueChange={(v) => set(i, { level: v as PackagingLevel })} disabled={!canEdit}>
                  <SelectTrigger aria-label={`Level ${i + 1}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{PACKAGING_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input aria-label={`Quantity ${i + 1}`} inputMode="decimal" value={String(r.quantity)} disabled={!canEdit} onChange={(e) => set(i, { quantity: e.target.value })} />
                <div>
                  <Input aria-label={`GTIN ${i + 1}`} inputMode="numeric" maxLength={14} value={r.gtin ?? ''} placeholder="Optional" disabled={!canEdit}
                    className={g && !isValidGtin(g) ? 'border-destructive' : ''} onChange={(e) => set(i, { gtin: e.target.value.replace(/\s/g, '') })} />
                </div>
                <Input aria-label={`Weight ${i + 1}`} inputMode="decimal" value={String(r.weight_kg ?? '')} disabled={!canEdit} onChange={(e) => set(i, { weight_kg: e.target.value })} />
                <Switch aria-label={`Sold in this package ${i + 1}`} checked={r.can_sell} disabled={!canEdit} onCheckedChange={(v) => set(i, { can_sell: v })} />
                <Switch aria-label={`Bought in this package ${i + 1}`} checked={r.can_buy} disabled={!canEdit} onCheckedChange={(v) => set(i, { can_buy: v })} />
                {canEdit ? (
                  <Button variant="ghost" size="icon" aria-label={`Remove packaging ${i + 1}`} onClick={() => { setRows((rs) => rs.filter((_, j) => j !== i)); setDirty(true); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : <span />}
              </div>
            );
          })}
        </div>
      )}
      {!rows.length && <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">No packaging yet (for example Box of 12, Carton of 48, Pallet of 960).</p>}
      {dirty && problem && <p className="text-xs text-destructive" role="alert">{problem}</p>}
      {canEdit && (
        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={() => { setRows((rs) => [...rs, blank()]); setDirty(true); }}><Plus className="mr-1 h-3 w-3" /> Add packaging</Button>
          <Button size="sm" onClick={submit} disabled={!dirty || save.isPending}>{save.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save packaging</Button>
        </div>
      )}
    </div>
  );
}
