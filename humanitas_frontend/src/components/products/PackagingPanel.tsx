import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import type { Product } from '@/hooks/useProducts';
import {
  PACKAGING_LEVELS, isValidGtin, packagingListProblem, usePackagings, useSavePackagings, type Packaging, type PackagingLevel,
} from '@/hooks/useProductExtras';

const blank = (): Packaging => ({ name: '', level: 'case', quantity: '', gtin: '', weight_kg: '', can_sell: true, can_buy: true });

/**
 * Packaging levels (GS1): the boxes, cartons and pallets a product also comes in, how many base units
 * each holds, and their own GTIN barcode, which scans as that quantity.
 */
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
        The boxes, cartons and pallets this product also comes in. Quantities are in the base unit ({unit}). A package's GTIN
        (the barcode printed on the box) scans as its whole quantity at the till, in receiving and in stock counts.
      </p>
      {rows.map((r, i) => {
        const g = (r.gtin ?? '').trim();
        const badGtin = !!g && !isValidGtin(g);
        return (
          <fieldset key={i} disabled={!canEdit} className="space-y-3 rounded-md border p-3" aria-label={r.name || `Packaging ${i + 1}`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_7rem]">
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`pk-name-${i}`}>Name</Label>
                <Input id={`pk-name-${i}`} value={r.name} placeholder="e.g. Box of 12" onChange={(e) => set(i, { name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pk-level-${i}`}>Level</Label>
                <Select value={r.level} onValueChange={(v) => set(i, { level: v as PackagingLevel })}>
                  <SelectTrigger id={`pk-level-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent>{PACKAGING_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pk-qty-${i}`}>Holds ({unit})</Label>
                <Input id={`pk-qty-${i}`} inputMode="decimal" value={String(r.quantity)} placeholder="12" onChange={(e) => set(i, { quantity: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`pk-gtin-${i}`}>GTIN (box barcode)</Label>
                <Input id={`pk-gtin-${i}`} inputMode="numeric" maxLength={14} value={r.gtin ?? ''} placeholder="Optional: 8, 12, 13 or 14 digits"
                  aria-invalid={badGtin} className={badGtin ? 'border-destructive' : ''} onChange={(e) => set(i, { gtin: e.target.value.replace(/\s/g, '') })} />
                {badGtin && <p className="text-xs text-destructive">Not a valid GTIN: check the digits.</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pk-weight-${i}`}>Weight kg</Label>
                <Input id={`pk-weight-${i}`} inputMode="decimal" value={String(r.weight_kg ?? '')} placeholder="—" onChange={(e) => set(i, { weight_kg: e.target.value })} />
              </div>
              <div className="flex items-center gap-4 pb-2">
                <label className="flex items-center gap-2 text-sm"><Switch checked={r.can_sell} onCheckedChange={(v) => set(i, { can_sell: v })} /> Sold</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={r.can_buy} onCheckedChange={(v) => set(i, { can_buy: v })} /> Bought</label>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${r.name || `packaging ${i + 1}`}`}
                    onClick={() => { setRows((rs) => rs.filter((_, j) => j !== i)); setDirty(true); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </fieldset>
        );
      })}
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
