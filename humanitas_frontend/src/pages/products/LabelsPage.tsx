import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Archive, Camera, Loader2, Pencil, Plus, Printer, QrCode, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { api } from '@/lib/api';
import { BarcodeScanDialog } from '@/components/platform/BarcodeScanDialog';
import { CompanyBranchSelect } from '@/components/platform/CompanyBranchSelect';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useShortcuts, shortcutHint } from '@/lib/shortcuts';
import { ProductLabel } from '@/components/products/ProductLabel';
import { lookupProduct, scopeKey, searchProducts, toQueryString, useProductCategories, type Paged, type Product } from '@/hooks/useProducts';
import { usePriceLists } from '@/hooks/usePriceLists';
import { defaultCompanyFor, useCompanyScope } from '@/hooks/useCompanyScope';
import { useArchiveLabelTemplate, useLabelPrices, useLabelTemplates, useSaveLabelTemplate } from '@/hooks/useLabels';
import {
  MAX_LABELS, NEW_TEMPLATE, expandLabels, labelCode, labelNames, labelsPerPage, layoutProblem, pageSize, paginate, slotPosition,
  type LabelBarcodeFormat, type LabelItem, type LabelTemplate, type LabelTemplateInput,
} from '@/lib/labels';

const DEFAULT_LIST = '__default__';
const PX_PER_MM = 3.7795;

/** Products a print list gets for one product: a product with variants brings its variants. */
async function sellable(p: Product): Promise<Product[]> {
  if (!p.has_variants) return [p];
  const res = await api.get<Paged<Product>>(`/products${toQueryString({ parent_id: p.id, kind: 'all', status: 'active', limit: 200 })}`);
  return res.data;
}

function activeCompanyIds(): string[] {
  const raw = scopeKey()[0];
  if (!raw) return [];
  try {
    return raw.startsWith('[') ? (JSON.parse(raw) as string[]) : raw.split(',').filter(Boolean);
  } catch {
    return [];
  }
}

/** Products -> Barcode & Price Labels (featureslist §1): pick products, choose a template, print. */
export default function LabelsPage() {
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const templates = useLabelTemplates();
  const categories = useProductCategories();
  const canSeeLists = hasPermission('view_price_lists');
  const priceLists = usePriceLists();
  const scope = useCompanyScope();
  const [items, setItems] = useState<LabelItem[]>([]);
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [listChoice, setListChoice] = useState<string | undefined>();
  const [editing, setEditing] = useState<LabelTemplate | 'new' | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const archive = useArchiveLabelTemplate();

  const template = (templates.data ?? []).find((t) => t.id === templateId) ?? templates.data?.[0];
  useEffect(() => {
    if (!templateId && templates.data?.length) setTemplateId(templates.data[0].id);
  }, [templates.data, templateId]);

  const add = async (found: Product[], copies = 1) => {
    const expanded = (await Promise.all(found.map(sellable))).flat();
    if (!expanded.length) return toast.info('Nothing to add.');
    setItems((cur) => {
      const next = [...cur];
      for (const p of expanded) {
        const at = next.findIndex((i) => i.product.id === p.id);
        if (at >= 0) next[at] = { ...next[at], copies: next[at].copies + copies };
        else next.push({ product: p, copies });
      }
      return next;
    });
  };
  const addSafely = (found: Product[], copies = 1) => add(found, copies).catch((e) => toast.error(errorMessage(e)));

  // ?product=<id> from the Products page.
  const preloaded = useRef(false);
  useEffect(() => {
    const id = searchParams.get('product');
    if (!id || preloaded.current) return;
    preloaded.current = true;
    api.get<Product>(`/products/${id}`).then((p) => addSafely([p])).catch((e) => toast.error(errorMessage(e)));
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScanned = async (code: string) => {
    try {
      const p = await lookupProduct(code);
      if (!p) return toast.error(`No product has the barcode ${code}.`);
      await add([p]);
      toast.success(`${p.name} added`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  useBarcodeScanner(onScanned);

  const addCategory = async (categoryId: string) => {
    try {
      const res = await api.get<Paged<Product>>(`/products${toQueryString({ category_id: categoryId, kind: 'sellable', status: 'active', limit: 200 })}`);
      await add(res.data);
      if (res.meta.total > res.data.length) toast.info(`Added the first ${res.data.length} of ${res.meta.total} products in this category.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const priceListId = listChoice === undefined ? template?.price_list_id ?? null : listChoice === DEFAULT_LIST ? null : listChoice;
  const prices = useLabelPrices(items.map((i) => i.product.id), priceListId, !!template?.show_price);
  const labels = useMemo(() => expandLabels(items, prices.data?.prices), [items, prices.data]);
  const totalCopies = items.reduce((s, i) => s + Math.max(0, Math.floor(i.copies)), 0);
  const currency = prices.data?.currency ?? 'ETB';
  const company = useMemo(() => {
    const id = defaultCompanyFor(scope.data, activeCompanyIds());
    return scope.data?.companies.find((c) => c.id === id)?.name ?? null;
  }, [scope.data]);
  const problem = template ? layoutProblem(template) : null;
  const pages = template ? paginate(labels, labelsPerPage(template)) : [];
  const canPrint = !!template && !problem && labels.length > 0;

  const print = () => {
    if (!canPrint) return;
    setPrinting(true);
  };
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    const t = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  useShortcuts([
    { keys: 'p', description: 'Print labels', group: 'Labels', run: print },
    { keys: 's', description: 'Scan with the camera', group: 'Labels', run: () => setScanOpen(true) },
    ...(hasPermission('create_label_templates') ? [{ keys: 'n', description: 'New template', group: 'Labels', run: () => setEditing('new' as const) }] : []),
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Barcode & Price Labels"
        description="Shelf labels, price tags and stickers for your products, on label rolls or A4 sticker sheets."
        actions={
          <Button onClick={print} disabled={!canPrint || printing} title={shortcutHint('Print labels', 'p')}>
            {printing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Print {labels.length ? `${labels.length} label${labels.length === 1 ? '' : 's'}` : ''}
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ProductSearch onPick={(p) => addSafely([p])} />
            <Button variant="outline" onClick={() => setScanOpen(true)} title={`${shortcutHint('Scan with the camera', 's')}. A USB or Bluetooth scanner works anywhere on this page.`}>
              <Camera className="mr-2 h-4 w-4" /> Scan
            </Button>
            <BarcodeScanDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onScanned} title="Scan a product to label" />
            <Select value="" onValueChange={addCategory}>
              <SelectTrigger className="w-56" aria-label="Add a whole category"><SelectValue placeholder="Add a whole category" /></SelectTrigger>
              <SelectContent>
                {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_path}</SelectItem>)}
              </SelectContent>
            </Select>
            {items.length > 0 && <Button variant="ghost" onClick={() => setItems([])}>Clear</Button>}
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="w-28 text-right">Labels</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const { name, variant } = labelNames(it.product);
                  const price = prices.data?.prices[it.product.id] ?? Number(it.product.sales_price);
                  return (
                    <TableRow key={it.product.id}>
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{[variant, it.product.sku].filter(Boolean).join(' · ')}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{labelCode(it.product)}</TableCell>
                      <TableCell className="text-right">{Number.isFinite(price) ? price.toFixed(2) : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} max={MAX_LABELS} className="h-8 w-20 text-right" aria-label={`Labels for ${it.product.name}`}
                          value={it.copies}
                          onChange={(e) => setItems((cur) => cur.map((x) => (x.product.id === it.product.id ? { ...x, copies: Math.min(MAX_LABELS, Math.max(0, Number(e.target.value) || 0)) } : x)))} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" aria-label={`Remove ${it.product.name}`} onClick={() => setItems((cur) => cur.filter((x) => x.product.id !== it.product.id))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!items.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      <QrCode className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      Search, scan or add a category to choose what to label.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {totalCopies > MAX_LABELS && <p className="text-sm text-amber-600">One print run makes at most {MAX_LABELS} labels; print the rest in another run.</p>}
          {template?.show_price && prices.isError && (
            <p className="text-sm text-muted-foreground">Price list prices could not be loaded ({errorMessage(prices.error)}); labels show the sales price.</p>
          )}
        </section>

        <aside className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lbl-template">Template</Label>
            <Select value={template?.id} onValueChange={setTemplateId}>
              <SelectTrigger id="lbl-template"><SelectValue placeholder={templates.isLoading ? 'Loading…' : 'No templates yet'} /></SelectTrigger>
              <SelectContent>
                {(templates.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 pt-1">
              {hasPermission('create_label_templates') && (
                <Button size="sm" variant="outline" onClick={() => setEditing('new')} title={shortcutHint('New template', 'n')}><Plus className="mr-1 h-3 w-3" /> New template</Button>
              )}
              {template && hasPermission('edit_label_templates') && (
                <Button size="sm" variant="outline" onClick={() => setEditing(template)}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
              )}
              {template && hasPermission('delete_label_templates') && (
                <Button size="sm" variant="ghost" disabled={archive.isPending}
                  onClick={() => archive.mutateAsync(template.id).then(() => { setTemplateId(undefined); toast.success('Template archived'); }).catch((e) => toast.error(errorMessage(e)))}>
                  <Archive className="mr-1 h-3 w-3" /> Archive
                </Button>
              )}
            </div>
          </div>
          {template?.show_price && canSeeLists && (
            <div className="space-y-1.5">
              <Label htmlFor="lbl-list">Prices from</Label>
              <Select value={listChoice ?? template.price_list_id ?? DEFAULT_LIST} onValueChange={setListChoice}>
                <SelectTrigger id="lbl-list"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_LIST}>Default price list</SelectItem>
                  {(priceLists.data ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.currency})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {template && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Preview</span>
                <Badge variant="secondary">
                  {template.layout === 'roll' ? `${Number(template.label_width_mm)} × ${Number(template.label_height_mm)} mm roll` : `${template.columns} × ${template.rows} on ${Number(template.page_width_mm)} × ${Number(template.page_height_mm)} mm`}
                </Badge>
              </div>
              {problem ? <p className="text-sm text-destructive">{problem}</p> : (
                <PagePreview template={template} labels={pages[0] ?? []} currency={currency} company={company} />
              )}
              {pages.length > 1 && <p className="text-xs text-muted-foreground">{pages.length} {template.layout === 'roll' ? 'labels' : 'sheets'} in all.</p>}
              <p className="text-xs text-muted-foreground">In the print window keep the scale at 100% and margins at none.</p>
            </div>
          )}
        </aside>
      </div>

      <TemplateDialog target={editing} onClose={() => setEditing(null)} onSaved={(t) => setTemplateId(t.id)} canSeeLists={canSeeLists} />

      {printing && template && createPortal(
        <div id="label-print-root">
          <style>{printCss(template)}</style>
          {pages.map((page, pi) => (
            <div key={pi} className="label-page" style={{ width: `${pageSize(template).width}mm`, height: `${pageSize(template).height}mm` }}>
              {page.map((l, i) => {
                const pos = slotPosition(template, i);
                return (
                  <div key={l.key} style={{ position: 'absolute', left: `${pos.left}mm`, top: `${pos.top}mm` }}>
                    <ProductLabel label={l} template={template} currency={currency} company={company} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function printCss(t: LabelTemplate): string {
  const { width, height } = pageSize(t);
  return `@media screen { #label-print-root { display: none; } }
@media print {
  @page { size: ${width}mm ${height}mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body > *:not(#label-print-root) { display: none !important; }
  #label-print-root { display: block; }
  #label-print-root .label-page { position: relative; overflow: hidden; break-after: page; page-break-after: always; }
  #label-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
}

/** The first page (or label) at real proportions, scaled to fit the column. */
function PagePreview({ template: t, labels, currency, company }: { template: LabelTemplate; labels: ReturnType<typeof expandLabels>; currency: string; company: string | null }) {
  const { width, height } = pageSize(t);
  const scale = Math.min(1, 360 / (width * PX_PER_MM), 460 / (height * PX_PER_MM));
  const slots = labelsPerPage(t);
  return (
    <div className="overflow-hidden rounded-md border bg-muted/40 p-2">
      <div style={{ width: width * PX_PER_MM * scale, height: height * PX_PER_MM * scale }}>
        <div className="relative bg-white shadow-sm" style={{ width: `${width}mm`, height: `${height}mm`, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {Array.from({ length: slots }, (_, i) => {
            const pos = slotPosition(t, i);
            const l = labels[i];
            return (
              <div key={i} className="absolute outline outline-1 outline-dashed outline-muted-foreground/30" style={{ left: `${pos.left}mm`, top: `${pos.top}mm`, width: `${Number(t.label_width_mm)}mm`, height: `${Number(t.label_height_mm)}mm` }}>
                {l && <ProductLabel label={l} template={t} currency={currency} company={company} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProductSearch({ onPick }: { onPick: (p: Product) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      searchProducts(term).then((r) => live && setResults(r)).catch(() => live && setResults([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input className="pl-8" placeholder="Add products: name, SKU or barcode" aria-label="Add products" value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && results.length > 0 && (
        <ul className="absolute z-[1100] mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md" role="listbox">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(p); setQ(''); setOpen(false); }}>
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{[p.sku, p.item_code].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const FORMATS: { value: LabelBarcodeFormat; label: string }[] = [
  { value: 'auto', label: 'Automatic (EAN when the barcode is one, else Code 128)' },
  { value: 'code128', label: 'Code 128' },
  { value: 'ean13', label: 'EAN-13 (else Code 128)' },
  { value: 'qr', label: 'QR code' },
  { value: 'none', label: 'No barcode' },
];
const SHOW: { key: keyof Pick<LabelTemplate, 'show_name' | 'show_variant' | 'show_sku' | 'show_price' | 'show_barcode_text' | 'show_company'>; label: string }[] = [
  { key: 'show_name', label: 'Name' },
  { key: 'show_variant', label: 'Variant (Red, M)' },
  { key: 'show_sku', label: 'SKU' },
  { key: 'show_price', label: 'Price' },
  { key: 'show_barcode_text', label: 'Barcode digits' },
  { key: 'show_company', label: 'Company name' },
];
type NumKey = 'label_width_mm' | 'label_height_mm' | 'page_width_mm' | 'page_height_mm' | 'columns' | 'rows' | 'margin_top_mm' | 'margin_left_mm' | 'gap_x_mm' | 'gap_y_mm' | 'font_size_pt';

function TemplateDialog({ target, onClose, onSaved, canSeeLists }: { target: LabelTemplate | 'new' | null; onClose: () => void; onSaved: (t: LabelTemplate) => void; canSeeLists: boolean }) {
  const save = useSaveLabelTemplate();
  const priceLists = usePriceLists();
  const [form, setForm] = useState<LabelTemplate | null>(null);
  const key = target === 'new' ? 'new' : target?.id ?? null;
  const [prev, setPrev] = useState<string | null>(null);
  if (key !== prev) {
    setPrev(key);
    setForm(target === 'new' ? { ...NEW_TEMPLATE, id: '', name: '', company_id: null, sort_order: 0, is_active: true } : target ? { ...target } : null);
  }
  if (!target || !form) return null;
  const existing = target !== 'new' ? target : null;
  const set = <K extends keyof LabelTemplate>(k: K, v: LabelTemplate[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const problem = layoutProblem(form);
  const numField = (k: NumKey, label: string, step = '0.1') => (
    <div className="space-y-1">
      <Label htmlFor={`lt-${k}`} className="text-xs">{label}</Label>
      <Input id={`lt-${k}`} type="number" step={step} value={String(form[k])} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || problem) return;
    const n = (v: string | number) => Number(v);
    const input: LabelTemplateInput = {
      name: form.name.trim(), layout: form.layout, barcode_format: form.barcode_format,
      label_width_mm: n(form.label_width_mm), label_height_mm: n(form.label_height_mm), font_size_pt: n(form.font_size_pt),
      show_name: form.show_name, show_variant: form.show_variant, show_sku: form.show_sku, show_price: form.show_price,
      show_barcode_text: form.show_barcode_text, show_company: form.show_company, price_list_id: form.price_list_id,
      ...(form.layout === 'sheet'
        ? {
            page_width_mm: n(form.page_width_mm), page_height_mm: n(form.page_height_mm), columns: n(form.columns), rows: n(form.rows),
            margin_top_mm: n(form.margin_top_mm), margin_left_mm: n(form.margin_left_mm), gap_x_mm: n(form.gap_x_mm), gap_y_mm: n(form.gap_y_mm),
          }
        : {}),
      ...(existing ? (form.company_id !== existing.company_id ? { company_id: form.company_id } : {}) : { company_id: form.company_id }),
    };
    try {
      const saved = await save.mutateAsync({ id: existing?.id, input });
      toast.success(existing ? 'Template saved' : `Template “${saved.name}” created`);
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{existing ? `Edit ${existing.name}` : 'New label template'}</DialogTitle>
            <DialogDescription>The label size and layout, and what each label shows.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="lt-name">Name</Label>
              <Input id="lt-name" autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} placeholder="Shelf label 50 × 25 mm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lt-layout">Paper</Label>
              <Select value={form.layout} onValueChange={(v) => set('layout', v as LabelTemplate['layout'])}>
                <SelectTrigger id="lt-layout"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="roll">Label roll (one label per page)</SelectItem>
                  <SelectItem value="sheet">Sticker sheet (A4 or other)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lt-format">Barcode</Label>
              <Select value={form.barcode_format} onValueChange={(v) => set('barcode_format', v as LabelBarcodeFormat)}>
                <SelectTrigger id="lt-format"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {numField('label_width_mm', 'Label width (mm)')}
            {numField('label_height_mm', 'Label height (mm)')}
            {form.layout === 'sheet' && (
              <>
                {numField('page_width_mm', 'Page width (mm)')}
                {numField('page_height_mm', 'Page height (mm)')}
                {numField('columns', 'Columns', '1')}
                {numField('rows', 'Rows', '1')}
                {numField('margin_left_mm', 'Left margin (mm)')}
                {numField('margin_top_mm', 'Top margin (mm)')}
                {numField('gap_x_mm', 'Gap between columns (mm)')}
                {numField('gap_y_mm', 'Gap between rows (mm)')}
              </>
            )}
            {numField('font_size_pt', 'Text size (pt)', '0.5')}
            {canSeeLists && (
              <div className="space-y-1">
                <Label htmlFor="lt-list" className="text-xs">Prices from</Label>
                <Select value={form.price_list_id ?? DEFAULT_LIST} onValueChange={(v) => set('price_list_id', v === DEFAULT_LIST ? null : v)}>
                  <SelectTrigger id="lt-list"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_LIST}>Default price list</SelectItem>
                    {(priceLists.data ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 grid grid-cols-3 gap-2 pt-1">
              {SHOW.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-sm">
                  <Switch checked={form[s.key]} onCheckedChange={(v) => set(s.key, v)} /> {s.label}
                </label>
              ))}
            </div>
            <div className="col-span-2">
              <CompanyBranchSelect companyId={form.company_id} onCompanyChange={(v) => set('company_id', v ?? null)} allowShared idPrefix="lt" />
            </div>
          </div>
          {problem && <p className="text-sm text-destructive">{problem}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || !form.name.trim() || !!problem}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {existing ? 'Save' : 'Create template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
