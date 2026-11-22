import { useState } from 'react';
import { ArrowDown, ArrowUp, Archive, Loader2, Pencil, Plus, RotateCcw, Star } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/design-system/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/errors';
import { moveId } from '@/hooks/useProductExtras';
import { useCrmList, usePipelines, useSetupAction, type ListItem, type Pipeline, type Stage } from '@/hooks/useCrm';

function useRun() {
  const act = useSetupAction();
  const run = (method: 'post' | 'patch' | 'delete', path: string, body: unknown, ok: string) =>
    act.mutateAsync({ method, path, body }).then(() => { toast.success(ok); return true; }).catch((e) => { toast.error(errorMessage(e)); return false; });
  return { run, busy: act.isPending };
}

/** Add or edit a stage: name, win probability and days before a deal shows as stuck. */
function StageDialog({ pipeline, stage, onClose }: { pipeline: Pipeline; stage: Stage | 'new' | null; onClose: () => void }) {
  const { run, busy } = useRun();
  const editing = stage && stage !== 'new' ? stage : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [prob, setProb] = useState(String(editing?.probability ?? 50));
  const [rot, setRot] = useState(editing?.rotting_days == null ? '' : String(editing.rotting_days));
  const closing = !!editing && (editing.is_won || editing.is_lost);
  const submit = async () => {
    const p = Number(prob);
    if (!name.trim()) return toast.error('Name the stage');
    if (!(p >= 0 && p <= 100)) return toast.error('Probability is 0 to 100');
    const body = { name: name.trim(), ...(closing ? {} : { probability: Math.round(p), rotting_days: rot === '' ? null : Number(rot) }) };
    const ok = editing
      ? await run('patch', `stages/${editing.id}`, body, 'Stage saved')
      : await run('post', `pipelines/${pipeline.id}/stages`, body, 'Stage added');
    if (ok) onClose();
  };
  return (
    <Dialog open={!!stage} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? `Edit ${editing.name}` : `New stage in ${pipeline.name}`}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="st-name">Name</Label><Input id="st-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Site visit" /></div>
          {!closing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="st-prob">Win probability %</Label><Input id="st-prob" inputMode="numeric" value={prob} onChange={(e) => setProb(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="st-rot">Stuck after (days)</Label><Input id="st-rot" inputMode="numeric" value={rot} onChange={(e) => setRot(e.target.value)} placeholder="Never" /></div>
            </div>
          )}
          {closing && <p className="text-xs text-muted-foreground">Won and lost stages close the deal: 100% and 0%.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PipelineCard({ p, canEdit, canDelete }: { p: Pipeline; canEdit: boolean; canDelete: boolean }) {
  const { run } = useRun();
  const [stage, setStage] = useState<Stage | 'new' | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(p.name);
  const stages = p.stages.filter((s) => s.is_active);
  const move = (s: Stage, by: -1 | 1) => run('post', `pipelines/${p.id}/stages/order`, { stage_ids: moveId(stages.map((x) => x.id), s.id, by) }, 'Order saved');
  return (
    <section className="space-y-3 rounded-lg border p-4" aria-label={p.name}>
      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run('patch', `pipelines/${p.id}`, { name: name.trim() }, 'Pipeline renamed')) setRenaming(false); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Pipeline name" className="h-8 w-56" autoFocus />
            <Button size="sm" type="submit">Save</Button>
          </form>
        ) : <h2 className="text-base font-semibold">{p.name}</h2>}
        {p.is_default && <Badge variant="secondary">Default</Badge>}
        {!p.is_active && <Badge variant="outline">Archived</Badge>}
        <div className="ml-auto flex gap-1">
          {canEdit && p.is_active && !renaming && <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}><Pencil className="mr-1 h-3 w-3" /> Rename</Button>}
          {canEdit && p.is_active && !p.is_default && <Button size="sm" variant="ghost" onClick={() => run('patch', `pipelines/${p.id}`, { is_default: true }, `${p.name} is now the default`)}><Star className="mr-1 h-3 w-3" /> Make default</Button>}
          {canDelete && p.is_active && !p.is_default && <Button size="sm" variant="ghost" onClick={() => run('patch', `pipelines/${p.id}`, { is_active: false }, 'Pipeline archived')}><Archive className="mr-1 h-3 w-3" /> Archive</Button>}
          {canEdit && !p.is_active && <Button size="sm" variant="ghost" onClick={() => run('patch', `pipelines/${p.id}`, { is_active: true }, 'Pipeline restored')}><RotateCcw className="mr-1 h-3 w-3" /> Restore</Button>}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Stage</TableHead><TableHead className="text-right">Probability</TableHead><TableHead className="text-right">Stuck after</TableHead>
            <TableHead className="text-right">Open deals</TableHead><TableHead className="w-36" /></TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((s, i) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name} {s.is_won && <Badge className="ml-1">Won</Badge>}{s.is_lost && <Badge variant="destructive" className="ml-1">Lost</Badge>}</TableCell>
              <TableCell className="text-right tabular-nums">{s.probability}%</TableCell>
              <TableCell className="text-right tabular-nums">{s.rotting_days ? `${s.rotting_days} days` : '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{s.open_count ?? 0}</TableCell>
              <TableCell>
                {canEdit && p.is_active && (
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => move(s, -1)}><ArrowUp className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Move ${s.name} down`} disabled={i === stages.length - 1} onClick={() => move(s, 1)}><ArrowDown className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Edit ${s.name}`} onClick={() => setStage(s)}><Pencil className="h-3 w-3" /></Button>
                    {canDelete && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Archive ${s.name}`} onClick={() => run('delete', `stages/${s.id}`, undefined, `${s.name} archived`)}><Archive className="h-3 w-3" /></Button>}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {canEdit && p.is_active && <Button size="sm" variant="outline" onClick={() => setStage('new')}><Plus className="mr-1 h-3 w-3" /> Add stage</Button>}
      {stage && <StageDialog pipeline={p} stage={stage} onClose={() => setStage(null)} />}
    </section>
  );
}

function ListEditor({ kind, noun, example }: { kind: 'sources' | 'lost-reasons'; noun: string; example: string }) {
  const { hasPermission } = useAuth();
  const [archived, setArchived] = useState(false);
  const q = useCrmList(kind, archived);
  const { run, busy } = useRun();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [editName, setEditName] = useState('');
  return (
    <div className="max-w-xl space-y-3">
      {hasPermission('create_crm_setup') && (
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (name.trim() && await run('post', kind, { name: name.trim() }, `${noun} added`)) setName(''); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${noun.toLowerCase()}, e.g. ${example}`} aria-label={`New ${noun}`} />
          <Button type="submit" disabled={busy || !name.trim()}><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </form>
      )}
      <label className="flex items-center gap-2 text-sm"><Switch checked={archived} onCheckedChange={setArchived} /> Show archived</label>
      <ul className="divide-y rounded-md border">
        {(q.data ?? []).map((i) => (
          <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            {editing?.id === i.id ? (
              <form className="flex flex-1 gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run('patch', `${kind}/${i.id}`, { name: editName.trim() }, 'Saved')) setEditing(null); }}>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" autoFocus aria-label="Name" />
                <Button size="sm" type="submit">Save</Button>
              </form>
            ) : (
              <span className={`flex-1 ${i.is_active ? '' : 'text-muted-foreground line-through'}`}>{i.name}</span>
            )}
            {hasPermission('edit_crm_setup') && editing?.id !== i.id && i.is_active && (
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Rename ${i.name}`} onClick={() => { setEditing(i); setEditName(i.name); }}><Pencil className="h-3 w-3" /></Button>
            )}
            {i.is_active && hasPermission('delete_crm_setup') && (
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Archive ${i.name}`} onClick={() => run('patch', `${kind}/${i.id}`, { is_active: false }, `${i.name} archived`)}><Archive className="h-3 w-3" /></Button>
            )}
            {!i.is_active && hasPermission('edit_crm_setup') && (
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Restore ${i.name}`} onClick={() => run('patch', `${kind}/${i.id}`, { is_active: true }, `${i.name} restored`)}><RotateCcw className="h-3 w-3" /></Button>
            )}
          </li>
        ))}
        {!q.isLoading && !(q.data ?? []).length && <li className="px-3 py-4 text-center text-sm text-muted-foreground">None yet.</li>}
      </ul>
    </div>
  );
}

/** CRM -> Set-up: pipelines and stages, lead sources, lost reasons. */
export default function CrmSetupPage() {
  const { hasPermission } = useAuth();
  const [archived, setArchived] = useState(false);
  const pipelines = usePipelines(archived);
  const { run, busy } = useRun();
  const [newName, setNewName] = useState('');
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="CRM Set-up" description="Pipelines and their stages, where leads come from, and why deals are lost." />
      <Tabs defaultValue="pipelines">
        <TabsList>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="sources">Lead sources</TabsTrigger>
          <TabsTrigger value="lost">Lost reasons</TabsTrigger>
        </TabsList>
        <TabsContent value="pipelines" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Each stage has a win probability (for the weighted forecast) and, optionally, the number of days after which a deal in it shows as stuck.
            A new pipeline starts with New, Qualified, Proposal, Negotiation, Won and Lost.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {hasPermission('create_crm_setup') && (
              <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (newName.trim() && await run('post', 'pipelines', { name: newName.trim() }, 'Pipeline added')) setNewName(''); }}>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New pipeline, e.g. Projects" aria-label="New pipeline" className="w-64" />
                <Button type="submit" disabled={busy || !newName.trim()}><Plus className="mr-1 h-4 w-4" /> Add pipeline</Button>
              </form>
            )}
            <label className="flex items-center gap-2 text-sm"><Switch checked={archived} onCheckedChange={setArchived} /> Show archived</label>
          </div>
          {pipelines.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {pipelines.isError && <p className="text-sm text-destructive">{errorMessage(pipelines.error)}</p>}
          {(pipelines.data ?? []).map((p) => <PipelineCard key={p.id} p={p} canEdit={hasPermission('edit_crm_setup')} canDelete={hasPermission('delete_crm_setup')} />)}
        </TabsContent>
        <TabsContent value="sources" className="pt-4"><ListEditor kind="sources" noun="Lead source" example="Exhibition" /></TabsContent>
        <TabsContent value="lost" className="pt-4"><ListEditor kind="lost-reasons" noun="Lost reason" example="Delivery too slow" /></TabsContent>
      </Tabs>
    </div>
  );
}
