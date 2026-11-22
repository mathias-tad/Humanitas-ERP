import { useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import type { Product } from '@/hooks/useProducts';
import {
  previewVariantChanges,
  useAddAttributeValue,
  useProductAttributes,
  useProductVariants,
  useSaveVariants,
  type VariantLineInput,
} from '@/hooks/useProductVariants';

/** Most variants one product may have (backend MAX_VARIANTS). */
export const MAX_VARIANTS = 300;

/** Toggle one value in a line; the line keeps the order values were picked in. */
export function toggleLineValue(lines: VariantLineInput[], attributeId: string, valueId: string): VariantLineInput[] {
  return lines.map((l) =>
    l.attribute_id !== attributeId
      ? l
      : { ...l, value_ids: l.value_ids.includes(valueId) ? l.value_ids.filter((v) => v !== valueId) : [...l.value_ids, valueId] },
  );
}

/**
 * The Variants tab of a product: pick attributes and values, see what saving will do, save, then
 * open each variant to give it a barcode, SKU, cost or price extra.
 */
export function VariantsPanel({ product }: { product: Product }) {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const config = useProductVariants(product.id);
  const attributes = useProductAttributes();
  const save = useSaveVariants();
  const addValue = useAddAttributeValue();
  const [lines, setLines] = useState<VariantLineInput[]>([]);
  const [newValue, setNewValue] = useState<Record<string, string>>({});
  const canEdit = hasPermission('edit_products') && product.is_active;
  const canAddValues = hasPermission('edit_product_attributes');

  useEffect(() => {
    if (config.data) setLines(config.data.attributes.map((a) => ({ attribute_id: a.attribute_id, value_ids: a.values.map((v) => v.id) })));
  }, [config.data]);

  const variants = config.data?.variants ?? [];
  const preview = useMemo(() => previewVariantChanges(lines, variants), [lines, variants]);
  const savedKey = JSON.stringify(config.data?.attributes.map((a) => [a.attribute_id, a.values.map((v) => v.id).sort()]) ?? []);
  const currentKey = JSON.stringify(lines.map((l) => [l.attribute_id, [...l.value_ids].sort()]));
  const dirty = savedKey !== currentKey;
  const unused = (attributes.data ?? []).filter((a) => !lines.some((l) => l.attribute_id === a.id));
  const tooMany = preview.total > MAX_VARIANTS;
  const emptyLine = lines.some((l) => !l.value_ids.length);
  const blockedByBarcodes = !variants.length && lines.length > 0 && (product.barcodes ?? []).length > 0;

  if (config.isLoading || attributes.isLoading) {
    return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (config.isError) return <p className="py-8 text-sm text-destructive">{errorMessage(config.error)}</p>;

  const submit = async () => {
    try {
      const res = await save.mutateAsync({ productId: product.id, attributes: lines });
      const s = res.summary;
      const parts = s ? [s.created && `${s.created} created`, s.archived && `${s.archived} archived`, s.restored && `${s.restored} restored`].filter(Boolean) : [];
      toast.success(parts.length ? `Variants saved: ${parts.join(', ')}` : 'Variants saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const createValue = async (attributeId: string) => {
    const name = (newValue[attributeId] ?? '').trim();
    if (!name) return;
    try {
      const v = await addValue.mutateAsync({ attributeId, input: { name } });
      setNewValue((s) => ({ ...s, [attributeId]: '' }));
      setLines((ls) => toggleLineValue(ls, attributeId, v.id));
      toast.success(`“${v.name}” added`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const summaryText = [
    preview.create && `create ${preview.create}`,
    preview.restore && `restore ${preview.restore}`,
    preview.archive && `archive ${preview.archive}`,
  ].filter(Boolean).join(', ');

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Pick what this product varies by. Each combination becomes its own variant with its own SKU, barcodes, price extra
        and stock; this product keeps the shared details.
      </p>

      <div className="space-y-3">
        {lines.map((line) => {
          const attr = (attributes.data ?? []).find((a) => a.id === line.attribute_id)
            ?? config.data?.attributes.find((a) => a.attribute_id === line.attribute_id);
          const name = attr?.name ?? 'Attribute';
          const values = attributes.data?.find((a) => a.id === line.attribute_id)?.values
            ?? config.data?.attributes.find((a) => a.attribute_id === line.attribute_id)?.values ?? [];
          return (
            <section key={line.attribute_id} className="rounded-md border p-3" aria-label={`${name} values`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{name}</span>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${name}`}
                    onClick={() => setLines((ls) => ls.filter((l) => l.attribute_id !== line.attribute_id))}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {values.map((v) => {
                  const on = line.value_ids.includes(v.id);
                  return (
                    <button key={v.id} type="button" disabled={!canEdit} aria-pressed={on}
                      onClick={() => setLines((ls) => toggleLineValue(ls, line.attribute_id, v.id))}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-60 ${on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                      {v.html_color && <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: v.html_color }} aria-hidden />}
                      {v.name}
                    </button>
                  );
                })}
                {canEdit && canAddValues && (
                  <Input className="h-7 w-36 text-xs" placeholder="New value + Enter" aria-label={`New ${name} value`}
                    value={newValue[line.attribute_id] ?? ''}
                    onChange={(e) => setNewValue((s) => ({ ...s, [line.attribute_id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void createValue(line.attribute_id);
                      }
                    }} />
                )}
              </div>
              {!line.value_ids.length && <p className="mt-2 text-xs text-destructive">Choose at least one {name} value.</p>}
            </section>
          );
        })}

        {canEdit && unused.length > 0 && (
          <Select value="" onValueChange={(id) => setLines((ls) => [...ls, { attribute_id: id, value_ids: [] }])}>
            <SelectTrigger className="w-60" aria-label="Add attribute"><Plus className="mr-1 h-4 w-4" /><SelectValue placeholder="Add attribute (Size, Color…)" /></SelectTrigger>
            <SelectContent>
              {unused.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {!lines.length && !variants.length && (
          <p className="text-sm text-muted-foreground">This product has no variants. Add an attribute to create them.</p>
        )}
      </div>

      {blockedByBarcodes && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Each variant gets its own barcode. Remove this product's barcodes on the Details tab first, then add one to each variant.
        </p>
      )}
      {tooMany && <p className="text-xs text-destructive">That makes {preview.total} variants; the limit is {MAX_VARIANTS}. Choose fewer values.</p>}

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {dirty ? `${preview.total} variant${preview.total === 1 ? '' : 's'}${summaryText ? `: will ${summaryText}` : ''}` : 'No changes'}
          </span>
          <Button type="button" onClick={submit} disabled={!dirty || save.isPending || tooMany || emptyLine || blockedByBarcodes}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save variants
          </Button>
        </div>
      )}

      {variants.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead className="text-right">Extra</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" tabIndex={0}
                  onClick={() => drawer.open({ type: 'product', mode: 'edit', id: v.id, title: 'Variant' })}
                  onKeyDown={(e) => e.key === 'Enter' && drawer.open({ type: 'product', mode: 'edit', id: v.id, title: 'Variant' })}>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {v.variant_label ?? v.name}
                      {!v.is_active && <Badge variant="outline">Archived</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{v.sku ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{v.barcodes?.find((b) => b.is_primary)?.barcode ?? <span className="text-amber-700">none</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(v.price_extra) ? `${Number(v.price_extra) > 0 ? '+' : ''}${Number(v.price_extra).toFixed(2)}` : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(v.sales_price).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
