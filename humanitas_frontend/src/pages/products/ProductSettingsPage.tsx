import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EntityPicker } from '@/components/platform/EntityPicker';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import '@/components/products/registerProductEntities';
import { EIMS_TAX_CODE_LABELS, useUoms, type EimsTaxCode, type ProductType } from '@/hooks/useProducts';
import { ean13Preview, skuPreview, useProductSettings, useSaveProductSettings, type ProductSettings } from '@/hooks/useProductExtras';

const NONE = '__none__';

/** Products -> Product Settings: numbering, defaults for new products and what every product must have. */
export default function ProductSettingsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('edit_product_settings');
  const q = useProductSettings();
  const save = useSaveProductSettings();
  const uoms = useUoms().data ?? [];
  const [s, setS] = useState<ProductSettings | null>(null);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  const set = <K extends keyof ProductSettings>(k: K, v: ProductSettings[K]) => setS((x) => (x ? { ...x, [k]: v } : x));

  if (q.isLoading || !s) {
    return <div className="p-6">{q.isError ? <p className="text-sm text-destructive">{errorMessage(q.error)}</p> : <Loader2 className="h-4 w-4 animate-spin" />}</div>;
  }
  const barcodePreview = ean13Preview(s.barcode_prefix, Number(s.barcode_next));
  const inStore = /^2\d/.test(s.barcode_prefix);

  const submit = async () => {
    try {
      const { next_sku_preview: _a, next_barcode_preview: _b, default_uom_name: _c, default_category_name: _d, ...input } = s;
      await save.mutateAsync({ ...input, sku_padding: Number(input.sku_padding), sku_next: Number(input.sku_next), barcode_next: Number(input.barcode_next) });
      toast.success('Product settings saved');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Product Settings" description="How new products are numbered and filled in, and what every product must have." />
      <fieldset disabled={!canEdit || save.isPending} className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-lg border p-4" aria-label="SKU numbering">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Automatic SKUs</h2>
            <Switch aria-label="Automatic SKUs" checked={s.sku_mode === 'auto'} onCheckedChange={(v) => set('sku_mode', v ? 'auto' : 'manual')} />
          </div>
          <p className="text-xs text-muted-foreground">New products without a SKU get the next number. Numbers already typed by hand are skipped.</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label htmlFor="s-sku-prefix">Prefix</Label><Input id="s-sku-prefix" maxLength={10} value={s.sku_prefix} onChange={(e) => set('sku_prefix', e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="s-sku-pad">Digits</Label><Input id="s-sku-pad" type="number" min={1} max={12} value={s.sku_padding} onChange={(e) => set('sku_padding', Number(e.target.value))} /></div>
            <div className="space-y-1"><Label htmlFor="s-sku-next">Next number</Label><Input id="s-sku-next" type="number" min={1} value={String(s.sku_next)} onChange={(e) => set('sku_next', e.target.value)} /></div>
          </div>
          <p className="text-sm">Next SKU: <span className="font-mono">{skuPreview(s.sku_prefix, Number(s.sku_padding), Number(s.sku_next))}</span></p>
        </section>

        <section className="space-y-3 rounded-lg border p-4" aria-label="Barcode numbering">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Automatic barcodes</h2>
            <Switch aria-label="Automatic barcodes" checked={s.barcode_mode === 'ean13'} onCheckedChange={(v) => set('barcode_mode', v ? 'ean13' : 'manual')} />
          </div>
          <p className="text-xs text-muted-foreground">
            Goods with no barcode get an EAN-13, and so does each new variant. Prefixes 20–29 are GS1's in-store range and never clash with a maker's barcode;
            a GS1 member can use its own company prefix.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="s-bc-prefix">Prefix</Label><Input id="s-bc-prefix" inputMode="numeric" maxLength={10} value={s.barcode_prefix} onChange={(e) => set('barcode_prefix', e.target.value.replace(/\D/g, ''))} /></div>
            <div className="space-y-1"><Label htmlFor="s-bc-next">Next number</Label><Input id="s-bc-next" type="number" min={1} value={String(s.barcode_next)} onChange={(e) => set('barcode_next', e.target.value)} /></div>
          </div>
          <p className="text-sm">Next barcode: <span className="font-mono">{barcodePreview ?? 'does not fit: use a shorter prefix'}</span></p>
          {s.barcode_mode === 'ean13' && !inStore && s.barcode_prefix.length < 6 && (
            <p className="text-xs text-amber-700">Use 20–29 for in-store barcodes, or your full GS1 company prefix (6 digits or more).</p>
          )}
        </section>

        <section className="space-y-3 rounded-lg border p-4" aria-label="Defaults for new products">
          <h2 className="text-base font-semibold">Defaults for new products</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="s-type">Type</Label>
              <Select value={s.default_product_type} onValueChange={(v) => set('default_product_type', v as ProductType)}>
                <SelectTrigger id="s-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="storable">Stock item</SelectItem>
                  <SelectItem value="consumable">Consumable</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-tax">Tax</Label>
              <Select value={s.default_tax_code} onValueChange={(v) => set('default_tax_code', v)}>
                <SelectTrigger id="s-tax"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(EIMS_TAX_CODE_LABELS) as EimsTaxCode[]).map((c) => <SelectItem key={c} value={c}>{EIMS_TAX_CODE_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-uom">Unit</Label>
              <Select value={s.default_uom_id ?? NONE} onValueChange={(v) => set('default_uom_id', v === NONE ? null : v)}>
                <SelectTrigger id="s-uom"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Units (standard)</SelectItem>
                  {uoms.map((c) => (
                    <SelectGroup key={c.id}>
                      <SelectLabel>{c.name}</SelectLabel>
                      {c.units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="s-cat">Category</Label>
              <EntityPicker id="s-cat" type="product_category" value={s.default_category_id} valueLabel={s.default_category_name}
                onChange={(id, rec) => setS((x) => (x ? { ...x, default_category_id: id, default_category_name: (rec as { full_path?: string } | undefined)?.full_path ?? null } : x))}
                placeholder="None" />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border p-4" aria-label="Rules">
          <h2 className="text-base font-semibold">Every product must have</h2>
          <label className="flex items-center justify-between gap-3 text-sm"><span>A category</span>
            <Switch checked={s.require_category} onCheckedChange={(v) => set('require_category', v)} /></label>
          <label className="flex items-center justify-between gap-3 text-sm"><span>A barcode (goods; automatic barcodes count)</span>
            <Switch checked={s.require_barcode} onCheckedChange={(v) => set('require_barcode', v)} /></label>
          <label className="flex items-center justify-between gap-3 text-sm"><span>Warn when the price is below cost</span>
            <Switch checked={s.warn_below_cost} onCheckedChange={(v) => set('warn_below_cost', v)} /></label>
        </section>
      </fieldset>
      {canEdit && (
        <Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save settings</Button>
      )}
    </div>
  );
}
