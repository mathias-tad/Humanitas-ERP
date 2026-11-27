import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { EntityPicker } from '@/components/platform/EntityPicker';
import {
  useAdjustStock, useInfiniteInventoryWarehouses, locationOptions,
} from '@/hooks/useInventory';
import '@/components/products/registerProductEntities';

const ALL = '__all__';

interface Props {
  /** The location the adjustment is made at (e.g. picked from the stock grid). */
  locationId?: string;
  /** The product the adjustment is made for. */
  productId?: string;
  /** The lot the adjustment is made for. */
  lotId?: string;
  onDone: () => void;
  onCancel: () => void;
}

/** The "Adjust" form: a manual +in / −out at one location, with the reason recorded (rule 3 audit). */
export function AdjustStockForm({ locationId, productId, lotId, onDone, onCancel }: Props) {
  const { hasPermission } = useAuth();
  const [product, setProduct] = useState<string | null>(productId ?? null);
  const [productLabel, setProductLabel] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [locations, setLocations] = useState<{ id: string; code: string; name: string }[]>([]);
  const [location, setLocation] = useState(locationId ?? '');
  const [lot, setLot] = useState(lotId ?? '');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const adjust = useAdjustStock();
  const warehouses = useInfiniteInventoryWarehouses({});
  const canAdjust = hasPermission('adjust_stock');

  // The locations of the chosen warehouse; picking one resets the old choice.
  useEffect(() => {
    if (!warehouseId) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    locationOptions(warehouseId).then((rows) => {
      if (cancelled) return;
      setLocations(rows.map((l) => ({ id: l.id, code: l.code, name: l.name })));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [warehouseId]);

  // Without a caller-picked location, the first one of the loaded warehouse is taken.
  useEffect(() => {
    if (locationId || locations.length < 1) return;
    setLocation((prev) => prev || locations[0].id);
  }, [locations, locationId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product) return setError('Choose the product being adjusted');
    if (!location) return setError('Choose the location (set a warehouse first)');
    const qty = Number(quantity);
    if (!quantity.trim() || Number.isNaN(qty) || qty === 0) return setError('Quantity must be a non-zero number (use a minus to remove)');
    if (unitCost.trim() && (Number.isNaN(Number(unitCost)) || Number(unitCost) < 0)) return setError('Unit cost must be 0 or more');
    if (!reason.trim()) return setError('A reason is required — it is what the ledger records');
    setError(null);
    try {
      await adjust.mutateAsync({
        product_id: product,
        location_id: location,
        quantity: qty,
        lot_id: lot || null,
        ...(unitCost.trim() ? { unit_cost: Number(unitCost) } : {}),
        reason: reason.trim(),
        notes: notes.trim() || null,
      });
      toast.success(`Stock adjusted: ${qty > 0 ? '+' : ''}${qty}`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Adjust stock form">
      <fieldset disabled={!canAdjust || adjust.isPending} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Product *</Label>
          <EntityPicker type="product" value={product} valueLabel={productLabel}
            onChange={(id, rec) => { setProduct(id); setProductLabel(id ? (rec as { name?: string })?.name ?? null : null); }}
            placeholder="Pick the product…" id="adjust-product" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-warehouse">Warehouse</Label>
            <Select value={warehouseId || ALL} onValueChange={(v) => { setWarehouseId(v === ALL ? '' : v); setLocation(''); setLocations([]); }}>
              <SelectTrigger id="adjust-warehouse" className="w-full"><SelectValue placeholder="All warehouses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All warehouses</SelectItem>
                {warehouses.rows.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} · {w.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-location">Location *</Label>
            <Select value={location || ALL} onValueChange={(v) => setLocation(v === ALL ? '' : v)} disabled={!locations.length && !!warehouseId}>
              <SelectTrigger id="adjust-location" className="w-full"><SelectValue placeholder={warehouseId ? 'Pick a location' : 'Set the warehouse first'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{warehouseId ? 'Pick a location' : 'Set the warehouse first'}</SelectItem>
                {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-lot">Lot</Label>
            <Input id="adjust-lot" value={lot} onChange={(e) => setLot(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-cost">Unit cost</Label>
            <Input id="adjust-cost" inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="Leave for the engine" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-qty">Quantity * (±)</Label>
            <Input id="adjust-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="+5 in, −2 out" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-reason">Reason *</Label>
            <Input id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. damaged, counted surplus" maxLength={255} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adjust-notes">Notes</Label>
          <Textarea id="adjust-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </fieldset>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        {canAdjust && (
          <Button type="submit" disabled={adjust.isPending}>
            {adjust.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adjust stock
          </Button>
        )}
      </div>
    </form>
  );
}
