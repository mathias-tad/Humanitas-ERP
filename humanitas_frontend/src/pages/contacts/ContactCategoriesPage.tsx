import { useState, type FormEvent } from 'react';
import { Archive, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { useShortcuts, shortcutHint } from '@/lib/shortcuts';
import { usePriceLists } from '@/hooks/usePriceLists';
import { useArchiveContactCategory, useContactCategories, useSaveContactCategory, type ContactCategory } from '@/hooks/useContacts';

const NONE = '__none__';

/** Contacts -> Contact Categories: Retail, Wholesale, Corporate… with a color and an optional price list. */
export default function ContactCategoriesPage() {
  const { hasPermission } = useAuth();
  const categories = useContactCategories();
  const archive = useArchiveContactCategory();
  const [editing, setEditing] = useState<ContactCategory | 'new' | null>(null);
  useShortcuts(hasPermission('create_contact_categories') ? [{ keys: 'n', description: 'New category', group: 'Contact categories', run: () => setEditing('new') }] : []);
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Contact Categories"
        description="Group contacts (Retail, Wholesale, Corporate, Government…); a category can carry its own price list."
        actions={hasPermission('create_contact_categories') && (
          <Button onClick={() => setEditing('new')} title={shortcutHint('New category', 'n')}><Plus className="mr-2 h-4 w-4" /> New category</Button>
        )}
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Price list</TableHead>
              <TableHead className="text-right">Contacts</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(categories.data ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-2 font-medium"><span className="h-3 w-3 rounded-full" style={{ background: c.color ?? '#94a3b8' }} /> {c.name}</span>
                  {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                </TableCell>
                <TableCell className="text-sm">{c.price_list_name ?? 'Default'}</TableCell>
                <TableCell className="text-right">{c.contact_count}</TableCell>
                <TableCell className="text-right">
                  {hasPermission('edit_contact_categories') && <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>}
                  {hasPermission('delete_contact_categories') && (
                    <Button size="icon" variant="ghost" aria-label={`Archive ${c.name}`} disabled={archive.isPending}
                      onClick={() => archive.mutateAsync(c.id).then(() => toast.success('Category archived')).catch((e) => toast.error(errorMessage(e)))}>
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!categories.data?.length && (
              <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">{categories.isLoading ? 'Loading…' : 'No categories yet.'}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <CategoryDialog target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function CategoryDialog({ target, onClose }: { target: ContactCategory | 'new' | null; onClose: () => void }) {
  const { hasPermission } = useAuth();
  const save = useSaveContactCategory();
  const canSeeLists = hasPermission('view_price_lists');
  const lists = usePriceLists(false, canSeeLists);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#0EA5E9');
  const [description, setDescription] = useState('');
  const [priceListId, setPriceListId] = useState<string | null>(null);
  const key = target === 'new' ? 'new' : target?.id ?? null;
  const [prev, setPrev] = useState<string | null>(null);
  if (key !== prev) {
    setPrev(key);
    const t = target && target !== 'new' ? target : null;
    setName(t?.name ?? '');
    setColor(t?.color ?? '#0EA5E9');
    setDescription(t?.description ?? '');
    setPriceListId(t?.price_list_id ?? null);
  }
  if (!target) return null;
  const existing = target !== 'new' ? target : null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await save.mutateAsync({ id: existing?.id, input: { name: name.trim(), color, description: description.trim() || null, ...(canSeeLists ? { price_list_id: priceListId } : {}) } });
      toast.success(existing ? 'Category saved' : 'Category created');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{existing ? `Edit ${existing.name}` : 'New contact category'}</DialogTitle>
            <DialogDescription>e.g. Retail, Wholesale, Corporate or Government.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-name">Name</Label>
              <Input id="cc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-color">Color</Label>
              <Input id="cc-color" type="color" className="h-9 w-16 p-1" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="cc-desc">Description</Label>
              <Input id="cc-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
            </div>
            {canSeeLists && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="cc-pl">Price list for these customers</Label>
                <Select value={priceListId ?? NONE} onValueChange={(v) => setPriceListId(v === NONE ? null : v)}>
                  <SelectTrigger id="cc-pl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>The default price list</SelectItem>
                    {(lists.data ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || !name.trim()}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {existing ? 'Save' : 'Create category'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
