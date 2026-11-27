import { useEffect, useRef, useState } from 'react';
import { Archive, Boxes, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import { LoadMore } from '@/components/platform/InfiniteList';
import { ActiveScopeBanner } from '@/components/inventory/ActiveScopeBanner';
import '@/components/inventory/registerInventoryEntities';
import {
  useArchiveWarehouse, useInfiniteInventoryWarehouses, useRestoreWarehouse,
} from '@/hooks/useInventory';

type Status = 'active' | 'archived' | 'all';

export default function WarehousesPage() {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const searchRef = useRef<HTMLInputElement>(null);
  const archive = useArchiveWarehouse();
  const restore = useRestoreWarehouse();

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const warehouses = useInfiniteInventoryWarehouses({
    search: term || undefined,
    include_archived: status !== 'active',
  });
  const rows = (warehouses.rows ?? [])
    .filter((w) => (status === 'active' ? w.is_active : status === 'archived' ? !w.is_active : true));

  const openWarehouse = (id: string, name?: string) =>
    drawer.open({ type: 'warehouse', mode: 'edit', id, title: name ? `Warehouse ${name}` : 'Warehouse' });

  useShortcuts([
    ...(hasPermission('create_warehouses')
      ? [{ keys: 'n', description: 'New warehouse', group: 'Warehouses', run: () => drawer.open({ type: 'warehouse', mode: 'create' }) }]
      : []),
    { keys: '/', description: 'Search warehouses', group: 'Warehouses', run: () => searchRef.current?.focus() },
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Warehouses"
        description="Storage sites: create a warehouse and its default storage locations, archive and restore them."
        actions={hasPermission('create_warehouses') && (
          <Button onClick={() => drawer.open({ type: 'warehouse', mode: 'create' })} title={shortcutHint('New warehouse', 'n')}>
            <Plus className="mr-2 h-4 w-4" /> New warehouse
          </Button>
        )}
      />
      <ActiveScopeBanner />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} className="pl-8" placeholder="Search code or name" title={shortcutHint('Search warehouses', '/')} aria-label="Search warehouses" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={status} onValueChange={(v) => setStatus(v as Status)}>
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
              <TableHead>Warehouse</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">Locations</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((w) => (
              <TableRow key={w.id} className="cursor-pointer" onClick={() => openWarehouse(w.id, w.name)} tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && openWarehouse(w.id, w.name)}>
                <TableCell>
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground">{w.code}</div>
                </TableCell>
                <TableCell>{[w.city, w.address].filter(Boolean).join(', ') || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{w.manager_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{w.location_count}</TableCell>
                <TableCell className="text-right tabular-nums">{w.product_count}</TableCell>
                <TableCell>{w.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Archived</Badge>}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {w.is_active ? (
                      hasPermission('delete_warehouses') && (
                        <Button variant="ghost" size="sm" onClick={async () => {
                          try { await archive.mutateAsync(w.id); toast.success(`Warehouse “${w.name}” archived`); }
                          catch (e) { toast.error(errorMessage(e)); }
                        }} aria-label={`Archive ${w.name}`}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      )
                    ) : hasPermission('edit_warehouses') && (
                      <Button variant="ghost" size="sm" onClick={async () => {
                        try { await restore.mutateAsync(w.id); toast.success(`Warehouse “${w.name}” restored`); }
                        catch (e) { toast.error(errorMessage(e)); }
                      }} aria-label={`Restore ${w.name}`}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    {hasPermission('edit_warehouses') && (
                      <Button variant="ghost" size="sm" onClick={() => openWarehouse(w.id, w.name)} aria-label={`Edit ${w.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  {warehouses.isLoading ? 'Loading warehouses…' : (
                    <div className="flex flex-col items-center gap-2">
                      <Boxes className="h-8 w-8 opacity-40" />
                      No warehouses yet.
                      {hasPermission('create_warehouses') && (
                        <Button size="sm" variant="outline" onClick={() => drawer.open({ type: 'warehouse', mode: 'create' })}>
                          <Plus className="mr-1 h-3 w-3" /> Create the first warehouse
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
        hasNextPage={!!warehouses.hasNextPage}
        isFetchingNextPage={warehouses.isFetchingNextPage}
        fetchNextPage={warehouses.fetchNextPage}
        loaded={rows.length}
        total={warehouses.total}
        noun="warehouses"
      />
    </div>
  );
}
