import { useEffect, useState, type FormEvent } from 'react';
import { Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import { CompanyBranchSelect } from '@/components/platform/CompanyBranchSelect';
import {
  useArchiveLocation, useCreateLocation, useLocation, useLocationsTree, useUpdateLocation,
  LOCATION_USAGE_LABELS,
  type LocationRow, type LocationUsage,
} from '@/hooks/useInventory';

const CODE_RE = /^[A-Za-z0-9._\-/]+$/;

export function validateLocationForm(f: { code: string; name: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Name is required';
  if (!f.code.trim()) errors.code = 'Code is required';
  else if (f.code.trim().length > 64 || !CODE_RE.test(f.code.trim())) errors.code = 'Up to 64 letters, digits, . _ - /';
  return errors;
}

interface Props {
  mode: 'create' | 'edit';
  id?: string;
  /** Create: which warehouse the location is a child of; edit: the location itself. */
  warehouseId?: string;
  /** Create: the parent location (a node of the tree), when adding under one. */
  parentId?: string;
  /** The parent's code, shown locked when adding under a specific node. */
  parentLabel?: string;
  onDone: () => void;
  onClose: () => void;
}

/** The create/edit form, shown inside a Sheet on the Locations page. */
export function LocationForm({ mode, id, warehouseId, parentId, onDone, onClose }: Props) {
  const { hasPermission } = useAuth();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [usage, setUsage] = useState<LocationUsage>('internal');
  const [barcode, setBarcode] = useState('');
  const [parent, setParent] = useState<string>(parentId ?? '__top__');
  const [companyId, setCompanyId] = useState<string | null | undefined>(undefined);
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const currentQ = useLocation(mode === 'edit' ? id : undefined);
  const current = mode === 'edit' ? currentQ.data : undefined;
  const tree = useLocationsTree(warehouseId ?? current?.warehouse_id ?? undefined);
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const archive = useArchiveLocation();

  useEffect(() => {
    if (current) {
      setCode(current.code);
      setName(current.name);
      setUsage((current.usage as LocationUsage) ?? 'internal');
      setBarcode(current.barcode ?? '');
      setCompanyId(current.company_id ?? null);
      setBranchId(current.branch_id ?? null);
    }
  }, [current]);

  const canSave = mode === 'create' ? hasPermission('create_inventory_locations') : hasPermission('edit_inventory_locations');
  const saving = create.isPending || update.isPending;
  // Only locations of the same warehouse can be the parent.
  const parents = (tree.data ?? []).flatMap((top) => [top, ...(top.children ?? [])]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = validateLocationForm({ code, name });
    if (Object.keys(errors).length) return setError(errors[Object.keys(errors)[0]]);
    setError(null);
    const body = {
      code: code.trim(),
      name: name.trim(),
      usage,
      barcode: barcode.trim() || null,
      company_id: companyId === undefined ? null : companyId,
      branch_id: branchId === undefined ? null : branchId,
    };
    try {
      if (mode === 'create') {
        const saved = await create.mutateAsync({
          warehouse_id: warehouseId ?? null,
          parent_id: parent === '__top__' ? null : parent,
          ...body,
        });
        toast.success(`Location “${saved.name}” created`);
      } else {
        await update.mutateAsync({ id: id!, input: { ...body, parent_id: undefined } });
        toast.success('Location saved');
      }
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useShortcuts([
    { keys: 'mod+s', allowInInputs: true, description: 'Save location', group: 'Location', run: () => void submit(new Event('submit') as unknown as FormEvent) },
  ]);

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Location form">
      <fieldset disabled={!canSave || saving || (mode === 'edit' && !current)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="l-name">Name *</Label>
          <Input id="l-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zone A" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-code">Code *</Label>
          <Input id="l-code" data-barcode-input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. WH-ADD/ZA-01" maxLength={64} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Usage</Label>
            <Select value={usage} onValueChange={(v) => setUsage(v as LocationUsage)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(LOCATION_USAGE_LABELS) as LocationUsage[]).map((u) => <SelectItem key={u} value={u}>{LOCATION_USAGE_LABELS[u]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-barcode">Barcode</Label>
            <Input id="l-barcode" data-barcode-input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Optional" maxLength={128} />
          </div>
        </div>
        {mode === 'create' && parents.length > 0 && (
          <div className="space-y-1.5">
            <Label>Parent</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__top__">Top level of this warehouse</SelectItem>
                {parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {mode === 'create' && (
          <CompanyBranchSelect companyId={companyId} onCompanyChange={setCompanyId} showBranch branchId={branchId} onBranchChange={setBranchId} idPrefix="location" />
        )}
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div>
          {mode === 'edit' && id && current?.is_active && hasPermission('delete_inventory_locations') && (
            <Button type="button" variant="outline" disabled={archive.isPending}
              onClick={async () => {
                try { await archive.mutateAsync(id); toast.success('Location archived'); onDone(); }
                catch (err) { setError(errorMessage(err)); }
              }}>
              {archive.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />} Archive
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          {canSave && (
            <Button type="submit" disabled={saving || (mode === 'edit' && !current)} title={shortcutHint('Save location', 'mod+s')}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {mode === 'create' ? 'Create location' : 'Save'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export type { LocationRow };
