import { useEffect, useState, type FormEvent } from 'react';
import { Archive, ArrowRightLeft, Loader2, RotateCcw, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { EntityPicker } from '@/components/platform/EntityPicker';
import { TimelinePanel } from '@/components/platform/TimelinePanel';
import { CompanyBranchSelect } from '@/components/platform/CompanyBranchSelect';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import type { EntityFormProps } from '@/components/platform/entityRegistry';
import {
  LEAD_STATUS_LABEL, MANUAL_LEAD_STATUSES, useLead, useLeadAction, useSaveLead, type Lead, type LeadInput, type LeadStatus,
} from '@/hooks/useCrm';
import { CrmListSelect, LoseDialog, UserSelect } from './CrmCommon';
import { ActivitiesPanel } from './ActivitiesPanel';

interface LeadFormState {
  title: string; person_name: string; company_name: string; job_title: string; email: string; phone: string; mobile: string; city: string;
  source_id: string | null; owner_id: string | null; status: LeadStatus; need: string; budget: string; timeline: string; decision_maker: string;
  expected_revenue: string; notes: string;
}

export function emptyLeadForm(initial?: Record<string, unknown>, ownerId?: string | null): LeadFormState {
  return {
    title: String(initial?.name ?? initial?.title ?? ''), person_name: '', company_name: '', job_title: '', email: '', phone: '', mobile: '', city: '',
    source_id: null, owner_id: ownerId ?? null, status: 'new', need: '', budget: '', timeline: '', decision_maker: '', expected_revenue: '', notes: '',
  };
}

export function leadToForm(l: Lead): LeadFormState {
  const s = (v: string | null | undefined) => v ?? '';
  return {
    title: l.title, person_name: s(l.person_name), company_name: s(l.company_name), job_title: s(l.job_title), email: s(l.email), phone: s(l.phone),
    mobile: s(l.mobile), city: s(l.city), source_id: l.source_id, owner_id: l.owner_id, status: l.status, need: s(l.need),
    budget: l.budget == null ? '' : String(Number(l.budget)), timeline: s(l.timeline), decision_maker: s(l.decision_maker),
    expected_revenue: l.expected_revenue == null ? '' : String(Number(l.expected_revenue)), notes: s(l.notes),
  };
}

/** Field → message; the API checks again. */
export function validateLeadForm(f: LeadFormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = 'Say what they want, e.g. "Office chairs for new branch"';
  if (!f.person_name.trim() && !f.company_name.trim()) e.person_name = 'Enter the person or the company';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Not a valid email';
  for (const k of ['budget', 'expected_revenue'] as const) {
    if (f[k] !== '' && (Number.isNaN(Number(f[k])) || Number(f[k]) < 0)) e[k] = 'Must be 0 or more';
  }
  return e;
}

export function leadFormToInput(f: LeadFormState): LeadInput {
  const t = (v: string) => v.trim() || null;
  const n = (v: string) => (v === '' ? null : Number(v));
  return {
    title: f.title.trim(), person_name: t(f.person_name), company_name: t(f.company_name), job_title: t(f.job_title), email: t(f.email),
    phone: t(f.phone), mobile: t(f.mobile), city: t(f.city), source_id: f.source_id, owner_id: f.owner_id, need: t(f.need), budget: n(f.budget),
    timeline: t(f.timeline), decision_maker: t(f.decision_maker), expected_revenue: n(f.expected_revenue), notes: t(f.notes),
  };
}

/** Convert: a new or existing customer contact, and (by default) a deal in the pipeline. */
function ConvertDialog({ lead, open, onClose, onDone }: { lead: Lead; open: boolean; onClose: () => void; onDone: (l: Lead) => void }) {
  const action = useLeadAction();
  const [useExisting, setUseExisting] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [makeDeal, setMakeDeal] = useState(true);
  const [dealName, setDealName] = useState(lead.title);
  const [revenue, setRevenue] = useState(lead.expected_revenue ? String(Number(lead.expected_revenue)) : '');
  const [close, setClose] = useState('');
  const submit = async () => {
    if (useExisting && !contactId) return toast.error('Choose the existing contact');
    try {
      const saved = await action.mutateAsync({
        id: lead.id, action: 'convert',
        body: {
          ...(useExisting && contactId ? { contact_id: contactId } : {}),
          create_opportunity: makeDeal,
          ...(makeDeal ? { opportunity_name: dealName.trim() || lead.title, ...(revenue ? { expected_revenue: Number(revenue) } : {}), ...(close ? { expected_close_date: close } : {}) } : {}),
        },
      });
      toast.success(makeDeal ? 'Converted: customer and deal created' : 'Converted into a customer');
      onDone(saved);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert “{lead.title}”</DialogTitle>
          <DialogDescription>The lead becomes a customer contact; its open activities move to the deal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={useExisting} onCheckedChange={setUseExisting} /> Use an existing contact</label>
            {useExisting ? (
              <EntityPicker type="contact" value={contactId} onChange={(id) => setContactId(id)} placeholder="Find the contact…" />
            ) : (
              <p className="text-xs text-muted-foreground">
                Creates {lead.company_name ? `the company “${lead.company_name}”${lead.person_name ? ` with ${lead.person_name} under it` : ''}` : `the person “${lead.person_name ?? lead.title}”`} as a customer.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={makeDeal} onCheckedChange={setMakeDeal} /> Create a deal in the pipeline</label>
            {makeDeal && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1"><Label htmlFor="cv-name">Deal name</Label><Input id="cv-name" value={dealName} onChange={(e) => setDealName(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="cv-rev">Expected revenue</Label><Input id="cv-rev" inputMode="decimal" value={revenue} onChange={(e) => setRevenue(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="cv-close">Expected close</Label><Input id="cv-close" type="date" value={close} onChange={(e) => setClose(e.target.value)} /></div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={action.isPending}>{action.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Convert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Create/edit a lead in the record drawer (CRM 1.1). */
export function LeadForm({ mode, id, initial, onSaved, onCancel }: EntityFormProps<Lead>) {
  const { hasPermission, user } = useAuth();
  const q = useLead(mode === 'edit' ? id : undefined);
  const save = useSaveLead();
  const action = useLeadAction();
  const drawer = useRecordDrawer();
  const [f, setF] = useState<LeadFormState>(() => emptyLeadForm(initial, user?.id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [companyId, setCompanyId] = useState<string | null | undefined>(undefined);
  const [converting, setConverting] = useState(false);
  const [losing, setLosing] = useState(false);
  const lead = q.data;
  useEffect(() => {
    if (mode === 'edit' && lead) {
      setF(leadToForm(lead));
      setCompanyId(lead.company_id);
    }
  }, [mode, lead]);

  if (mode === 'edit' && q.isLoading) return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (mode === 'edit' && q.isError) return <p className="py-8 text-sm text-destructive">{errorMessage(q.error)}</p>;

  const locked = mode === 'edit' && (lead?.status === 'converted' || !lead?.is_active);
  const canEdit = !locked && (mode === 'create' ? hasPermission('create_crm_leads') : hasPermission('edit_crm_leads'));
  const set = <K extends keyof LeadFormState>(k: K, v: LeadFormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const err = (k: string) => errors[k] && <p className="text-xs text-destructive" role="alert">{errors[k]}</p>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateLeadForm(f);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const input: LeadInput = { ...leadFormToInput(f), ...(mode === 'create' ? { status: f.status } : {}) };
      const companyChanged = mode === 'create' ? companyId !== undefined : companyId !== undefined && companyId !== (lead?.company_id ?? null);
      if (companyChanged) input.company_id = companyId ?? null;
      const saved = await save.mutateAsync({ id: mode === 'edit' ? id : undefined, input });
      toast.success(mode === 'create' ? `Lead “${saved.title}” created` : 'Lead saved');
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const setStatus = async (status: LeadStatus) => {
    if (!lead || status === lead.status) return;
    try {
      await save.mutateAsync({ id: lead.id, input: { status } });
      toast.success(`Lead is now ${LEAD_STATUS_LABEL[status]}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const details = (
    <form onSubmit={submit} className="space-y-4" aria-label="Lead form">
      <fieldset disabled={!canEdit || save.isPending} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="l-title">What do they want? *</Label>
          <Input id="l-title" autoFocus value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. 20 office chairs for the new branch" />
          {err('title')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="l-person">Person</Label><Input id="l-person" value={f.person_name} onChange={(e) => set('person_name', e.target.value)} />{err('person_name')}</div>
          <div className="space-y-1.5"><Label htmlFor="l-company">Company</Label><Input id="l-company" value={f.company_name} onChange={(e) => set('company_name', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="l-job">Job title</Label><Input id="l-job" value={f.job_title} onChange={(e) => set('job_title', e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="l-city">City</Label><Input id="l-city" value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Addis Ababa" /></div>
          <div className="space-y-1.5"><Label htmlFor="l-phone">Phone</Label><Input id="l-phone" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="09…" /></div>
          <div className="space-y-1.5"><Label htmlFor="l-email">Email</Label><Input id="l-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />{err('email')}</div>
          <div className="space-y-1.5"><Label htmlFor="l-source">Source</Label><CrmListSelect id="l-source" kind="sources" value={f.source_id} onChange={(v) => set('source_id', v)} placeholder="Not set" /></div>
          <div className="space-y-1.5"><Label htmlFor="l-owner">Owner</Label><UserSelect id="l-owner" value={f.owner_id} onChange={(v) => set('owner_id', v)} placeholder="Nobody yet" /></div>
        </div>
        <section className="space-y-3 rounded-md border p-3" aria-label="Qualification">
          <h3 className="text-sm font-medium">Qualification</h3>
          <div className="space-y-1.5"><Label htmlFor="l-need">Need</Label><Textarea id="l-need" rows={2} value={f.need} onChange={(e) => set('need', e.target.value)} placeholder="What problem are they solving?" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="l-budget">Budget</Label><Input id="l-budget" inputMode="decimal" value={f.budget} onChange={(e) => set('budget', e.target.value)} />{err('budget')}</div>
            <div className="space-y-1.5"><Label htmlFor="l-timeline">Timeline</Label><Input id="l-timeline" value={f.timeline} onChange={(e) => set('timeline', e.target.value)} placeholder="e.g. Before Meskerem" /></div>
            <div className="space-y-1.5"><Label htmlFor="l-dm">Decision maker</Label><Input id="l-dm" value={f.decision_maker} onChange={(e) => set('decision_maker', e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="l-rev">Expected revenue</Label><Input id="l-rev" inputMode="decimal" value={f.expected_revenue} onChange={(e) => set('expected_revenue', e.target.value)} />{err('expected_revenue')}</div>
          </div>
        </section>
        <CompanyBranchSelect companyId={companyId} onCompanyChange={setCompanyId} allowShared disabled={!canEdit} idPrefix="l" />
        <div className="space-y-1.5"><Label htmlFor="l-notes">Notes</Label><Textarea id="l-notes" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        <div className="flex gap-2">
          {mode === 'edit' && lead && (lead.is_active ? hasPermission('delete_crm_leads') : hasPermission('restore_crm_leads')) && (
            <Button type="button" variant="outline" disabled={action.isPending}
              onClick={() => action.mutate({ id: lead.id, action: lead.is_active ? 'archive' : 'restore' }, {
                onSuccess: (l) => { toast.success(lead.is_active ? 'Lead archived' : 'Lead restored'); onSaved(l); },
                onError: (e) => toast.error(errorMessage(e)),
              })}>
              {lead.is_active ? <><Archive className="mr-2 h-4 w-4" /> Archive</> : <><RotateCcw className="mr-2 h-4 w-4" /> Restore</>}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          {canEdit && <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {mode === 'create' ? 'Create lead' : 'Save'}</Button>}
        </div>
      </div>
    </form>
  );

  if (mode === 'create' || !lead) return details;
  const open = lead.status !== 'converted' && lead.status !== 'lost';
  const canAct = hasPermission('edit_crm_leads') && lead.is_active;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{lead.code}</span>
        {open && canAct ? (
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Status">
            {MANUAL_LEAD_STATUSES.map((s) => (
              <button key={s} type="button" aria-pressed={lead.status === s} onClick={() => setStatus(s)}
                className={`rounded px-2.5 py-1 text-xs ${lead.status === s ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>{LEAD_STATUS_LABEL[s]}</button>
            ))}
          </div>
        ) : <Badge variant={lead.status === 'lost' ? 'destructive' : 'secondary'}>{LEAD_STATUS_LABEL[lead.status]}</Badge>}
        <div className="ml-auto flex gap-2">
          {open && canAct && <Button size="sm" onClick={() => setConverting(true)}><ArrowRightLeft className="mr-1 h-3 w-3" /> Convert</Button>}
          {open && canAct && <Button size="sm" variant="outline" onClick={() => setLosing(true)}><ThumbsDown className="mr-1 h-3 w-3" /> Mark as lost</Button>}
        </div>
      </div>
      {lead.status === 'converted' && (
        <p className="rounded-md border bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Converted into{' '}
          {lead.converted_contact_id && (
            <button type="button" className="font-medium underline" onClick={() => drawer.open({ type: 'contact', mode: 'edit', id: lead.converted_contact_id!, title: 'Contact' })}>{lead.converted_contact_name}</button>
          )}
          {lead.converted_opportunity_id && <> and the deal{' '}
            <button type="button" className="font-medium underline" onClick={() => drawer.open({ type: 'crm_opportunity', mode: 'edit', id: lead.converted_opportunity_id!, title: 'Deal' })}>{lead.converted_opportunity_name}</button></>}
          . The lead is kept read-only.
        </p>
      )}
      {lead.status === 'lost' && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Lost: {lead.lost_reason_name ?? '—'}{lead.lost_note ? ` · ${lead.lost_note}` : ''}. Set it back to New or Contacted to work on it again.
          {canAct && <button type="button" className="ml-2 font-medium underline" onClick={() => setStatus('contacted')}>Reopen</button>}
        </p>
      )}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {hasPermission('view_crm_activities') && <TabsTrigger value="activities">Activities</TabsTrigger>}
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="pt-4">{details}</TabsContent>
        {hasPermission('view_crm_activities') && (
          <TabsContent value="activities" className="pt-4"><ActivitiesPanel related={{ type: 'lead', id: lead.id, name: lead.title }} /></TabsContent>
        )}
        <TabsContent value="history" className="pt-4"><TimelinePanel path={`/crm/leads/${lead.id}/timeline`} /></TabsContent>
      </Tabs>
      <ConvertDialog lead={lead} open={converting} onClose={() => setConverting(false)} onDone={() => setConverting(false)} />
      <LoseDialog open={losing} title={`Lost: ${lead.title}`} busy={action.isPending} onClose={() => setLosing(false)}
        onConfirm={(reason, note) => action.mutate({ id: lead.id, action: 'lose', body: { lost_reason_id: reason, note: note.trim() || null } }, {
          onSuccess: () => { toast.success('Lead marked as lost'); setLosing(false); },
          onError: (e) => toast.error(errorMessage(e)),
        })} />
    </div>
  );
}
