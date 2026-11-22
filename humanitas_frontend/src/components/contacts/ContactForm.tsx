import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Archive, Building2, Loader2, Plus, RotateCcw, Star, Trash2, TriangleAlert, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import type { EntityFormProps } from '@/components/platform/entityRegistry';
import { CompanyBranchSelect } from '@/components/platform/CompanyBranchSelect';
import { EntityPicker } from '@/components/platform/EntityPicker';
import { TimelinePanel } from '@/components/platform/TimelinePanel';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import { usePriceLists } from '@/hooks/usePriceLists';
import {
  findDuplicateContacts, tinProblem, useArchiveContact, useContact, useContactCategories, useLogInteraction, useSaveContact,
  type Contact, type ContactInput, type ContactType, type DuplicateContact, type InteractionKind, type PersonInput,
} from '@/hooks/useContacts';

const NONE = '__none__';
type Draft = {
  contact_type: ContactType; parent_id: string | null; parent_label: string | null; job_title: string; name: string; legal_name: string;
  code: string; tin: string; vat_number: string; phone: string; mobile: string; email: string; website: string; region: string; city: string;
  subcity: string; woreda: string; street: string; category_id: string | null; tags: string; is_customer: boolean; is_vendor: boolean;
  price_list_id: string | null; credit_limit: string; payment_terms_days: string; notes: string; company_id: string | null | undefined;
};
const str = (v: unknown) => (v == null ? '' : String(v));
const empty = (i?: Record<string, unknown>): Draft => ({
  contact_type: (i?.contact_type as ContactType) ?? (i?.parent_id ? 'person' : 'company'), parent_id: (i?.parent_id as string) ?? null,
  parent_label: (i?.parent_label as string) ?? null, job_title: '', name: str(i?.name), legal_name: '', code: '', tin: '', vat_number: '',
  phone: str(i?.phone), mobile: '', email: '', website: '', region: '', city: '', subcity: '', woreda: '', street: '', category_id: null, tags: '',
  is_customer: i?.is_customer === true, is_vendor: i?.is_vendor === true, price_list_id: null, credit_limit: '', payment_terms_days: '0', notes: '',
  company_id: undefined,
});
const fromContact = (c: Contact): Draft => ({
  contact_type: c.contact_type, parent_id: c.parent_id, parent_label: c.parent_name, job_title: c.job_title ?? '', name: c.name,
  legal_name: c.legal_name ?? '', code: c.code, tin: c.tin ?? '', vat_number: c.vat_number ?? '', phone: c.phone ?? '', mobile: c.mobile ?? '',
  email: c.email ?? '', website: c.website ?? '', region: c.region ?? '', city: c.city ?? '', subcity: c.subcity ?? '', woreda: c.woreda ?? '',
  street: c.street ?? '', category_id: c.category_id, tags: (c.tags ?? []).join(', '), is_customer: c.is_customer, is_vendor: c.is_vendor,
  price_list_id: c.price_list_id, credit_limit: c.credit_limit == null ? '' : String(Number(c.credit_limit)),
  payment_terms_days: String(c.payment_terms_days ?? 0), notes: c.notes ?? '', company_id: c.company_id,
});

/** Contact create/edit in the record drawer: details, people (companies) and history (featureslist §4.1, CRM 1.3). */
export function ContactForm({ mode, id, initial, onSaved, onCancel }: EntityFormProps<Contact>) {
  const { hasPermission } = useAuth();
  const contact = useContact(mode === 'edit' ? id : undefined);
  if (mode === 'edit' && !contact.data) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;
  }
  if (mode === 'create' || !contact.data) return <DetailsForm initial={initial} onSaved={onSaved} onCancel={onCancel} />;
  const c = contact.data;
  return (
    <Tabs defaultValue="details">
      <TabsList>
        <TabsTrigger value="details">Details</TabsTrigger>
        {c.contact_type === 'company' && <TabsTrigger value="people">People ({c.people?.length ?? 0})</TabsTrigger>}
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="pt-4">
        <DetailsForm key={c.id} contact={c} onSaved={onSaved} onCancel={onCancel} />
      </TabsContent>
      {c.contact_type === 'company' && (
        <TabsContent value="people" className="pt-4">
          <People company={c} canEdit={hasPermission('edit_contacts')} canCreate={hasPermission('create_contacts')} />
        </TabsContent>
      )}
      <TabsContent value="history" className="space-y-4 pt-4">
        {hasPermission('edit_contacts') && <LogInteraction contact={c} />}
        <TimelinePanel path={`/contacts/${c.id}/timeline`} />
      </TabsContent>
    </Tabs>
  );
}

function DetailsForm({ contact, initial, onSaved, onCancel }: { contact?: Contact; initial?: Record<string, unknown>; onSaved: (c: Contact) => void; onCancel: () => void }) {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const save = useSaveContact();
  const archive = useArchiveContact();
  const categories = useContactCategories();
  const canSeeLists = hasPermission('view_price_lists');
  const priceLists = usePriceLists(false, canSeeLists);
  const [d, setD] = useState<Draft>(() => (contact ? fromContact(contact) : empty(initial)));
  const [people, setPeople] = useState<PersonInput[]>([]);
  const [dupes, setDupes] = useState<DuplicateContact[]>([]);
  const [confirmTin, setConfirmTin] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const canSave = contact ? hasPermission('edit_contacts') : hasPermission('create_contacts');
  const tinError = tinProblem(d.tin);
  const isCompany = d.contact_type === 'company';

  // Contacts with the same TIN, phone or email (so nobody is entered twice).
  useEffect(() => {
    const q = { tin: d.tin.trim() || undefined, phone: d.phone.trim() || undefined, mobile: d.mobile.trim() || undefined, email: d.email.trim() || undefined, exclude_id: contact?.id };
    if (!q.tin && !q.phone && !q.mobile && !q.email) {
      setDupes([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => findDuplicateContacts(q).then((r) => live && setDupes(r)).catch(() => live && setDupes([])), 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [d.tin, d.phone, d.mobile, d.email, contact?.id]);

  const input = useMemo<ContactInput>(() => {
    const text = (v: string) => v.trim() || null;
    const changedCompany = contact ? d.company_id !== undefined && d.company_id !== contact.company_id : d.company_id !== undefined;
    return {
      contact_type: d.contact_type, parent_id: isCompany ? null : d.parent_id, job_title: isCompany ? null : text(d.job_title),
      name: d.name.trim(), legal_name: isCompany ? text(d.legal_name) : null, tin: text(d.tin), vat_number: text(d.vat_number),
      phone: text(d.phone), mobile: text(d.mobile), email: text(d.email), website: text(d.website), region: text(d.region), city: text(d.city),
      subcity: text(d.subcity), woreda: text(d.woreda), street: text(d.street), category_id: d.category_id,
      tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean), is_customer: d.is_customer, is_vendor: d.is_vendor,
      credit_limit: d.credit_limit.trim() === '' ? null : Number(d.credit_limit), payment_terms_days: Number(d.payment_terms_days || 0),
      notes: text(d.notes), ...(canSeeLists ? { price_list_id: d.price_list_id } : {}),
      ...(d.code.trim() && d.code.trim() !== contact?.code ? { code: d.code.trim() } : {}),
      ...(changedCompany ? { company_id: d.company_id } : {}),
    };
  }, [d, contact, canSeeLists, isCompany]);

  const submit = async (e: FormEvent, allowDuplicate = false) => {
    e.preventDefault();
    if (!d.name.trim() || tinError) return;
    try {
      const body: ContactInput = { ...input, ...(allowDuplicate ? { allow_duplicate: true } : {}),
        ...(!contact && isCompany && people.length ? { people: people.filter((p) => p.name.trim()) } : {}) };
      const saved = await save.mutateAsync({ id: contact?.id, input: body });
      toast.success(contact ? 'Contact saved' : `“${saved.name}” created (${saved.code})`);
      setConfirmTin(false);
      onSaved(saved);
    } catch (err) {
      const msg = errorMessage(err);
      if (/already has TIN/.test(msg)) setConfirmTin(true);
      toast.error(msg);
    }
  };

  const field = (k: keyof Draft, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`ct-${k}`} className="text-xs">{label}</Label>
      <Input id={`ct-${k}`} value={String(d[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} disabled={!canSave} {...props} />
    </div>
  );

  return (
    <form onSubmit={(e) => submit(e)} className="space-y-4">
      {contact && !contact.is_active && <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm">This contact is archived: hidden from lists and pickers.</p>}
      <div className="flex gap-2" role="radiogroup" aria-label="Company or person">
        {(['company', 'person'] as const).map((t) => (
          <Button key={t} type="button" size="sm" variant={d.contact_type === t ? 'default' : 'outline'} aria-pressed={d.contact_type === t}
            disabled={!canSave || (!!contact && contact.contact_type === 'company' && (contact.people?.length ?? 0) > 0 && t === 'person')}
            onClick={() => set('contact_type', t)}>
            {t === 'company' ? <Building2 className="mr-1 h-4 w-4" /> : <User className="mr-1 h-4 w-4" />} {t === 'company' ? 'Company' : 'Person'}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">{field('name', isCompany ? 'Company name' : 'Full name', { autoFocus: !contact, maxLength: 255, required: true })}</div>
        {isCompany ? (
          <div className="col-span-2">{field('legal_name', 'Legal name (as registered)', { maxLength: 255 })}</div>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="ct-parent" className="text-xs">Works at (company)</Label>
              <EntityPicker id="ct-parent" type="contact_company" value={d.parent_id} valueLabel={d.parent_label}
                onChange={(pid, rec) => { set('parent_id', pid); set('parent_label', (rec as { name?: string } | undefined)?.name ?? null); }}
                placeholder="No company" />
            </div>
            {field('job_title', 'Job title', { maxLength: 100 })}
          </>
        )}
        {field('code', 'Code', { placeholder: contact ? undefined : 'Given automatically (C000123)', maxLength: 30 })}
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm"><Switch checked={d.is_customer} onCheckedChange={(v) => set('is_customer', v)} disabled={!canSave} /> Customer</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={d.is_vendor} onCheckedChange={(v) => set('is_vendor', v)} disabled={!canSave} /> Vendor</label>
        </div>
        <div className="space-y-1">
          {field('tin', 'TIN (10 digits)', { inputMode: 'numeric', maxLength: 14 })}
          {tinError && <p className="text-xs text-destructive">{tinError}</p>}
        </div>
        {field('vat_number', 'VAT registration number', { maxLength: 30 })}
        {field('phone', 'Phone', { inputMode: 'tel', maxLength: 30 })}
        {field('mobile', 'Mobile', { inputMode: 'tel', maxLength: 30 })}
        {field('email', 'Email', { type: 'email', maxLength: 255 })}
        {field('website', 'Website', { maxLength: 255 })}
      </div>

      {dupes.length > 0 && (
        <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="status">
          <p className="flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" /> This may already be a contact:</p>
          {dupes.map((x) => (
            <button key={x.id} type="button" className="block text-left underline-offset-2 hover:underline"
              onClick={() => drawer.open({ type: 'contact', mode: 'edit', id: x.id, title: 'Contact' })}>
              {x.name} ({x.code}) — {x.reason}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {field('region', 'Region')}
        {field('city', 'City')}
        {field('subcity', 'Sub-city')}
        {field('woreda', 'Woreda')}
        <div className="col-span-2">{field('street', 'Street / house number')}</div>
        <div className="space-y-1">
          <Label htmlFor="ct-cat" className="text-xs">Category</Label>
          <Select value={d.category_id ?? NONE} onValueChange={(v) => set('category_id', v === NONE ? null : v)} disabled={!canSave}>
            <SelectTrigger id="ct-cat"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No category</SelectItem>
              {(categories.data ?? []).map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {field('tags', 'Tags (comma separated)', { placeholder: 'VIP, Bole' })}
        {d.is_customer && (
          <>
            {canSeeLists && (
              <div className="space-y-1">
                <Label htmlFor="ct-pl" className="text-xs">Price list</Label>
                <Select value={d.price_list_id ?? NONE} onValueChange={(v) => set('price_list_id', v === NONE ? null : v)} disabled={!canSave}>
                  <SelectTrigger id="ct-pl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>From the category, else the default</SelectItem>
                    {(priceLists.data ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {field('credit_limit', 'Credit limit (ETB)', { inputMode: 'decimal', placeholder: 'No limit' })}
            {field('payment_terms_days', 'Payment terms (days)', { inputMode: 'numeric' })}
          </>
        )}
        <div className="col-span-2 space-y-1">
          <Label htmlFor="ct-notes" className="text-xs">Notes</Label>
          <Textarea id="ct-notes" value={d.notes} onChange={(e) => set('notes', e.target.value)} disabled={!canSave} rows={3} />
        </div>
        <div className="col-span-2">
          <CompanyBranchSelect companyId={d.company_id} onCompanyChange={(v) => set('company_id', v)} allowShared idPrefix="ct" disabled={!canSave} />
        </div>
      </div>

      {!contact && isCompany && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">People at this company</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setPeople((p) => [...p, { name: '' }])}><Plus className="mr-1 h-3 w-3" /> Add person</Button>
          </div>
          {people.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2">
              {(['name', 'job_title', 'phone', 'email'] as const).map((k) => (
                <Input key={k} aria-label={`Person ${i + 1} ${k.replace('_', ' ')}`} placeholder={{ name: 'Name', job_title: 'Job title', phone: 'Phone', email: 'Email' }[k]}
                  value={p[k] ?? ''} onChange={(e) => setPeople((all) => all.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
              ))}
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove person ${i + 1}`} onClick={() => setPeople((all) => all.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {people.length > 0 && <p className="text-xs text-muted-foreground">Each person becomes a contact of their own; the first is the primary contact.</p>}
        </div>
      )}

      {confirmTin && (
        <div className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <span>Another contact has this TIN. Save anyway if they are different.</span>
          <Button type="button" size="sm" variant="outline" onClick={(e) => submit(e as unknown as FormEvent, true)}>Save anyway</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {contact && contact.is_active && hasPermission('delete_contacts') && (
          <Button type="button" variant="ghost" disabled={archive.isPending}
            onClick={() => archive.mutateAsync({ id: contact.id }).then(() => toast.success('Contact archived')).catch((e) => toast.error(errorMessage(e)))}>
            <Archive className="mr-2 h-4 w-4" /> Archive
          </Button>
        )}
        {contact && !contact.is_active && hasPermission('restore_contacts') && (
          <Button type="button" variant="ghost" disabled={archive.isPending}
            onClick={() => archive.mutateAsync({ id: contact.id, restore: true }).then(() => toast.success('Contact restored')).catch((e) => toast.error(errorMessage(e)))}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restore
          </Button>
        )}
        <div className="flex-1" />
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        {canSave && (
          <Button type="submit" disabled={save.isPending || !d.name.trim() || !!tinError}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {contact ? 'Save' : d.is_customer ? 'Create customer' : 'Create contact'}
          </Button>
        )}
      </div>
    </form>
  );
}

/** People tab of a company: each person is a contact of their own. */
function People({ company, canEdit, canCreate }: { company: Contact; canEdit: boolean; canCreate: boolean }) {
  const drawer = useRecordDrawer();
  const save = useSaveContact();
  const people = company.people ?? [];
  return (
    <div className="space-y-3">
      {canCreate && (
        <Button size="sm" variant="outline"
          onClick={() => drawer.open({ type: 'contact', mode: 'create', initial: { contact_type: 'person', parent_id: company.id, parent_label: company.name } })}>
          <Plus className="mr-1 h-3 w-3" /> Add person
        </Button>
      )}
      {!people.length && <p className="text-sm text-muted-foreground">No people yet.</p>}
      <ul className="divide-y rounded-md border">
        {people.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-2 p-3 text-sm">
            <button type="button" className="text-left" onClick={() => drawer.open({ type: 'contact', mode: 'edit', id: p.id, title: 'Contact' })}>
              <div className="flex items-center gap-2 font-medium">{p.name}{p.is_primary_contact && <Badge variant="secondary">Primary</Badge>}</div>
              <div className="text-xs text-muted-foreground">{[p.job_title, p.phone, p.mobile, p.email].filter(Boolean).join(' · ')}</div>
            </button>
            {canEdit && !p.is_primary_contact && (
              <Button size="icon" variant="ghost" aria-label={`Make ${p.name} the primary contact`} title="Make primary contact"
                onClick={() => save.mutateAsync({ id: p.id, input: { is_primary_contact: true } }).catch((e) => toast.error(errorMessage(e)))}>
                <Star className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const KINDS: { value: InteractionKind; label: string }[] = [
  { value: 'call', label: 'Call' }, { value: 'meeting', label: 'Meeting' }, { value: 'email', label: 'Email' },
  { value: 'visit', label: 'Visit' }, { value: 'note', label: 'Note' },
];

function LogInteraction({ contact }: { contact: Contact }) {
  const log = useLogInteraction();
  const [kind, setKind] = useState<InteractionKind>('call');
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [personId, setPersonId] = useState<string>(NONE);
  const [summary, setSummary] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    try {
      await log.mutateAsync({ contactId: contact.id, input: {
        kind, summary: summary.trim(), ...(kind !== 'note' ? { direction } : {}), ...(personId !== NONE ? { person_id: personId } : {}),
      } });
      setSummary('');
      toast.success('Logged on the history');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as InteractionKind)}>
          <SelectTrigger className="w-32" aria-label="Kind"><SelectValue /></SelectTrigger>
          <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
        </Select>
        {kind !== 'note' && (
          <Select value={direction} onValueChange={(v) => setDirection(v as 'inbound' | 'outbound')}>
            <SelectTrigger className="w-40" aria-label="Direction"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="outbound">We contacted them</SelectItem>
              <SelectItem value="inbound">They contacted us</SelectItem>
            </SelectContent>
          </Select>
        )}
        {(contact.people?.length ?? 0) > 0 && (
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger className="w-40" aria-label="With"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>With the company</SelectItem>
              {contact.people!.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <Textarea aria-label="What happened" placeholder="What was said or agreed" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} maxLength={2000} />
      <Button type="submit" size="sm" disabled={log.isPending || !summary.trim()}>{log.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Log</Button>
    </form>
  );
}
