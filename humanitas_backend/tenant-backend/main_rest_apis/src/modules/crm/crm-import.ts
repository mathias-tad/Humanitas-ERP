/**
 * CRM import (featureslist §4.1, §24): reading CSV files, matching columns to fields, and reading
 * numbers, dates and statuses the way people type them. Pure; the service does the database work.
 */

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  /** Other column names that mean this field (lower case, letters and digits only). */
  aliases: string[];
  hint?: string;
}

export const LEAD_FIELDS: ImportField[] = [
  { key: 'title', label: 'Title (what they want)', aliases: ['title', 'lead', 'leadtitle', 'subject', 'interest', 'need', 'opportunity'] },
  { key: 'person_name', label: 'Person', aliases: ['person', 'name', 'contact', 'contactname', 'fullname', 'contactperson', 'personname'] },
  { key: 'company_name', label: 'Company', aliases: ['company', 'companyname', 'organisation', 'organization', 'business', 'account'] },
  { key: 'job_title', label: 'Job title', aliases: ['jobtitle', 'position', 'role', 'designation'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'telephone', 'tel', 'phonenumber', 'officephone'] },
  { key: 'mobile', label: 'Mobile', aliases: ['mobile', 'cell', 'cellphone', 'mobilephone'] },
  { key: 'email', label: 'Email', aliases: ['email', 'emailaddress', 'mail'] },
  { key: 'city', label: 'City', aliases: ['city', 'town', 'location', 'address'] },
  { key: 'source', label: 'Source', aliases: ['source', 'leadsource', 'channel', 'origin'] },
  { key: 'owner_email', label: 'Owner email', aliases: ['owner', 'owneremail', 'salesperson', 'assignedto', 'rep', 'salesrep'], hint: 'The email the owner signs in with' },
  { key: 'status', label: 'Status', aliases: ['status', 'stage', 'leadstatus'], hint: 'New, Contacted or Qualified' },
  { key: 'need', label: 'Need', aliases: ['needs', 'requirement', 'description', 'details'] },
  { key: 'budget', label: 'Budget', aliases: ['budget'] },
  { key: 'timeline', label: 'Timeline', aliases: ['timeline', 'timeframe', 'when'] },
  { key: 'decision_maker', label: 'Decision maker', aliases: ['decisionmaker', 'decider', 'approver'] },
  { key: 'expected_revenue', label: 'Expected revenue', aliases: ['expectedrevenue', 'revenue', 'value', 'amount', 'dealvalue'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'comment', 'remarks'] },
];

export const DEAL_FIELDS: ImportField[] = [
  { key: 'name', label: 'Deal name', required: true, aliases: ['name', 'deal', 'dealname', 'opportunity', 'opportunityname', 'title'] },
  { key: 'customer', label: 'Customer', aliases: ['customer', 'company', 'client', 'account', 'customername', 'companyname'] },
  { key: 'customer_tin', label: 'Customer TIN', aliases: ['tin', 'customertin', 'taxid', 'vat', 'vatnumber'] },
  { key: 'customer_phone', label: 'Customer phone', aliases: ['phone', 'customerphone', 'telephone', 'mobile'] },
  { key: 'pipeline', label: 'Pipeline', aliases: ['pipeline'], hint: 'Blank: the default pipeline' },
  { key: 'stage', label: 'Stage', aliases: ['stage', 'status', 'dealstage'], hint: 'A stage name of the pipeline; blank: the first stage' },
  { key: 'expected_revenue', label: 'Expected revenue', aliases: ['expectedrevenue', 'revenue', 'value', 'amount', 'dealvalue'] },
  { key: 'probability', label: 'Probability %', aliases: ['probability', 'winprobability', 'chance', 'likelihood'] },
  { key: 'expected_close_date', label: 'Expected close date', aliases: ['expectedclosedate', 'closedate', 'expectedclose', 'close', 'closingdate'] },
  { key: 'owner_email', label: 'Owner email', aliases: ['owner', 'owneremail', 'salesperson', 'assignedto', 'rep', 'salesrep'] },
  { key: 'source', label: 'Source', aliases: ['source', 'leadsource', 'channel'] },
  { key: 'lost_reason', label: 'Lost reason', aliases: ['lostreason', 'reason'], hint: 'Needed for deals in the Lost stage' },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'description', 'remarks'] },
];

export const MAX_IMPORT_ROWS = 5000;

/** "Owner E-mail " -> "owneremail" */
export function normalizeHeader(h: string): string {
  return String(h ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

/** Field key -> column index, from the headers' names (each column used once, required fields first). */
export function suggestMapping(headers: string[], fields: ImportField[]): Record<string, number> {
  const norm = headers.map(normalizeHeader);
  const used = new Set<number>();
  const out: Record<string, number> = {};
  const ordered = [...fields].sort((a, b) => Number(!!b.required) - Number(!!a.required));
  for (const pass of ['exact', 'alias'] as const) {
    for (const f of ordered) {
      if (out[f.key] !== undefined) continue;
      const wanted = pass === 'exact' ? [normalizeHeader(f.key), normalizeHeader(f.label)] : f.aliases;
      const i = norm.findIndex((h, idx) => !used.has(idx) && h && wanted.includes(h));
      if (i >= 0) {
        out[f.key] = i;
        used.add(i);
      }
    }
  }
  return out;
}

/** RFC 4180 CSV: quotes, doubled quotes, line breaks inside quotes; comma, semicolon or tab, whichever the header uses. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map((d) => ({ d, n: firstLine.split(d).length }));
  const delim = counts.sort((a, b) => b.n - a.n)[0].n > 1 ? counts[0].d : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** "1,250.50", "1 250", "ETB 2,000" -> number; '' -> null; anything else -> NaN. */
export function parseAmount(v: string | undefined): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const cleaned = s.replace(/(ETB|BIRR|BR|USD|\$)/gi, '').replace(/[\s,]/g, '');
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
}

/** YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, an Excel serial day or an ISO time -> YYYY-MM-DD; '' -> null; bad -> 'invalid'. */
export function parseDate(v: string | undefined): string | null | 'invalid' {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const ok = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
      ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : 'invalid';
  };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return ok(+m[3], +m[2], +m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86_400_000);
    return dt.toISOString().slice(0, 10);
  }
  return 'invalid';
}

/** Digits of a phone number, the last 9 (Ethiopian numbers: 09…, +2519… and 9… are the same). */
export function phoneKey(v: string | null | undefined): string | null {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length >= 6 ? d.slice(-9) : null;
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const LEAD_STATUS_WORDS: Record<string, 'new' | 'contacted' | 'qualified'> = {
  new: 'new', open: 'new', contacted: 'contacted', incontact: 'contacted', working: 'contacted', qualified: 'qualified', hot: 'qualified',
};

/** "Contacted", "qualified ", "" -> the lead status; unknown -> null. */
export function leadStatusOf(v: string | undefined): 'new' | 'contacted' | 'qualified' | null {
  const k = normalizeHeader(v ?? '');
  if (!k) return 'new';
  return LEAD_STATUS_WORDS[k] ?? null;
}
