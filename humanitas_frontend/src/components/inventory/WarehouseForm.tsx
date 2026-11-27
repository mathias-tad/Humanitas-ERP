import { useEffect, useState, type FormEvent } from 'react';
import { Archive, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import type { EntityFormProps } from '@/components/platform/entityRegistry';
import { CompanyBranchSelect } from '@/components/platform/CompanyBranchSelect';
import {
  useArchiveWarehouse, useCreateWarehouse, useRestoreWarehouse, useUpdateWarehouse, useWarehouse,
  type Warehouse, type WarehouseInput,
} from '@/hooks/useInventory';

/** The code may contain letters, digits, dot, dash, underscore and slash only (the backend re-checks). */
export const WAREHOUSE_CODE_RE = /^[A-Za-z0-9._\-/]+$/;

export interface WarehouseFormState {
  code: string;
  name: string;
  short_name: string;
  address: string;
  city: string;
  phone: string;
  /** On by default: build the virtual locations and the default storage location with the warehouse. */
  create_default_locations: boolean;
}

export function emptyWarehouseForm(initial?: Record<string, unknown>): WarehouseFormState {
  return {
    code: String(initial?.code ?? ''),
    name: String(initial?.name ?? ''),
    short_name: String(initial?.short_name ?? ''),
    address: String(initial?.address ?? ''),
    city: String(initial?.city ?? ''),
    phone: String(initial?.phone ?? ''),
    create_default_locations: initial?.create_default_locations === undefined ? true : !!initial.create_default_locations,
  };
}

export function warehouseToForm(w: Warehouse): WarehouseFormState {
  return {
    code: w.code,
    name: w.name,
    short_name: w.short_name ?? '',
    address: w.address ?? '',
    city: w.city ?? '',
    phone: w.phone ?? '',
    create_default_locations: false,
  };
}

export function warehouseFormToInput(
  f: WarehouseFormState,
  scope: { company_id: string | null; branch_id: string | null },
  opts?: { create_default_locations?: boolean },
): WarehouseInput {
  return {
    code: f.code.trim(),
    name: f.name.trim(),
    short_name: f.short_name.trim() || null,
    address: f.address.trim() || null,
    city: f.city.trim() || null,
    phone: f.phone.trim() || null,
    ...(opts?.create_default_locations ? { create_default_locations: true } : {}),
    company_id: scope.company_id,
    branch_id: scope.branch_id,
  };
}

/** Client-side checks; the API validates again. Returns field → message. */
export function validateWarehouseForm(f: WarehouseFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Name is required';
  if (!f.code.trim()) errors.code = 'Code is required';
  else if (f.code.trim().length > 16 || !WAREHOUSE_CODE_RE.test(f.code.trim())) errors.code = 'Up to 16 letters, digits, . _ - /';
  return errors;
}

export function WarehouseForm({ mode, id, initial, onSaved, onCancel }: EntityFormProps<Warehouse>) {
  const { hasPermission } = useAuth();
  const [form, setForm] = useState<WarehouseFormState>(() => emptyWarehouseForm(initial));
  const [companyId, setCompanyId] = useState<string | null | undefined>(undefined);
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateWarehouse();
  const update = useUpdateWarehouse();
  const archive = useArchiveWarehouse();
  const restore = useRestoreWarehouse();
  const currentQ = useWarehouse(mode === 'edit' ? id : undefined);
  const current = mode === 'edit' ? currentQ.data : undefined;
  const loaded = mode === 'create' || (mode === 'edit' && (!!current || currentQ.isError));
  const active = current ? current.is_active : true;

  useEffect(() => {
    if (mode === 'create') {
      setForm((f) => ({ ...f, name: String(initial?.name ?? f.name) }));
      return;
    }
    if (current) {
      setForm(warehouseToForm(current));
      setCompanyId(current.company_id ?? null);
      setBranchId(current.branch_id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, current]);

  const set = <K extends keyof WarehouseFormState>(key: K, value: WarehouseFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const canSave = mode === 'create' ? hasPermission('create_warehouses') : hasPermission('edit_warehouses');
  const saving = create.isPending || update.isPending;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const errors = validateWarehouseForm(form);
    if (Object.keys(errors).length) return setError(errors[Object.keys(errors)[0]]);
    setError(null);
    const input = warehouseFormToInput(form, {
      company_id: companyId === undefined ? null : companyId,
      branch_id: branchId === undefined ? null : branchId,
    }, { create_default_locations: mode === 'create' && form.create_default_locations });
    try {
      const saved = mode === 'create' ? await create.mutateAsync(input) : await update.mutateAsync({ id: id!, input });
      toast.success(mode === 'create' ? `Warehouse “${saved.name}” created` : 'Warehouse saved');
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  useShortcuts([
    {
      keys: 'mod+s', allowInInputs: true, description: 'Save warehouse', group: 'Warehouse',
      run: () => {
        const el = document.activeElement;
        if (el instanceof HTMLButtonElement) return;
        void submit();
      },
    },
  ]);

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4" aria-label="Warehouse form">
      <fieldset disabled={!canSave || saving || !loaded} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="w-name">Name *</Label>
          <Input id="w-name" autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Addis Main Warehouse" maxLength={200} />
          {error && error !== 'Name is required' && <p className="text-xs text-destructive" role="alert">{error}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="w-code">Code *</Label>
            <Input id="w-code" data-barcode-input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. WH-ADD" maxLength={16} />
            {error && error.startsWith('Up to') && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-short">Short name</Label>
            <Input id="w-short" value={form.short_name} onChange={(e) => set('short_name', e.target.value)} placeholder="e.g. Addis main" maxLength={32} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="w-address">Address</Label>
          <Textarea id="w-address" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="w-city">City</Label>
            <Input id="w-city" value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-phone">Phone</Label>
            <Input id="w-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={50} />
          </div>
        </div>
        {mode === 'create' && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.create_default_locations} onCheckedChange={(v) => set('create_default_locations', v)} />
            Create the default storage locations with the warehouse
          </label>
        )}
        <CompanyBranchSelect
          companyId={companyId} onCompanyChange={setCompanyId}
          showBranch branchId={branchId} onBranchChange={setBranchId}
          idPrefix="warehouse"
        />
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div className="flex gap-2">
          {mode === 'edit' && id && active && hasPermission('delete_warehouses') && (
            <Button type="button" variant="outline" disabled={archive.isPending}
              onClick={async () => {
                try { const saved = await archive.mutateAsync(id); toast.success('Warehouse archived'); onSaved(saved); }
                catch (err) { toast.error(errorMessage(err)); }
              }}>
              {archive.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />} Archive
            </Button>
          )}
          {mode === 'edit' && id && !active && hasPermission('edit_warehouses') && (
            <Button type="button" variant="outline" disabled={restore.isPending}
              onClick={async () => {
                try { const saved = await restore.mutateAsync(id); toast.success('Warehouse restored'); onSaved(saved); }
                catch (err) { toast.error(errorMessage(err)); }
              }}>
              {restore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />} Restore
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          {canSave && (
            <Button type="submit" disabled={saving || !loaded} title={shortcutHint('Save warehouse', 'mod+s')}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {mode === 'create' ? 'Create warehouse' : 'Save'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
