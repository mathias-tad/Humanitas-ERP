import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { ContactsService } from '../contacts/contacts.service';
import type { CatalogContext } from '../../common/records/record-context';
import { defaultRecordCompany, isVisible, type Queryable } from '../../common/records/record-scope';
import { CrmBase, ENTITY } from './crm.base';
import { CrmSetupService } from './crm-setup.service';
import {
  DEAL_FIELDS, LEAD_FIELDS, MAX_IMPORT_ROWS, isEmail, leadStatusOf, parseAmount, parseCsv, parseDate, phoneKey, suggestMapping,
  type ImportField,
} from './crm-import';

export type ImportKind = 'leads' | 'opportunities';
export type ImportMode = 'preview' | 'check' | 'import';

export interface ImportOptions {
  /** Create lead sources (and, for deals, lost reasons) the file names but the list does not have. */
  create_missing_sources?: boolean;
  /** Deals: create the customer when no contact matches. */
  create_missing_customers?: boolean;
  /** Who owns rows without an owner: me (default) or nobody. */
  default_owner?: 'me' | 'none';
}

export interface ImportFile {
  data: Buffer;
  filename: string;
}

export interface RowProblem {
  row: number;
  messages: string[];
}

type Cells = string[];

/** Reads a CSV or Excel file into a header row and data rows of text. */
export async function readSheet(file: ImportFile): Promise<{ headers: string[]; rows: Cells[] }> {
  const ext = path.extname(file.filename || '').toLowerCase();
  let table: string[][];
  if (ext === '.xlsx') {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file.data as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('This Excel file could not be read; save it again as .xlsx or CSV');
    }
    const ws = wb.worksheets.find((w) => w.rowCount > 0);
    if (!ws) throw new BadRequestException('The file has no rows');
    table = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const out: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        const cell = row.getCell(c);
        const v = cell.value;
        out.push(v instanceof Date ? v.toISOString().slice(0, 10) : String(cell.text ?? '').trim());
      }
      if (out.some((x) => x !== '')) table.push(out);
    });
  } else if (ext === '.csv' || ext === '.txt') {
    const text = file.data.toString('utf8');
    if (text.includes('\u0000')) throw new BadRequestException('This is not a text CSV file');
    table = parseCsv(text);
  } else {
    throw new BadRequestException('Choose an Excel (.xlsx) or CSV file');
  }
  if (table.length < 2) throw new BadRequestException('The file needs a header row and at least one row of data');
  if (table.length - 1 > MAX_IMPORT_ROWS) throw new BadRequestException(`Up to ${MAX_IMPORT_ROWS} rows at a time; split the file`);
  const headers = table[0].map((h, i) => h.trim() || `Column ${i + 1}`);
  return { headers, rows: table.slice(1) };
}

/** Import leads and opportunities from Excel or CSV: preview, check every row, then import the good ones. */
@Injectable()
export class CrmImportService extends CrmBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
    private readonly setup: CrmSetupService,
    private readonly contacts: ContactsService,
  ) {
    super();
  }

  static fields(kind: ImportKind): ImportField[] {
    return kind === 'leads' ? LEAD_FIELDS : DEAL_FIELDS;
  }

  async run(ctx: CatalogContext, kind: ImportKind, file: ImportFile, mode: ImportMode, mapping?: Record<string, number>, options: ImportOptions = {}) {
    const { headers, rows } = await readSheet(file);
    const fields = CrmImportService.fields(kind);
    const map = mapping && Object.keys(mapping).length ? mapping : suggestMapping(headers, fields);
    for (const [k, i] of Object.entries(map)) {
      if (!fields.some((f) => f.key === k)) throw new BadRequestException(`Unknown field ${k}`);
      if (!Number.isInteger(i) || i < 0 || i >= headers.length) throw new BadRequestException(`The column for ${k} is not in the file`);
    }
    if (mode === 'preview') {
      return { headers, sample: rows.slice(0, 5), total: rows.length, mapping: map, fields };
    }
    for (const f of fields) if (f.required && map[f.key] === undefined) throw new BadRequestException(`Choose the column for ${f.label}`);
    if (kind === 'leads' && map.title === undefined && map.person_name === undefined && map.company_name === undefined) {
      throw new BadRequestException('Choose the column for the title, the person or the company');
    }
    const get = (r: Cells, k: string) => (map[k] === undefined ? '' : String(r[map[k]] ?? '').trim());
    return kind === 'leads' ? this.leads(ctx, file, rows, get, mode, options) : this.deals(ctx, file, rows, get, mode, options);
  }

  // ── Leads ────────────────────────────────────────────────────────────────────
  private async leads(ctx: CatalogContext, file: ImportFile, rows: Cells[], get: (r: Cells, k: string) => string, mode: ImportMode, o: ImportOptions) {
    const { conn, scope } = await this.open(ctx);
    const lookups = await this.lookups(conn, rows.map((r) => get(r, 'owner_email')));
    const existing = await this.existingLeadKeys(conn);
    const seen = new Set<string>();
    const problems: RowProblem[] = [];
    const ready: { row: number; values: Record<string, unknown> }[] = [];
    let duplicates = 0;
    const newSources = new Set<string>();

    rows.forEach((r, i) => {
      const rowNo = i + 2;
      const msgs: string[] = [];
      const person = get(r, 'person_name');
      const company = get(r, 'company_name');
      const title = get(r, 'title') || (company ? `Lead: ${company}` : person ? `Lead: ${person}` : '');
      if (!title && !person && !company) msgs.push('No title, person or company');
      const email = get(r, 'email').toLowerCase();
      if (email && !isEmail(email)) msgs.push(`"${email}" is not an email`);
      const budget = parseAmount(get(r, 'budget'));
      if (Number.isNaN(budget) || (budget ?? 0) < 0) msgs.push(`Budget "${get(r, 'budget')}" is not an amount`);
      const revenue = parseAmount(get(r, 'expected_revenue'));
      if (Number.isNaN(revenue) || (revenue ?? 0) < 0) msgs.push(`Expected revenue "${get(r, 'expected_revenue')}" is not an amount`);
      const status = leadStatusOf(get(r, 'status'));
      if (!status) msgs.push(`Status "${get(r, 'status')}" must be New, Contacted or Qualified`);
      const sourceName = get(r, 'source');
      let sourceId: string | null = null;
      if (sourceName) {
        sourceId = lookups.sources.get(sourceName.toLowerCase()) ?? null;
        if (!sourceId) {
          if (o.create_missing_sources) newSources.add(sourceName);
          else msgs.push(`Source "${sourceName}" is not in CRM Set-up`);
        }
      }
      const ownerEmail = get(r, 'owner_email').toLowerCase();
      let ownerId: string | null = o.default_owner === 'none' ? null : ctx.user?.sub ?? null;
      if (ownerEmail) {
        ownerId = lookups.users.get(ownerEmail) ?? null;
        if (!ownerId) msgs.push(`No active user signs in with ${ownerEmail}`);
      }
      if (msgs.length) return problems.push({ row: rowNo, messages: msgs });
      const keys = [email && `e:${email}`, phoneKey(get(r, 'phone')) && `p:${phoneKey(get(r, 'phone'))}`, phoneKey(get(r, 'mobile')) && `p:${phoneKey(get(r, 'mobile'))}`]
        .filter((k): k is string => !!k);
      if (keys.some((k) => existing.has(k) || seen.has(k))) {
        duplicates += 1;
        return problems.push({ row: rowNo, messages: ['Skipped: a lead with this email or phone already exists'] });
      }
      keys.forEach((k) => seen.add(k));
      ready.push({
        row: rowNo,
        values: {
          title: title.slice(0, 255), person_name: person || null, company_name: company || null, job_title: get(r, 'job_title') || null,
          email: email || null, phone: get(r, 'phone') || null, mobile: get(r, 'mobile') || null, city: get(r, 'city') || null,
          source_name: sourceName || null, source_id: sourceId, owner_id: ownerId, status, need: get(r, 'need') || null, budget,
          timeline: get(r, 'timeline') || null, decision_maker: get(r, 'decision_maker') || null, expected_revenue: revenue,
          notes: get(r, 'notes') || null,
        },
      });
    });

    const summary = { kind: 'leads' as const, total: rows.length, ready: ready.length, duplicates, problems: problems.slice(0, 200), problem_count: problems.length, new_sources: [...newSources] };
    if (mode === 'check') return summary;

    const companyId = defaultRecordCompany(scope) ?? null;
    const created: string[] = [];
    await conn.transaction(async (m: Queryable) => {
      const sourceIds = await this.createSources(m, newSources, lookups.sources);
      for (const r of ready) {
        const v = r.values;
        const [row] = await m.query(
          `INSERT INTO crm_leads (title, person_name, company_name, job_title, email, phone, mobile, city, source_id, owner_id, status,
                                  need, budget, timeline, decision_maker, expected_revenue, notes, company_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19) RETURNING id`,
          [v.title, v.person_name, v.company_name, v.job_title, v.email, v.phone, v.mobile, v.city,
            v.source_id ?? (v.source_name ? sourceIds.get(String(v.source_name).toLowerCase()) ?? null : null), v.owner_id, v.status,
            v.need, v.budget, v.timeline, v.decision_maker, v.expected_revenue, v.notes, companyId, ctx.user?.sub ?? null],
        );
        created.push(row.id);
      }
    });
    for (const id of created) await this.record(ctx, ENTITY.lead, id, 'created', `Lead imported from ${path.basename(file.filename)}`);
    return { ...summary, imported: created.length };
  }

  // ── Opportunities ────────────────────────────────────────────────────────────
  private async deals(ctx: CatalogContext, file: ImportFile, rows: Cells[], get: (r: Cells, k: string) => string, mode: ImportMode, o: ImportOptions) {
    const { conn, scope } = await this.open(ctx);
    const lookups = await this.lookups(conn, rows.map((r) => get(r, 'owner_email')));
    const pipelines: { id: string; name: string; is_default: boolean; company_id: string | null; branch_id?: string | null }[] =
      (await conn.query(`SELECT id, name, is_default, company_id, branch_id FROM crm_pipelines WHERE is_active`)).filter((p: { company_id: string | null; branch_id?: string | null }) => isVisible(scope, p.company_id, p.branch_id));
    const defaultPipeline = await this.setup.resolvePipeline(conn, scope, null);
    const stagesBy = new Map<string, { id: string; name: string; probability: number; is_won: boolean; is_lost: boolean }[]>();
    for (const p of pipelines) stagesBy.set(p.id, await this.setup.stagesOf(conn, p.id));
    const reasons = new Map<string, string>(
      (await conn.query(`SELECT id, name FROM crm_lost_reasons WHERE is_active`)).map((x: { id: string; name: string }) => [x.name.toLowerCase(), x.id]),
    );
    const customers = await this.customerIndex(conn, scope);
    const openDeals = new Set<string>(
      (await conn.query(`SELECT lower(name) AS name, contact_id FROM crm_opportunities WHERE is_active AND status = 'open'`))
        .map((d: { name: string; contact_id: string | null }) => `${d.name}|${d.contact_id ?? ''}`),
    );
    const problems: RowProblem[] = [];
    const ready: { row: number; v: Record<string, unknown> }[] = [];
    const newSources = new Set<string>();
    const newCustomers = new Map<string, { name: string; tin: string | null; phone: string | null }>();
    let duplicates = 0;
    const seen = new Set<string>();

    rows.forEach((r, i) => {
      const rowNo = i + 2;
      const msgs: string[] = [];
      const name = get(r, 'name');
      if (!name) msgs.push('No deal name');
      const pipeName = get(r, 'pipeline');
      const pipeline = pipeName ? pipelines.find((p) => p.name.toLowerCase() === pipeName.toLowerCase()) : pipelines.find((p) => p.id === defaultPipeline.id) ?? pipelines[0];
      if (!pipeline) msgs.push(pipeName ? `Pipeline "${pipeName}" not found` : 'There is no pipeline (CRM Set-up)');
      const stages = pipeline ? stagesBy.get(pipeline.id) ?? [] : [];
      const stageName = get(r, 'stage');
      const stage = stageName ? stages.find((s) => s.name.toLowerCase() === stageName.toLowerCase()) : stages.find((s) => !s.is_won && !s.is_lost);
      if (pipeline && !stage) msgs.push(stageName ? `Stage "${stageName}" is not in ${pipeline.name}` : `${pipeline.name} has no open stage`);
      const reasonName = get(r, 'lost_reason');
      const reasonId = reasonName ? reasons.get(reasonName.toLowerCase()) ?? null : null;
      if (stage?.is_lost && !reasonId) msgs.push(reasonName ? `Lost reason "${reasonName}" is not in CRM Set-up` : 'A lost deal needs its lost reason');
      const revenue = parseAmount(get(r, 'expected_revenue'));
      if (Number.isNaN(revenue) || (revenue ?? 0) < 0) msgs.push(`Expected revenue "${get(r, 'expected_revenue')}" is not an amount`);
      const probText = get(r, 'probability').replace('%', '').trim();
      const probability = probText === '' ? null : Number(probText);
      if (probability !== null && !(Number.isInteger(probability) && probability >= 0 && probability <= 100)) msgs.push(`Probability "${get(r, 'probability')}" must be 0 to 100`);
      const close = parseDate(get(r, 'expected_close_date'));
      if (close === 'invalid') msgs.push(`Close date "${get(r, 'expected_close_date')}" is not a date (use 2026-12-31 or 31/12/2026)`);
      const sourceName = get(r, 'source');
      const sourceId = sourceName ? lookups.sources.get(sourceName.toLowerCase()) ?? null : null;
      if (sourceName && !sourceId) {
        if (o.create_missing_sources) newSources.add(sourceName);
        else msgs.push(`Source "${sourceName}" is not in CRM Set-up`);
      }
      const ownerEmail = get(r, 'owner_email').toLowerCase();
      let ownerId: string | null = o.default_owner === 'none' ? null : ctx.user?.sub ?? null;
      if (ownerEmail) {
        ownerId = lookups.users.get(ownerEmail) ?? null;
        if (!ownerId) msgs.push(`No active user signs in with ${ownerEmail}`);
      }
      const custName = get(r, 'customer');
      const tin = get(r, 'customer_tin').replace(/\s/g, '');
      const phone = get(r, 'customer_phone');
      const match = customers.find(custName, tin, phone);
      let customerKey: string | null = null;
      if ((custName || tin || phone) && !match) {
        if (o.create_missing_customers && custName) {
          customerKey = custName.toLowerCase();
          if (!newCustomers.has(customerKey)) newCustomers.set(customerKey, { name: custName, tin: tin || null, phone: phone || null });
        } else msgs.push(custName ? `Customer "${custName}" not found${o.create_missing_customers ? '' : ' (tick "Create missing customers")'}` : 'No customer matches this TIN or phone');
      }
      if (msgs.length) return problems.push({ row: rowNo, messages: msgs });
      const dupKey = `${name.toLowerCase()}|${match?.id ?? customerKey ?? ''}`;
      if ((match && openDeals.has(`${name.toLowerCase()}|${match.id}`)) || seen.has(dupKey)) {
        duplicates += 1;
        return problems.push({ row: rowNo, messages: ['Skipped: this customer already has an open deal with this name'] });
      }
      seen.add(dupKey);
      ready.push({
        row: rowNo,
        v: {
          name: name.slice(0, 255), contact_id: match?.id ?? null, customer_key: customerKey, pipeline_id: pipeline!.id, stage: stage!,
          revenue: revenue ?? 0, probability, close, source_id: sourceId, source_name: sourceName || null, owner_id: ownerId,
          lost_reason_id: reasonId, notes: get(r, 'notes') || null,
        },
      });
    });

    const summary = {
      kind: 'opportunities' as const, total: rows.length, ready: ready.length, duplicates, problems: problems.slice(0, 200), problem_count: problems.length,
      new_sources: [...newSources], new_customers: [...newCustomers.values()].map((c) => c.name),
    };
    if (mode === 'check') return summary;

    // Customers first (each in its own step, through Contacts, so codes and duplicate rules apply).
    const customerIds = new Map<string, string>();
    for (const [key, c] of newCustomers) {
      const made = await this.contacts.create(ctx, {
        name: c.name, contact_type: 'company', is_customer: true, allow_duplicate: true, ...(c.tin ? { tin: c.tin } : {}), ...(c.phone ? { phone: c.phone } : {}),
      } as never);
      customerIds.set(key, (made as { id: string }).id);
    }
    const companyId = defaultRecordCompany(scope) ?? null;
    const created: string[] = [];
    await conn.transaction(async (m: Queryable) => {
      const sourceIds = await this.createSources(m, newSources, lookups.sources);
      for (const r of ready) {
        const v = r.v as Record<string, any>;
        const status = v.stage.is_won ? 'won' : v.stage.is_lost ? 'lost' : 'open';
        const [row] = await m.query(
          `INSERT INTO crm_opportunities (name, contact_id, pipeline_id, stage_id, stage_changed_at, owner_id, expected_revenue, probability,
                                          expected_close_date, status, closed_at, lost_reason_id, source_id, notes, company_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,now(),$5,$6,$7,$8,$9,${status === 'open' ? 'NULL' : 'now()'},$10,$11,$12,$13,$14,$14) RETURNING id`,
          [v.name, v.contact_id ?? (v.customer_key ? customerIds.get(v.customer_key) ?? null : null), v.pipeline_id, v.stage.id, v.owner_id, v.revenue,
            v.probability, v.close, status, v.lost_reason_id, v.source_id ?? (v.source_name ? sourceIds.get(String(v.source_name).toLowerCase()) ?? null : null),
            v.notes, companyId, ctx.user?.sub ?? null],
        );
        created.push(row.id);
      }
    });
    for (const id of created) await this.record(ctx, ENTITY.opportunity, id, 'created', `Deal imported from ${path.basename(file.filename)}`);
    return { ...summary, imported: created.length };
  }

  // ── helpers ──────────────────────────────────────────────────────────────────
  private async lookups(conn: Queryable, ownerEmails: string[]) {
    const sources = new Map<string, string>(
      (await conn.query(`SELECT id, name FROM crm_lead_sources WHERE is_active`)).map((s: { id: string; name: string }) => [s.name.toLowerCase(), s.id]),
    );
    const emails = [...new Set(ownerEmails.map((e) => e.toLowerCase()).filter(Boolean))];
    const users = new Map<string, string>(
      emails.length
        ? (await conn.query(`SELECT id, lower(email) AS email FROM users WHERE lower(email) = ANY($1::text[]) AND COALESCE(is_active, true)`, [emails]))
            .map((u: { id: string; email: string }) => [u.email, u.id])
        : [],
    );
    return { sources, users };
  }

  private async createSources(m: Queryable, names: Set<string>, known: Map<string, string>): Promise<Map<string, string>> {
    const out = new Map(known);
    for (const name of names) {
      if (out.has(name.toLowerCase())) continue;
      const [row] = await m.query(
        `INSERT INTO crm_lead_sources (name, sort_order) VALUES ($1, COALESCE((SELECT max(sort_order) + 1 FROM crm_lead_sources), 1))
         ON CONFLICT DO NOTHING RETURNING id`,
        [name.slice(0, 100)],
      );
      const id = row?.id ?? (await m.query(`SELECT id FROM crm_lead_sources WHERE lower(name) = lower($1)`, [name]))[0]?.id;
      if (id) out.set(name.toLowerCase(), id);
    }
    return out;
  }

  /** Emails and phone keys of active leads, to skip duplicates. */
  private async existingLeadKeys(conn: Queryable): Promise<Set<string>> {
    const rows: { email: string | null; phone: string | null; mobile: string | null }[] =
      await conn.query(`SELECT lower(email) AS email, phone, mobile FROM crm_leads WHERE is_active`);
    const keys = new Set<string>();
    for (const r of rows) {
      if (r.email) keys.add(`e:${r.email}`);
      for (const p of [phoneKey(r.phone), phoneKey(r.mobile)]) if (p) keys.add(`p:${p}`);
    }
    return keys;
  }

  /** Customers the person can see, found by TIN, then phone, then exact name. */
  private async customerIndex(conn: Queryable, scope: Parameters<typeof isVisible>[0]) {
    const rows: { id: string; name: string; tin: string | null; phone: string | null; mobile: string | null; company_id: string | null; branch_id?: string | null }[] =
      await conn.query(`SELECT id, name, tin, phone, mobile, company_id, branch_id FROM contacts WHERE is_active AND parent_id IS NULL`);
    const visible = rows.filter((r) => isVisible(scope, r.company_id, r.branch_id));
    const byTin = new Map<string, string>();
    const byPhone = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const r of visible) {
      if (r.tin) byTin.set(r.tin.replace(/\s/g, ''), r.id);
      for (const p of [phoneKey(r.phone), phoneKey(r.mobile)]) if (p) byPhone.set(p, r.id);
      byName.set(r.name.trim().toLowerCase(), r.id);
    }
    return {
      find: (name: string, tin: string, phone: string): { id: string } | null => {
        const id = (tin && byTin.get(tin)) || (phoneKey(phone) && byPhone.get(phoneKey(phone)!)) || (name && byName.get(name.trim().toLowerCase())) || null;
        return id ? { id } : null;
      },
    };
  }
}

