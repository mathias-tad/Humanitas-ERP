import { useState } from 'react';
import { FolderTree, Pencil, Plus } from 'lucide-react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/context/AuthContext';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import { LocationForm } from '@/components/inventory/LocationForm';
import { ActiveScopeBanner } from '@/components/inventory/ActiveScopeBanner';
import {
  useInfiniteInventoryWarehouses, useLocationsTree, LOCATION_USAGE_LABELS,
  type LocationTreeNode,
} from '@/hooks/useInventory';

const ALL = '__all__';

interface EditTarget {
  mode: 'create' | 'edit';
  id?: string;
  warehouseId?: string;
  parentId?: string;
  parentLabel?: string;
  title: string;
}

function LocationNode({ node, depth, onEdit, onAddChild }: {
  node: LocationTreeNode;
  depth: number;
  onEdit: (target: EditTarget) => void;
  onAddChild: (target: EditTarget) => void;
}) {
  const { hasPermission } = useAuth();
  const usage = LOCATION_USAGE_LABELS[node.usage as keyof typeof LOCATION_USAGE_LABELS] ?? node.usage;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-4 py-2" style={{ paddingLeft: `${16 + depth * 24}px` }}>
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{node.name}</span>
          <span className="text-xs text-muted-foreground">{node.code}</span>
          <Badge variant="outline">{usage}</Badge>
          {node.barcode && <span className="font-mono text-xs text-muted-foreground">{node.barcode}</span>}
          {!node.is_active && <Badge variant="outline">Archived</Badge>}
          {typeof node.product_count === 'number' && node.product_count > 0 && (
            <span className="text-xs text-muted-foreground">{node.product_count} product{node.product_count === 1 ? '' : 's'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('create_inventory_locations') && (
            <Button variant="ghost" size="sm" aria-label={`Add sub-location to ${node.name}`}
              onClick={() => onAddChild({ mode: 'create', warehouseId: node.warehouse_id ?? undefined, parentId: node.id, title: `New location under ${node.name}` })}>
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {hasPermission('edit_inventory_locations') && (
            <Button variant="ghost" size="sm" aria-label={`Edit ${node.name}`}
              onClick={() => onEdit({ mode: 'edit', id: node.id, title: `Location ${node.code}` })}>
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {(node.children ?? []).map((c) => (
        <LocationNode key={c.id} node={c} depth={depth + 1} onEdit={onEdit} onAddChild={onAddChild} />
      ))}
    </div>
  );
}

export default function LocationsPage() {
  const { hasPermission } = useAuth();
  const [warehouseId, setWarehouseId] = useState<string>(ALL);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const selected = warehouseId === ALL ? undefined : warehouseId;
  const warehouses = useInfiniteInventoryWarehouses({ include_archived: showArchived });
  const tree = useLocationsTree(selected);

  useShortcuts([
    ...(hasPermission('create_inventory_locations') && selected
      ? [{ keys: 'n', description: 'New location in the warehouse', group: 'Locations', run: () => setEditing({ mode: 'create', warehouseId: selected, title: 'New location' }) }]
      : []),
  ]);

  const openEdit = (target: EditTarget) => setEditing(target);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Storage locations"
        description="The Warehouse → Zone → Aisle → Bin tree of each storage site."
        actions={hasPermission('create_inventory_locations') && (
          <Button onClick={() => setEditing({ mode: 'create', warehouseId: selected, title: 'New location' })}
            disabled={!selected} title={shortcutHint('New location', 'n')}>
            <Plus className="mr-2 h-4 w-4" /> New location
          </Button>
        )}
      />
      <ActiveScopeBanner />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-64" aria-label="Warehouse"><SelectValue placeholder="All warehouses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All warehouses</SelectItem>
            {(warehouses.rows ?? []).map((w) => <SelectItem key={w.id} value={w.id}>{w.name} · {w.code}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived warehouses</label>
      </div>

      <ul className="divide-y rounded-lg border" aria-label="Location tree">
        {(tree.data ?? []).map((top) => (
          <li key={top.id}>
            <LocationNode node={top} depth={0} onEdit={openEdit} onAddChild={openEdit} />
          </li>
        ))}
        {!(tree.data ?? []).length && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {tree.isLoading ? 'Loading locations…' : selected ? 'This warehouse has no active locations yet.' : 'Choose a warehouse to see its location tree.'}
          </li>
        )}
      </ul>

      {editing && (
        <Sheet open onOpenChange={(o) => !o && setEditing(null)}>
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing.title}</SheetTitle>
              <SheetDescription className="sr-only">{editing.title}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              <LocationForm
                key={editing.id ?? `${editing.warehouseId ?? 'none'}-${editing.parentId ?? 'top'}`}
                mode={editing.mode}
                id={editing.id}
                warehouseId={editing.warehouseId}
                parentId={editing.parentId}
                onDone={() => setEditing(null)}
                onClose={() => setEditing(null)}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
