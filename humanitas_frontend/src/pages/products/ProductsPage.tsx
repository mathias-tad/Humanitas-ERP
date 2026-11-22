import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BadgeCheck, Camera, Download, Package, Plus, Search, Settings2, TriangleAlert } from 'lucide-react';
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
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import { BarcodeScanDialog } from '@/components/platform/BarcodeScanDialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { ScannerSettingsDialog } from '@/components/platform/ScannerSettingsDialog';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import '@/components/products/registerProductEntities';
import { LoadMore } from '@/components/platform/InfiniteList';
import {
  EIMS_ISSUE_TEXT, downloadProductsCsv, lookupProduct, useInfiniteProducts, useProductCategories, type ProductFilters, type ProductType,
} from '@/hooks/useProducts';

const TYPE_LABEL: Record<ProductType, string> = { storable: 'Stock item', consumable: 'Consumable', service: 'Service' };
const ALL = '__all__';

export default function ProductsPage() {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const [scanOpen, setScanOpen] = useState(false);
  const [scannerSettingsOpen, setScannerSettingsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ProductFilters>({ status: 'active', page: 1, limit: 25, sort: 'name', order: 'asc' });
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: search.trim() || undefined, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);
  // 40 at a time; more load as the list is scrolled (rule 24 item 21).
  const { page: _page, limit: _limit, ...listFilters } = filters;
  const products = useInfiniteProducts(listFilters);
  const categories = useProductCategories();
  const rows = products.rows;

  const openProduct = (id: string) => drawer.open({ type: 'product', mode: 'edit', id, title: 'Product' });

  /** Scan → open the matching product, or offer to create one with that barcode. */
  const onScanned = async (code: string) => {
    try {
      const found = await lookupProduct(code);
      if (found) return openProduct(found.id);
      if (hasPermission('create_products')) {
        toast.info(`No product has ${code} yet. Fill in the details to create it.`);
        drawer.open({ type: 'product', mode: 'create', initial: { barcode: code } });
      } else {
        toast.error(`No product has the barcode ${code}.`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  // USB/Bluetooth scanners work anywhere on this page, no need to click into a field.
  useBarcodeScanner(onScanned);

  // Keyboard shortcuts (press ? for the list).
  useShortcuts([
    ...(hasPermission('create_products')
      ? [{ keys: 'n', description: 'New product', group: 'Products', run: () => drawer.open({ type: 'product', mode: 'create' }) }]
      : []),
    { keys: '/', description: 'Search products', group: 'Products', run: () => searchRef.current?.focus() },
    { keys: 's', description: 'Scan a barcode with the camera', group: 'Products', run: () => setScanOpen(true) },
    ...(hasPermission('export_products')
      ? [{ keys: 'e', description: 'Export to CSV', group: 'Products', run: () => { downloadProductsCsv(filters).catch((err) => toast.error(errorMessage(err))); } }]
      : []),
  ]);

  // The command palette's "New product" opens /products?new=1.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setSearchParams((p) => { p.delete('new'); return p; }, { replace: true });
    if (hasPermission('create_products')) drawer.open({ type: 'product', mode: 'create' });
  }, [searchParams, setSearchParams, hasPermission, drawer]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Products"
        description="Your product catalog: goods, consumables and services with units, prices and barcodes."
        actions={
          <div className="flex gap-2">
            {hasPermission('export_products') && (
              <Button variant="outline" onClick={() => downloadProductsCsv(filters).catch((e) => toast.error(errorMessage(e)))} title={shortcutHint('Export to CSV', 'e')}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            )}
            {hasPermission('create_products') && (
              <Button onClick={() => drawer.open({ type: 'product', mode: 'create' })} title={shortcutHint('New product', 'n')}>
                <Plus className="mr-2 h-4 w-4" /> New product
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} className="pl-8" placeholder="Search name, item code, SKU or barcode" title={shortcutHint('Search products', '/')} aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => setScanOpen(true)} aria-label="Scan a barcode" title={`${shortcutHint('Scan with the camera', 's')}. A USB or Bluetooth barcode scanner works anywhere on this page without clicking.`}>
          <Camera className="mr-2 h-4 w-4" /> Scan
        </Button>
        <BarcodeScanDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={onScanned} title="Find a product by barcode" />
        <Button variant="ghost" size="icon" onClick={() => setScannerSettingsOpen(true)} aria-label="Scanner settings" title="Barcode scanner settings">
          <Settings2 className="h-4 w-4" />
        </Button>
        <ScannerSettingsDialog open={scannerSettingsOpen} onOpenChange={setScannerSettingsOpen} />
        <Select value={filters.category_id ?? ALL} onValueChange={(v) => setFilters((f) => ({ ...f, category_id: v === ALL ? undefined : v, page: 1 }))}>
          <SelectTrigger className="w-56" aria-label="Category"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_path}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.product_type ?? ALL} onValueChange={(v) => setFilters((f) => ({ ...f, product_type: v === ALL ? undefined : (v as ProductType), page: 1 }))}>
          <SelectTrigger className="w-40" aria-label="Type"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {(Object.keys(TYPE_LABEL) as ProductType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.eims ?? ALL} onValueChange={(v) => setFilters((f) => ({ ...f, eims: v === ALL ? undefined : (v as ProductFilters['eims']), page: 1 }))}>
          <SelectTrigger className="w-48" aria-label="E-invoicing"><SelectValue placeholder="E-invoicing: any" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>E-invoicing: any</SelectItem>
            <SelectItem value="ready">Ready for e-invoicing</SelectItem>
            <SelectItem value="not_ready">Needs fixing</SelectItem>
          </SelectContent>
        </Select>
        <Tabs value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as ProductFilters['status'], page: 1 }))}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Sales price</TableHead>
              <TableHead>Tax</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>E-invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => openProduct(p.id)} tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && openProduct(p.id)}>
                <TableCell>
                  <div className="font-medium">
                    {p.name} {!p.is_active && <Badge variant="outline" className="ml-1">Archived</Badge>}
                    {p.has_variants && <Badge variant="secondary" className="ml-1">{p.variant_count} variant{p.variant_count === 1 ? '' : 's'}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.item_code}{p.sku && p.sku !== p.item_code ? ` · ${p.sku}` : ''}</div>
                </TableCell>
                <TableCell>{p.category_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{TYPE_LABEL[p.product_type]}</TableCell>
                <TableCell>{p.uom_symbol ?? p.uom_name}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(p.sales_price).toFixed(2)}</TableCell>
                <TableCell className="text-xs">{p.tax_code}</TableCell>
                <TableCell className="font-mono text-xs">{p.barcodes?.find((b) => b.is_primary)?.barcode ?? '—'}</TableCell>
                <TableCell>
                  {p.eims_ready ? (
                    <BadgeCheck className="h-4 w-4 text-emerald-600" aria-label="Ready for e-invoicing" />
                  ) : (
                    <span title={(p.eims_issues ?? []).map((i) => EIMS_ISSUE_TEXT[i] ?? i).join('\n')}>
                      <TriangleAlert className="h-4 w-4 text-amber-600" aria-label="Not ready for e-invoicing" />
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  {products.isLoading ? 'Loading products…' : (
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 opacity-40" />
                      {filters.q ? `No products match “${filters.q}”.` : 'No products yet.'}
                      {hasPermission('create_products') && (
                        <Button size="sm" variant="outline"
                          onClick={() => drawer.open({ type: 'product', mode: 'create', initial: filters.q ? { name: filters.q } : undefined })}>
                          <Plus className="mr-1 h-3 w-3" /> {filters.q ? `Create “${filters.q}”` : 'Create the first product'}
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LoadMore
        hasNextPage={!!products.hasNextPage}
        isFetchingNextPage={products.isFetchingNextPage}
        fetchNextPage={products.fetchNextPage}
        loaded={rows.length}
        total={products.total}
        noun="products"
      />
    </div>
  );
}
