import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import { LoadMore } from '@/components/platform/InfiniteList';
import { ActiveScopeBanner } from '@/components/inventory/ActiveScopeBanner';
import '@/components/inventory/registerInventoryEntities';
import { useInfiniteInventoryWarehouses, useInfiniteStockMovements } from '@/hooks/useInventory';

const ALL = '__all__';
const qty = (v: string | number | undefined) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
const MOVE_LABEL: Record<string, string> = {
  receipt: 'Receipt', delivery: 'Delivery', internal: 'Internal', scrap: 'Scrap', adjustment: 'Adjustment',
  production: 'Production', consumption: 'Consumption', return: 'Return',
};

/** The stock ledger: every move that was done, newest first. It is never edited, only added to. */
export default function MovementsPage() {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const [params, setParams] = useSearchParams();
  const [warehouseId, setWarehouseId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const productId = params.get('product_id') ?? undefined;
  const money = hasPermission('view_stock_valuation');
  const warehouses = useInfiniteInventoryWarehouses({});
  const moves = useInfiniteStockMovements({
    product_id: productId, warehouse_id: warehouseId || undefined,
    from: from || undefined, to: to ? `${to}T23:59:59` : undefined,
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Stock movements" description="Every receipt, delivery, transfer and adjustment that moved stock, with who and why." />
      <ActiveScopeBanner />
      <div className="flex flex-wrap items-end gap-3">
        <Select value={warehouseId || ALL} onValueChange={(v) => setWarehouseId(v === ALL ? '' : v)}>
          <SelectTrigger className="w-52" aria-label="Warehouse"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All warehouses</SelectItem>
            {warehouses.rows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="space-y-1"><Label htmlFor="mv-from" className="text-xs">From</Label><Input id="mv-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="mv-to" className="text-xs">To</Label><Input id="mv-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {productId && (
          <Button variant="secondary" size="sm" onClick={() => setParams((p) => { p.delete('product_id'); return p; }, { replace: true })}>
            One product <X className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              {money && <TableHead className="text-right">Unit cost</TableHead>}
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {moves.rows.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-xs">{m.done_at ? new Date(m.done_at).toLocaleString() : '—'}</TableCell>
                <TableCell className="text-xs">{m.reference ?? '—'}</TableCell>
                <TableCell>{MOVE_LABEL[m.move_type] ?? m.move_type}</TableCell>
                <TableCell>
                  <button type="button" className="text-left hover:underline" onClick={() => drawer.open({ type: 'product', mode: 'edit', id: m.product_id, title: 'Product' })}>
                    {m.product_name}
                  </button>
                </TableCell>
                <TableCell className="text-xs">{m.from_location_code ?? (m.to_location_code ? 'Outside' : '—')}</TableCell>
                <TableCell className="text-xs">{m.to_location_code ?? (m.from_location_code ? 'Outside' : '—')}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(m.quantity)}</TableCell>
                {money && <TableCell className="text-right tabular-nums">{qty(m.unit_cost)}</TableCell>}
                <TableCell className="text-xs">{m.reason ?? ''}</TableCell>
              </TableRow>
            ))}
            {!moves.rows.length && (
              <TableRow>
                <TableCell colSpan={money ? 9 : 8} className="py-12 text-center text-sm text-muted-foreground">
                  {moves.isLoading ? 'Loading…' : 'No stock has moved yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <LoadMore hasNextPage={moves.hasNextPage} isFetchingNextPage={moves.isFetchingNextPage} fetchNextPage={moves.fetchNextPage}
        loaded={moves.rows.length} total={moves.total} noun="movements" />
    </div>
  );
}
