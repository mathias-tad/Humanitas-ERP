import { useState, type ReactNode } from 'react';
import { CalendarClock, Check, Loader2, Mail, MapPin, Phone, Plus, SquareCheck, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { LoadMore } from '@/components/platform/InfiniteList';
import {
  ACTIVITY_TYPE_LABEL, activityState, toLocalInput, useCompleteActivity, useInfiniteActivities, useRemoveActivity, useSaveActivity,
  type Activity, type ActivityType, type RelatedType,
} from '@/hooks/useCrm';
import { UserSelect } from './CrmCommon';

export const ACTIVITY_ICON: Record<ActivityType, typeof Phone> = { call: Phone, meeting: Users, email: Mail, visit: MapPin, todo: SquareCheck };

const STATE_STYLE: Record<string, string> = {
  overdue: 'text-destructive', today: 'text-amber-700', upcoming: 'text-muted-foreground', done: 'text-emerald-700',
};

export function dueText(a: Activity): string {
  const d = new Date(a.due_at);
  const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

/** Plan an activity (call, meeting, email, visit, to-do), for yourself or a colleague. */
export function ActivityDialog({ open, onClose, related, initial }: {
  open: boolean; onClose: () => void; related?: { type: RelatedType; id: string; name?: string }; initial?: Partial<Activity>;
}) {
  const { user } = useAuth();
  const save = useSaveActivity();
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; };
  const [type, setType] = useState<ActivityType>(initial?.activity_type ?? 'call');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [due, setDue] = useState(initial?.due_at ? toLocalInput(new Date(initial.due_at)) : toLocalInput(tomorrow()));
  const [assignee, setAssignee] = useState<string | null>(initial?.assigned_to ?? user?.id ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const submit = async () => {
    if (!subject.trim()) return toast.error('Write what the activity is about');
    try {
      await save.mutateAsync({
        id: initial?.id,
        input: {
          activity_type: type, subject: subject.trim(), due_at: new Date(due).toISOString(), notes: notes.trim() || null,
          ...(assignee ? { assigned_to: assignee } : {}),
          ...(related && !initial?.id ? { related_type: related.type, related_id: related.id } : {}),
        },
      });
      toast.success(initial?.id ? 'Activity saved' : 'Activity planned');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Edit activity' : 'Plan an activity'}</DialogTitle>
          {related?.name && <DialogDescription>About {related.name}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="act-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger id="act-type"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((t) => <SelectItem key={t} value={t}>{ACTIVITY_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-due">When</Label>
              <Input id="act-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-subject">Subject *</Label>
            <Input id="act-subject" autoFocus value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Call back about the quote" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-who">Who does it</Label>
            <UserSelect id="act-who" value={assignee} onChange={setAssignee} allowNone={false} placeholder="Me" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-notes">Notes</Label>
            <Textarea id="act-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {initial?.id ? 'Save' : 'Plan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mark done with the outcome; it goes on the lead, deal or contact history. */
export function CompleteDialog({ activity, onClose }: { activity: Activity | null; onClose: () => void }) {
  const complete = useCompleteActivity();
  const [outcome, setOutcome] = useState('');
  return (
    <Dialog open={!!activity} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Done: {activity?.subject}</DialogTitle>
          <DialogDescription>What came out of it? This goes on the history.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} autoFocus value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. They will sign on Monday" aria-label="Outcome" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={complete.isPending} onClick={async () => {
            if (!activity) return;
            try {
              await complete.mutateAsync({ id: activity.id, outcome });
              toast.success('Marked as done');
              setOutcome('');
              onClose();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}>{complete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mark done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One activity row: type icon, subject, when, who, related record, done and remove. */
export function ActivityRow({ a, onDone, onEdit, showRelated = true, action }: {
  a: Activity; onDone: (a: Activity) => void; onEdit?: (a: Activity) => void; showRelated?: boolean; action?: ReactNode;
}) {
  const { hasPermission } = useAuth();
  const remove = useRemoveActivity();
  const Icon = ACTIVITY_ICON[a.activity_type] ?? CalendarClock;
  const state = activityState(a);
  return (
    <li className="flex items-start gap-3 px-3 py-2 text-sm">
      {!a.done_at && hasPermission('edit_crm_activities') ? (
        <button type="button" aria-label={`Mark ${a.subject} done`} title="Mark done" onClick={() => onDone(a)}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border hover:border-primary hover:bg-primary/10"><Check className="h-3 w-3 opacity-0 hover:opacity-100" /></button>
      ) : (
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-100 text-emerald-700"><Check className="h-3 w-3" /></span>
      )}
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <button type="button" className="text-left font-medium hover:underline disabled:no-underline" disabled={!onEdit || !!a.done_at} onClick={() => onEdit?.(a)}>
          {a.subject}
        </button>
        <div className="text-xs text-muted-foreground">
          <span className={STATE_STYLE[state]}>{state === 'overdue' ? 'Overdue · ' : ''}{dueText(a)}</span>
          {a.assigned_to_name && ` · ${a.assigned_to_name}`}
          {showRelated && a.related_name && ` · ${a.related_name}`}
        </div>
        {a.outcome && <div className="mt-1 text-xs">Outcome: {a.outcome}</div>}
      </div>
      {state === 'today' && <Badge variant="secondary">Today</Badge>}
      {action}
      {hasPermission('delete_crm_activities') && !a.done_at && (
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remove ${a.subject}`}
          onClick={() => remove.mutate(a.id, { onSuccess: () => toast.success('Activity removed'), onError: (e) => toast.error(errorMessage(e)) })}>
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </li>
  );
}

/** Activities of one lead, deal or contact, with "Plan activity". */
export function ActivitiesPanel({ related }: { related: { type: RelatedType; id: string; name?: string } }) {
  const { hasPermission } = useAuth();
  const [planning, setPlanning] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [completing, setCompleting] = useState<Activity | null>(null);
  const open = useInfiniteActivities({ assigned_to: 'all', related_type: related.type, related_id: related.id, when: 'open' });
  const done = useInfiniteActivities({ assigned_to: 'all', related_type: related.type, related_id: related.id, when: 'done' });
  return (
    <div className="space-y-4">
      {hasPermission('create_crm_activities') && (
        <Button size="sm" variant="outline" onClick={() => setPlanning(true)}><Plus className="mr-1 h-3 w-3" /> Plan activity</Button>
      )}
      <section aria-label="Planned">
        <h3 className="mb-1 text-sm font-medium">Planned</h3>
        <ul className="divide-y rounded-md border">
          {open.rows.map((a) => <ActivityRow key={a.id} a={a} showRelated={false} onDone={setCompleting} onEdit={setEditing} />)}
          {!open.rows.length && <li className="px-3 py-4 text-center text-sm text-muted-foreground">{open.isLoading ? 'Loading…' : 'Nothing planned. Plan the next step so nothing slips.'}</li>}
        </ul>
      </section>
      {done.rows.length > 0 && (
        <section aria-label="Done">
          <h3 className="mb-1 text-sm font-medium">Done</h3>
          <ul className="divide-y rounded-md border">{done.rows.map((a) => <ActivityRow key={a.id} a={a} showRelated={false} onDone={setCompleting} />)}</ul>
          <LoadMore hasNextPage={!!done.hasNextPage} isFetchingNextPage={done.isFetchingNextPage} fetchNextPage={done.fetchNextPage} loaded={done.rows.length} total={done.total} noun="activities" />
        </section>
      )}
      {planning && <ActivityDialog open onClose={() => setPlanning(false)} related={related} />}
      {editing && <ActivityDialog open onClose={() => setEditing(null)} initial={editing} />}
      <CompleteDialog activity={completing} onClose={() => setCompleting(null)} />
    </div>
  );
}
