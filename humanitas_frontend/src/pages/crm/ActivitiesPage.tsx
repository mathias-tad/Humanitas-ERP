import { useState } from 'react';
import { CalendarCheck, Plus } from 'lucide-react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useRecordDrawer } from '@/components/platform/RecordDrawer';
import { LoadMore } from '@/components/platform/InfiniteList';
import { shortcutHint, useShortcuts } from '@/lib/shortcuts';
import '@/components/crm/registerCrmEntities';
import { ActivityDialog, ActivityRow, CompleteDialog } from '@/components/crm/ActivitiesPanel';
import { useActivitySummary, useInfiniteActivities, type Activity, type ActivityFilters } from '@/hooks/useCrm';

type When = NonNullable<ActivityFilters['when']>;

/** CRM -> My Activities (CRM 1.5): what is overdue, due today and coming up. */
export default function ActivitiesPage() {
  const { hasPermission } = useAuth();
  const drawer = useRecordDrawer();
  const [when, setWhen] = useState<When>('overdue');
  const [who, setWho] = useState<'me' | 'all'>('me');
  const [planning, setPlanning] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [completing, setCompleting] = useState<Activity | null>(null);
  const summary = useActivitySummary().data;
  const list = useInfiniteActivities({ when, assigned_to: who });
  useShortcuts(hasPermission('create_crm_activities') ? [{ keys: 'n', description: 'Plan an activity', group: 'Activities', run: () => setPlanning(true) }] : []);

  const openRelated = (a: Activity) => {
    if (!a.related_id || !a.related_type) return;
    const type = a.related_type === 'lead' ? 'crm_lead' : a.related_type === 'opportunity' ? 'crm_opportunity' : 'contact';
    drawer.open({ type, mode: 'edit', id: a.related_id, title: a.related_name ?? undefined });
  };
  const tab = (w: When, label: string, n?: number) => <TabsTrigger value={w}>{label}{n !== undefined ? ` (${n})` : ''}</TabsTrigger>;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="My Activities"
        description="Calls, meetings, emails, visits and to-dos. Tick one when it is done and write the outcome: it goes on the lead or deal history."
        actions={hasPermission('create_crm_activities') && (
          <Button onClick={() => setPlanning(true)} title={shortcutHint('Plan an activity', 'n')}><Plus className="mr-2 h-4 w-4" /> Plan activity</Button>
        )}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={when} onValueChange={(v) => setWhen(v as When)}>
          <TabsList>
            {tab('overdue', 'Overdue', who === 'me' ? summary?.overdue : undefined)}
            {tab('today', 'Today', who === 'me' ? summary?.today : undefined)}
            {tab('upcoming', 'Upcoming', who === 'me' ? summary?.upcoming : undefined)}
            {tab('done', 'Done')}
          </TabsList>
        </Tabs>
        <Select value={who} onValueChange={(v) => setWho(v as 'me' | 'all')}>
          <SelectTrigger className="w-40" aria-label="Whose"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="me">Mine</SelectItem><SelectItem value="all">Everyone's</SelectItem></SelectContent>
        </Select>
      </div>
      <ul className="divide-y rounded-lg border">
        {list.rows.map((a) => (
          <ActivityRow key={a.id} a={a} onDone={setCompleting} onEdit={setEditing}
            action={a.related_id ? (
              <Button variant="link" size="sm" className="h-7" onClick={() => openRelated(a)}>Open {a.related_type === 'opportunity' ? 'deal' : a.related_type}</Button>
            ) : undefined} />
        ))}
        {!list.rows.length && (
          <li className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
            <CalendarCheck className="h-8 w-8 opacity-40" />
            {list.isLoading ? 'Loading…' : when === 'overdue' ? 'Nothing overdue. Well done.' : when === 'today' ? 'Nothing due today.' : 'Nothing here.'}
          </li>
        )}
      </ul>
      <LoadMore hasNextPage={!!list.hasNextPage} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={list.fetchNextPage} loaded={list.rows.length} total={list.total} noun="activities" />
      {planning && <ActivityDialog open onClose={() => setPlanning(false)} />}
      {editing && <ActivityDialog open onClose={() => setEditing(null)} initial={editing} />}
      <CompleteDialog activity={completing} onClose={() => setCompleting(null)} />
    </div>
  );
}
