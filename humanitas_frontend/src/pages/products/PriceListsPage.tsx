import { useEffect, useState, type FormEvent } from 'react';
import { Archive, Download, Loader2, Pencil, Plus, RotateCcw, Search, Star, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { EntityPicker } from '@/components/platform/EntityPicker';
import { CompanyBranchSelect } from '@/components/platform/CompanyBranchSelect';
import { useShortcuts, shortcutHint } from '@/lib/shortcuts';
import '@/components/products/registerProductEntities';
import {
  downloadComparisonCsv, ruleInputProblem, rulePriceText, ruleTarget, useArchivePriceList, useArchiveRule, usePriceCompare,
  useAddRulesForProducts, usePriceList, usePriceLists, useSavePriceList, useSaveRule,
  type PriceList, type PriceRule, type PriceRuleInput, type RuleCompute, type RuleScope,
} from '@/hooks/usePriceLists';

/** "Several products" makes one rule per product in one step. */
type DialogScope = RuleScope | 'products';
const SCOPES: { value: DialogScope; label: string }[] = [
  { value: 'product', label: 'A product' },
  { value: 'products', label: 'Several products' },
  { value: 'category', label: 'A category' },
  { value: 'all', label: 'Every product' },
];
const COMPUTES: { value: RuleCompute; label: string }[] = [
  { value: 'fixed', label: 'Fixed price' },
  { value: 'discount', label: '% off sales price' },
  { value: 'markup', label: '% on cost' },
];

/** Products -> Price Lists (featureslist §1): tiers, their rules, and a comparison across lists. */
export default function PriceListsPage() {
  const { hasPermission } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const lists = usePriceLists(showArchived);
  const [selected, setSelected] = useState<string | undefined>();
  const [editing, setEditing] = useState<PriceList | 'new' | null>(null);

  useEffect(() => {
    if (!selected && lists.data?.length) setSelected(lists.data[0].id);
  }, [lists.data, selected]);

  useShortcuts(hasPermission('create_price_lists')
    ? [{ keys: 'n', description: 'New price list', group: 'Price lists', run: () => setEditing('new') }]
    : []);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Price Lists"
        description="Retail, wholesale, distributor and VIP prices: rules by product, category or quantity, with promotion dates."
        actions={hasPermission('create_price_lists') && (
          <Button onClick={() => setEditing('new')} title={shortcutHint('New price list', 'n')}><Plus className="mr-2 h-4 w-4" /> New price list</Button>
        )}
      />
      <Tabs defaultValue="lists">
        <TabsList>
          <TabsTrigger value="lists">Price lists</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>
        <TabsContent value="lists" className="pt-4">
          <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
            <aside className="space-y-3">
              <label className="flex items-center gap-2 text-sm"><Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived</label>
              {lists.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
              {lists.isError && <p className="text-sm text-destructive">{errorMessage(lists.error)}</p>}
              <ul className="space-y-1.5">
                {(lists.data ?? []).map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => setSelected(l.id)} aria-current={selected === l.id}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${selected === l.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}>
                      <span className="flex items-center gap-2 font-medium">
                        {l.name}
                        {l.is_default && <Badge variant="secondary">Default</Badge>}
                        {!l.is_active && <Badge variant="outline">Archived</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground">{l.currency} · {l.rule_count} rule{l.rule_count === 1 ? '' : 's'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
            {selected ? <ListDetail id={selected} onEdit={(l) => setEditing(l)} /> : (
              <div className="flex flex-col items-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground"><Tags className="h-8 w-8 opacity-40" /> No price lists yet.</div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="compare" className="pt-4"><Compare /></TabsContent>
      </Tabs>
      <ListDialog target={editing} onClose={() => setEditing(null)} onSaved={(id) => setSelected(id)} />
    </div>
  );
}

function ListDetail({ id, onEdit }: { id: string; onEdit: (l: PriceList) => void }) {
  const { hasPermission } = useAuth();
  const q = usePriceList(id);
  const save = useSavePriceList();
  const archive = useArchivePriceList();
  const archiveRule = useArchiveRule();
  const [rule, setRule] = useState<PriceRule | 'new' | null>(null);
  const l = q.data;
  if (q.isLoading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;
  if (q.isError || !l) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>;
  const canEdit = hasPermission('edit_price_lists') && l.is_active;

  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <section className="space-y-4" aria-label={l.name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">{l.name} {l.is_default && <Badge variant="secondary">Default</Badge>}</h2>
          <p className="text-sm text-muted-foreground">{l.currency}{l.code ? ` · ${l.code}` : ''}{l.description ? ` · ${l.description}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button variant="outline" size="sm" onClick={() => onEdit(l)}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>}
          {canEdit && !l.is_default && (
            <Button variant="outline" size="sm" onClick={() => run(save.mutateAsync({ id: l.id, input: { is_default: true } }), `${l.name} is now the default`)}>
              <Star className="mr-1 h-3 w-3" /> Make default
            </Button>
          )}
          {l.is_active && !l.is_default && hasPermission('delete_price_lists') && (
            <Button variant="outline" size="sm" onClick={() => run(archive.mutateAsync(l.id), 'Price list archived')}><Archive className="mr-1 h-3 w-3" /> Archive</Button>
          )}
          {!l.is_active && hasPermission('edit_price_lists') && (
            <Button variant="outline" size="sm" onClick={() => run(save.mutateAsync({ id: l.id, input: { is_active: true } }), 'Price list restored')}><RotateCcw className="mr-1 h-3 w-3" /> Restore</Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applies to</TableHead>
              <TableHead className="text-right">From qty</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(l.items ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{ruleTarget(r)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(r.min_quantity)}</TableCell>
                <TableCell>{rulePriceText(r, l.currency)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.date_start || r.date_end ? `${r.date_start ?? '…'} → ${r.date_end ?? '…'}` : 'Always'}</TableCell>
                <TableCell>
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit rule" onClick={() => setRule(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Remove rule"
                        onClick={() => run(archiveRule.mutateAsync({ listId: l.id, ruleId: r.id }), 'Rule removed')}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!(l.items ?? []).length && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No rules: every product is at its sales price on this list.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {canEdit && <Button variant="outline" onClick={() => setRule('new')}><Plus className="mr-2 h-4 w-4" /> Add rule</Button>}
      <RuleDialog list={l} target={rule} onClose={() => setRule(null)} />
    </section>
  );
}

function ListDialog({ target, onClose, onSaved }: { target: PriceList | 'new' | null; onClose: () => void; onSaved: (id: string) => void }) {
  const save = useSavePriceList();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [companyId, setCompanyId] = useState<string | null | undefined>(undefined);
  const key = target === 'new' ? 'new' : target?.id ?? null;
  const [prev, setPrev] = useState<string | null>(null);
  if (key !== prev) {
    setPrev(key);
    const t = target && target !== 'new' ? target : null;
    setName(t?.name ?? '');
    setCode(t?.code ?? '');
    setCurrency(t?.currency ?? 'ETB');
    setDescription(t?.description ?? '');
    setIsDefault(t?.is_default ?? false);
    setCompanyId(t ? t.company_id : undefined);
  }
  if (!target) return null;
  const existing = target !== 'new' ? target : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const companyChanged = existing ? companyId !== undefined && companyId !== existing.company_id : companyId !== undefined;
      const saved = await save.mutateAsync({
        id: existing?.id,
        input: {
          name: name.trim(), code: code.trim() || null, currency: currency.trim().toUpperCase(), description: description.trim() || null,
          ...(existing ? {} : { is_default: isDefault }), ...(companyChanged ? { company_id: companyId } : {}),
        },
      });
      toast.success(existing ? 'Price list saved' : `Price list “${saved.name}” created`);
      onSaved(saved.id);
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
            <DialogTitle>{existing ? `Edit ${existing.name}` : 'New price list'}</DialogTitle>
            <DialogDescription>e.g. Wholesale, Distributor or VIP.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="pl-name">Name</Label>
              <Input id="pl-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-code">Code</Label>
              <Input id="pl-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={30} placeholder="WHOLESALE" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-currency">Currency</Label>
              <Input id="pl-currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="pl-desc">Description</Label>
              <Input id="pl-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
            </div>
            <div className="col-span-2">
              <CompanyBranchSelect companyId={companyId} onCompanyChange={setCompanyId} allowShared idPrefix="pl" />
            </div>
            {!existing && (
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} /> Default list (Sales and POS start with it)
              </label>
            )}
          </div>
          {currency !== 'ETB' && <p className="text-xs text-muted-foreground">Product prices are in ETB: a {currency || 'foreign'} list uses fixed prices until exchange rates come with Accounting.</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || !name.trim() || !/^[A-Z]{3}$/.test(currency)}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {existing ? 'Save' : 'Create price list'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RuleDialog({ list, target, onClose }: { list: PriceList; target: PriceRule | 'new' | null; onClose: () => void }) {
  const save = useSaveRule();
  const saveMany = useAddRulesForProducts();
  const [scope, setScope] = useState<DialogScope>('product');
  const [many, setMany] = useState<{ id: string; name: string }[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [productLabel, setProductLabel] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null);
  const [minQty, setMinQty] = useState('0');
  const [compute, setCompute] = useState<RuleCompute>(list.currency === 'ETB' ? 'discount' : 'fixed');
  const [value, setValue] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const key = target === 'new' ? 'new' : target?.id ?? null;
  const [prev, setPrev] = useState<string | null>(null);
  if (key !== prev) {
    setPrev(key);
    const r = target && target !== 'new' ? target : null;
    setScope(r?.applies_to ?? 'product');
    setMany([]);
    setProductId(r?.product_id ?? null);
    setProductLabel(r?.product_name ?? null);
    setCategoryId(r?.category_id ?? null);
    setCategoryLabel(r?.category_name ?? null);
    setMinQty(r ? String(Number(r.min_quantity)) : '0');
    setCompute(r?.compute ?? (list.currency === 'ETB' ? 'discount' : 'fixed'));
    setValue(r ? String(Number(r.compute === 'fixed' ? r.fixed_price : r.percent)) : '');
    setDateStart(r?.date_start ?? '');
    setDateEnd(r?.date_end ?? '');
  }
  if (!target) return null;
  const existing = target !== 'new' ? target : null;
  const input: PriceRuleInput = {
    applies_to: scope === 'products' ? 'product' : scope,
    product_id: scope === 'product' ? productId : scope === 'products' ? (many[0]?.id ?? null) : null,
    category_id: scope === 'category' ? categoryId : null,
    min_quantity: Number(minQty || 0),
    compute,
    fixed_price: compute === 'fixed' ? (value === '' ? null : Number(value)) : null,
    percent: compute !== 'fixed' ? (value === '' ? null : Number(value)) : null,
    date_start: dateStart || null,
    date_end: dateEnd || null,
  };
  const problem = scope === 'products' && !many.length ? 'Add the products' : ruleInputProblem(input, list.currency);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    try {
      if (scope === 'products') {
        const rule = { min_quantity: input.min_quantity, compute: input.compute, fixed_price: input.fixed_price, percent: input.percent, date_start: input.date_start, date_end: input.date_end };
        const r = await saveMany.mutateAsync({ listId: list.id, productIds: many.map((m) => m.id), rule });
        toast.success(`${r.added} rule${r.added === 1 ? '' : 's'} added`);
      } else {
        await save.mutateAsync({ listId: list.id, ruleId: existing?.id, input });
        toast.success(existing ? 'Rule saved' : 'Rule added');
      }
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
            <DialogTitle>{existing ? 'Edit rule' : `Add a rule to ${list.name}`}</DialogTitle>
            <DialogDescription>The most specific rule wins, then the highest quantity the line reaches.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-scope">Applies to</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as DialogScope)}>
                <SelectTrigger id="r-scope" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPES.filter((s) => !existing || s.value !== 'products').map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-qty">From quantity</Label>
              <Input id="r-qty" inputMode="decimal" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
            </div>
            {scope === 'product' && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="r-product">Product</Label>
                <EntityPicker id="r-product" type="price_rule_product" value={productId} valueLabel={productLabel}
                  onChange={(pid, rec) => { setProductId(pid); setProductLabel((rec as { name?: string } | undefined)?.name ?? null); }} placeholder="Search products" />
              </div>
            )}
            {scope === 'products' && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="r-products">Products (one rule for each)</Label>
                <EntityPicker id="r-products" type="price_rule_product" value={null} valueLabel={null}
                  onChange={(pid, rec) => {
                    if (pid && !many.some((m) => m.id === pid)) setMany((cur) => [...cur, { id: pid, name: (rec as { name?: string } | undefined)?.name ?? pid }]);
                  }}
                  placeholder="Search and add products" />
                {many.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {many.map((m) => (
                      <Badge key={m.id} variant="secondary" className="gap-1">
                        {m.name}
                        <button type="button" aria-label={`Remove ${m.name}`} onClick={() => setMany((cur) => cur.filter((x) => x.id !== m.id))}>×</button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">For every product choose “Every product”; for a whole category choose “A category”.</p>
              </div>
            )}
            {scope === 'category' && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="r-category">Category (and its sub-categories)</Label>
                <EntityPicker id="r-category" type="product_category" value={categoryId} valueLabel={categoryLabel}
                  onChange={(cid, rec) => { setCategoryId(cid); setCategoryLabel((rec as { full_path?: string } | undefined)?.full_path ?? null); }} placeholder="Search categories" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="r-compute">Price</Label>
              <Select value={compute} onValueChange={(v) => setCompute(v as RuleCompute)}>
                <SelectTrigger id="r-compute" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPUTES.filter((c) => list.currency === 'ETB' || c.value === 'fixed').map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-value">{compute === 'fixed' ? `Price (${list.currency})` : 'Percent'}</Label>
              <Input id="r-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={compute === 'fixed' ? '95.00' : '10'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-start">From date</Label>
              <Input id="r-start" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-end">Until date</Label>
              <Input id="r-end" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
            </div>
          </div>
          {problem && <p className="text-xs text-destructive" role="alert">{problem}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || saveMany.isPending || !!problem}>{(save.isPending || saveMany.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {existing ? 'Save rule' : scope === 'products' && many.length ? `Add ${many.length} rule${many.length === 1 ? '' : 's'}` : 'Add rule'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Compare() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [qty, setQty] = useState('1');
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const quantity = Math.max(0, Number(qty) || 1);
  const data = usePriceCompare(q, quantity);
  const lists = data.data?.lists ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, SKU or item code" aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Label htmlFor="cmp-qty" className="text-sm">Quantity</Label>
        <Input id="cmp-qty" className="w-24" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        {hasPermission('export_price_lists') && (
          <Button variant="outline" onClick={() => downloadComparisonCsv(q, quantity).catch((e) => toast.error(errorMessage(e)))}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Sales price</TableHead>
              {lists.map((l) => <TableHead key={l.id} className="text-right">{l.name} <span className="text-xs text-muted-foreground">({l.currency})</span></TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data.data?.rows ?? []).map((r) => (
              <TableRow key={r.product_id}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{[r.item_code, r.sku].filter(Boolean).join(' · ')}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.base_price.toFixed(2)}</TableCell>
                {lists.map((l) => {
                  const p = r.prices[l.id];
                  return <TableCell key={l.id} className={`text-right tabular-nums ${p !== r.base_price ? 'font-medium' : 'text-muted-foreground'}`}>{Number(p).toFixed(2)}</TableCell>;
                })}
              </TableRow>
            ))}
            {!data.isLoading && !(data.data?.rows ?? []).length && (
              <TableRow><TableCell colSpan={2 + lists.length} className="py-8 text-center text-sm text-muted-foreground">No products match.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {data.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
    </div>
  );
}
