import { useState } from 'react';
import { FolderTree, Pencil, Plus } from 'lucide-react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/context/AuthContext';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import '@/components/products/registerProductEntities';
import { useProductCategories } from '@/hooks/useProducts';

export default function CategoriesPage() {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const [showArchived, setShowArchived] = useState(false);
  const categories = useProductCategories(showArchived);
  const rows = categories.data ?? [];
  const canCreate = hasPermission('create_product_categories');
  const canEdit = hasPermission('edit_product_categories');

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Product categories"
        description="Group products in a tree, e.g. Food / Grains / Teff."
        actions={canCreate && (
          <Button onClick={() => drawer.open({ type: 'product_category', mode: 'create' })}>
            <Plus className="mr-2 h-4 w-4" /> New category
          </Button>
        )}
      />
      <label className="flex items-center gap-2 text-sm"><Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived</label>
      <ul className="divide-y rounded-lg border" aria-label="Category tree">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2" style={{ paddingLeft: `${16 + c.depth * 24}px` }}>
            <div className="flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{c.name}</span>
              {c.code && <span className="text-xs text-muted-foreground">{c.code}</span>}
              {!c.is_active && <Badge variant="outline">Archived</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{c.product_count} product{c.product_count === 1 ? '' : 's'}</span>
              {canCreate && c.is_active && (
                <Button variant="ghost" size="sm" aria-label={`Add subcategory to ${c.name}`}
                  onClick={() => drawer.open({ type: 'product_category', mode: 'create', initial: { parent_id: c.id, parent_label: c.full_path } })}>
                  <Plus className="h-3 w-3" />
                </Button>
              )}
              {canEdit && (
                <Button variant="ghost" size="sm" aria-label={`Edit ${c.name}`} onClick={() => drawer.open({ type: 'product_category', mode: 'edit', id: c.id })}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          </li>
        ))}
        {!rows.length && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {categories.isLoading ? 'Loading…' : 'No categories yet.'}
          </li>
        )}
      </ul>
    </div>
  );
}
