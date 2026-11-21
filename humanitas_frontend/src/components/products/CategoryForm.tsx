import { useEffect, useState, type FormEvent } from 'react';
import { Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { EntityPicker } from '@/components/platform/EntityPicker';
import type { EntityFormProps } from '@/components/platform/entityRegistry';
import { useArchiveCategory, useCreateCategory, useProductCategories, useUpdateCategory, type ProductCategory } from '@/hooks/useProducts';

/** Ids of a category and all its descendants — none of them can become its parent. */
export function selfAndDescendants(categories: ProductCategory[], id: string): string[] {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parent_id && out.has(c.parent_id) && !out.has(c.id)) {
        out.add(c.id);
        grew = true;
      }
    }
  }
  return [...out];
}

export function CategoryForm({ mode, id, initial, onSaved, onCancel }: EntityFormProps<ProductCategory>) {
  const { hasPermission } = useAuth();
  const all = useProductCategories(true);
  const current = mode === 'edit' ? all.data?.find((c) => c.id === id) : undefined;
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const [name, setName] = useState(String(initial?.name ?? ''));
  const [parentId, setParentId] = useState<string | null>((initial?.parent_id as string | undefined) ?? null);
  const [parentLabel, setParentLabel] = useState<string | null>((initial?.parent_label as string | undefined) ?? null);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [excise, setExcise] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    setName(current.name);
    setParentId(current.parent_id);
    setParentLabel(all.data?.find((c) => c.id === current.parent_id)?.full_path ?? null);
    setCode(current.code ?? '');
    setDescription(current.description ?? '');
    setExcise(current.excise_rate != null && Number(current.excise_rate) !== 0 ? String(Number(current.excise_rate)) : '');
  }, [current, all.data]);

  const canSave = mode === 'create' ? hasPermission('create_product_categories') : hasPermission('edit_product_categories');
  const saving = create.isPending || update.isPending;
  const exclude = mode === 'edit' && id ? selfAndDescendants(all.data ?? [], id) : [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required');
    const exciseRate = excise.trim() === '' ? 0 : Number(excise);
    if (Number.isNaN(exciseRate) || exciseRate < 0 || exciseRate > 500) return setError('Excise rate must be between 0 and 500');
    setError(null);
    const input = {
      name: name.trim(), parent_id: parentId, code: code.trim() || null, description: description.trim() || null, excise_rate: exciseRate,
    };
    try {
      const saved = mode === 'create' ? await create.mutateAsync(input) : await update.mutateAsync({ id: id!, input });
      toast.success(mode === 'create' ? `Category “${saved.name}” created` : 'Category saved');
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Category form">
      <fieldset disabled={!canSave || saving} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Name *</Label>
          <Input id="c-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grains" />
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-parent">Parent category</Label>
          <EntityPicker id="c-parent" type="product_category" value={parentId} valueLabel={parentLabel} excludeIds={exclude}
            onChange={(pid, rec) => { setParentId(pid); setParentLabel((rec as ProductCategory | undefined)?.full_path ?? null); }}
            placeholder="Top level" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-code">Code</Label>
          <Input id="c-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. FOOD-GR" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-excise">Excise %</Label>
          <Input id="c-excise" inputMode="decimal" value={excise} onChange={(e) => setExcise(e.target.value)} placeholder="0" />
          <p className="text-xs text-muted-foreground">Used on e-invoices for products in this category unless a product sets its own rate.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-desc">Description</Label>
          <Textarea id="c-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div>
          {mode === 'edit' && current?.is_active && hasPermission('delete_product_categories') && (
            <Button type="button" variant="outline" disabled={archive.isPending}
              onClick={async () => {
                try { const saved = await archive.mutateAsync(current.id); toast.success('Category archived'); onSaved(saved); }
                catch (err) { toast.error(errorMessage(err)); }
              }}>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          {canSave && (
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {mode === 'create' ? 'Create category' : 'Save'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
