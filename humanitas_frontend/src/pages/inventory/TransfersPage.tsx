import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, Download, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import { LoadMore } from '@/components/platform/InfiniteList';
import { BarcodeScanDialog } from '@/components/platform/BarcodeScanDialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { ActiveScopeBanner } from '@/components/inventory/ActiveScopeBanner';
import '@/components/inventory/registerInventoryEntities';
import {
  downloadTransfersCsv, lookupTransfer, useInfiniteInventoryTransfers,
  TRANSFER_STATE_LABELS, TRANSFER_TYPES, TRANSFER_TYPE_LABELS,
  type TransferState, type TransferType,
} from '@/hooks/useInventory';

const ALL = '__all__';
type StateTab = 'all' | TransferState;
const TABS: StateTab[] = ['all', 'draft', 'in_progress', 'done', 'cancelled'];

export const STATE_TONE: Record<TransferState, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline', waiting: 'outline', ready: 'secondary', in_progress: 'secondary', done: 'default', cancelled: 'destructive',
};

/** Receipts, deliveries, internal moves and returns. Nothing moves until a transfer is marked done. */
export default function TransfersPage() {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [state, setState] = useState<StateTab>('all');
  const [type, setType] = useState<TransferType | ''>('');
  const [scanOpen, setScanOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = { search: term || undefined, state: state === 'all' ? undefined : state, transfer_type: type || undefined };
  const transfers = useInfiniteInventoryTransfers(filters);
  const open = (id: string, name?: string) => drawer.open({ type: 'transfer', mode: 'edit', id, title: name ? `Transfer ${name}` : 'Transfer' });
  const create = (t?: TransferType) => drawer.open({ type: 'transfer', mode: 'create', initial: t ? { transfer_type: t } : undefined });

  // The command palette's "New transfer" opens /inventory/transfers?new=1.
  useEffect(() => {
    if (params.get('new') !== '1') return;
    setParams((p) => { p.delete('new'); return p; }, { replace: true });
    if (hasPermission('create_transfers')) create();
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Scanning a transfer number (printed on the picking slip) opens it. */
  const onScanned = async (code: string) => {
    try {
      const t = await lookupTransfer(code);
      if (t) open(t.id, t.name);
      else toast.error(`No transfer ${code}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  useBarcodeScanner(onScanned);

  const exportCsv = () => downloadTransfersCsv(filters).catch((e) => toast.error(errorMessage(e)));
  useShortcuts([
    ...(hasPermission('create_transfers') ? [{ keys: 'n', description: 'New transfer', group: 'Transfers', run: () => create() }] : []),
    { keys: '/', description: 'Search transfers', group: 'Transfers', run: () => searchRef.current?.focus() },
    { keys: 's', description: 'Scan a transfer number with the camera', group: 'Transfers', run: () => setScanOpen(true) },
    ...(hasPermission('export_transfers') ? [{ keys: 'e', description: 'Export to CSV', group: 'Transfers', run: exportCsv }] : []),
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Transfers"
        description="Receipts, deliveries, internal moves and returns. Stock moves when a transfer is marked done."
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setScanOpen(true)} aria-label="Scan a transfer number" title={shortcutHint('Scan with the camera', 's')}>
              <Camera className="h-4 w-4" />
            </Button>
            {hasPermission('export_transfers') && (
              <Button variant="outline" onClick={exportCsv} title={shortcutHint('Export to CSV', 'e')}><Download className="mr-2 h-4 w-4" /> Export</Button>
            )}
            {hasPermission('create_transfers') && (
              <Button onClick={() => create()} title={shortcutHint('New transfer', 'n')}><Plus className="mr-2 h-4 w-4" /> New transfer</Button>
            )}
          </div>
        )}
      />
      <ActiveScopeBanner />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} className="pl-8" placeholder="Number, partner or source reference" aria-label="Search transfers"
            title={shortcutHint('Search transfers', '/')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={state} onValueChange={(v) => setState(v as StateTab)}>
          <TabsList>
            {TABS.map((t) => <TabsTrigger key={t} value={t}>{t === 'all' ? 'All' : TRANSFER_STATE_LABELS[t]}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <Select value={type || ALL} onValueChange={(v) => setType(v === ALL ? '' : (v as TransferType))}>
          <SelectTrigger className="w-44" aria-label="Type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {TRANSFER_TYPES.map((t) => <SelectItem key={t} value={t}>{TRANSFER_TYPE_LABELS[t]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.rows.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" tabIndex={0} onClick={() => open(t.id, t.name)}
                onKeyDown={(e) => e.key === 'Enter' && open(t.id, t.name)}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{TRANSFER_TYPE_LABELS[t.transfer_type]}</TableCell>
                <TableCell>{t.partner_name ?? '—'}</TableCell>
                <TableCell className="text-xs">{t.origin ?? '—'}</TableCell>
                <TableCell className="text-xs">{t.scheduled_date ? t.scheduled_date.slice(0, 10) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{t.move_count}</TableCell>
                <TableCell><Badge variant={STATE_TONE[t.state]}>{TRANSFER_STATE_LABELS[t.state]}</Badge></TableCell>
              </TableRow>
            ))}
            {!transfers.rows.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  {transfers.isLoading ? 'Loading…' : 'No transfers yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <LoadMore hasNextPage={transfers.hasNextPage} isFetchingNextPage={transfers.isFetchingNextPage} fetchNextPage={transfers.fetchNextPage}
        loaded={transfers.rows.length} total={transfers.total} noun="transfers" />
      <BarcodeScanDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onScanned} title="Open a transfer by its number" />
    </div>
  );
}
