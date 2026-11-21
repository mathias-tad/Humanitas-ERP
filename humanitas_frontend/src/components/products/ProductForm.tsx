import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Archive, BadgeCheck, Camera, Loader2, Plus, ReceiptText, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { EntityPicker } from '@/components/platform/EntityPicker';
import { BarcodeScanDialog } from '@/components/platform/BarcodeScanDialog';
import { TimelinePanel } from '@/components/platform/TimelinePanel';
import type { EntityFormProps } from '@/components/platform/entityRegistry';
import {
  EIMS_ISSUE_TEXT, EIMS_TAX_CODE_LABELS, EIMS_TAX_CODES,
  useArchiveProduct, useCreateProduct, useProduct, useRestoreProduct, useUoms, useUpdateProduct,
  type EimsTaxCode, type Product, type ProductBarcode, type ProductInput, type ProductType, type UomCategory,
} from '@/hooks/useProducts';

/** MoR limits (AGENTS.md rule 28; backend products.eims.ts). */
export const ITEM_CODE_RE = /^[A-Za-z0-9._/-]{1,15}$/;
export const HS_CODE_RE = /^[0-9A-Za-z.]{2,15}$/;
export const MOR_DESCRIPTION_MAX = 100;

const TYPES: { value: ProductType; label: string; hint: string }[] = [
  { value: 'storable', label: 'Stock item', hint: 'Quantities are tracked in inventory' },
  { value: 'consumable', label: 'Consumable', hint: 'Bought and sold, stock not tracked' },
  { value: 'service', label: 'Service', hint: 'Work or time, never stocked' },
];

interface FormState {
  name: string;
  sku: string;
  product_type: ProductType;
  category_id: string | null;
  category_name: string | null;
  uom_id: string;
  purchase_uom_id: string;
  sales_price: string;
  cost_price: string;
  tax_code: EimsTaxCode;
  item_code: string;
  harmonization_code: string;
  /** '' = use the category's excise rate */
  excise_rate: string;
  invoice_description: string;
  can_be_sold: boolean;
  can_be_purchased: boolean;
  description: string;
  barcodes: ProductBarcode[];
}

export function emptyProductForm(initial?: Record<string, unknown>): FormState {
  return {
    name: String(initial?.name ?? ''), sku: '', product_type: 'consumable', category_id: null, category_name: null,
    uom_id: '', purchase_uom_id: '', sales_price: '', cost_price: '', tax_code: 'VAT15', item_code: '',
    harmonization_code: '', excise_rate: '', invoice_description: '', can_be_sold: true,
    can_be_purchased: true, description: '',
    // A barcode scanned on the Products page that matched nothing starts the new product.
    barcodes: initial?.barcode ? [{ barcode: String(initial.barcode).trim(), quantity: 1, is_primary: true }] : [],
  };
}

/** Add a scanned code: fills an empty barcode row first; the first barcode becomes primary. */
export function addScannedBarcode(list: ProductBarcode[], code: string): { barcodes: ProductBarcode[]; duplicate: boolean } {
  const c = code.trim();
  if (!c) return { barcodes: list, duplicate: false };
  if (list.some((b) => b.barcode.trim() === c)) return { barcodes: list, duplicate: true };
  const empty = list.findIndex((b) => !b.barcode.trim());
  if (empty >= 0) return { barcodes: list.map((b, i) => (i === empty ? { ...b, barcode: c } : b)), duplicate: false };
  return { barcodes: [...list, { barcode: c, quantity: 1, is_primary: list.length === 0 }], duplicate: false };
}

export function productToForm(p: Product): FormState {
  return {
    name: p.name, sku: p.sku ?? '', product_type: p.product_type, category_id: p.category_id, category_name: p.category_name,
    uom_id: p.uom_id, purchase_uom_id: p.purchase_uom_id, sales_price: String(Number(p.sales_price)),
    cost_price: String(Number(p.cost_price)), tax_code: p.tax_code ?? 'VAT15', item_code: p.item_code ?? '',
    harmonization_code: p.harmonization_code ?? '', excise_rate: p.excise_rate === null || p.excise_rate === undefined ? '' : String(Number(p.excise_rate)),
    invoice_description: p.invoice_description ?? '',
    can_be_sold: p.can_be_sold, can_be_purchased: p.can_be_purchased, description: p.description ?? '',
    barcodes: (p.barcodes ?? []).map((b) => ({ barcode: b.barcode, packaging: b.packaging ?? '', quantity: Number(b.quantity ?? 1), is_primary: !!b.is_primary })),
  };
}

/** Client-side checks; the API validates again. Returns field → message. */
export function validateProductForm(f: FormState, uoms: UomCategory[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Name is required';
  if (f.sku && !/^[A-Za-z0-9._\-/]+$/.test(f.sku.trim())) errors.sku = 'Letters, digits, . _ - / only';
  for (const key of ['sales_price', 'cost_price'] as const) {
    if (f[key] !== '' && (Number.isNaN(Number(f[key])) || Number(f[key]) < 0)) errors[key] = 'Must be 0 or more';
  }
  if (!(f.tax_code in EIMS_TAX_CODES)) errors.tax_code = 'Choose a tax code';
  if (f.item_code.trim() && !ITEM_CODE_RE.test(f.item_code.trim())) errors.item_code = 'Up to 15 letters, digits, . _ - /';
  if (f.harmonization_code.trim() && !HS_CODE_RE.test(f.harmonization_code.trim())) errors.harmonization_code = '2 to 15 digits';
  if (f.excise_rate !== '' && (Number.isNaN(Number(f.excise_rate)) || Number(f.excise_rate) < 0 || Number(f.excise_rate) > 500)) {
    errors.excise_rate = 'Between 0 and 500';
  }
  if (f.invoice_description.trim().length > MOR_DESCRIPTION_MAX) errors.invoice_description = `At most ${MOR_DESCRIPTION_MAX} characters`;
  if (f.uom_id && f.purchase_uom_id) {
    const cat = (id: string) => uoms.find((c) => c.units.some((u) => u.id === id))?.id;
    if (cat(f.uom_id) !== cat(f.purchase_uom_id)) errors.purchase_uom_id = 'Must be the same kind of unit as the sales unit';
  }
  const codes = f.barcodes.map((b) => b.barcode.trim()).filter(Boolean);
  if (new Set(codes).size !== codes.length) errors.barcodes = 'Each barcode can be listed only once';
  if (f.barcodes.some((b) => /\s/.test(b.barcode.trim()))) errors.barcodes = 'Barcodes cannot contain spaces';
  return errors;
}

export function formToInput(f: FormState): ProductInput {
  const num = (s: string) => (s === '' ? undefined : Number(s));
  return {
    name: f.name.trim(),
    sku: f.sku.trim() || null,
    product_type: f.product_type,
    category_id: f.category_id,
    uom_id: f.uom_id || undefined,
    purchase_uom_id: f.purchase_uom_id || undefined,
    sales_price: num(f.sales_price) ?? 0,
    cost_price: num(f.cost_price) ?? 0,
    tax_code: f.tax_code,
    // Empty on create: the server generates one, so the product can be e-invoiced at once.
    item_code: f.item_code.trim() || undefined,
    harmonization_code: f.harmonization_code.trim() || null,
    excise_rate: f.excise_rate === '' ? null : Number(f.excise_rate),
    invoice_description: f.invoice_description.trim() || null,
    can_be_sold: f.can_be_sold,
    can_be_purchased: f.can_be_purchased,
    description: f.description.trim() || null,
    barcodes: f.barcodes
      .filter((b) => b.barcode.trim())
      .map((b) => ({ barcode: b.barcode.trim(), packaging: b.packaging || undefined, quantity: Number(b.quantity) || 1, is_primary: !!b.is_primary })),
  };
}

function UnitSelect({ id, value, onChange, uoms, onlyCategoryOf, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; uoms: UomCategory[]; onlyCategoryOf?: string; placeholder: string;
}) {
  const groups = onlyCategoryOf ? uoms.filter((c) => c.units.some((u) => u.id === onlyCategoryOf)) : uoms;
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {groups.map((c) => (
          <SelectGroup key={c.id}>
            <SelectLabel>{c.name}</SelectLabel>
            {c.units.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}{u.symbol ? ` (${u.symbol})` : ''}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Create/edit form for products — used in the record drawer from any page (featureslist §29). */
export function ProductForm({ mode, id, initial, onSaved, onCancel }: EntityFormProps<Product>) {
  const { hasPermission } = useAuth();
  const product = useProduct(mode === 'edit' ? id : undefined);
  const uomsQ = useUoms();
  const uoms = uomsQ.data ?? [];
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const archive = useArchiveProduct();
  const restore = useRestoreProduct();
  const [f, setF] = useState<FormState>(() => emptyProductForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && product.data) setF(productToForm(product.data));
  }, [mode, product.data]);

  const canEdit = mode === 'create' ? hasPermission('create_products') : hasPermission('edit_products');
  const saving = create.isPending || update.isPending;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const purchaseOptionsFor = useMemo(() => f.uom_id || undefined, [f.uom_id]);
  const selectedUnit = useMemo(() => {
    const all = uoms.flatMap((c) => c.units);
    return all.find((u) => u.id === f.uom_id) ?? (f.uom_id ? undefined : all.find((u) => u.is_reference && u.name === 'Units'));
  }, [uoms, f.uom_id]);
  const categoryExcise = mode === 'edit' && product.data?.category_id === f.category_id && product.data?.category_excise_rate != null
    ? Number(product.data.category_excise_rate) : null;

  if (mode === 'edit' && product.isLoading) {
    return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (mode === 'edit' && product.isError) return <p className="py-8 text-sm text-destructive">{errorMessage(product.error)}</p>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateProductForm(f, uoms);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const input = formToInput(f);
      const saved = mode === 'create' ? await create.mutateAsync(input) : await update.mutateAsync({ id: id!, input });
      toast.success(mode === 'create' ? `Product “${saved.name}” created` : 'Product saved');
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const toggleActive = async () => {
    if (!product.data) return;
    try {
      const saved = product.data.is_active ? await archive.mutateAsync(product.data.id) : await restore.mutateAsync(product.data.id);
      toast.success(saved.is_active ? 'Product restored' : 'Product archived');
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onScanned = (code: string) => {
    if (addScannedBarcode(f.barcodes, code).duplicate) {
      toast.info(`${code} is already on this product`);
      return;
    }
    setF((s) => ({ ...s, barcodes: addScannedBarcode(s.barcodes, code).barcodes }));
    toast.success(`Barcode ${code} added`);
  };

  const fieldError = (k: string) => errors[k] && <p className="text-xs text-destructive" role="alert">{errors[k]}</p>;

  const details = (
    <form onSubmit={submit} className="space-y-4" aria-label="Product form">
      <fieldset disabled={!canEdit || saving} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Name *</Label>
          <Input id="p-name" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Teff flour 1 kg" />
          {fieldError('name')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-sku">SKU</Label>
            <Input id="p-sku" value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="TEFF-1KG" />
            {fieldError('sku')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-type">Type</Label>
            <Select value={f.product_type} onValueChange={(v) => set('product_type', v as ProductType)}>
              <SelectTrigger id="p-type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{TYPES.find((t) => t.value === f.product_type)?.hint}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-category">Category</Label>
          <EntityPicker
            id="p-category"
            type="product_category"
            value={f.category_id}
            valueLabel={f.category_name}
            onChange={(cid, rec) => setF((s) => ({ ...s, category_id: cid, category_name: (rec as { full_path?: string } | undefined)?.full_path ?? null }))}
            placeholder="No category"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-uom">Sales unit</Label>
            <UnitSelect id="p-uom" value={f.uom_id} uoms={uoms} placeholder="Units (default)"
              onChange={(v) => setF((s) => ({ ...s, uom_id: v, purchase_uom_id: '' }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-puom">Purchase unit</Label>
            <UnitSelect id="p-puom" value={f.purchase_uom_id} uoms={uoms} onlyCategoryOf={purchaseOptionsFor} placeholder="Same as sales unit"
              onChange={(v) => set('purchase_uom_id', v)} />
            {fieldError('purchase_uom_id')}
          </div>
        </div>
        {selectedUnit && !selectedUnit.mor_code && (
          <p className="text-xs text-amber-700">“{selectedUnit.name}” has no MoR unit code yet, so e-invoices can't use it. Set one under Units of Measure.</p>
        )}
        <div className="grid grid-cols-3 gap-3">
          {([['sales_price', 'Sales price'], ['cost_price', 'Cost']] as const).map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`p-${k}`}>{label}</Label>
              <Input id={`p-${k}`} inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder="0" />
              {fieldError(k)}
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="p-tax">Tax</Label>
            <Select value={f.tax_code} onValueChange={(v) => set('tax_code', v as EimsTaxCode)}>
              <SelectTrigger id="p-tax" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(EIMS_TAX_CODE_LABELS) as EimsTaxCode[]).map((c) => (
                  <SelectItem key={c} value={c}>{EIMS_TAX_CODE_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError('tax_code')}
          </div>
        </div>
        <section className="space-y-3 rounded-md border p-3" aria-label="E-invoicing (MoR)">
          <div className="flex items-center gap-2 text-sm font-medium"><ReceiptText className="h-4 w-4" /> E-invoicing (MoR)</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-item-code">Item code</Label>
              <Input id="p-item-code" maxLength={15} value={f.item_code} onChange={(e) => set('item_code', e.target.value)}
                placeholder={mode === 'create' ? 'Generated if empty' : ''} />
              {fieldError('item_code')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-hs">HS code</Label>
              <Input id="p-hs" maxLength={15} inputMode="numeric" value={f.harmonization_code}
                onChange={(e) => set('harmonization_code', e.target.value)} placeholder="Needed for exports" />
              {fieldError('harmonization_code')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-excise">Excise %</Label>
              <Input id="p-excise" inputMode="decimal" value={f.excise_rate} onChange={(e) => set('excise_rate', e.target.value)}
                placeholder={categoryExcise !== null ? `Category: ${categoryExcise}%` : 'From category'} />
              {fieldError('excise_rate')}
            </div>
            <div className="space-y-1.5">
              <Label>Supply type</Label>
              <p className="pt-2 text-sm text-muted-foreground">{f.product_type === 'service' ? 'Service' : 'Goods'} (from the product type)</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-inv-desc">Invoice description</Label>
            <Input id="p-inv-desc" maxLength={MOR_DESCRIPTION_MAX} value={f.invoice_description}
              onChange={(e) => set('invoice_description', e.target.value)} placeholder="Defaults to the product name" />
            {fieldError('invoice_description')}
            {!f.invoice_description.trim() && f.name.trim().length > MOR_DESCRIPTION_MAX && (
              <p className="text-xs text-amber-700">The name is over {MOR_DESCRIPTION_MAX} characters, which MoR won't accept. Add a shorter invoice description.</p>
            )}
          </div>
        </section>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.can_be_sold} onCheckedChange={(v) => set('can_be_sold', v)} /> Can be sold</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.can_be_purchased} onCheckedChange={(v) => set('can_be_purchased', v)} /> Can be purchased</label>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Barcodes</Label>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setScanOpen(true)}>
                <Camera className="mr-1 h-3 w-3" /> Scan with camera
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => set('barcodes', [...f.barcodes, { barcode: '', quantity: 1, is_primary: f.barcodes.length === 0 }])}>
                <Plus className="mr-1 h-3 w-3" /> Add barcode
              </Button>
            </div>
          </div>
          <BarcodeScanDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onScanned} title="Scan the product's barcode" />
          {f.barcodes.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_4.5rem_auto_auto] items-center gap-2">
              <Input aria-label={`Barcode ${i + 1}`} value={b.barcode} placeholder="Scan or type"
                onChange={(e) => set('barcodes', f.barcodes.map((x, j) => (j === i ? { ...x, barcode: e.target.value } : x)))} />
              <Input aria-label={`Packaging ${i + 1}`} value={b.packaging ?? ''} placeholder="Unit / Box"
                onChange={(e) => set('barcodes', f.barcodes.map((x, j) => (j === i ? { ...x, packaging: e.target.value } : x)))} />
              <Input aria-label={`Quantity ${i + 1}`} inputMode="decimal" value={String(b.quantity ?? 1)}
                onChange={(e) => set('barcodes', f.barcodes.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
              <label className="flex items-center gap-1 text-xs">
                <input type="radio" name="primary-barcode" checked={!!b.is_primary}
                  onChange={() => set('barcodes', f.barcodes.map((x, j) => ({ ...x, is_primary: j === i })))} /> Primary
              </label>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove barcode ${i + 1}`}
                onClick={() => set('barcodes', f.barcodes.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {fieldError('barcodes')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-desc">Description</Label>
          <Textarea id="p-desc" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div>
          {mode === 'edit' && product.data && (product.data.is_active ? hasPermission('delete_products') : hasPermission('restore_products')) && (
            <Button type="button" variant="outline" onClick={toggleActive} disabled={archive.isPending || restore.isPending}>
              {product.data.is_active ? <><Archive className="mr-2 h-4 w-4" /> Archive</> : <><RotateCcw className="mr-2 h-4 w-4" /> Restore</>}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          {canEdit && (
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {mode === 'create' ? 'Create product' : 'Save'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );

  if (mode === 'create') return details;
  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="pt-4">
        {product.data && <EimsStatus product={product.data} />}
        {product.data && !product.data.is_active && (
          <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">This product is archived — hidden from lists and scanners.</p>
        )}
        {details}
      </TabsContent>
      <TabsContent value="history" className="pt-4">
        <TimelinePanel path={`/products/${id}/timeline`} />
      </TabsContent>
    </Tabs>
  );
}

/** Whether MoR would accept this product on an e-invoice, and what to fix (rule 28). */
export function EimsStatus({ product }: { product: Pick<Product, 'eims_ready' | 'eims_issues'> }) {
  if (product.eims_ready) {
    return (
      <p className="mb-3 flex items-center gap-2 text-xs text-emerald-700"><BadgeCheck className="h-4 w-4" /> Ready for e-invoicing</p>
    );
  }
  return (
    <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
      <p className="flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" /> Not ready for e-invoicing</p>
      <ul className="ml-6 list-disc">{(product.eims_issues ?? []).map((i) => <li key={i}>{EIMS_ISSUE_TEXT[i] ?? i}</li>)}</ul>
    </div>
  );
}
