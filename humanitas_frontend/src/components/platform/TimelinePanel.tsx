import { useInfiniteQuery } from '@tanstack/react-query';
import { Archive, ArrowRight, Clock, History, Loader2, MessageSquare, PencilLine, PhoneCall, RotateCcw, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { describeClient } from '@/lib/activityClient';

/** One entry of the universal activity timeline (featureslist §30). */
export interface TimelineEvent {
  id: string;
  event_type: string;
  summary: string | null;
  changes: { field: string; label: string; old: unknown; new: unknown }[];
  source: string;
  created_by_name?: string | null;
  client_platform?: string | null;
  client_device?: string | null;
  client_info?: { os?: string; browser?: string; appVersion?: string } | null;
  occurred_at: string;
}

interface TimelinePage {
  events: TimelineEvent[];
  nextCursor: string | null;
}

const ICONS: Record<string, typeof History> = {
  created: Sparkles,
  updated: PencilLine,
  deleted: Archive,
  restored: RotateCcw,
  note: MessageSquare,
  interaction: PhoneCall,
};

export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Read-only history of a record. `path` is the module's own timeline endpoint, e.g. /products/<id>/timeline. */
export function TimelinePanel({ path }: { path: string }) {
  const q = useInfiniteQuery({
    queryKey: ['timeline', path],
    queryFn: ({ pageParam }) => api.get<TimelinePage>(`${path}${pageParam ? `?before=${pageParam}` : ''}`),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
      </div>
    );
  }
  if (q.isError) return <p className="py-6 text-sm text-destructive">Could not load history.</p>;
  const events = q.data?.pages.flatMap((p) => p.events) ?? [];
  if (!events.length) return <p className="py-6 text-sm text-muted-foreground">No history yet.</p>;

  return (
    <ol className="relative space-y-4 border-l pl-5" aria-label="Record history">
      {events.map((e) => {
        const Icon = ICONS[e.event_type] ?? History;
        const when = new Date(e.occurred_at);
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border bg-background">
              <Icon className="h-3 w-3" />
            </span>
            <div className="text-sm font-medium">{e.summary ?? e.event_type}</div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>{e.created_by_name ?? 'System'}</span>
              <span aria-hidden>·</span>
              <time dateTime={e.occurred_at} title={when.toLocaleString()} className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {when.toLocaleString()}
              </time>
              <span aria-hidden>·</span>
              <span>{describeClient({ platform: e.client_platform, device: e.client_device, info: e.client_info })}</span>
              {e.source !== 'ui' && <span className="rounded bg-muted px-1">{e.source.toUpperCase()}</span>}
            </div>
            {e.event_type !== 'created' && e.changes?.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {e.changes.map((c) => (
                  <li key={c.field} className="flex flex-wrap items-center gap-1">
                    <span className="font-medium">{c.label}:</span>
                    <span className="text-muted-foreground line-through">{formatValue(c.old)}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{formatValue(c.new)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
      {q.hasNextPage && (
        <li>
          <Button variant="ghost" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? 'Loading…' : 'Show older'}
          </Button>
        </li>
      )}
    </ol>
  );
}
