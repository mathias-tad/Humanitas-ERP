import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EntityPicker } from '@/components/platform/EntityPicker';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import type { Product } from '@/hooks/useProducts';
import {
  compositionDraftProblem, kitTotals, useComposition, useSaveComposition, type ComboGroup, type Composition, type KitComponent,
} from '@/hooks/useProductExtras';

const MODES: { value: Composition; label: string; hint: string }[] = [
  { value: 'single', label: 'Single product', hint: 'Sold as it is.' },
  { value: 'kit', label: 'Kit / bundle', hint: 'Fixed components sold together at the kit price (a gift basket, a school pack).' },
  { value: 'combo', label: 'Combo', hint: 'The customer picks from groups, such as a main, a side and a drink; choices can cost extra.' },
];

type Picked = { id: string; name?: string; sales_price?: string; cost_price?: string; sku?: string | null };

/** Whether the product is single, a kit or a combo, and what is inside. */
export function CompositionPanel({ product }: { product: Product }) {
  const { hasPermission } = useAuth();
  const blocked = product.has_variants || !!product.parent_id;
  const canEdit = hasPermission('edit_products') && product.is_active && !blocked;
  const q = useComposition(product.id);
  const save = useSaveComposition(product.id);
  const [mode, setMode] = useState<Composition>('single');
  const [components, setComponents] = useState<KitComponent[]>([]);
  const [groups, setGroups] = useState<ComboGroup[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setMode(q.data.composition);
    setComponents(q.data.components.map((c) => ({ ...c, quantity: String(Number(c.quantity)) })));
    setGroups(q.data.groups.map((g) => ({ ...g, choices: g.choices.map((c) => ({ ...c, extra_price: String(Number(c.extra_price ?? 0)) })) })));
    setDirty(false);
  }, [q.data]);

  if (blocked) {
    return <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">A product with variants, or a variant, cannot be a kit or combo. Kits and combos use variants as their components.</p>;
  }
  if (q.isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;
  if (q.isError) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>;

  const touch = () => setDirty(true);
  const problem = compositionDraftProblem(product.id, mode, components, groups);
  const totals = kitTotals(components);
  const price = Number(product.sales_price);

  const addComponent = (rec: Picked | undefined) => {
    if (!rec) return;
    if (components.some((c) => c.component_id === rec.id)) return toast.info(`${rec.name} is already in the kit`);
    setComponents((cs) => [...cs, { component_id: rec.id, quantity: '1', name: rec.name, sku: rec.sku, sales_price: rec.sales_price, cost_price: rec.cost_price, is_active: true }]);
    touch();
  };
  const setGroup = (i: number, patch: Partial<ComboGroup>) => { setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g))); touch(); };

  const submit = async () => {
    if (problem) return toast.error(problem);
    try {
      await save.mutateAsync({ composition: mode, components, groups });
      toast.success('Contents saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Product kind" className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} disabled={!canEdit}
            onClick={() => { setMode(m.value); touch(); }}
            className={`rounded-md border p-3 text-left text-sm transition-colors ${mode === m.value ? 'border-primary bg-primary/5' : 'hover:bg-accent'} disabled:opacity-70`}>
            <span className="font-medium">{m.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{m.hint}</span>
          </button>
        ))}
      </div>

      {mode === 'kit' && (
        <section aria-label="Kit components" className="space-y-2">
          {components.map((c, i) => (
            <div key={c.component_id} className="grid grid-cols-[1fr_6rem_6rem_auto] items-center gap-2 text-sm">
              <span className="truncate">{c.name}{c.is_active === false && <span className="ml-1 text-xs text-amber-700">(archived)</span>}</span>
              <Input aria-label={`Quantity of ${c.name}`} inputMode="decimal" value={String(c.quantity)} disabled={!canEdit}
                onChange={(e) => { setComponents((cs) => cs.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x))); touch(); }} />
              <span className="text-right tabular-nums text-muted-foreground">{((Number(c.sales_price) || 0) * (Number(c.quantity) || 0)).toFixed(2)}</span>
              {canEdit ? (
                <Button variant="ghost" size="icon" aria-label={`Remove ${c.name}`} onClick={() => { setComponents((cs) => cs.filter((_, j) => j !== i)); touch(); }}><Trash2 className="h-4 w-4" /></Button>
              ) : <span />}
            </div>
          ))}
          {canEdit && (
            <EntityPicker type="product" value={null} placeholder="Add a component…" allowClear={false} excludeIds={[product.id, ...components.map((c) => c.component_id)]}
              onChange={(_id, rec) => addComponent(rec as Picked | undefined)} />
          )}
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span>Components at their prices</span><span className="tabular-nums">{totals.price.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Components' cost</span><span className="tabular-nums">{totals.cost.toFixed(2)}</span></div>
            <div className="flex justify-between font-medium"><span>Kit price (Details tab)</span><span className="tabular-nums">{price.toFixed(2)}</span></div>
            {totals.price > 0 && price > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {price < totals.price ? `The kit saves the customer ${(totals.price - price).toFixed(2)} (${Math.round(((totals.price - price) / totals.price) * 100)}%).` : 'The kit costs the customer as much as or more than the components.'}
                {totals.cost > 0 && ` Margin on the kit: ${(((price - totals.cost) / price) * 100).toFixed(1)}%.`}
              </p>
            )}
          </div>
        </section>
      )}

      {mode === 'combo' && (
        <section aria-label="Combo groups" className="space-y-3">
          {groups.map((g, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <div className="grid grid-cols-[1fr_5rem_5rem_auto] items-end gap-2">
                <div className="space-y-1"><Label htmlFor={`g-name-${i}`}>Group</Label>
                  <Input id={`g-name-${i}`} value={g.name} placeholder="Drink" disabled={!canEdit} onChange={(e) => setGroup(i, { name: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor={`g-min-${i}`}>Min</Label>
                  <Input id={`g-min-${i}`} type="number" min={0} value={g.min_choices} disabled={!canEdit} onChange={(e) => setGroup(i, { min_choices: Number(e.target.value) })} /></div>
                <div className="space-y-1"><Label htmlFor={`g-max-${i}`}>Max</Label>
                  <Input id={`g-max-${i}`} type="number" min={1} value={g.max_choices} disabled={!canEdit} onChange={(e) => setGroup(i, { max_choices: Number(e.target.value) })} /></div>
                {canEdit ? <Button variant="ghost" size="icon" aria-label={`Remove group ${g.name || i + 1}`} onClick={() => { setGroups((gs) => gs.filter((_, j) => j !== i)); touch(); }}><Trash2 className="h-4 w-4" /></Button> : <span />}
              </div>
              {g.choices.map((c, k) => (
                <div key={c.component_id} className="grid grid-cols-[1fr_6rem_auto_auto] items-center gap-2 text-sm">
                  <span className="truncate">{c.name}</span>
                  <Input aria-label={`Extra price for ${c.name}`} inputMode="decimal" value={String(c.extra_price ?? '0')} disabled={!canEdit}
                    onChange={(e) => setGroup(i, { choices: g.choices.map((x, j) => (j === k ? { ...x, extra_price: e.target.value } : x)) })} />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={!!c.is_default} disabled={!canEdit}
                      onChange={(e) => setGroup(i, { choices: g.choices.map((x, j) => (j === k ? { ...x, is_default: e.target.checked } : x)) })} /> Default
                  </label>
                  {canEdit ? <Button variant="ghost" size="icon" aria-label={`Remove ${c.name}`} onClick={() => setGroup(i, { choices: g.choices.filter((_, j) => j !== k) })}><Trash2 className="h-4 w-4" /></Button> : <span />}
                </div>
              ))}
              {canEdit && (
                <EntityPicker type="product" value={null} placeholder="Add a choice…" allowClear={false} excludeIds={[product.id, ...g.choices.map((c) => c.component_id)]}
                  onChange={(_id, rec) => {
                    const r = rec as Picked | undefined;
                    if (r) setGroup(i, { choices: [...g.choices, { component_id: r.id, name: r.name, sales_price: r.sales_price, extra_price: '0', quantity: 1 }] });
                  }} />
              )}
            </div>
          ))}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => { setGroups((gs) => [...gs, { name: '', min_choices: 1, max_choices: 1, choices: [] }]); touch(); }}>
              <Plus className="mr-1 h-3 w-3" /> Add group
            </Button>
          )}
          <p className="text-xs text-muted-foreground">The combo's own sales price is the base; each choice adds its extra price.</p>
        </section>
      )}

      {dirty && problem && <p className="text-xs text-destructive" role="alert">{problem}</p>}
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!dirty || save.isPending}>{save.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Save contents</Button>
        </div>
      )}
    </div>
  );
}
