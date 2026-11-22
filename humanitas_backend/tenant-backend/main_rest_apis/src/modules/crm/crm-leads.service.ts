import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../products/products.service';
import { csvCell } from '../products/products.service';
import { assertCompanyAssignable, companyFilter, defaultRecordCompany, isVisible, type CompanyScope, type Queryable, defaultRecordBranch, assertBranchAssignable } from '../products/products.scope';
import { cleanTags } from '../contacts/contacts.rules';
import { ContactsService } from '../contacts/contacts.service';
import { CrmBase, ENTITY, blankToNull, ownSql, ownsCrmRow, setClause } from './crm.base';
import { leadStatusProblem, type LeadStatus } from './crm.rules';
import { CrmOpportunitiesService } from './crm-opportunities.service';
import type { ConvertLeadDto, CreateLeadDto, ListLeadsQueryDto, LoseDto, UpdateLeadDto } from './dto/crm.dto';

const LEAD_SQL = `
  SELECT l.*, src.name AS source_name, u.full_name AS owner_name, lr.name AS lost_reason_name,
         c.name AS converted_contact_name, o.name AS converted_opportunity_name,
         (SELECT min(a.due_at) FROM crm_activities a WHERE a.related_type = 'lead' AND a.related_id = l.id AND a.is_active AND a.done_at IS NULL) AS next_activity_at
    FROM crm_leads l
    LEFT JOIN crm_lead_sources src ON src.id = l.source_id
    LEFT JOIN users u ON u.id = l.owner_id
    LEFT JOIN crm_lost_reasons lr ON lr.id = l.lost_reason_id
    LEFT JOIN contacts c ON c.id = l.converted_contact_id
    LEFT JOIN crm_opportunities o ON o.id = l.converted_opportunity_id`;

export const LEAD_TRACKED_FIELDS: Record<string, string> = {
  title: 'Title', person_name: 'Person', company_name: 'Company', job_title: 'Job title', email: 'Email', phone: 'Phone', mobile: 'Mobile',
  city: 'City', source_name: 'Source', owner_name: 'Owner', status: 'Status', need: 'Need', budget: 'Budget', timeline: 'Timeline',
  decision_maker: 'Decision maker', expected_revenue: 'Expected revenue', tags: 'Tags', notes: 'Notes',
};

const COLUMNS = ['title', 'person_name', 'company_name', 'job_title', 'email', 'phone', 'mobile', 'city', 'source_id', 'owner_id', 'status',
  'need', 'budget', 'timeline', 'decision_maker', 'expected_revenue', 'tags', 'notes', 'company_id', 'branch_id'] as const;

type Lead = Record<string, unknown> & {
  id: string; code: string; title: string; status: LeadStatus; company_id: string | null; person_name: string | null; company_name: string | null;
  email: string | null; phone: string | null; mobile: string | null; owner_id: string | null; source_id: string | null; expected_revenue: string | null;
};

/** Leads: capture, assign, qualify, track and convert into a contact and an opportunity (CRM 1.1). */
@Injectable()
export class CrmLeadsService extends CrmBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
    private readonly opportunities: CrmOpportunitiesService,
    private readonly contacts: ContactsService,
  ) {
    super();
  }

  async list(ctx: CatalogContext, q: ListLeadsQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(ctx, scope, q);
    const limit = Math.min(q.limit ?? 40, 200);
    const page = q.page ?? 1;
    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await conn.query(`SELECT count(*)::int AS total FROM crm_leads l ${w}`, params);
    const data = await conn.query(`${LEAD_SQL} ${w} ORDER BY l.created_at DESC, l.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]);
    const [counts] = await conn.query(
      `SELECT count(*) FILTER (WHERE status = 'new')::int AS new, count(*) FILTER (WHERE status = 'contacted')::int AS contacted,
              count(*) FILTER (WHERE status = 'qualified')::int AS qualified, count(*) FILTER (WHERE status = 'converted')::int AS converted,
              count(*) FILTER (WHERE status = 'lost')::int AS lost
         FROM crm_leads l WHERE ${this.filters(ctx, scope, { ...q, status: undefined }).where.join(' AND ')}`,
      this.filters(ctx, scope, { ...q, status: undefined }).params,
    );
    return { data, meta: { page, limit, total }, counts };
  }

  async get(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    return this.findVisible(conn, scope, id);
  }

  async create(ctx: CatalogContext, dto: CreateLeadDto) {
    const { conn, scope } = await this.open(ctx);
    const companyId = dto.company_id !== undefined ? dto.company_id : defaultRecordCompany(scope);
    assertCompanyAssignable(scope, companyId);
    const branchId = dto.branch_id !== undefined ? dto.branch_id : defaultRecordBranch(scope);
    assertBranchAssignable(scope, branchId);
    // No branch picked: the database puts the lead in its creator's branch.
    const row = this.clean({ ...dto, owner_id: dto.owner_id === undefined ? ctx.user?.sub ?? null : dto.owner_id, company_id: companyId ?? null, ...(branchId ? { branch_id: branchId } : {}) });
    await this.checkLinks(conn, row);
    const cols = COLUMNS.filter((c) => row[c] !== undefined);
    const [created] = await conn
      .query(`INSERT INTO crm_leads (${cols.join(', ')}, created_by, updated_by) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, $${cols.length + 1}) RETURNING id`,
        [...cols.map((c) => row[c]), ctx.user?.sub ?? null])
      .catch((e: unknown) => this.rethrow(e));
    await this.record(ctx, ENTITY.lead, created.id, 'created', `Lead "${row.title}" created`);
    return this.get(ctx, created.id);
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateLeadDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible(conn, scope, id);
    if (before.status === 'converted') throw new BadRequestException('This lead is converted; work on its opportunity instead');
    if (dto.company_id !== undefined) assertCompanyAssignable(scope, dto.company_id);
    assertBranchAssignable(scope, dto.branch_id);
    if (dto.status && dto.status !== before.status) {
      const problem = leadStatusProblem(before.status, dto.status);
      if (problem) throw new BadRequestException(problem);
    }
    const row = this.clean(dto);
    await this.checkLinks(conn, row);
    const set = setClause(row, COLUMNS);
    if (!set.present.length) return before;
    const statusChanged = dto.status && dto.status !== before.status;
    await conn
      .query(`UPDATE crm_leads SET ${set.sql}${statusChanged ? ', status_changed_at = now(), lost_reason_id = NULL, lost_note = NULL' : ''},
              updated_by = $${set.params.length + 1}, updated_at = now() WHERE id = $${set.params.length + 2}`, [...set.params, ctx.user?.sub ?? null, id])
      .catch((e: unknown) => this.rethrow(e));
    const after = await this.findVisible(conn, scope, id);
    await this.timeline.recordChanges(ctx.tenantId, {
      entityType: ENTITY.lead, entityId: id, moduleKey: 'crm', before, after, fields: LEAD_TRACKED_FIELDS, actorId: ctx.user?.sub, client: ctx.client,
    });
    return after;
  }

  async markLost(ctx: CatalogContext, id: string, dto: LoseDto) {
    const { conn, scope } = await this.open(ctx);
    const lead = await this.findVisible(conn, scope, id);
    if (lead.status === 'converted') throw new BadRequestException('This lead is converted; mark its opportunity as lost instead');
    await this.checkListItem(conn, 'crm_lost_reasons', dto.lost_reason_id, 'lost reason');
    await conn.query(
      `UPDATE crm_leads SET status = 'lost', status_changed_at = now(), lost_reason_id = $1, lost_note = $2, updated_by = $3, updated_at = now() WHERE id = $4`,
      [dto.lost_reason_id, blankToNull(dto.note) ?? null, ctx.user?.sub ?? null, id],
    );
    const after = await this.findVisible(conn, scope, id);
    await this.record(ctx, ENTITY.lead, id, 'updated', `Lost: ${after.lost_reason_name}${dto.note?.trim() ? ` — ${dto.note.trim()}` : ''}`, { status: 'lost' });
    return after;
  }

  /**
   * Converts a lead: an existing contact, or a new one from the lead (a company with the person under it, or a person),
   * marked as a customer; then, unless told not to, an opportunity in the pipeline.
   */
  async convert(ctx: CatalogContext, id: string, dto: ConvertLeadDto) {
    const { conn, scope } = await this.open(ctx);
    const lead = await this.findVisible(conn, scope, id);
    if (lead.status === 'converted') throw new BadRequestException('This lead is already converted');
    let contactId: string;
    let personId: string | null = null;
    if (dto.contact_id) {
      const [c] = await conn.query(`SELECT id, contact_type, parent_id, company_id, branch_id, is_active FROM contacts WHERE id = $1`, [dto.contact_id]);
      if (!c || !isVisible(scope, c.company_id, c.branch_id) || !c.is_active) throw new BadRequestException('That contact was not found');
      contactId = c.contact_type === 'person' && c.parent_id ? c.parent_id : c.id;
      personId = c.contact_type === 'person' ? c.id : null;
      await conn.query(`UPDATE contacts SET is_customer = true, updated_at = now() WHERE id = $1 AND NOT is_customer`, [contactId]);
    } else {
      const contact = { phone: lead.phone, mobile: lead.mobile, email: lead.email, city: (lead.city as string | null) ?? null, company_id: lead.company_id, allow_duplicate: true };
      if (lead.company_name) {
        const company = await this.contacts.create(ctx, {
          ...contact, name: lead.company_name, contact_type: 'company', is_customer: true,
          people: lead.person_name ? [{ name: lead.person_name, job_title: (lead.job_title as string | null) ?? null, phone: lead.phone, mobile: lead.mobile, email: lead.email }] : [],
        });
        contactId = company.id;
        personId = (company.people as { id: string }[] | undefined)?.[0]?.id ?? null;
      } else {
        const person = await this.contacts.create(ctx, { ...contact, name: lead.person_name || lead.title, contact_type: 'person', is_customer: true });
        contactId = person.id;
      }
    }
    let opportunityId: string | null = null;
    if (dto.create_opportunity !== false) {
      const deal = await this.opportunities.create(ctx, {
        name: dto.opportunity_name?.trim() || lead.title, contact_id: contactId, person_id: personId, pipeline_id: dto.pipeline_id,
        expected_revenue: dto.expected_revenue ?? (lead.expected_revenue == null ? 0 : Number(lead.expected_revenue)),
        expected_close_date: dto.expected_close_date, owner_id: lead.owner_id, source_id: lead.source_id, lead_id: lead.id, company_id: lead.company_id,
        branch_id: (lead.branch_id as string | null | undefined) ?? undefined,
      });
      opportunityId = deal.id;
    }
    await conn.query(
      `UPDATE crm_leads SET status = 'converted', status_changed_at = now(), converted_contact_id = $1, converted_opportunity_id = $2, converted_at = now(),
              updated_by = $3, updated_at = now() WHERE id = $4`,
      [contactId, opportunityId, ctx.user?.sub ?? null, id],
    );
    // Open activities move to the opportunity (or the contact).
    await conn.query(
      `UPDATE crm_activities SET related_type = $1, related_id = $2, updated_at = now() WHERE related_type = 'lead' AND related_id = $3 AND done_at IS NULL AND is_active`,
      [opportunityId ? 'opportunity' : 'contact', opportunityId ?? contactId, id],
    );
    const after = await this.findVisible(conn, scope, id);
    await this.record(ctx, ENTITY.lead, id, 'updated', `Converted to ${after.converted_contact_name}${opportunityId ? ` and the deal "${after.converted_opportunity_name}"` : ''}`,
      { status: 'converted', contact_id: contactId, opportunity_id: opportunityId });
    await this.record(ctx, ENTITY.contact, contactId, 'updated', `From lead ${lead.code} "${lead.title}"`);
    return after;
  }

  archive(ctx: CatalogContext, id: string) {
    return this.setActive(ctx, id, false);
  }

  restore(ctx: CatalogContext, id: string) {
    return this.setActive(ctx, id, true);
  }

  async timelineFor(ctx: CatalogContext, id: string, opts: { limit?: number; before?: string }) {
    const { conn, scope } = await this.open(ctx);
    await this.findVisible(conn, scope, id);
    return this.timeline.list(ctx.tenantId, ENTITY.lead, id, opts);
  }

  async exportCsv(ctx: CatalogContext, q: ListLeadsQueryDto): Promise<string> {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(ctx, scope, q);
    const rows = await conn.query(`${LEAD_SQL} WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT 50000`, params);
    const cols = ['code', 'title', 'status', 'person_name', 'company_name', 'job_title', 'phone', 'mobile', 'email', 'city', 'source_name', 'owner_name',
      'need', 'budget', 'timeline', 'decision_maker', 'expected_revenue', 'lost_reason_name', 'converted_contact_name', 'created_at', 'converted_at'];
    const lines = [cols.join(',')];
    for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(','));
    return lines.join('\r\n');
  }

  // ── helpers ────────────────────────────────────────────────────────────────────
  private clean(dto: Partial<CreateLeadDto> & { owner_id?: string | null; company_id?: string | null; branch_id?: string | null }) {
    const out: Record<string, unknown> = {};
    for (const c of COLUMNS) {
      const v = (dto as Record<string, unknown>)[c];
      if (v === undefined) continue;
      out[c] = c === 'tags' ? cleanTags(v as string[]) : blankToNull(v);
    }
    if (out.title !== undefined && !out.title) throw new BadRequestException('A lead needs a title');
    if (out.email) out.email = String(out.email).toLowerCase();
    return out;
  }

  private async checkLinks(conn: Queryable, row: Record<string, unknown>) {
    await this.checkUser(conn, row.owner_id as string | null, 'owner');
    await this.checkListItem(conn, 'crm_lead_sources', row.source_id as string | null, 'lead source');
  }

  private async setActive(ctx: CatalogContext, id: string, active: boolean) {
    const { conn, scope } = await this.open(ctx);
    const lead = await this.findVisible(conn, scope, id);
    if (Boolean(lead.is_active) === active) return lead;
    await conn.query(`UPDATE crm_leads SET is_active = $1, updated_by = $2, updated_at = now() WHERE id = $3`, [active, ctx.user?.sub ?? null, id]);
    await this.record(ctx, ENTITY.lead, id, active ? 'restored' : 'deleted', `Lead "${lead.title}" ${active ? 'restored' : 'archived'}`);
    return this.get(ctx, id);
  }

  private filters(ctx: CatalogContext, scope: CompanyScope, q: Partial<ListLeadsQueryDto>) {
    const where: string[] = [q.archived === 'archived' ? 'NOT l.is_active' : 'l.is_active'];
    const params: unknown[] = [];
    if (q.q?.trim()) {
      const term = q.q.trim().toLowerCase();
      params.push(`%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
      const like = `$${params.length}`;
      const digits = term.replace(/\D/g, '');
      const phone = digits.length >= 6
        ? ` OR regexp_replace(COALESCE(l.phone, '') || ' ' || COALESCE(l.mobile, ''), '\\D', '', 'g') LIKE '%' || $${params.push(digits.slice(-9))} || '%'`
        : '';
      where.push(`(lower(l.title) LIKE ${like} OR lower(l.code) LIKE ${like} OR lower(COALESCE(l.person_name, '')) LIKE ${like}
        OR lower(COALESCE(l.company_name, '')) LIKE ${like} OR lower(COALESCE(l.email, '')) LIKE ${like}${phone})`);
    }
    if (q.status === 'open') where.push(`l.status IN ('new', 'contacted', 'qualified')`);
    else if (q.status) where.push(`l.status = $${params.push(q.status)}`);
    const owner = this.userParam(ctx, q.owner_id);
    if (owner) where.push(`l.owner_id = $${params.push(owner)}`);
    if (q.source_id) where.push(`l.source_id = $${params.push(q.source_id)}`);
    const own = ownSql(scope, 'l', params);
    if (own) where.push(own);
    const f = companyFilter(scope, 'l', params.length + 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    return { where, params };
  }

  private async findVisible(conn: Queryable, scope: CompanyScope, id: string): Promise<Lead> {
    const [row] = await conn.query(`${LEAD_SQL} WHERE l.id = $1`, [id]);
    if (!row || !isVisible(scope, row.company_id, row.branch_id) || !ownsCrmRow(scope as { mine?: string | null }, row)) throw new NotFoundException('Lead not found');
    return row;
  }
}
