import { useState, type FormEvent } from 'react';
import { Archive, Plus, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import {
  useArchiveUom, useCreateUom, useCreateUomCategory, useMorUnitCodes, useUoms, useUpdateUom, type Uom, type UomCategory,
} from '@/hooks/useProducts';

const NONE = '__none__';

/** MoR unit code picker (AGENTS.md rule 28): e-invoices send this code as the line unit. */
export function MorCodeSelect({ id, value, onChange, disabled }: { id?: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const codes = useMorUnitCodes();
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled}>
      <SelectTrigger id={id} className="h-7 w-28 text-xs" aria-label="MoR unit code"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No MoR code</SelectItem>
        {(codes.data ?? []).map((c) => <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function UnitMorCode({ unit, canEdit }: { unit: Uom; canEdit: boolean }) {
  const update = useUpdateUom();
  if (!canEdit) {
    return unit.mor_code
      ? <Badge variant="outline" className="font-mono text-[10px]">{unit.mor_code}</Badge>
      : <span className="text-[10px] text-amber-700">no MoR code</span>;
  }
  return (
    <MorCodeSelect value={unit.mor_code ?? ''} disabled={update.isPending}
      onChange={(v) => update.mutateAsync({ id: unit.id, input: { mor_code: v || null } })
        .then(() => toast.success(v ? `${unit.name} sends ${v} on e-invoices` : `MoR code removed from ${unit.name}`))
        .catch((e) => toast.error(errorMessage(e)))} />
  );
}

/** "1 Quintal = 100 kg" — how a unit relates to its category's reference unit. */
export function ratioText(unit: { name: string; ratio: string | number; is_reference: boolean }, reference?: { name: string }) {
  if (unit.is_reference || !reference) return 'Reference unit';
  const r = Number(unit.ratio);
  const pretty = Number.isInteger(r) ? String(r) : String(Number(r.toPrecision(8)));
  return `1 ${unit.name} = ${pretty} ${reference.name}`;
}

export default function UnitsPage() {
  const { hasPermission } = useAuth();
  const uoms = useUoms();
  const archive = useArchiveUom();
  const [addTo, setAddTo] = useState<UomCategory | null>(null);
  const [newCategory, setNewCategory] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Units of measure"
        description="Units products are sold and bought in. Each kind of unit has one reference unit, e.g. kg for weight. Units used on e-invoices need a MoR unit code."
        actions={hasPermission('create_uoms') && (
          <Button onClick={() => setNewCategory(true)}><Plus className="mr-2 h-4 w-4" /> New unit category</Button>
        )}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(uoms.data ?? []).map((cat) => {
          const ref = cat.units.find((u) => u.is_reference);
          return (
            <section key={cat.id} className="rounded-lg border p-4" aria-label={`${cat.name} units`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold"><Ruler className="h-4 w-4" /> {cat.name}</h2>
                {hasPermission('create_uoms') && (
                  <Button variant="ghost" size="sm" onClick={() => setAddTo(cat)}><Plus className="mr-1 h-3 w-3" /> Unit</Button>
                )}
              </div>
              <ul className="space-y-1 text-sm">
                {cat.units.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2">
                    <span>{u.name}{u.symbol ? ` (${u.symbol})` : ''} {u.is_reference && <Badge variant="secondary" className="ml-1">reference</Badge>}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {ratioText(u, ref)}
                      <UnitMorCode unit={u} canEdit={hasPermission('edit_uoms')} />
                      {!u.is_reference && hasPermission('delete_uoms') && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Archive ${u.name}`}
                          onClick={() => archive.mutateAsync(u.id).then(() => toast.success(`${u.name} archived`)).catch((e) => toast.error(errorMessage(e)))}>
                          <Archive className="h-3 w-3" />
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {addTo && <AddUnitDialog category={addTo} onClose={() => setAddTo(null)} />}
      {newCategory && <NewCategoryDialog onClose={() => setNewCategory(false)} />}
    </div>
  );
}

function AddUnitDialog({ category, onClose }: { category: UomCategory; onClose: () => void }) {
  const create = useCreateUom();
  const ref = category.units.find((u) => u.is_reference);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [ratio, setRatio] = useState('');
  const [morCode, setMorCode] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = Number(ratio);
    if (!name.trim() || !(r > 0)) return toast.error('Enter a name and a ratio greater than 0');
    try {
      await create.mutateAsync({ category_id: category.id, name: name.trim(), symbol: symbol.trim() || undefined, ratio: r, mor_code: morCode || undefined });
      toast.success(`${name.trim()} added`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New {category.name.toLowerCase()} unit</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="u-name">Name *</Label><Input id="u-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sack (50 kg)" /></div>
            <div className="space-y-1.5"><Label htmlFor="u-symbol">Symbol</Label><Input id="u-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-ratio">1 {name || 'unit'} = how many {ref?.name ?? 'reference units'}? *</Label>
            <Input id="u-ratio" inputMode="decimal" value={ratio} onChange={(e) => setRatio(e.target.value)} placeholder="50" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="u-mor">MoR unit code (for e-invoices)</Label>
            <MorCodeSelect id="u-mor" value={morCode} onChange={setMorCode} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Add unit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewCategoryDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateUomCategory();
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [morCode, setMorCode] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !reference.trim()) return toast.error('Enter the category and its reference unit');
    try {
      await create.mutateAsync({ name: name.trim(), reference_unit: reference.trim(), reference_mor_code: morCode || undefined });
      toast.success(`${name.trim()} created`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New unit category</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="uc-name">Category *</Label><Input id="uc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Packaging" /></div>
          <div className="space-y-1.5"><Label htmlFor="uc-ref">Reference unit *</Label><Input id="uc-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Sack" /></div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="uc-mor">MoR code of the reference unit</Label>
            <MorCodeSelect id="uc-mor" value={morCode} onChange={setMorCode} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
