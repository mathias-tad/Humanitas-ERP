import { useEffect, useRef, useState } from 'react';
import { Building2, Contact as ContactIcon, Download, Plus, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import { LoadMore } from '@/components/platform/InfiniteList';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import '@/components/contacts/registerContactEntities';
import { downloadContactsCsv, useContactCategories, useInfiniteContacts, type ContactFilters, type ContactRole, type ContactType } from '@/hooks/useContacts';

const ALL = '__all__';

/** Contacts (featureslist §4.1, CRM 1.3): companies and people; /customers shows the customers. */
export default function ContactsPage({ role: fixedRole }: { role?: ContactRole }) {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ContactFilters>({ status: 'active', sort: 'name', order: 'asc', role: fixedRole });
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: search.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [search]);
  const contacts = useInfiniteContacts(filters);
  const categories = useContactCategories();
  const rows = contacts.rows;
  const isCustomers = filters.role === 'customer';
  const noun = isCustomers ? 'customer' : filters.role === 'vendor' ? 'vendor' : 'contact';
  const open = (id: string) => drawer.open({ type: 'contact', mode: 'edit', id, title: 'Contact' });
  const create = () => drawer.open({
    type: 'contact', mode: 'create',
    initial: { ...(filters.q ? { name: filters.q } : {}), ...(filters.role === 'customer' ? { is_customer: true } : {}), ...(filters.role === 'vendor' ? { is_vendor: true } : {}) },
  });
  const exportCsv = () => downloadContactsCsv(filters).catch((e) => toast.error(errorMessage(e)));

  useShortcuts([
    ...(hasPermission('create_contacts') ? [{ keys: 'n', description: `New ${noun}`, group: 'Contacts', run: create }] : []),
    { keys: '/', description: `Search ${noun}s`, group: 'Contacts', run: () => searchRef.current?.focus() },
    ...(hasPermission('export_contacts') ? [{ keys: 'e', description: 'Export to CSV', group: 'Contacts', run: exportCsv }] : []),
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={fixedRole === 'customer' ? 'Customers' : 'Contacts'}
        description={fixedRole === 'customer'
          ? 'The companies and people you sell to: price list, credit limit, payment terms and every call and meeting.'
          : 'Companies and people for every module: customers, vendors and the people who work there.'}
        actions={
          <div className="flex gap-2">
            {hasPermission('export_contacts') && (
              <Button variant="outline" onClick={exportCsv} title={shortcutHint('Export to CSV', 'e')}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
            )}
            {hasPermission('create_contacts') && (
              <Button onClick={create} title={shortcutHint(`New ${noun}`, 'n')}><Plus className="mr-2 h-4 w-4" /> New {noun}</Button>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        {!fixedRole && (
          <Tabs value={filters.role ?? ALL} onValueChange={(v) => setFilters((f) => ({ ...f, role: v === ALL ? undefined : (v as ContactRole) }))}>
            <TabsList>
              <TabsTrigger value={ALL}>All</TabsTrigger>
              <TabsTrigger value="customer">Customers</TabsTrigger>
              <TabsTrigger value="vendor">Vendors</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} className="pl-8" placeholder="Search name, code, TIN, phone, email or person" aria-label={`Search ${noun}s`}
            title={shortcutHint(`Search ${noun}s`, '/')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filters.contact_type ?? ALL} onValueChange={(v) => setFilters((f) => ({ ...f, contact_type: v === ALL ? undefined : (v as ContactType) }))}>
          <SelectTrigger className="w-44" aria-label="Companies or people"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Companies and people</SelectItem>
            <SelectItem value="company">Companies</SelectItem>
            <SelectItem value="person">People</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.category_id ?? ALL} onValueChange={(v) => setFilters((f) => ({ ...f, category_id: v === ALL ? undefined : v }))}>
          <SelectTrigger className="w-44" aria-label="Category"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Tabs value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as ContactFilters['status'] }))}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>TIN</TableHead>
              <TableHead>Primary contact</TableHead>
              <TableHead>City</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => open(c.id)}>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-medium">
                    {c.contact_type === 'company' ? <Building2 className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                    {c.name}
                    {c.is_customer && !fixedRole && <Badge variant="secondary" className="text-[10px]">Customer</Badge>}
                    {c.is_vendor && <Badge variant="secondary" className="text-[10px]">Vendor</Badge>}
                    {!c.is_active && <Badge variant="outline">Archived</Badge>}
                  </div>
                  {c.contact_type === 'person' && c.parent_name && <div className="text-xs text-muted-foreground">{[c.job_title, c.parent_name].filter(Boolean).join(' at ')}</div>}
                  {c.tags?.length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}</div>}
                </TableCell>
                <TableCell>
                  {c.category_name && (
                    <span className="inline-flex items-center gap-1.5 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.category_color ?? '#94a3b8' }} /> {c.category_name}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{c.phone ?? c.mobile ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{c.tin ?? '—'}</TableCell>
                <TableCell className="text-sm">{c.primary_contact ?? '—'}</TableCell>
                <TableCell className="text-sm">{c.city ?? '—'}</TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  {contacts.isLoading ? 'Loading…' : (
                    <div className="flex flex-col items-center gap-2">
                      <ContactIcon className="h-8 w-8 opacity-40" />
                      {filters.q ? `No ${noun}s match “${filters.q}”.` : `No ${noun}s yet.`}
                      {hasPermission('create_contacts') && (
                        <Button size="sm" variant="outline" onClick={create}><Plus className="mr-1 h-3 w-3" /> {filters.q ? `Create “${filters.q}”` : `Add the first ${noun}`}</Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <LoadMore hasNextPage={!!contacts.hasNextPage} isFetchingNextPage={contacts.isFetchingNextPage} fetchNextPage={contacts.fetchNextPage}
        loaded={rows.length} total={contacts.total} noun={`${noun}s`} />
    </div>
  );
}

/** /customers: the contacts marked as customers. */
export function CustomersPage() {
  return <ContactsPage role="customer" />;
}
