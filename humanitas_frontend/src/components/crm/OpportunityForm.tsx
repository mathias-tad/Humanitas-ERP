import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Archive, Loader2, RotateCcw, ThumbsDown, Trophy, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { EntityPicker } from '@/components/platform/EntityPicker';
import { TimelinePanel } from '@/components/platform/TimelinePanel';
import { CompanyBranchSelect } from '@/components/platform/CompanyBranchSelect';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import type { EntityFormProps } from '@/components/platform/entityRegistry';
import { formatMoney, isOverdue, useDeal, useDealAction, usePipelines, useSaveDeal, type Deal, type DealInput } from '@/hooks/useCrm';
import { CrmListSelect, LoseDialog, UserSelect } from './CrmCommon';
import { ActivitiesPanel } from './ActivitiesPanel';
import { FollowUpDialog, FollowUpsPanel, lastContactText } from './FollowUps';

interface DealFormState {
  name: string; contact_id: string | null; contact_name: string | null; person_id: string | null; person_name: string | null;
  pipeline_id: string | null; stage_id: string | null; owner_id: string | null; expected_revenue: string; probability: string;
  expected_close_date: string; source_id: string | null; notes: string;
}

export function emptyDealForm(initial?: Record<string, unknown>, ownerId?: string | null): DealFormState {
  return {
    name: String(initial?.name ?? ''), contact_id: (initial?.contact_id as string) ?? null, contact_name: (initial?.contact_name as string) ?? null,
    person_id: null, person_name: null, pipeline_id: (initial?.pipeline_id as string) ?? null, stage_id: (initial?.stage_id as string) ?? null,
    owner_id: ownerId ?? null, expected_revenue: '', probability: '', expected_close_date: '', source_id: null, notes: '',
  };
}

export function dealToForm(d: Deal): DealFormState {
  return {
    name: d.name, contact_id: d.contact_id, contact_name: d.contact_name, person_id: d.person_id, person_name: d.person_name, pipeline_id: d.pipeline_id,
    stage_id: d.stage_id, owner_id: d.owner_id, expected_revenue: String(Number(d.expected_revenue ?? 0)),
    probability: d.probability == null ? '' : String(d.probability), expected_close_date: d.expected_close_date ? String(d.expected_close_date).slice(0, 10) : '',
    source_id: d.source_id, notes: d.notes ?? '',
  };
}

export function validateDealForm(f: DealFormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = 'Name the deal, e.g. "Abebe Trading: 20 chairs"';
  if (f.expected_revenue !== '' && (Number.isNaN(Number(f.expected_revenue)) || Number(f.expected_revenue) < 0)) e.expected_revenue = 'Must be 0 or more';
  if (f.probability !== '' && !(Number(f.probability) >= 0 && Number(f.probability) <= 100 && Number.isInteger(Number(f.probability)))) e.probability = 'A whole number from 0 to 100';
  return e;
}

/** Create/edit a deal in the record drawer (CRM 1.2). The stage is moved with the stage buttons or on the board. */
export function OpportunityForm({ mode, id, initial, onSaved, onCancel }: EntityFormProps<Deal>) {
  const { hasPermission, user } = useAuth();
  const q = useDeal(mode === 'edit' ? id : undefined);
  const pipelines = usePipelines().data ?? [];
  const save = useSaveDeal();
  const action = useDealAction();
  const drawer = useRecordDrawer();
  const [f, setF] = useState<DealFormState>(() => emptyDealForm(initial, user?.id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companyId, setCompanyId] = useState<string | null | undefined>(undefined);
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined);
  const [losing, setLosing] = useState(false);
  const [following, setFollowing] = useState(false);
  const deal = q.data;
  useEffect(() => {
    if (mode === 'edit' && deal) {
      setF(dealToForm(deal));
      setCompanyId(deal.company_id);
      setBranchId(deal.branch_id ?? null);
    }
  }, [mode, deal]);
  const pipeline = useMemo(
    () => pipelines.find((p) => p.id === (f.pipeline_id ?? deal?.pipeline_id)) ?? pipelines.find((p) => p.is_default) ?? pipelines[0],
    [pipelines, f.pipeline_id, deal?.pipeline_id],
  );

  if (mode === 'edit' && q.isLoading) return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (mode === 'edit' && q.isError) return <p className="py-8 text-sm text-destructive">{errorMessage(q.error)}</p>;

  const canEdit = (mode === 'create' ? hasPermission('create_crm_opportunities') : hasPermission('edit_crm_opportunities')) && (mode === 'create' || !!deal?.is_active);
  const set = <K extends keyof DealFormState>(k: K, v: DealFormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const err = (k: string) => errors[k] && <p className="text-xs text-destructive" role="alert">{errors[k]}</p>;
  const openStages = (pipeline?.stages ?? []).filter((s) => s.is_active && !s.is_lost);
  const stageProbability = pipeline?.stages.find((s) => s.id === (f.stage_id ?? deal?.stage_id))?.probability;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateDealForm(f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const input: DealInput = {
      name: f.name.trim(), contact_id: f.contact_id, person_id: f.person_id, owner_id: f.owner_id,
      expected_revenue: f.expected_revenue === '' ? 0 : Number(f.expected_revenue),
      probability: f.probability === '' ? null : Number(f.probability),
      expected_close_date: f.expected_close_date || null, source_id: f.source_id, notes: f.notes.trim() || null,
      ...(mode === 'create' ? { pipeline_id: pipeline?.id, ...(f.stage_id ? { stage_id: f.stage_id } : {}) } : {}),
      ...(mode === 'edit' && f.pipeline_id && f.pipeline_id !== deal?.pipeline_id ? { pipeline_id: f.pipeline_id } : {}),
    };
    const companyChanged = mode === 'create' ? companyId !== undefined : companyId !== undefined && companyId !== (deal?.company_id ?? null);
    if (companyChanged) input.company_id = companyId ?? null;
    const branchChanged = mode === 'create' ? branchId !== undefined : branchId !== undefined && branchId !== (deal?.branch_id ?? null);
    if (branchChanged) input.branch_id = branchId ?? null;
    try {
      const saved = await save.mutateAsync({ id: mode === 'edit' ? id : undefined, input });
      toast.success(mode === 'create' ? `Deal “${saved.name}” created` : 'Deal saved');
      onSaved(saved);
    } catch (e2) {
      toast.error(errorMessage(e2));
    }
  };

  const run = (p: Promise<unknown>, ok: string) => p.then(() => toast.success(ok)).catch((e) => toast.error(errorMessage(e)));

  const details = (
    <form onSubmit={submit} className="space-y-4" aria-label="Deal form">
      <fieldset disabled={!canEdit || save.isPending} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="d-name">Deal *</Label>
          <Input id="d-name" autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Abebe Trading: 20 office chairs" />
          {err('name')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="d-customer">Customer</Label>
            <EntityPicker id="d-customer" type="customer" value={f.contact_id} valueLabel={f.contact_name}
              onChange={(cid, rec) => setF((s) => ({ ...s, contact_id: cid, contact_name: (rec as { name?: string } | undefined)?.name ?? null, person_id: null, person_name: null }))}
              placeholder="Choose or create" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-person">Contact person</Label>
            <EntityPicker id="d-person" type="contact" value={f.person_id} valueLabel={f.person_name}
              onChange={(pid, rec) => setF((s) => ({ ...s, person_id: pid, person_name: (rec as { name?: string } | undefined)?.name ?? null }))}
              placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-rev">Expected revenue</Label>
            <Input id="d-rev" inputMode="decimal" value={f.expected_revenue} onChange={(e) => set('expected_revenue', e.target.value)} placeholder="0" />
            {err('expected_revenue')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-close">Expected close</Label>
            <Input id="d-close" type="date" value={f.expected_close_date} onChange={(e) => set('expected_close_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-prob">Win probability %</Label>
            <Input id="d-prob" inputMode="numeric" value={f.probability} onChange={(e) => set('probability', e.target.value)}
              placeholder={stageProbability != null ? `${stageProbability} (from the stage)` : 'From the stage'} />
            {err('probability')}
          </div>
          <div className="space-y-1.5"><Label htmlFor="d-owner">Owner</Label><UserSelect id="d-owner" value={f.owner_id} onChange={(v) => set('owner_id', v)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="d-pipeline">Pipeline</Label>
            <Select value={pipeline?.id ?? ''} onValueChange={(v) => setF((s) => ({ ...s, pipeline_id: v, stage_id: null }))} disabled={pipelines.length < 2}>
              <SelectTrigger id="d-pipeline"><SelectValue placeholder="Default pipeline" /></SelectTrigger>
              <SelectContent>{pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {mode === 'create' && (
            <div className="space-y-1.5">
              <Label htmlFor="d-stage">Stage</Label>
              <Select value={f.stage_id ?? openStages[0]?.id ?? ''} onValueChange={(v) => set('stage_id', v)}>
                <SelectTrigger id="d-stage"><SelectValue placeholder="First stage" /></SelectTrigger>
                <SelectContent>{openStages.filter((s) => !s.is_won).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label htmlFor="d-source">Source</Label><CrmListSelect id="d-source" kind="sources" value={f.source_id} onChange={(v) => set('source_id', v)} placeholder="Not set" /></div>
        </div>
        <CompanyBranchSelect companyId={companyId} onCompanyChange={setCompanyId} showBranch branchId={branchId} onBranchChange={setBranchId} allowShared disabled={!canEdit} idPrefix="d" />
        <div className="space-y-1.5"><Label htmlFor="d-notes">Notes</Label><Textarea id="d-notes" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div>
          {mode === 'edit' && deal && (deal.is_active ? hasPermission('delete_crm_opportunities') : hasPermission('restore_crm_opportunities')) && (
            <Button type="button" variant="outline" disabled={action.isPending}
              onClick={() => action.mutate({ id: deal.id, action: deal.is_active ? 'archive' : 'restore' }, {
                onSuccess: (d) => { toast.success(deal.is_active ? 'Deal archived' : 'Deal restored'); onSaved(d); },
                onError: (e) => toast.error(errorMessage(e)),
              })}>
              {deal.is_active ? <><Archive className="mr-2 h-4 w-4" /> Archive</> : <><RotateCcw className="mr-2 h-4 w-4" /> Restore</>}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          {canEdit && <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {mode === 'create' ? 'Create deal' : 'Save'}</Button>}
        </div>
      </div>
    </form>
  );

  if (mode === 'create' || !deal) return details;
  const canAct = hasPermission('edit_crm_opportunities') && deal.is_active;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs text-muted-foreground">{deal.code}</span>
        <Badge variant={deal.status === 'won' ? 'default' : deal.status === 'lost' ? 'destructive' : 'secondary'}>
          {deal.status === 'open' ? deal.stage_name : deal.status === 'won' ? 'Won' : 'Lost'}
        </Badge>
        <span className="text-muted-foreground">{formatMoney(deal.expected_revenue)} {deal.currency} · {deal.effective_probability}% · weighted {formatMoney(deal.weighted_revenue)}</span>
        {deal.is_stuck && <Badge variant="outline" className="border-amber-400 text-amber-700">Stuck {deal.days_in_stage} days</Badge>}
        {isOverdue(deal) && <Badge variant="outline" className="border-destructive text-destructive">Past close date</Badge>}
        <div className="ml-auto flex gap-2">
          {canAct && <Button size="sm" variant="outline" onClick={() => setFollowing(true)}>Log follow-up</Button>}
          {deal.status === 'open' && canAct && <Button size="sm" onClick={() => run(action.mutateAsync({ id: deal.id, action: 'won' }), 'Deal won')}><Trophy className="mr-1 h-3 w-3" /> Won</Button>}
          {deal.status === 'open' && canAct && <Button size="sm" variant="outline" onClick={() => setLosing(true)}><ThumbsDown className="mr-1 h-3 w-3" /> Lost</Button>}
          {deal.status !== 'open' && canAct && <Button size="sm" variant="outline" onClick={() => run(action.mutateAsync({ id: deal.id, action: 'reopen' }), 'Deal reopened')}><Undo2 className="mr-1 h-3 w-3" /> Reopen</Button>}
        </div>
      </div>
      {deal.status === 'open' && canAct && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Stage">
          {(pipeline?.stages ?? []).filter((s) => s.is_active && !s.is_lost && !s.is_won).map((s) => (
            <button key={s.id} type="button" aria-pressed={s.id === deal.stage_id}
              onClick={() => s.id !== deal.stage_id && run(action.mutateAsync({ id: deal.id, action: 'stage', body: { stage_id: s.id } }), `Moved to ${s.name}`)}
              className={`rounded-full border px-3 py-1 text-xs ${s.id === deal.stage_id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{s.name}</button>
          ))}
        </div>
      )}
      {deal.lead_id && (
        <p className="text-xs text-muted-foreground">
          From lead{' '}
          <button type="button" className="font-medium text-primary underline"
            onClick={() => drawer.open({ type: 'crm_lead', mode: 'edit', id: deal.lead_id!, title: 'Lead' })}>
            {deal.lead_code}{deal.lead_title ? ` · ${deal.lead_title}` : ''}
          </button>
        </p>
      )}
      {deal.status === 'lost' && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">Lost: {deal.lost_reason_name ?? '—'}{deal.lost_note ? ` · ${deal.lost_note}` : ''}</p>
      )}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups{deal.contact_count ? ` (${deal.contact_count})` : ''}</TabsTrigger>
          {hasPermission('view_crm_activities') && <TabsTrigger value="activities">Activities</TabsTrigger>}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="pt-4">
          <p className="mb-3 text-xs text-muted-foreground">Last contact: {lastContactText(deal.last_contact_at, deal.last_contact_channel)}{deal.contact_count ? ` · ${deal.contact_count} contacts so far` : ''}</p>
          {details}
        </TabsContent>
        <TabsContent value="followups" className="pt-4">
          <FollowUpsPanel target="opportunity" id={deal.id} name={deal.name} canLog={canAct} />
        </TabsContent>
        {hasPermission('view_crm_activities') && (
          <TabsContent value="activities" className="pt-4"><ActivitiesPanel related={{ type: 'opportunity', id: deal.id, name: deal.name }} /></TabsContent>
        )}
        <TabsContent value="history" className="pt-4"><TimelinePanel path={`/crm/opportunities/${deal.id}/timeline`} /></TabsContent>
      </Tabs>
      {following && <FollowUpDialog target="opportunity" id={deal.id} name={deal.name} open onClose={() => setFollowing(false)} />}
      <LoseDialog open={losing} title={`Lost: ${deal.name}`} busy={action.isPending} onClose={() => setLosing(false)}
        onConfirm={(reason, note) => action.mutate({ id: deal.id, action: 'lose', body: { lost_reason_id: reason, note: note.trim() || null } }, {
          onSuccess: () => { toast.success('Deal marked as lost'); setLosing(false); },
          onError: (e) => toast.error(errorMessage(e)),
        })} />
    </div>
  );
}
