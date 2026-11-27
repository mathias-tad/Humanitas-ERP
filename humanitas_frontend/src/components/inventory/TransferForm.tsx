import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Play, Plus, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { lookupProduct } from '@/hooks/useProducts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import type { EntityFormProps } from '@/components/platform/entityRegistry';
import { EntityPicker } from '@/components/platform/EntityPicker';
import { CompanyBranchSelect } from '@/components/platform/CompanyBranchSelect';
import {
  useCancelTransfer, useCreateTransfer, useInfiniteInventoryWarehouses, useLocations, useStartTransfer, useTransfer, useUpdateTransfer,
  useValidateTransfer, TRANSFER_STATE_LABELS, TRANSFER_TYPES, TRANSFER_TYPE_LABELS,
  type TransferMoveInput, type TransferRow, type TransferType,
} from '@/hooks/useInventory';
import '@/components/products/registerProductEntities';
import '@/components/inventory/registerInventoryEntities';

const ALL = '__all__';

interface MoveLine {
  key: string;
  product_id: string;
  product_label: string | null;
  from_location_id: string;
  to_location_id: string;
  quantity: string;
  unit_cost: string;
}

/** A move line's user-entered fields, ready for the API; null until the row has a product and quantity. */
export function lineToMove(l: MoveLine): TransferMoveInput | null {
  if (!l.product_id || !l.quantity.trim()) return null;
  const quantity = Number(l.quantity);
  if (Number.isNaN(quantity) || quantity === 0) return null;
  return {
    product_id: l.product_id,
    quantity,
    from_location_id: l.from_location_id || null,
    to_location_id: l.to_location_id || null,
    ...(l.unit_cost.trim() && !Number.isNaN(Number(l.unit_cost)) ? { unit_cost: Number(l.unit_cost) } : {}),
  };
}

/** A Select over ids already loaded elsewhere (warehouses, locations), so no second fetch. */
function idPicker(options: { id: string; code: string; name: string }[], value: string, onChange: (v: string) => void, placeholder: string, triggerId: string) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger id={triggerId} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name} · {o.code}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function TransferForm({ mode, id, initial, onSaved, onCancel }: EntityFormProps<TransferRow>) {
  const { hasPermission } = useAuth();
  const [transferType, setTransferType] = useState<TransferType>(((initial?.transfer_type as TransferType) ?? 'internal'));
  const [partnerName, setPartnerName] = useState(String(initial?.partner_name ?? ''));
  const [origin, setOrigin] = useState(String(initial?.origin ?? ''));
  const [reason, setReason] = useState(String(initial?.reason ?? ''));
  const [notes, setNotes] = useState(String(initial?.notes ?? ''));
  const [scheduledDate, setScheduledDate] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState<string>(String(initial?.from_warehouse_id ?? ''));
  const [toWarehouseId, setToWarehouseId] = useState<string>(String(initial?.to_warehouse_id ?? ''));
  const [companyId, setCompanyId] = useState<string | null | undefined>(undefined);
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined);
  const [lines, setLines] = useState<MoveLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const detailQ = useTransfer(mode === 'edit' ? id : undefined);
  const detail = mode === 'edit' ? detailQ.data : undefined;
  const create = useCreateTransfer();
  const update = useUpdateTransfer();
  const loaded = mode === 'create' || (!!detail || detailQ.isError);

  const warehouses = useInfiniteInventoryWarehouses({});
  const warehouseRows: { id: string; code: string; name: string }[] = useMemo(
    () => warehouses.rows.map((w) => ({ id: w.id, code: w.code, name: w.name })),
    [warehouses.rows],
  );
  const fromLocations = useLocations({ warehouse_id: fromWarehouseId || undefined });
  const toLocations = useLocations({ warehouse_id: toWarehouseId || undefined });

  // Pre-fill the document's fields once it is loaded.
  useEffect(() => {
    if (mode !== 'edit' || !detail) return;
    setTransferType(detail.transfer_type);
    setPartnerName(detail.partner_name ?? '');
    setOrigin(detail.origin ?? '');
    setReason(detail.reason ?? '');
    setNotes(detail.notes ?? '');
    setScheduledDate(detail.scheduled_date ? detail.scheduled_date.slice(0, 10) : '');
    setFromWarehouseId(detail.from_warehouse_id ?? '');
    setToWarehouseId(detail.to_warehouse_id ?? '');
    setCompanyId(detail.company_id ?? null);
    setBranchId(detail.branch_id ?? null);
  }, [mode, detail]);

  // Switching the type or warehouses changes which location trees apply: drop the old lines.
  useEffect(() => setLines([]), [transferType, fromWarehouseId, toWarehouseId]);

  const finished = detail?.state === 'done' || detail?.state === 'cancelled';
  const canSave = !finished && (mode === 'create' ? hasPermission('create_transfers') : hasPermission('edit_transfers'));
  const saving = create.isPending || update.isPending;
  const start = useStartTransfer();
  const validate = useValidateTransfer();
  const cancelTransfer = useCancelTransfer();
  const acting = start.isPending || validate.isPending || cancelTransfer.isPending;
  const [confirmCancel, setConfirmCancel] = useState(false);
  const act = async (what: 'start' | 'validate' | 'cancel') => {
    if (!id) return;
    try {
      if (what === 'start') await start.mutateAsync(id);
      if (what === 'validate') await validate.mutateAsync(id);
      if (what === 'cancel') await cancelTransfer.mutateAsync(id);
      toast.success(what === 'validate' ? 'Done: the stock has moved' : what === 'start' ? 'Transfer started' : 'Transfer cancelled');
      void detailQ.refetch();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const patchLine = (i: number, patch: Partial<MoveLine>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((ls) => [...ls, {
      key: `${ls.length}-${Date.now()}`,
      product_id: '',
      product_label: null,
      from_location_id: '',
      to_location_id: '',
      quantity: '',
      unit_cost: '',
    }]);

  const moves: TransferMoveInput[] | undefined = useMemo(
    () => {
      const valid = lines.map(lineToMove).filter((m): m is TransferMoveInput => m !== null);
      return valid.length ? valid : undefined;
    },
    [lines],
  );

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!fromWarehouseId && !toWarehouseId) return setError('Choose at least a source or a destination warehouse');
    try {
      if (mode === 'create') {
        const saved: TransferRow = await create.mutateAsync({
          transfer_type: transferType,
          from_warehouse_id: fromWarehouseId || null,
          to_warehouse_id: toWarehouseId || null,
          partner_name: partnerName.trim() || null,
          origin: origin.trim() || null,
          reason: reason.trim() || null,
          notes: notes.trim() || null,
          scheduled_date: scheduledDate || null,
          company_id: companyId === undefined ? null : companyId,
          branch_id: branchId === undefined ? null : branchId,
          moves,
        });
        toast.success(`Transfer ${saved.name} created`);
        onSaved(saved);
        return;
      }
      const saved = await update.mutateAsync({
        id: id!,
        input: {
          origin: origin.trim() || null,
          partner_name: partnerName.trim() || null,
          from_warehouse_id: fromWarehouseId || null,
          to_warehouse_id: toWarehouseId || null,
          scheduled_date: scheduledDate || null,
          reason: reason.trim() || null,
          notes: notes.trim() || null,
        },
      });
      toast.success('Transfer saved');
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  // A scanned product barcode adds a line (or one more of it) while creating (rule 18).
  useBarcodeScanner(async (code) => {
    try {
      const p = await lookupProduct(code);
      if (!p) return toast.error(`No product has the barcode ${code}`);
      setLines((ls) => {
        const i = ls.findIndex((l) => l.product_id === p.id);
        if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l));
        return [...ls, { key: `${ls.length}-${Date.now()}`, product_id: p.id, product_label: p.name, from_location_id: '', to_location_id: '', quantity: '1', unit_cost: '' }];
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, { enabled: mode === 'create' });

  useShortcuts([
    { keys: 'mod+s', allowInInputs: true, description: 'Save transfer', group: 'Transfer', run: () => void submit() },
    ...(mode === 'create' ? [{ keys: 'n', description: 'Add a move line', group: 'Transfer', run: addLine }] : []),
  ]);

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4" aria-label="Transfer form">
      <fieldset disabled={!canSave || saving || !loaded} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-type">Type</Label>
            <Select value={transferType} onValueChange={(v) => setTransferType(v as TransferType)} disabled={mode === 'edit'}>
              <SelectTrigger id="t-type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRANSFER_TYPES.map((t) => <SelectItem key={t} value={t}>{TRANSFER_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-date">Scheduled date</Label>
            <Input id="t-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-from">From warehouse</Label>
            {idPicker(warehouseRows, fromWarehouseId, setFromWarehouseId, 'Receipts and returns-in: none', 't-from')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-to">To warehouse</Label>
            {idPicker(warehouseRows, toWarehouseId, setToWarehouseId, 'Deliveries and returns-out: none', 't-to')}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-partner">Partner</Label>
            <Input id="t-partner" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Supplier or customer" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-origin">Source reference</Label>
            <Input id="t-origin" data-barcode-input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g. PO-0007" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-reason">Reason</Label>
            <Input id="t-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-notes">Notes</Label>
            <Textarea id="t-notes" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {mode === 'create' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Move lines</p>
              <Button type="button" variant="outline" size="sm" onClick={addLine} title={shortcutHint('Add a move line', 'n')}>
                <Plus className="mr-1 h-3 w-3" /> Add line
              </Button>
            </div>
            {lines.map((l, i) => (
              <div key={l.key} className="space-y-2 rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <EntityPicker type="product" value={l.product_id || null} valueLabel={l.product_label}
                      onChange={(pid, rec) => patchLine(i, {
                        product_id: pid ?? '',
                        product_label: rec ? ((rec as { name?: string }).name ?? null) : null,
                      })}
                      placeholder="Product…" id={`t-product-${i}`} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">From location</Label>
                    {fromWarehouseId
                      ? idPicker((fromLocations.data ?? []).map((l) => ({ id: l.id, code: l.code, name: l.name })), l.from_location_id, (v) => patchLine(i, { from_location_id: v }), 'Not set', `t-from-${i}`)
                      : <span className="text-xs text-muted-foreground">Set a from warehouse first</span>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">To location</Label>
                    {toWarehouseId
                      ? idPicker((toLocations.data ?? []).map((l) => ({ id: l.id, code: l.code, name: l.name })), l.to_location_id, (v) => patchLine(i, { to_location_id: v }), 'Not set', `t-to-${i}`)
                      : <span className="text-xs text-muted-foreground">Set a to warehouse first</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Quantity *</Label>
                    <Input inputMode="decimal" data-barcode-input value={l.quantity} onChange={(e) => patchLine(i, { quantity: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Unit cost</Label>
                    <Input inputMode="decimal" value={l.unit_cost} onChange={(e) => patchLine(i, { unit_cost: e.target.value })} placeholder="Leave for the engine" />
                  </div>
                </div>
              </div>
            ))}
            <span className="text-xs text-muted-foreground">
              {moves?.length ? `${moves.length} move line${moves.length === 1 ? '' : 's'}` : 'No lines yet — add some before saving.'}
            </span>
          </div>
        )}

        {mode === 'edit' && detail && (
          <section aria-label="Lines and status" className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Lines</p>
              <Badge variant={detail.state === 'done' ? 'default' : detail.state === 'cancelled' ? 'destructive' : 'secondary'}>
                {TRANSFER_STATE_LABELS[detail.state]}
              </Badge>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.moves.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.product_name}{m.lot_name ? <span className="text-xs text-muted-foreground"> · {m.lot_name}</span> : null}</TableCell>
                      <TableCell className="text-xs">{m.from_location_code ?? (detail.from_warehouse_id ? 'Warehouse stock' : 'Outside')}</TableCell>
                      <TableCell className="text-xs">{m.to_location_code ?? (detail.to_warehouse_id ? 'Warehouse stock' : 'Outside')}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(m.quantity).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {!detail.moves.length && (
                    <TableRow><TableCell colSpan={4} className="py-4 text-center text-xs text-muted-foreground">No lines.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
        <CompanyBranchSelect
          companyId={companyId} onCompanyChange={setCompanyId}
          showBranch branchId={branchId} onBranchChange={setBranchId}
          idPrefix="transfer"
        />
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        {mode === 'edit' && detail && !finished && (
          <div className="mr-auto flex flex-wrap gap-2">
            {hasPermission('edit_transfers') && ['draft', 'waiting', 'ready'].includes(detail.state) && (
              <Button type="button" variant="outline" disabled={acting} onClick={() => void act('start')}><Play className="mr-1 h-4 w-4" /> Start</Button>
            )}
            {hasPermission('validate_transfers') && (
              <Button type="button" disabled={acting || !detail.moves.length} onClick={() => void act('validate')}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Mark done
              </Button>
            )}
            {hasPermission('cancel_transfers') && (
              <Button type="button" variant="ghost" className="text-destructive" disabled={acting} onClick={() => setConfirmCancel(true)}>
                <XCircle className="mr-1 h-4 w-4" /> Cancel transfer
              </Button>
            )}
          </div>
        )}
        <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel {detail?.name}?</AlertDialogTitle>
              <AlertDialogDescription>Its lines will not move any stock. A cancelled transfer cannot be reopened.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={() => void act('cancel')}>Cancel transfer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button type="button" variant="ghost" onClick={onCancel}>Close</Button>
        {canSave && (
          <Button type="submit" disabled={saving || !loaded} title={shortcutHint('Save transfer', 'mod+s')}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {mode === 'create' ? 'Create transfer' : 'Save'}
          </Button>
        )}
      </div>
    </form>
  );
}
