import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Loader2, Mail, MapPin, MessageCircle, MessageSquare, Phone, Send, StickyNote, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/context/AuthContext';
import { ACTIVITY_TYPE_LABEL, toLocalInput, useInfiniteActivities, type ActivityType } from '@/hooks/useCrm';
import { dueText } from './ActivitiesPanel';
import { UserSelect } from './CrmCommon';

export type FollowUpChannel = 'call' | 'meeting' | 'visit' | 'email' | 'telegram' | 'whatsapp' | 'sms' | 'note';
export type FollowUpTarget = 'lead' | 'opportunity';

export const CHANNELS: { value: FollowUpChannel; label: string; icon: typeof Phone }[] = [
  { value: 'call', label: 'Call', icon: Phone }, { value: 'meeting', label: 'Meeting', icon: Users }, { value: 'visit', label: 'Visit', icon: MapPin },
  { value: 'email', label: 'Email', icon: Mail }, { value: 'telegram', label: 'Telegram', icon: Send }, { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'sms', label: 'SMS', icon: MessageSquare }, { value: 'note', label: 'Note', icon: StickyNote },
];
export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.value, c.label])) as Record<FollowUpChannel, string>;

/** "Telegram · 2 days ago" for a list; "Never" when nobody has been in touch. */
export function lastContactText(at: string | null | undefined, channel: string | null | undefined, now = new Date()): string {
  if (!at) return 'Never';
  const days = Math.floor((now.getTime() - new Date(at).getTime()) / 86_400_000);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : new Date(at).toLocaleDateString();
  const how = channel ? CHANNEL_LABEL[channel as FollowUpChannel] ?? channel : '';
  return how ? `${how} · ${when}` : when;
}

/** Open records not contacted for this many days are flagged in the lists. */
export const STALE_DAYS = 14;
export const isStale = (at: string | null | undefined, now = new Date()) => !at || now.getTime() - new Date(at).getTime() > STALE_DAYS * 86_400_000;

interface TimelineEvent {
  id: string;
  event_type: 'interaction' | 'note';
  summary: string | null;
  payload: { channel?: FollowUpChannel; kind?: string; direction?: 'inbound' | 'outbound' | null; outcome?: string; with_whom?: string | null; duration_minutes?: number | null; sequence?: number | null };
  occurred_at: string;
  created_by_name?: string | null;
}

const path = (t: FollowUpTarget, id: string) => `/crm/${t === 'lead' ? 'leads' : 'opportunities'}/${id}/follow-ups`;

/** Log a contact that already happened, and optionally plan the next step. */
export function FollowUpDialog({ target, id, name, open, onClose }: { target: FollowUpTarget; id: string; name?: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [channel, setChannel] = useState<FollowUpChannel>('call');
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [duration, setDuration] = useState('');
  const [withWhom, setWithWhom] = useState('');
  const [outcome, setOutcome] = useState('');
  const [planNext, setPlanNext] = useState(true);
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; };
  const [nextType, setNextType] = useState<ActivityType>('call');
  const [nextSubject, setNextSubject] = useState('');
  const [nextDue, setNextDue] = useState(toLocalInput(tomorrow()));
  const [nextWho, setNextWho] = useState<string | null>(user?.id ?? null);
  const save = useMutation({
    mutationFn: (body: unknown) => api.post<{ sequence: number | null }>(path(target, id), body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm'] }); qc.invalidateQueries({ queryKey: ['follow-ups'] }); qc.invalidateQueries({ queryKey: ['timeline'] }); },
  });
  const isNote = channel === 'note';
  const submit = async () => {
    if (!outcome.trim()) return toast.error(isNote ? 'Write the note' : 'Write what came out of it');
    if (planNext && !isNote && !nextSubject.trim()) return toast.error('Write the next step, or switch it off');
    const whenDate = new Date(when);
    if (whenDate.getTime() > Date.now() + 5 * 60 * 1000) return toast.error('Log what already happened; plan future contacts as the next step');
    try {
      const r = await save.mutateAsync({
        channel, outcome: outcome.trim(),
        ...(isNote ? {} : { direction, ...(duration ? { duration_minutes: Number(duration) } : {}), ...(withWhom.trim() ? { with_whom: withWhom.trim() } : {}) }),
        ...(Math.abs(whenDate.getTime() - Date.now()) > 2 * 60 * 1000 ? { occurred_at: whenDate.toISOString() } : {}),
        ...(planNext && !isNote ? { next: { activity_type: nextType, subject: nextSubject.trim(), due_at: new Date(nextDue).toISOString(), ...(nextWho ? { assigned_to: nextWho } : {}) } } : {}),
      });
      toast.success(r.sequence ? `${r.sequence}${['th', 'st', 'nd', 'rd'][((r.sequence % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][r.sequence % 100] || 'th'} contact logged` : 'Note added');
      setOutcome(''); setDuration(''); setWithWhom(''); setNextSubject('');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log follow-up</DialogTitle>
          <DialogDescription>{name ? `${name}: ` : ''}a contact that already happened.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div role="radiogroup" aria-label="How" className="grid grid-cols-4 gap-2">
            {CHANNELS.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={channel === c.value} onClick={() => setChannel(c.value)}
                className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs ${channel === c.value ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent'}`}>
                <c.icon className="h-4 w-4" />{c.label}
              </button>
            ))}
          </div>
          {!isNote && (
            <div className="flex rounded-md border p-0.5 text-sm" role="radiogroup" aria-label="Who made contact">
              {([['outbound', 'We contacted them', ArrowUpRight], ['inbound', 'They contacted us', ArrowDownLeft]] as const).map(([v, label, Icon]) => (
                <button key={v} type="button" role="radio" aria-checked={direction === v} onClick={() => setDirection(v)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 ${direction === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="fu-when">When</Label><Input id="fu-when" type="datetime-local" value={when} max={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} /></div>
            {!isNote && <div className="space-y-1"><Label htmlFor="fu-min">Minutes</Label><Input id="fu-min" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} placeholder="Optional" /></div>}
          </div>
          {!isNote && <div className="space-y-1"><Label htmlFor="fu-who">With whom</Label><Input id="fu-who" value={withWhom} onChange={(e) => setWithWhom(e.target.value)} placeholder="e.g. Sara (buyer)" /></div>}
          <div className="space-y-1">
            <Label htmlFor="fu-outcome">{isNote ? 'Note *' : 'Outcome *'}</Label>
            <Textarea id="fu-outcome" rows={3} autoFocus value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={isNote ? '' : 'e.g. Wants a quote by Friday; decides with the owner'} />
          </div>
          {!isNote && (
            <section className="space-y-3 rounded-md border p-3" aria-label="Next step">
              <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={planNext} onCheckedChange={setPlanNext} /> Plan the next step</label>
              {planNext && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="fu-ntype">Type</Label>
                    <Select value={nextType} onValueChange={(v) => setNextType(v as ActivityType)}>
                      <SelectTrigger id="fu-ntype"><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((t) => <SelectItem key={t} value={t}>{ACTIVITY_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label htmlFor="fu-ndue">When</Label><Input id="fu-ndue" type="datetime-local" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></div>
                  <div className="col-span-2 space-y-1"><Label htmlFor="fu-nsub">Next step</Label><Input id="fu-nsub" value={nextSubject} onChange={(e) => setNextSubject(e.target.value)} placeholder="e.g. Send the quote" /></div>
                  <div className="col-span-2 space-y-1"><Label htmlFor="fu-nwho">Who does it</Label><UserSelect id="fu-nwho" value={nextWho} onChange={setNextWho} allowNone={false} placeholder="Me" /></div>
                </div>
              )}
            </section>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The Follow-ups tab: the next step on top, then every contact, numbered, newest first. */
export function FollowUpsPanel({ target, id, name, canLog }: { target: FollowUpTarget; id: string; name?: string; canLog: boolean }) {
  const [logging, setLogging] = useState(false);
  const next = useInfiniteActivities({ assigned_to: 'all', related_type: target, related_id: id, when: 'open' });
  const q = useInfiniteQuery({
    queryKey: ['follow-ups', target, id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.get<{ events: TimelineEvent[]; nextCursor: string | null }>(`${path(target, id)}?limit=30${pageParam ? `&before=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const events = (q.data?.pages ?? []).flatMap((p) => p.events);
  const upcoming = next.rows[0];
  return (
    <div className="space-y-4">
      {canLog && <Button size="sm" onClick={() => setLogging(true)}><Phone className="mr-1 h-3 w-3" /> Log follow-up</Button>}
      <section aria-label="Next step" className="rounded-md border bg-muted/30 p-3 text-sm">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> Next step</div>
        {upcoming ? (
          <div>
            <span className="font-medium">{ACTIVITY_TYPE_LABEL[upcoming.activity_type]}: {upcoming.subject}</span>
            <span className={`ml-2 text-xs ${new Date(upcoming.due_at) < new Date() ? 'text-destructive' : 'text-muted-foreground'}`}>{dueText(upcoming)}{upcoming.assigned_to_name ? ` · ${upcoming.assigned_to_name}` : ''}</span>
            {next.rows.length > 1 && <span className="ml-2 text-xs text-muted-foreground">+{next.rows.length - 1} more planned (Activities tab)</span>}
          </div>
        ) : <span className="text-amber-700">Nothing planned. Plan the next step when you log a follow-up.</span>}
      </section>
      <ol className="space-y-2" aria-label="Follow-ups">
        {events.map((e) => {
          const ch = (e.payload?.channel ?? e.payload?.kind) as FollowUpChannel | undefined;
          const meta = CHANNELS.find((c) => c.value === ch) ?? CHANNELS[CHANNELS.length - 1];
          const Icon = meta.icon;
          return (
            <li key={e.id} className="flex gap-3 rounded-md border p-3 text-sm">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {e.payload?.sequence ? <span className="font-semibold text-foreground">#{e.payload.sequence}</span> : null}
                  <span className="font-medium text-foreground">{meta.label}</span>
                  {e.payload?.direction && <span className="flex items-center gap-0.5">{e.payload.direction === 'inbound' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{e.payload.direction === 'inbound' ? 'from them' : 'by us'}</span>}
                  <span>{new Date(e.occurred_at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {e.payload?.duration_minutes ? <span>{e.payload.duration_minutes} min</span> : null}
                  {e.payload?.with_whom && <span>with {e.payload.with_whom}</span>}
                  {e.created_by_name && <span>· {e.created_by_name}</span>}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{e.payload?.outcome ?? e.summary}</p>
              </div>
            </li>
          );
        })}
        {!events.length && <li className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">{q.isLoading ? 'Loading…' : 'No follow-ups yet.'}</li>}
      </ol>
      {q.hasNextPage && <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>{q.isFetchingNextPage ? 'Loading…' : 'Older follow-ups'}</Button>}
      {logging && <FollowUpDialog target={target} id={id} name={name} open onClose={() => setLogging(false)} />}
    </div>
  );
}
