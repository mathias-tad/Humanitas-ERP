import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorMessage } from '@/lib/errors';
import { formatMoney, monthLabel, useForecast, usePipelines } from '@/hooks/useCrm';

const ALL = '__all__';

function Stat({ label, value, hint, onClick }: { label: string; value: string | number; hint?: string; onClick?: () => void }) {
  const body = (
    <>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="rounded-lg border p-4 text-left hover:border-primary hover:bg-primary/5">{body}</button>
    : <div className="rounded-lg border p-4">{body}</div>;
}

/** CRM -> Forecast (CRM 1.4): weighted revenue by expected close month. */
export default function ForecastPage() {
  const navigate = useNavigate();
  const pipelines = usePipelines().data ?? [];
  const [pipelineId, setPipelineId] = useState<string | undefined>();
  const [owner, setOwner] = useState<'all' | 'me'>('all');
  const q = useForecast({ pipeline_id: pipelineId, ...(owner === 'me' ? { owner_id: 'me' } : {}) });
  const f = q.data;
  const max = Math.max(1, ...(f?.months ?? []).map((m) => m.revenue));

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Forecast"
        description="Open deals by expected close month. Weighted = expected revenue × win probability."
        actions={
          <div className="flex gap-2">
            <Select value={pipelineId ?? ALL} onValueChange={(v) => setPipelineId(v === ALL ? undefined : v)}>
              <SelectTrigger className="w-48" aria-label="Pipeline"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All pipelines</SelectItem>{pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={owner} onValueChange={(v) => setOwner(v as 'all' | 'me')}>
              <SelectTrigger className="w-36" aria-label="Owner"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Everyone's</SelectItem><SelectItem value="me">Mine</SelectItem></SelectContent>
            </Select>
          </div>
        }
      />
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.isError && <p className="text-sm text-destructive">{errorMessage(q.error)}</p>}
      {f && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Open deals" value={f.open_count} />
            <Stat label="Pipeline value" value={formatMoney(f.open_revenue)} />
            <Stat label="Weighted" value={formatMoney(f.open_weighted)} />
            <Stat label="Won this month" value={formatMoney(f.won_this_month.revenue)} hint={`${f.won_this_month.count} deals`} />
            <Stat label="Need attention" value={f.overdue_count + f.stuck_count} hint={`${f.overdue_count} past close · ${f.stuck_count} stuck`}
              onClick={() => navigate('/crm/opportunities?attention=overdue')} />
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Month</TableHead><TableHead className="text-right">Deals</TableHead><TableHead className="w-1/3" />
                  <TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Weighted</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {f.months.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">{monthLabel(m.month)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                    <TableCell>
                      <div className="relative h-3 rounded-full bg-muted" aria-hidden>
                        <div className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${(m.revenue / max) * 100}%` }} />
                        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(m.weighted / max) * 100}%` }} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(m.revenue)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(m.weighted)}</TableCell>
                  </TableRow>
                ))}
                {!f.months.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No open deals.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
