import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@/lib/errors';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthHeaders } from '@/context/AuthContext';

export type ImportKind = 'leads' | 'opportunities';

interface Field { key: string; label: string; required?: boolean; hint?: string }
interface Preview { headers: string[]; sample: string[][]; total: number; mapping: Record<string, number>; fields: Field[] }
interface CheckResult {
  total: number; ready: number; duplicates: number; problem_count: number;
  problems: { row: number; messages: string[] }[]; new_sources: string[]; new_customers?: string[]; imported?: number;
}

const NONE = '__none__';

/** Template columns with one example row, so people see what goes where. */
export const IMPORT_TEMPLATES: Record<ImportKind, { headers: string[]; example: string[] }> = {
  leads: {
    headers: ['Title', 'Person', 'Company', 'Job title', 'Phone', 'Mobile', 'Email', 'City', 'Source', 'Owner email', 'Status', 'Need', 'Budget', 'Timeline', 'Decision maker', 'Expected revenue', 'Notes'],
    example: ['20 office chairs', 'Sara Bekele', 'Abebe Trading', 'Buyer', '0111234567', '0911234567', 'sara@abebe.et', 'Addis Ababa', 'Website', '', 'New', 'Chairs for the new branch', '200000', 'Before end of month', 'Ato Abebe', '180000', ''],
  },
  opportunities: {
    headers: ['Deal name', 'Customer', 'Customer TIN', 'Customer phone', 'Pipeline', 'Stage', 'Expected revenue', 'Probability %', 'Expected close date', 'Owner email', 'Source', 'Lost reason', 'Notes'],
    example: ['Abebe Trading: 20 chairs', 'Abebe Trading', '0012345678', '0911234567', '', 'Proposal', '180000', '', '2026-12-31', '', 'Referral', '', ''],
  },
};

/** A CSV the template download gives (quotes where needed). */
export function templateCsv(kind: ImportKind): string {
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const t = IMPORT_TEMPLATES[kind];
  return `﻿${t.headers.map(q).join(',')}\r\n${t.example.map(q).join(',')}\r\n`;
}

async function send(kind: ImportKind, file: File, mode: 'preview' | 'check' | 'import', mapping?: Record<string, number>, options?: Record<string, unknown>) {
  const form = new FormData();
  form.append('mode', mode);
  if (mapping) form.append('mapping', JSON.stringify(mapping));
  if (options) form.append('options', JSON.stringify(options));
  form.append('file', file);
  const headers = { ...getAuthHeaders() } as Record<string, string>;
  delete headers['Content-Type'];
  const res = await fetch(`${API_BASE_URL}/crm/${kind}/import`, { method: 'POST', credentials: 'include', headers, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(body.message) ? body.message.join('\n') : body.message || `Import failed (${res.status})`);
  return body;
}

/** Import leads or deals: choose the file, match the columns, check every row, import the good ones. */
export function CrmImportDialog({ kind, open, onClose }: { kind: ImportKind; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const noun = kind === 'leads' ? 'leads' : 'deals';
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [createSources, setCreateSources] = useState(true);
  const [createCustomers, setCreateCustomers] = useState(true);
  const [ownerNone, setOwnerNone] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'check' | 'import' | null>(null);

  const reset = () => { setFile(null); setPreview(null); setMapping({}); setCheck(null); };
  const close = () => { reset(); onClose(); };
  const options = { create_missing_sources: createSources, create_missing_customers: createCustomers, default_owner: ownerNone ? 'none' : 'me' };

  const choose = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error('The file is larger than 5 MB; split it');
    setFile(f); setCheck(null); setBusy('preview');
    try {
      const p: Preview = await send(kind, f, 'preview');
      setPreview(p); setMapping(p.mapping);
    } catch (e) {
      toast.error(errorMessage(e)); setFile(null);
    } finally { setBusy(null); }
  };

  const run = async (mode: 'check' | 'import') => {
    if (!file) return;
    setBusy(mode);
    try {
      const r: CheckResult = await send(kind, file, mode, mapping, options);
      setCheck(r);
      if (mode === 'import') {
        toast.success(`${r.imported ?? 0} ${noun} imported`);
        qc.invalidateQueries({ queryKey: ['crm'] });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally { setBusy(null); }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateCsv(kind)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${noun}-import-template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const imported = check?.imported !== undefined;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import {noun}</DialogTitle>
          <DialogDescription>From an Excel (.xlsx) or CSV file, up to 5000 rows. Nothing is saved until you click Import.</DialogDescription>
        </DialogHeader>

        {!preview && (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground hover:bg-accent">
              {busy === 'preview' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              <span>{busy === 'preview' ? 'Reading the file…' : 'Choose an .xlsx or .csv file'}</span>
              <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
                onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <Button variant="link" className="px-0" onClick={downloadTemplate}><Download className="mr-1 h-4 w-4" /> Download the template</Button>
          </div>
        )}

        {preview && !imported && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-4 w-4" /> {file?.name}: {preview.total} rows, {preview.headers.length} columns.
              <Button variant="link" size="sm" className="h-auto px-1" onClick={reset}>Choose another file</Button></p>
            <section aria-label="Match the columns" className="space-y-2">
              <h3 className="text-sm font-medium">Which column holds each field?</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {preview.fields.map((f) => (
                  <div key={f.key} className="grid grid-cols-[9rem_1fr] items-center gap-2">
                    <Label htmlFor={`map-${f.key}`} className="text-xs">{f.label}{f.required ? ' *' : ''}</Label>
                    <Select value={mapping[f.key] === undefined ? NONE : String(mapping[f.key])}
                      onValueChange={(v) => { setCheck(null); setMapping((m) => { const n = { ...m }; if (v === NONE) delete n[f.key]; else n[f.key] = Number(v); return n; }); }}>
                      <SelectTrigger id={`map-${f.key}`} className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not in the file</SelectItem>
                        {preview.headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}{preview.sample[0]?.[i] ? ` (e.g. ${preview.sample[0][i].slice(0, 24)})` : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </section>
            <section aria-label="Options" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <label className="flex items-center gap-2"><Switch checked={createSources} onCheckedChange={(v) => { setCreateSources(v); setCheck(null); }} /> Create missing sources</label>
              {kind === 'opportunities' && (
                <label className="flex items-center gap-2"><Switch checked={createCustomers} onCheckedChange={(v) => { setCreateCustomers(v); setCheck(null); }} /> Create missing customers</label>
              )}
              <label className="flex items-center gap-2"><Switch checked={ownerNone} onCheckedChange={(v) => { setOwnerNone(v); setCheck(null); }} /> Rows without an owner stay unassigned (otherwise: me)</label>
            </section>
          </div>
        )}

        {check && (
          <section aria-label="Check result" className="space-y-2 rounded-md border p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {imported ? `${check.imported} ${noun} imported` : `${check.ready} of ${check.total} rows are ready to import`}
              {check.duplicates > 0 && <span className="font-normal text-muted-foreground">· {check.duplicates} duplicates skipped</span>}
            </p>
            {check.new_sources.length > 0 && <p className="text-xs text-muted-foreground">New sources: {check.new_sources.join(', ')}</p>}
            {(check.new_customers ?? []).length > 0 && <p className="text-xs text-muted-foreground">New customers: {(check.new_customers ?? []).slice(0, 10).join(', ')}{(check.new_customers ?? []).length > 10 ? ` and ${(check.new_customers ?? []).length - 10} more` : ''}</p>}
            {check.problem_count > 0 && (
              <div>
                <p className="flex items-center gap-2 text-amber-700"><AlertTriangle className="h-4 w-4" /> {check.problem_count} rows {imported ? 'were not imported' : 'will be left out'}:</p>
                <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs">
                  {check.problems.map((p) => <li key={p.row}><span className="font-mono">Row {p.row}:</span> {p.messages.join('; ')}</li>)}
                  {check.problem_count > check.problems.length && <li className="text-muted-foreground">…and {check.problem_count - check.problems.length} more</li>}
                </ul>
              </div>
            )}
          </section>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={close}>{imported ? 'Close' : 'Cancel'}</Button>
          {preview && !imported && (
            <Button variant="outline" onClick={() => run('check')} disabled={!!busy}>{busy === 'check' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Check</Button>
          )}
          {preview && !imported && (
            <Button onClick={() => run('import')} disabled={!!busy || !check || check.ready === 0}
              title={!check ? 'Check the file first' : undefined}>
              {busy === 'import' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Import {check ? `${check.ready} ${noun}` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
