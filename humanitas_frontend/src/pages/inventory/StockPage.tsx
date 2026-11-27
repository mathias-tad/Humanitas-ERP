import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, Download, Search, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import { LoadMore } from '@/components/platform/InfiniteList';
import { BarcodeScanDialog } from '@/components/platform/BarcodeScanDialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { lookupProduct } from '@/hooks/useProducts';
import { ActiveScopeBanner } from '@/components/inventory/ActiveScopeBanner';
import { AdjustStockForm } from '@/components/inventory/AdjustStockForm';
import '@/components/inventory/registerInventoryEntities';
import '@/components/products/registerProductEntities';
import { downloadStockCsv, useInfiniteInventoryStock, useInfiniteInventoryWarehouses, type StockRow } from '@/hooks/useInventory';

const ALL = '__all__';
const qty = (v: string | number | undefined) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

/** Stock on hand: one row per product, location and lot, filtered by the company/branch switcher. */
export default function StockPage() {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [belowReorder, setBelowReorder] = useState(false);
  const [productFilter, setProductFilter] = useState<{ id: string; name: string } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<StockRow | 'new' | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const money = hasPermission('view_stock_valuation');

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ?product_id= from a product's Stock tab or the command palette
  useEffect(() => {
    const id = params.get('product_id');
    if (id) setProductFilter({ id, name: 'Selected product' });
  }, [params]);

  const warehouses = useInfiniteInventoryWarehouses({});
  const filters = {
    search: term || undefined,
    warehouse_id: warehouseId || undefined,
    product_id: productFilter?.id,
    in_stock_only: inStockOnly || undefined,
    below_reorder: belowReorder || undefined,
  };
  const stock = useInfiniteInventoryStock(filters);

  /** A scan narrows the list to that product. */
  const onScanned = async (code: string) => {
    try {
      const p = await lookupProduct(code);
      if (!p) return toast.error(`No product has the barcode ${code}`);
      setProductFilter({ id: p.id, name: p.name });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  useBarcodeScanner(onScanned);

  const exportCsv = () => downloadStockCsv(filters).catch((e) => toast.error(errorMessage(e)));
  useShortcuts([
    { keys: '/', description: 'Search stock', group: 'Stock', run: () => searchRef.current?.focus() },
    { keys: 's', description: 'Scan a barcode with the camera', group: 'Stock', run: () => setScanOpen(true) },
    ...(hasPermission('adjust_stock') ? [{ keys: 'a', description: 'Adjust stock', group: 'Stock', run: () => setAdjusting('new') }] : []),
    ...(hasPermission('export_stock') ? [{ keys: 'e', description: 'Export to CSV', group: 'Stock', run: exportCsv }] : []),
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Stock on hand"
        description="What is where: quantities by product, warehouse, location and lot. A USB or Bluetooth scanner works anywhere on this page."
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setScanOpen(true)} title={shortcutHint('Scan with the camera', 's')} aria-label="Scan a barcode">
              <Camera className="h-4 w-4" />
            </Button>
            {hasPermission('export_stock') && (
              <Button variant="outline" onClick={exportCsv} title={shortcutHint('Export to CSV', 'e')}><Download className="mr-2 h-4 w-4" /> Export</Button>
            )}
            {hasPermission('adjust_stock') && (
              <Button onClick={() => setAdjusting('new')} title={shortcutHint('Adjust stock', 'a')}><SlidersHorizontal className="mr-2 h-4 w-4" /> Adjust stock</Button>
            )}
          </div>
        )}
      />
      <ActiveScopeBanner />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} className="pl-8" placeholder="Product, SKU, location or lot" aria-label="Search stock"
            title={shortcutHint('Search stock', '/')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={warehouseId || ALL} onValueChange={(v) => setWarehouseId(v === ALL ? '' : v)}>
          <SelectTrigger className="w-52" aria-label="Warehouse"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All warehouses</SelectItem>
            {warehouses.rows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={inStockOnly} onCheckedChange={setInStockOnly} /> In stock only</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={belowReorder} onCheckedChange={setBelowReorder} /> Below reorder point</label>
        {productFilter && (
          <Button variant="secondary" size="sm" onClick={() => { setProductFilter(null); setParams((p) => { p.delete('product_id'); return p; }, { replace: true }); }}>
            {productFilter.name} <X className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Lot</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Free</TableHead>
              {money && <TableHead className="text-right">Value</TableHead>}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock.rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" tabIndex={0}
                onClick={() => drawer.open({ type: 'product', mode: 'edit', id: r.product_id, title: 'Product' })}
                onKeyDown={(e) => e.key === 'Enter' && drawer.open({ type: 'product', mode: 'edit', id: r.product_id, title: 'Product' })}>
                <TableCell>
                  <div className="font-medium">{r.product_name}</div>
                  {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                </TableCell>
                <TableCell>{r.warehouse_name ?? '—'}</TableCell>
                <TableCell className="text-xs">{r.location_code}</TableCell>
                <TableCell className="text-xs">{r.lot_name ?? '—'}{r.expiry_date ? ` · exp ${r.expiry_date.slice(0, 10)}` : ''}</TableCell>
                <TableCell className={`text-right tabular-nums ${Number(r.quantity) < 0 ? 'text-destructive' : ''}`}>{qty(r.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(r.reserved_quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(r.free_quantity)}</TableCell>
                {money && <TableCell className="text-right tabular-nums">{qty(r.stock_value)}</TableCell>}
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  {hasPermission('adjust_stock') && <Button size="sm" variant="ghost" onClick={() => setAdjusting(r)}>Adjust</Button>}
                </TableCell>
              </TableRow>
            ))}
            {!stock.rows.length && (
              <TableRow>
                <TableCell colSpan={money ? 9 : 8} className="py-12 text-center text-sm text-muted-foreground">
                  {stock.isLoading ? 'Loading…' : 'No stock here yet. Receive it with a transfer, or adjust it in.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <LoadMore hasNextPage={stock.hasNextPage} isFetchingNextPage={stock.isFetchingNextPage} fetchNextPage={stock.fetchNextPage}
        loaded={stock.rows.length} total={stock.total} noun="stock lines" />

      <BarcodeScanDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onScanned} title="Find a product's stock" />
      <Dialog open={!!adjusting} onOpenChange={(o) => !o && setAdjusting(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>Add (+) or remove (−) stock at one location; the reason is kept in the history.</DialogDescription>
          </DialogHeader>
          {adjusting && (
            <AdjustStockForm
              productId={adjusting === 'new' ? productFilter?.id : adjusting.product_id}
              locationId={adjusting === 'new' ? undefined : adjusting.location_id}
              lotId={adjusting === 'new' ? undefined : adjusting.lot_id ?? undefined}
              onDone={() => setAdjusting(null)} onCancel={() => setAdjusting(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
