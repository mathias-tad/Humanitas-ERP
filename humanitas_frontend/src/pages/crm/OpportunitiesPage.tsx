import { useEffect, useMemo, useRef, useState, type DragEvent, type WheelEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlarmClock, CalendarClock, ChevronLeft, ChevronRight, Download, Hourglass, Plus, Search, Target, Upload } from 'lucide-react';
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
import { CrmImportDialog } from '@/components/crm/CrmImportDialog';
import '@/components/contacts/registerContactEntities';
import { LoseDialog } from '@/components/crm/CrmCommon';
import { isStale, lastContactText } from '@/components/crm/FollowUps';
import {
  DEAL_HEALTH, dealHealth, downloadCrmCsv, formatMoney, isOverdue, useBoard, useDealAction, useInfiniteDeals, usePipelines, type BoardStage, type Deal, type DealFilters,
} from '@/hooks/useCrm';

/** A card on the board: drag to another stage, click to open. */
function DealCard({ d, draggable, onOpen }: { d: Deal; draggable: boolean; onOpen: () => void }) {
  const overdueActivity = d.next_activity_at && new Date(d.next_activity_at) < new Date();
  const health = DEAL_HEALTH[dealHealth(d)];
  return (
    <button type="button" draggable={draggable} onClick={onOpen} title={health.label}
      onDragStart={(e) => { e.dataTransfer.setData('text/deal', d.id); e.dataTransfer.effectAllowed = 'move'; }}
      className={`w-full rounded-md border border-l-4 bg-background p-2.5 text-left text-sm shadow-sm transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary ${health.card}`}>
      <div className="font-medium leading-snug">{d.name}</div>
      {d.contact_name && <div className="truncate text-xs text-muted-foreground">{d.contact_name}</div>}
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{formatMoney(d.expected_revenue)}</span>
        <span className="text-muted-foreground">{d.effective_probability}%</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {d.expected_close_date && <span className={isOverdue(d) ? 'text-destructive' : ''}><CalendarClock className="mr-0.5 inline h-3 w-3" />{String(d.expected_close_date).slice(0, 10)}</span>}
        {d.owner_name && <span>· {d.owner_name}</span>}
        {d.is_stuck && <span className="text-amber-700"><Hourglass className="mr-0.5 inline h-3 w-3" />{d.days_in_stage}d</span>}
        {overdueActivity && <span className="text-destructive"><AlarmClock className="mr-0.5 inline h-3 w-3" />late step</span>}
        {d.status === 'open' && !d.next_activity_at && <span className="text-amber-700">no next step</span>}
        {d.status === 'open' && <span className={isStale(d.last_contact_at) ? 'text-amber-700' : ''}>· last: {lastContactText(d.last_contact_at, d.last_contact_channel)}</span>}
      </div>
    </button>
  );
}

function Column({ s, canMove, onDrop, onOpen, onAdd }: {
  s: BoardStage; canMove: boolean; onDrop: (dealId: string, stage: BoardStage) => void; onOpen: (id: string) => void; onAdd?: () => void;
}) {
  const [over, setOver] = useState(false);
  const accept = (e: DragEvent) => { if (canMove && e.dataTransfer.types.includes('text/deal')) { e.preventDefault(); setOver(true); } };
  const tone = s.is_won ? 'border-t-emerald-500' : s.is_lost ? 'border-t-red-400' : 'border-t-primary/60';
  return (
    <section aria-label={s.name} onDragOver={accept} onDragLeave={() => setOver(false)}
      onDrop={(e) => { setOver(false); const id = e.dataTransfer.getData('text/deal'); if (id) onDrop(id, s); }}
      className={`flex h-[calc(100vh-15rem)] min-h-[26rem] w-72 shrink-0 flex-col rounded-lg border border-t-4 ${tone} bg-muted/30 ${over ? 'ring-2 ring-primary' : ''}`}>
      <header className="space-y-0.5 border-b p-2.5">
        <div className="flex items-center justify-between gap-2 text-sm font-semibold">
          <span className="truncate">{s.name}</span>
          <span className="flex items-center gap-1">
            <span className="text-xs font-normal text-muted-foreground">{s.count}</span>
            {onAdd && !s.is_won && !s.is_lost && (
              <button type="button" onClick={onAdd} aria-label={`Add a deal in ${s.name}`} title={`Add a deal in ${s.name}`}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatMoney(s.revenue)}{!s.is_won && !s.is_lost ? ` · weighted ${formatMoney(s.weighted)}` : ''}{!s.is_won && !s.is_lost ? ` · ${s.probability}%` : ''}
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {s.deals.map((d) => <DealCard key={d.id} d={d} draggable={canMove} onOpen={() => onOpen(d.id)} />)}
        {!s.deals.length && <p className="py-4 text-center text-xs text-muted-foreground">{s.is_won || s.is_lost ? 'Last 30 days' : 'Drop deals here'}</p>}
        {s.count > s.deals.length && <p className="text-center text-xs text-muted-foreground">+{s.count - s.deals.length} more in the List tab</p>}
      </div>
    </section>
  );
}

/** CRM -> Opportunities (CRM 1.2, 1.4): the pipeline board and the list. */
export default function OpportunitiesPage() {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const [params, setParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const pipelines = usePipelines().data ?? [];
  const [view, setView] = useState<'board' | 'list'>('board');
  const [pipelineId, setPipelineId] = useState<string | undefined>();
  const [owner, setOwner] = useState<'all' | 'me'>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState<string | undefined>();
  const [status, setStatus] = useState<'open' | 'won' | 'lost' | 'all'>('open');
  const [attention, setAttention] = useState<DealFilters['attention'] | 'none'>((params.get('attention') as DealFilters['attention']) ?? 'none');
  const [losing, setLosing] = useState<Deal | null>(null);
  useEffect(() => { const t = setTimeout(() => setQ(search.trim() || undefined), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (!pipelineId && pipelines.length) setPipelineId((pipelines.find((p) => p.is_default) ?? pipelines[0]).id); }, [pipelines, pipelineId]);
  useEffect(() => { if (params.get('attention')) setView('list'); }, [params]);

  const ownerFilter = owner === 'me' ? { owner_id: 'me' } : {};
  const board = useBoard({ pipeline_id: pipelineId, q, ...ownerFilter });
  const listFilters: DealFilters = {
    q, pipeline_id: pipelineId, ...ownerFilter, ...(status === 'all' ? {} : { status }), ...(attention && attention !== 'none' ? { attention } : {}),
  };
  const list = useInfiniteDeals(listFilters);
  const action = useDealAction();
  const canMove = hasPermission('edit_crm_opportunities');
  const boardRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = () => {
    const el = boardRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  };
  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  });
  const scrollBoard = (by: number) => boardRef.current?.scrollBy({ left: by, behavior: 'smooth' });
  /** The scrollbar is hidden: the mouse wheel moves the board sideways, except over a column that scrolls its own deals. */
  const onBoardWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = boardRef.current;
    if (!el || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    let t = e.target as HTMLElement | null;
    while (t && t !== el) {
      if (t.scrollHeight > t.clientHeight + 1 && getComputedStyle(t).overflowY === 'auto') return;
      t = t.parentElement;
    }
    if (el.scrollWidth > el.clientWidth) el.scrollLeft += e.deltaY;
  };
  const totals = useMemo(() => {
    const open = (board.data?.stages ?? []).filter((s) => !s.is_won && !s.is_lost);
    return { count: open.reduce((t, s) => t + s.count, 0), revenue: open.reduce((t, s) => t + s.revenue, 0), weighted: open.reduce((t, s) => t + s.weighted, 0) };
  }, [board.data]);

  const create = (stageId?: string) => drawer.open({ type: 'crm_opportunity', mode: 'create', title: 'New deal', initial: { pipeline_id: pipelineId, ...(stageId ? { stage_id: stageId } : {}) } });
  const openDeal = (id: string) => drawer.open({ type: 'crm_opportunity', mode: 'edit', id, title: 'Deal' });
  useShortcuts([
    ...(hasPermission('create_crm_opportunities') ? [{ keys: 'n', description: 'New deal', group: 'Opportunities', run: () => create() }] : []),
    { keys: '/', description: 'Search deals', group: 'Opportunities', run: () => searchRef.current?.focus() },
    { keys: 'b', description: 'Board / list', group: 'Opportunities', run: () => setView((v) => (v === 'board' ? 'list' : 'board')) },
  ]);
  useEffect(() => {
    if (params.get('new') !== '1') return;
    setParams((p) => { p.delete('new'); return p; }, { replace: true });
    if (hasPermission('create_crm_opportunities')) create();
  }, [params]); // eslint-disable-line

  /** Dropping a card: won stage wins it, lost stage asks why, otherwise it moves. */
  const dropped = (dealId: string, to: BoardStage) => {
    const deal = board.data?.stages.flatMap((s) => s.deals).find((d) => d.id === dealId);
    if (!deal || deal.stage_id === to.id) return;
    if (to.is_lost) return setLosing(deal);
    if (deal.status !== 'open') return toast.info('Reopen a closed deal before moving it');
    const p = to.is_won ? action.mutateAsync({ id: dealId, action: 'won' }) : action.mutateAsync({ id: dealId, action: 'stage', body: { stage_id: to.id } });
    p.then(() => toast.success(to.is_won ? `${deal.name} won` : `Moved to ${to.name}`)).catch((e) => toast.error(errorMessage(e)));
  };

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Opportunities"
        description="Deals in your pipeline: drag them through the stages, win or lose them, and see what each stage is worth."
        actions={
          <div className="flex gap-2">
            {view === 'list' && hasPermission('export_crm_opportunities') && (
              <Button variant="outline" onClick={() => downloadCrmCsv('opportunities', { q, pipeline_id: pipelineId, status: status === 'all' ? undefined : status }).catch((e) => toast.error(errorMessage(e)))}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            )}
            {hasPermission('create_crm_opportunities') && <Button variant="outline" onClick={() => setImporting(true)}><Upload className="mr-2 h-4 w-4" /> Import</Button>}
            {hasPermission('create_crm_opportunities') && <Button onClick={() => create()} title={shortcutHint('New deal', 'n')}><Plus className="mr-2 h-4 w-4" /> New deal</Button>}
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as 'board' | 'list')}>
          <TabsList><TabsTrigger value="board">Board</TabsTrigger><TabsTrigger value="list">List</TabsTrigger></TabsList>
        </Tabs>
        {pipelines.length > 1 && (
          <Select value={pipelineId} onValueChange={setPipelineId}>
            <SelectTrigger className="w-48" aria-label="Pipeline"><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input ref={searchRef} className="pl-8" placeholder="Search deals or customers" aria-label="Search deals" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {!hasPermission('view_all_crm_records') && <span className="text-xs text-muted-foreground">Showing the deals you own or created</span>}
        {hasPermission('view_all_crm_records') && <Select value={owner} onValueChange={(v) => setOwner(v as 'all' | 'me')}>
          <SelectTrigger className="w-36" aria-label="Owner"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Everyone's</SelectItem><SelectItem value="me">My deals</SelectItem></SelectContent>
        </Select>}
        {view === 'list' && (
          <>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-32" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="won">Won</SelectItem><SelectItem value="lost">Lost</SelectItem><SelectItem value="all">All</SelectItem></SelectContent>
            </Select>
            <Select value={attention ?? 'none'} onValueChange={(v) => setAttention(v as typeof attention)}>
              <SelectTrigger className="w-48" aria-label="Needs attention"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any deal</SelectItem>
                <SelectItem value="overdue">Past close date</SelectItem>
                <SelectItem value="no_activity">No next step</SelectItem>
                <SelectItem value="stuck">Stuck in a stage</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        {view === 'board' && board.data && (
          <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-label="Card colours">
            {(['on_track', 'attention', 'late', 'won', 'lost'] as const).map((k) => (
              <span key={k} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${DEAL_HEALTH[k].dot}`} />{DEAL_HEALTH[k].label}</span>
            ))}
          </span>
        )}
        {view === 'board' && board.data && (
          <span className="ml-auto text-sm text-muted-foreground">{totals.count} open · {formatMoney(totals.revenue)} · weighted {formatMoney(totals.weighted)}</span>
        )}
      </div>

      {view === 'board' && (
        board.isError ? <p className="text-sm text-destructive">{errorMessage(board.error)}</p> :
        board.isLoading ? <p className="text-sm text-muted-foreground">Loading the pipeline…</p> : (
          <div className="relative">
            {edges.left && (
              <button type="button" aria-label="Scroll the board left" onClick={() => scrollBoard(-320)}
                className="absolute left-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow hover:bg-accent">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {edges.right && (
              <button type="button" aria-label="Scroll the board right" onClick={() => scrollBoard(320)}
                className="absolute right-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow hover:bg-accent">
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
            <div ref={boardRef} onScroll={updateEdges} onWheel={onBoardWheel}
              className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(board.data?.stages ?? []).map((s) => (
                <Column key={s.id} s={s} canMove={canMove} onDrop={dropped} onOpen={openDeal}
                  onAdd={hasPermission('create_crm_opportunities') ? () => create(s.id) : undefined} />
              ))}
            </div>
          </div>
        )
      )}

      {view === 'list' && (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead><TableHead>Customer</TableHead><TableHead>Stage</TableHead><TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Weighted</TableHead><TableHead>Close</TableHead><TableHead>Owner</TableHead><TableHead>Last contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" tabIndex={0} onClick={() => openDeal(d.id)} onKeyDown={(e) => e.key === 'Enter' && openDeal(d.id)}>
                    <TableCell><div className="font-medium">{d.name}</div><div className="text-xs text-muted-foreground">{d.code}</div></TableCell>
                    <TableCell className="text-sm">{d.contact_name ?? '—'}</TableCell>
                    <TableCell>
                      {d.status === 'open' ? d.stage_name : <Badge variant={d.status === 'won' ? 'default' : 'destructive'}>{d.status === 'won' ? 'Won' : 'Lost'}</Badge>}
                      {d.is_stuck && <Badge variant="outline" className="ml-1 border-amber-400 text-amber-700">{d.days_in_stage}d</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(d.expected_revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(d.weighted_revenue)}</TableCell>
                    <TableCell className={`text-sm ${isOverdue(d) ? 'text-destructive' : ''}`}>{d.expected_close_date ? String(d.expected_close_date).slice(0, 10) : '—'}</TableCell>
                    <TableCell className="text-sm">{d.owner_name ?? '—'}</TableCell>
                    <TableCell className={`text-xs ${d.status === 'open' && isStale(d.last_contact_at) ? 'text-amber-700' : ''}`}>{lastContactText(d.last_contact_at, d.last_contact_channel)}</TableCell>
                  </TableRow>
                ))}
                {!list.rows.length && (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    {list.isLoading ? 'Loading deals…' : <div className="flex flex-col items-center gap-2"><Target className="h-8 w-8 opacity-40" /> No deals here.</div>}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <LoadMore hasNextPage={!!list.hasNextPage} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={list.fetchNextPage} loaded={list.rows.length} total={list.total} noun="deals" />
        </>
      )}
      <CrmImportDialog kind="opportunities" open={importing} onClose={() => setImporting(false)} />
      <LoseDialog open={!!losing} title={`Lost: ${losing?.name ?? ''}`} busy={action.isPending} onClose={() => setLosing(null)}
        onConfirm={(reason, note) => losing && action.mutate({ id: losing.id, action: 'lose', body: { lost_reason_id: reason, note: note.trim() || null } }, {
          onSuccess: () => { toast.success('Deal marked as lost'); setLosing(null); },
          onError: (e) => toast.error(errorMessage(e)),
        })} />
    </div>
  );
}
