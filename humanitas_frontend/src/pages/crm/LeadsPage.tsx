import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, Download, Plus, Search, UserPlus } from 'lucide-react';
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
import '@/components/crm/registerCrmEntities';
import '@/components/contacts/registerContactEntities';
import { CrmListSelect } from '@/components/crm/CrmCommon';
import {
  LEAD_STATUS_LABEL, downloadCrmCsv, formatMoney, leadWho, useInfiniteLeads, useLeadCounts, type LeadFilters, type LeadStatus,
} from '@/hooks/useCrm';

const TABS: { value: LeadStatus | 'open' | 'all'; label: string }[] = [
  { value: 'open', label: 'Open' }, { value: 'new', label: 'New' }, { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' }, { value: 'converted', label: 'Converted' }, { value: 'lost', label: 'Lost' }, { value: 'all', label: 'All' },
];
const STATUS_STYLE: Record<LeadStatus, string> = {
  new: 'bg-sky-100 text-sky-800', contacted: 'bg-indigo-100 text-indigo-800', qualified: 'bg-emerald-100 text-emerald-800',
  converted: 'bg-slate-100 text-slate-700', lost: 'bg-red-100 text-red-800',
};

/** CRM -> Leads (CRM 1.1): capture, assign, qualify and convert. */
export default function LeadsPage() {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const searchRef = useRef<HTMLInputElement>(null);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('open');
  const [owner, setOwner] = useState<'all' | 'me'>('all');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [q, setQ] = useState<string | undefined>();
  useEffect(() => { const t = setTimeout(() => setQ(search.trim() || undefined), 300); return () => clearTimeout(t); }, [search]);

  const base: Omit<LeadFilters, 'status'> = { q, ...(owner === 'me' ? { owner_id: 'me' } : {}), ...(sourceId ? { source_id: sourceId } : {}) };
  const filters: LeadFilters = { ...base, ...(tab === 'all' ? {} : { status: tab }) };
  const leads = useInfiniteLeads(filters);
  const counts = useLeadCounts(base).data ?? {};
  const countOf = (t: (typeof TABS)[number]['value']) =>
    t === 'all' ? undefined : t === 'open' ? (counts.new ?? 0) + (counts.contacted ?? 0) + (counts.qualified ?? 0) : counts[t];

  const create = () => drawer.open({ type: 'crm_lead', mode: 'create', title: 'New lead' });
  const openLead = (id: string) => drawer.open({ type: 'crm_lead', mode: 'edit', id, title: 'Lead' });
  useShortcuts([
    ...(hasPermission('create_crm_leads') ? [{ keys: 'n', description: 'New lead', group: 'Leads', run: create }] : []),
    { keys: '/', description: 'Search leads', group: 'Leads', run: () => searchRef.current?.focus() },
  ]);
  useEffect(() => {
    if (params.get('new') !== '1') return;
    setParams((p) => { p.delete('new'); return p; }, { replace: true });
    if (hasPermission('create_crm_leads')) create();
  }, [params]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Leads"
        description="Possible customers before they are qualified: who they are, what they need, and the next step."
        actions={
          <div className="flex gap-2">
            {hasPermission('export_crm_leads') && (
              <Button variant="outline" onClick={() => downloadCrmCsv('leads', { q, status: tab === 'all' ? undefined : tab, owner_id: owner === 'me' ? 'me' : undefined }).catch((e) => toast.error(errorMessage(e)))}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            )}
            {hasPermission('create_crm_leads') && <Button onClick={create} title={shortcutHint('New lead', 'n')}><Plus className="mr-2 h-4 w-4" /> New lead</Button>}
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} className="pl-8" placeholder="Search title, person, company, phone or email" aria-label="Search leads" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {!hasPermission('view_all_crm_records') && <span className="text-xs text-muted-foreground">Showing the leads you own or created</span>}
        {hasPermission('view_all_crm_records') && <Select value={owner} onValueChange={(v) => setOwner(v as 'all' | 'me')}>
          <SelectTrigger className="w-36" aria-label="Owner"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Everyone's</SelectItem><SelectItem value="me">My leads</SelectItem></SelectContent>
        </Select>}
        <div className="w-44"><CrmListSelect kind="sources" value={sourceId} onChange={setSourceId} placeholder="Any source" /></div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="flex-wrap">
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}{countOf(t.value) !== undefined ? ` (${countOf(t.value)})` : ''}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead><TableHead>Who</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead>
              <TableHead>Owner</TableHead><TableHead className="text-right">Expected</TableHead><TableHead>Next step</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.rows.map((l) => {
              const overdue = l.next_activity_at && new Date(l.next_activity_at) < new Date();
              return (
                <TableRow key={l.id} className="cursor-pointer" tabIndex={0} onClick={() => openLead(l.id)} onKeyDown={(e) => e.key === 'Enter' && openLead(l.id)}>
                  <TableCell>
                    <div className="font-medium">{l.title} {!l.is_active && <Badge variant="outline">Archived</Badge>}</div>
                    <div className="text-xs text-muted-foreground">{l.code}{l.city ? ` · ${l.city}` : ''}</div>
                  </TableCell>
                  <TableCell><div>{leadWho(l)}</div><div className="text-xs text-muted-foreground">{l.phone ?? l.mobile ?? l.email ?? ''}</div></TableCell>
                  <TableCell><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[l.status]}`}>{LEAD_STATUS_LABEL[l.status]}</span></TableCell>
                  <TableCell className="text-sm">{l.source_name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{l.owner_name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.expected_revenue ? formatMoney(l.expected_revenue) : '—'}</TableCell>
                  <TableCell className="text-xs">
                    {l.next_activity_at ? (
                      <span className={`flex items-center gap-1 ${overdue ? 'text-destructive' : ''}`}><CalendarClock className="h-3 w-3" />{new Date(l.next_activity_at).toLocaleDateString()}</span>
                    ) : (l.status !== 'converted' && l.status !== 'lost' ? <span className="text-amber-700">None planned</span> : '—')}
                  </TableCell>
                </TableRow>
              );
            })}
            {!leads.rows.length && (
              <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                {leads.isLoading ? 'Loading leads…' : (
                  <div className="flex flex-col items-center gap-2">
                    <UserPlus className="h-8 w-8 opacity-40" />
                    {q ? `No leads match “${q}”.` : 'No leads here yet.'}
                    {hasPermission('create_crm_leads') && <Button size="sm" variant="outline" onClick={create}><Plus className="mr-1 h-3 w-3" /> New lead</Button>}
                  </div>
                )}
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <LoadMore hasNextPage={!!leads.hasNextPage} isFetchingNextPage={leads.isFetchingNextPage} fetchNextPage={leads.fetchNextPage} loaded={leads.rows.length} total={leads.total} noun="leads" />
    </div>
  );
}
