import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { useStockForProduct } from '@/hooks/useInventory';
import type { SlotProps } from '@/lib/moduleSlots';
import { AdjustStockForm } from './AdjustStockForm';

const qty = (v: string | number | undefined) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

/**
 * The product form's Stock tab. Inventory adds it through the 'product.tabs' module slot
 * (rule 30), so Products shows it only when the tenant has Inventory and never imports Inventory.
 */
export function ProductStockTab({ productId, isActive }: SlotProps['product.tabs']) {
  const { hasPermission } = useAuth();
  const stock = useStockForProduct(productId);
  const [adjusting, setAdjusting] = useState<{ locationId?: string; lotId?: string } | null>(null);
  const money = hasPermission('view_stock_valuation');
  const rows = stock.data?.data ?? [];
  const totals = stock.data?.totals;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['On hand', totals?.quantity],
          ['Reserved', totals?.reserved],
          ['Free to use', totals?.free],
          ...(money ? [['Value', totals?.value] as const] : []),
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-md border p-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold tabular-nums">{stock.isLoading ? '…' : qty(value as number)}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Link className="text-xs text-primary underline" to={`/inventory/movements?product_id=${productId}`}>Movement history</Link>
        {isActive && hasPermission('adjust_stock') && (
          <Button size="sm" variant="outline" onClick={() => setAdjusting({})}>
            <SlidersHorizontal className="mr-1 h-3 w-3" /> Adjust stock
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Warehouse</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Lot</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Free</TableHead>
              {money && <TableHead className="text-right">Value</TableHead>}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.warehouse_name ?? '—'}</TableCell>
                <TableCell className="text-xs">{r.location_code}</TableCell>
                <TableCell className="text-xs">{r.lot_name ?? '—'}{r.expiry_date ? ` · exp ${r.expiry_date.slice(0, 10)}` : ''}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(r.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(r.free_quantity)}</TableCell>
                {money && <TableCell className="text-right tabular-nums">{qty(r.stock_value)}</TableCell>}
                <TableCell className="text-right">
                  {isActive && hasPermission('adjust_stock') && (
                    <Button size="sm" variant="ghost" onClick={() => setAdjusting({ locationId: r.location_id, lotId: r.lot_id ?? undefined })}>Adjust</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={money ? 7 : 6} className="py-6 text-center text-sm text-muted-foreground">
                  {stock.isLoading ? 'Loading…' : stock.isError ? 'Stock could not be loaded.' : 'No stock yet. Receive it with a transfer or adjust it in.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!adjusting} onOpenChange={(o) => !o && setAdjusting(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>Add (+) or remove (−) stock at one location, with the reason.</DialogDescription>
          </DialogHeader>
          {adjusting && (
            <AdjustStockForm productId={productId} locationId={adjusting.locationId} lotId={adjusting.lotId}
              onDone={() => setAdjusting(null)} onCancel={() => setAdjusting(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
