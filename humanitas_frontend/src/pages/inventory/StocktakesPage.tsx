import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, ClipboardCheck, Download, Play, Plus, Search, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import { LoadMore } from '@/components/platform/InfiniteList';
import { BarcodeScanDialog } from '@/components/platform/BarcodeScanDialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { ActiveScopeBanner } from '@/components/inventory/ActiveScopeBanner';
import { locationOptions, useInfiniteInventoryWarehouses, type LocationRow } from '@/hooks/useInventory';
import {
  COUNT_STATE_LABELS, COUNT_TYPE_LABELS, countProgress, downloadCountSheet, nextStep, useCountScan, useCreateStocktake,
  useInfiniteCountLines, useInfiniteStocktakes, useSetCountLine, useStocktake, useStocktakeAction, varianceLabel,
  type CountLine, type CountState, type CountType, type LineFilter, type StocktakeInput,
} from '@/hooks/useStocktakes';

const ALL = '__all__';
const STATE_TABS: ('all' | CountState)[] = ['all', 'draft', 'counting', 'review', 'posted', 'cancelled'];
const TONE: Record<CountState, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline', counting: 'secondary', review: 'secondary', posted: 'default', cancelled: 'destructive',
};
const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Stocktakes: plan a count of a warehouse or a location, count by scanning, review the
 * differences and post them as stock adjustments (featureslist §2).
 */
export default function StocktakesPage() {
  const [params, setParams] = useSearchParams();
  const id = params.get('id');
  const openCount = (countId: string | null) => setParams((p) => {
    if (countId) p.set('id', countId);
    else p.delete('id');
    return p;
  });
  return id ? <StocktakeDetail id={id} onBack={() => openCount(null)} /> : <StocktakeList onOpen={openCount} />;
}

function StocktakeList({ onOpen }: { onOpen: (id: string) => void }) {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [state, setState] = useState<'all' | CountState>('all');
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const counts = useInfiniteStocktakes({ search: term || undefined, state: state === 'all' ? undefined : state });
  useShortcuts([
    ...(hasPermission('create_stocktakes') ? [{ keys: 'n', description: 'New stocktake', group: 'Stocktakes', run: () => setCreating(true) }] : []),
    { keys: '/', description: 'Search stocktakes', group: 'Stocktakes', run: () => searchRef.current?.focus() },
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Stocktakes"
        description="Count what is really on the shelves: plan a count, scan, review the differences and post them."
        actions={hasPermission('create_stocktakes') && (
          <Button onClick={() => setCreating(true)} title={shortcutHint('New stocktake', 'n')}><Plus className="mr-2 h-4 w-4" /> New stocktake</Button>
        )}
      />
      <ActiveScopeBanner />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} className="pl-8" placeholder="Number or notes" aria-label="Search stocktakes" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={state} onValueChange={(v) => setState(v as 'all' | CountState)}>
          <TabsList>
            {STATE_TABS.map((s) => <TabsTrigger key={s} value={s}>{s === 'all' ? 'All' : COUNT_STATE_LABELS[s]}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Warehouse / location</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Responsible</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {counts.rows.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" tabIndex={0} onClick={() => onOpen(c.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(c.id)}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{COUNT_TYPE_LABELS[c.count_type]}{c.is_blind && c.count_type !== 'blind' ? ' (blind)' : ''}</TableCell>
                <TableCell>{c.warehouse_name ?? '—'}{c.location_code ? ` · ${c.location_code}` : ''}</TableCell>
                <TableCell className="text-xs">{c.scheduled_date ? c.scheduled_date.slice(0, 10) : '—'}</TableCell>
                <TableCell className="text-xs">{c.state === 'draft' ? '—' : countProgress({ lines: c.line_count ?? 0, counted: c.counted_count ?? 0 }).label}</TableCell>
                <TableCell>{c.responsible_name ?? '—'}</TableCell>
                <TableCell><Badge variant={TONE[c.state]}>{COUNT_STATE_LABELS[c.state]}</Badge></TableCell>
              </TableRow>
            ))}
            {!counts.rows.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  {counts.isLoading ? 'Loading…' : 'No stocktakes yet. Plan one to check what is really on the shelves.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <LoadMore hasNextPage={counts.hasNextPage} isFetchingNextPage={counts.isFetchingNextPage} fetchNextPage={counts.fetchNextPage}
        loaded={counts.rows.length} total={counts.total} noun="stocktakes" />
      <NewStocktakeDialog open={creating} onClose={() => setCreating(false)} onCreated={(cid) => { setCreating(false); onOpen(cid); }} />
    </div>
  );
}

function NewStocktakeDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const warehouses = useInfiniteInventoryWarehouses({});
  const create = useCreateStocktake();
  const [warehouseId, setWarehouseId] = useState('');
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState('');
  const [type, setType] = useState<CountType>('cycle');
  const [blind, setBlind] = useState(false);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setLocationId('');
    if (!warehouseId) { setLocations([]); return; }
    locationOptions(warehouseId).then((l) => setLocations(l.filter((x) => x.usage === 'internal' || x.usage === 'view'))).catch(() => setLocations([]));
  }, [warehouseId]);

  const submit = async () => {
    if (!warehouseId) return toast.error('Choose the warehouse to count');
    const input: StocktakeInput = {
      warehouse_id: warehouseId, count_type: type, is_blind: blind || type === 'blind',
      ...(locationId ? { location_id: locationId } : {}), ...(date ? { scheduled_date: date } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    try {
      const c = await create.mutateAsync(input);
      toast.success(`Stocktake ${c.name} planned`);
      onCreated(c.id);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New stocktake</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Warehouse *</Label>
            <Select value={warehouseId || ALL} onValueChange={(v) => setWarehouseId(v === ALL ? '' : v)}>
              <SelectTrigger aria-label="Warehouse"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} disabled>Choose…</SelectItem>
                {warehouses.rows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={locationId || ALL} onValueChange={(v) => setLocationId(v === ALL ? '' : v)} disabled={!warehouseId}>
              <SelectTrigger aria-label="Location"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Every storage location of the warehouse</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.code} — {l.name} (and below)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CountType)}>
                <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(COUNT_TYPE_LABELS) as CountType[]).map((t) => <SelectItem key={t} value={t}>{COUNT_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-date">Scheduled for</Label>
              <Input id="st-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={blind || type === 'blind'} disabled={type === 'blind'} onCheckedChange={setBlind} />
            Blind: counters do not see what the system expects
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="st-notes">Notes</Label>
            <Textarea id="st-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>Plan the count</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StocktakeDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { hasPermission } = useAuth();
  const q = useStocktake(id);
  const action = useStocktakeAction();
  const scan = useCountScan();
  const setLine = useSetCountLine();
  const [filter, setFilter] = useState<LineFilter>('all');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [location, setLocation] = useState<{ id: string; code: string } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [confirm, setConfirm] = useState<'post' | 'cancel' | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const count = q.data;
  const lines = useInfiniteCountLines(id, { filter, search: term || undefined });
  const counting = count?.state === 'counting' || count?.state === 'review';
  const canCount = counting && hasPermission('count_stocktakes');

  const onScanned = async (code: string) => {
    if (!canCount) return;
    try {
      const r = await scan.mutateAsync({ id, code, location_id: location?.id });
      if (r.kind === 'location') {
        setLocation({ id: r.location.id, code: r.location.code });
        toast.success(`Counting in ${r.location.code}`);
      } else {
        toast.success(`${r.line.product_name}${r.line.lot_name ? ` · ${r.line.lot_name}` : ''}: ${Number(r.line.counted_qty ?? 0)}`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  useBarcodeScanner(onScanned);

  const run = async (step: 'start' | 'submit' | 'post' | 'cancel') => {
    try {
      await action.mutateAsync({ id, action: step });
      toast.success({ start: 'Counting started', submit: 'Sent for review', post: 'Differences posted to stock', cancel: 'Stocktake cancelled' }[step]);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const saveQty = async (line: CountLine, value: string) => {
    const v = value.trim();
    const qty = v === '' ? null : Number(v);
    if (qty !== null && (!Number.isFinite(qty) || qty < 0)) return toast.error('A count is a number of 0 or more');
    if ((line.counted_qty == null && qty == null) || (line.counted_qty != null && qty != null && Number(line.counted_qty) === qty)) return;
    try {
      await setLine.mutateAsync({ id, lineId: line.id, counted_qty: qty });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  useShortcuts([
    { keys: 's', description: 'Scan with the camera', group: 'Stocktake', run: () => setScanOpen(true) },
    { keys: 'u', description: 'Show what is not counted yet', group: 'Stocktake', run: () => setFilter('uncounted') },
    { keys: 'd', description: 'Show differences', group: 'Stocktake', run: () => setFilter('variance') },
  ]);

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (q.isError || !count) return <div className="p-6 text-sm text-destructive">{errorMessage(q.error)}</div>;

  const step = nextStep(count.state);
  const t = count.totals;
  const progress = countProgress(t);
  const hidden = count.expected_hidden;
  const showMoney = hasPermission('view_stock_valuation');
  const stepAllowed = step === 'start' ? hasPermission('create_stocktakes') : step === 'submit' ? hasPermission('count_stocktakes') : step === 'post' ? hasPermission('approve_stocktakes') : false;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={`Stocktake ${count.name}`}
        description={`${COUNT_TYPE_LABELS[count.count_type]} of ${count.warehouse_name ?? 'the warehouse'}${count.location_code ? ` · ${count.location_code} and below` : ''}${count.is_blind ? ' · blind' : ''}`}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Stocktakes</Button>
            {hasPermission('export_stocktakes') && (
              <Button variant="outline" onClick={() => downloadCountSheet(id, count.name).catch((e) => toast.error(errorMessage(e)))}>
                <Download className="mr-2 h-4 w-4" /> Count sheet
              </Button>
            )}
            {canCount && <Button variant="outline" onClick={() => setScanOpen(true)} title={shortcutHint('Scan with the camera', 's')}><Camera className="mr-2 h-4 w-4" /> Scan</Button>}
            {step === 'start' && stepAllowed && <Button onClick={() => run('start')} disabled={action.isPending}><Play className="mr-2 h-4 w-4" /> Start counting</Button>}
            {step === 'submit' && stepAllowed && <Button onClick={() => run('submit')} disabled={action.isPending}><Send className="mr-2 h-4 w-4" /> Send for review</Button>}
            {(count.state === 'counting' || count.state === 'review') && hasPermission('approve_stocktakes') && (
              <Button onClick={() => setConfirm('post')} disabled={action.isPending}><CheckCircle2 className="mr-2 h-4 w-4" /> Approve &amp; post</Button>
            )}
            {count.state !== 'posted' && count.state !== 'cancelled' && hasPermission('cancel_stocktakes') && (
              <Button variant="outline" onClick={() => setConfirm('cancel')}><XCircle className="mr-2 h-4 w-4" /> Cancel</Button>
            )}
          </div>
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={TONE[count.state]}>{COUNT_STATE_LABELS[count.state]}</Badge>
        {count.responsible_name && <span className="text-sm text-muted-foreground">Responsible: {count.responsible_name}</span>}
        {count.category_name && <span className="text-sm text-muted-foreground">Category: {count.category_name}</span>}
      </div>

      {count.state === 'draft' ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          <ClipboardCheck className="mr-2 inline h-4 w-4" />
          Start counting to freeze what the system expects in each location. Stock can keep moving while you count: posting adjusts against what is on hand at that moment.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Figure label="Progress" value={progress.label}>
            <div className="mt-2 h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${progress.percent}%` }} /></div>
          </Figure>
          {!hidden && <Figure label="Accuracy" value={t?.accuracy == null ? '—' : `${t.accuracy}%`} hint="Counted lines that matched" />}
          {!hidden && <Figure label="Lines with a difference" value={String(t?.with_variance ?? 0)} />}
          {!hidden && showMoney && t?.variance_value_gain != null && <Figure label="Found (value)" value={money.format(t.variance_value_gain)} />}
          {!hidden && showMoney && t?.variance_value_loss != null && <Figure label="Missing (value)" value={money.format(t.variance_value_loss)} />}
          {hidden && <Figure label="Blind count" value="Expected quantities are hidden" hint="They show to the approver and after posting" />}
        </div>
      )}

      {count.state !== 'draft' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {canCount && (
              <div className="rounded-md border px-3 py-1.5 text-sm">
                {location ? <>Counting in <strong>{location.code}</strong> <button type="button" className="ml-2 text-xs underline" onClick={() => setLocation(null)}>change</button></> : 'Scan a location barcode, then the products in it'}
              </div>
            )}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Product, SKU, lot or location" aria-label="Search lines" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as LineFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="uncounted" title={shortcutHint('Not counted', 'u')}>Not counted</TabsTrigger>
                {!hidden && <TabsTrigger value="variance" title={shortcutHint('Differences', 'd')}>Differences</TabsTrigger>}
                <TabsTrigger value="unexpected">Found elsewhere</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Lot / serial</TableHead>
                  {!hidden && <TableHead className="text-right">Expected</TableHead>}
                  <TableHead className="w-32 text-right">Counted</TableHead>
                  {!hidden && <TableHead className="text-right">Difference</TableHead>}
                  {!hidden && showMoney && <TableHead className="text-right">Value</TableHead>}
                  <TableHead>Counted by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{l.location_code ?? '—'}</TableCell>
                    <TableCell>
                      <div className="font-medium">{l.product_name}</div>
                      <div className="text-xs text-muted-foreground">{l.sku ?? ''}{l.is_unexpected ? ' · found here' : ''}</div>
                    </TableCell>
                    <TableCell className="text-xs">{l.lot_name ?? '—'}{l.expiry_date ? ` · exp ${String(l.expiry_date).slice(0, 10)}` : ''}</TableCell>
                    {!hidden && <TableCell className="text-right tabular-nums">{Number(l.expected_qty ?? 0)}</TableCell>}
                    <TableCell className="text-right">
                      {canCount ? (
                        <Input key={`${l.id}-${l.counted_qty ?? ''}`} className="h-8 text-right tabular-nums" inputMode="decimal" aria-label={`Counted ${l.product_name}`}
                          defaultValue={l.counted_qty == null ? '' : String(Number(l.counted_qty))}
                          onBlur={(e) => saveQty(l, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                      ) : <span className="tabular-nums">{l.counted_qty == null ? '—' : Number(l.counted_qty)}</span>}
                    </TableCell>
                    {!hidden && (
                      <TableCell className={`text-right tabular-nums ${Number(l.variance ?? 0) < 0 ? 'text-destructive' : Number(l.variance ?? 0) > 0 ? 'text-emerald-600' : ''}`}>
                        {varianceLabel(l)}
                      </TableCell>
                    )}
                    {!hidden && showMoney && <TableCell className="text-right tabular-nums">{l.counted_qty == null ? '' : money.format(Number(l.variance_value ?? 0))}</TableCell>}
                    <TableCell className="text-xs">{l.counted_by_name ?? ''}</TableCell>
                  </TableRow>
                ))}
                {!lines.rows.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      {lines.isLoading ? 'Loading…' : filter === 'uncounted' ? 'Everything is counted.' : 'Nothing here.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <LoadMore hasNextPage={lines.hasNextPage} isFetchingNextPage={lines.isFetchingNextPage} fetchNextPage={lines.fetchNextPage}
            loaded={lines.rows.length} total={lines.total} noun="lines" />
        </>
      )}

      <BarcodeScanDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onScanned} title="Scan a location, product or serial" />
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'post' ? `Post ${count.name}?` : `Cancel ${count.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'post'
                ? `Every counted line with a difference becomes a stock adjustment against what is on hand now${t?.uncounted ? `; the ${t.uncounted} line${t.uncounted === 1 ? '' : 's'} not counted stay as they are` : ''}. This cannot be undone; count again to correct it.`
                : 'Nothing is adjusted; the counts are kept for reference.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const c = confirm; setConfirm(null); if (c) run(c); }}>{confirm === 'post' ? 'Post the differences' : 'Cancel the stocktake'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Figure({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {children}
    </div>
  );
}
