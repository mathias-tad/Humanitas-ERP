import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorMessage } from '@/lib/errors';
import { useProductPrices } from '@/hooks/usePriceLists';

/** A product's Prices tab: its price on every price list at a quantity (each variant for a product with variants). */
export function ProductPricesPanel({ productId }: { productId: string }) {
  const [qty, setQty] = useState('1');
  const quantity = Math.max(0, Number(qty) || 1);
  const q = useProductPrices(productId, quantity);
  if (q.isLoading) return <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;
  if (q.isError || !q.data) return <p className="py-6 text-sm text-destructive">{errorMessage(q.error)}</p>;
  const { lists, rows } = q.data;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="pp-qty" className="text-sm">Quantity</Label>
        <Input id="pp-qty" className="w-24" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {rows.length > 1 && <TableHead>Variant</TableHead>}
              <TableHead className="text-right">Sales price</TableHead>
              {lists.map((l) => <TableHead key={l.id} className="text-right">{l.name}{l.is_default && <Badge variant="secondary" className="ml-1">Default</Badge>}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.product_id}>
                {rows.length > 1 && <TableCell className="font-medium">{r.name}</TableCell>}
                <TableCell className="text-right tabular-nums">{r.base_price.toFixed(2)}</TableCell>
                {lists.map((l) => {
                  const c = r.prices[l.id];
                  return (
                    <TableCell key={l.id} className="text-right tabular-nums" title={c?.source === 'rule' ? 'Set by a rule on this list' : 'No rule: the sales price'}>
                      {c ? `${c.price.toFixed(2)} ${l.currency}` : '—'}
                      {c?.source === 'base' && <span className="block text-[10px] text-muted-foreground">sales price</span>}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Change prices on <Link to="/products/pricelists" className="text-primary underline">Products → Price Lists</Link>.</p>
    </div>
  );
}
