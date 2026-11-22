import { useState, type FormEvent } from 'react';
import { Archive, Loader2, Pencil, Plus, RotateCcw, Shapes } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import {
  useAddAttributeValue,
  useArchiveAttribute,
  useArchiveAttributeValue,
  useCreateAttribute,
  useProductAttributes,
  useUpdateAttribute,
  useUpdateAttributeValue,
  type AttributeDisplayType,
  type AttributeValue,
  type ProductAttribute,
} from '@/hooks/useProductVariants';

const DISPLAY: Record<AttributeDisplayType, string> = { pills: 'Buttons', select: 'Drop-down', color: 'Color swatches' };

/** "S, M, L" or one per line -> unique trimmed names. */
export function parseValueList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const v = raw.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export default function AttributesPage() {
  const { hasPermission } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const attributes = useProductAttributes(showArchived);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductAttribute | null>(null);
  const [editingValue, setEditingValue] = useState<{ attribute: ProductAttribute; value: AttributeValue } | null>(null);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Attributes & Variants"
        description="What products vary by (Size, Color, Material…). Pick them on a product's Variants tab to create its variants."
        actions={hasPermission('create_product_attributes') && (
          <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" /> New attribute</Button>
        )}
      />
      <label className="flex w-fit items-center gap-2 text-sm"><Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived</label>

      {attributes.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
      {attributes.isError && <p className="text-sm text-destructive">{errorMessage(attributes.error)}</p>}
      {attributes.data && !attributes.data.length && (
        <div className="flex flex-col items-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
          <Shapes className="h-8 w-8 opacity-40" /> No attributes yet.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {(attributes.data ?? []).map((a) => (
          <AttributeCard key={a.id} attribute={a} onEdit={() => setEditing(a)} onEditValue={(v) => setEditingValue({ attribute: a, value: v })} />
        ))}
      </div>

      <AttributeDialog open={creating} onOpenChange={setCreating} />
      <AttributeDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} attribute={editing ?? undefined} />
      <ValueDialog target={editingValue} onClose={() => setEditingValue(null)} />
    </div>
  );
}

function AttributeCard({ attribute: a, onEdit, onEditValue }: {
  attribute: ProductAttribute; onEdit: () => void; onEditValue: (v: AttributeValue) => void;
}) {
  const { hasPermission } = useAuth();
  const addValue = useAddAttributeValue();
  const [name, setName] = useState('');
  const canEdit = hasPermission('edit_product_attributes') && a.is_active;

  const add = async () => {
    const v = name.trim();
    if (!v) return;
    try {
      await addValue.mutateAsync({ attributeId: a.id, input: { name: v } });
      setName('');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="rounded-lg border p-4" aria-label={a.name}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            {a.name} {!a.is_active && <Badge variant="outline">Archived</Badge>}
          </h2>
          <p className="text-xs text-muted-foreground">
            {DISPLAY[a.display_type]} · used by {a.product_count} product{a.product_count === 1 ? '' : 's'}
          </p>
        </div>
        {hasPermission('edit_product_attributes') && (
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${a.name}`}><Pencil className="h-4 w-4" /></Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {a.values.map((v) => (
          <button key={v.id} type="button" disabled={!hasPermission('edit_product_attributes')} onClick={() => onEditValue(v)}
            title={`${v.variant_count ?? 0} active variant${v.variant_count === 1 ? '' : 's'}${v.code ? ` · SKU code ${v.code}` : ''}`}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-accent disabled:cursor-default ${v.is_active ? '' : 'opacity-50 line-through'}`}>
            {v.html_color && <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: v.html_color }} aria-hidden />}
            {v.name}
          </button>
        ))}
        {canEdit && (
          <Input className="h-7 w-36 text-xs" placeholder="Add value + Enter" aria-label={`Add a ${a.name} value`} value={name}
            onChange={(e) => setName(e.target.value)} disabled={addValue.isPending}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }} />
        )}
      </div>
    </section>
  );
}

function AttributeDialog({ open, onOpenChange, attribute }: { open: boolean; onOpenChange: (o: boolean) => void; attribute?: ProductAttribute }) {
  const { hasPermission } = useAuth();
  const create = useCreateAttribute();
  const update = useUpdateAttribute();
  const archive = useArchiveAttribute();
  const [name, setName] = useState('');
  const [display, setDisplay] = useState<AttributeDisplayType>('pills');
  const [values, setValues] = useState('');
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(attribute?.name ?? '');
      setDisplay(attribute?.display_type ?? 'pills');
      setValues('');
    }
  }
  const busy = create.isPending || update.isPending || archive.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (attribute) await update.mutateAsync({ id: attribute.id, input: { name: name.trim(), display_type: display } });
      else await create.mutateAsync({ name: name.trim(), display_type: display, values: parseValueList(values).map((v) => ({ name: v })) });
      toast.success(attribute ? 'Attribute saved' : `Attribute “${name.trim()}” created`);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const toggleArchive = async () => {
    if (!attribute) return;
    try {
      if (attribute.is_active) await archive.mutateAsync(attribute.id);
      else await update.mutateAsync({ id: attribute.id, input: { is_active: true } });
      toast.success(attribute.is_active ? 'Attribute archived' : 'Attribute restored');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{attribute ? `Edit ${attribute.name}` : 'New attribute'}</DialogTitle>
            <DialogDescription>e.g. Size with S, M, L or Color with Red, Blue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="attr-name">Name</Label>
            <Input id="attr-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attr-display">Shown as</Label>
            <Select value={display} onValueChange={(v) => setDisplay(v as AttributeDisplayType)}>
              <SelectTrigger id="attr-display" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DISPLAY) as AttributeDisplayType[]).map((d) => <SelectItem key={d} value={d}>{DISPLAY[d]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!attribute && (
            <div className="space-y-1.5">
              <Label htmlFor="attr-values">Values</Label>
              <Input id="attr-values" value={values} onChange={(e) => setValues(e.target.value)} placeholder="S, M, L, XL" />
              <p className="text-xs text-muted-foreground">Separate with commas. You can add more later.</p>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <div>
              {attribute && hasPermission(attribute.is_active ? 'delete_product_attributes' : 'edit_product_attributes') && (
                <Button type="button" variant="outline" onClick={toggleArchive} disabled={busy}>
                  {attribute.is_active ? <><Archive className="mr-2 h-4 w-4" /> Archive</> : <><RotateCcw className="mr-2 h-4 w-4" /> Restore</>}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {attribute ? 'Save' : 'Create attribute'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ValueDialog({ target, onClose }: { target: { attribute: ProductAttribute; value: AttributeValue } | null; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const update = useUpdateAttributeValue();
  const archive = useArchiveAttributeValue();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState('');
  const [prev, setPrev] = useState<string | null>(null);
  const id = target?.value.id ?? null;
  if (id !== prev) {
    setPrev(id);
    if (target) {
      setName(target.value.name);
      setCode(target.value.code ?? '');
      setColor(target.value.html_color ?? '');
    }
  }
  const busy = update.isPending || archive.isPending;
  if (!target) return null;
  const { attribute, value } = target;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        attributeId: attribute.id, valueId: value.id,
        input: { name: name.trim(), code: code.trim() || null, html_color: attribute.display_type === 'color' ? color || null : value.html_color },
      });
      toast.success(name.trim() !== value.name ? 'Value renamed; its variants were renamed too' : 'Value saved');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const toggleArchive = async () => {
    try {
      if (value.is_active) await archive.mutateAsync({ attributeId: attribute.id, valueId: value.id });
      else await update.mutateAsync({ attributeId: attribute.id, valueId: value.id, input: { is_active: true } });
      toast.success(value.is_active ? 'Value archived' : 'Value restored');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{attribute.name}: {value.name}</DialogTitle>
            <DialogDescription>Used by {value.variant_count ?? 0} active variant{value.variant_count === 1 ? '' : 's'}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="val-name">Name</Label>
            <Input id="val-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="val-code">SKU code</Label>
            <Input id="val-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={20} placeholder="From the name" />
            <p className="text-xs text-muted-foreground">Used in new variant SKUs, e.g. TSHIRT-{code || name.toUpperCase().replace(/[^A-Z0-9]+/g, '-') || 'RED'}.</p>
          </div>
          {attribute.display_type === 'color' && (
            <div className="space-y-1.5">
              <Label htmlFor="val-color">Color</Label>
              <div className="flex items-center gap-2">
                <input id="val-color" type="color" value={color || '#000000'} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-9 w-12 rounded border" />
                <span className="font-mono text-xs">{color || 'none'}</span>
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <div>
              {hasPermission(value.is_active ? 'delete_product_attributes' : 'edit_product_attributes') && (
                <Button type="button" variant="outline" onClick={toggleArchive} disabled={busy}>
                  {value.is_active ? <><Archive className="mr-2 h-4 w-4" /> Archive</> : <><RotateCcw className="mr-2 h-4 w-4" /> Restore</>}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={busy || !name.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
