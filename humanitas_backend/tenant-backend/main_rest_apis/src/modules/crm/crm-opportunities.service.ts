import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../products/products.service';
import { csvCell } from '../products/products.service';
import { assertCompanyAssignable, companyFilter, defaultRecordCompany, isVisible, type CompanyScope, type Queryable, defaultRecordBranch, assertBranchAssignable, setRecordBranch } from '../products/products.scope';
import { cleanTags } from '../contacts/contacts.rules';
import { CrmBase, ENTITY, blankToNull, ownSql, ownsCrmRow, setClause } from './crm.base';
import { dealProbability, forecastByMonth, stuck, weighted } from './crm.rules';
import { CrmSetupService, type StageRow } from './crm-setup.service';
import type {
  BoardQueryDto, CreateOpportunityDto, ForecastQueryDto, ListOpportunitiesQueryDto, LoseDto, UpdateOpportunityDto,
} from './dto/crm.dto';

const DEAL_SQL = `
  SELECT o.*, s.name AS stage_name, s.probability AS stage_probability, s.rotting_days, s.is_won AS stage_is_won, s.is_lost AS stage_is_lost,
         p.name AS pipeline_name, c.name AS contact_name, pc.name AS person_name, u.full_name AS owner_name,
         src.name AS source_name, lr.name AS lost_reason_name, ld.code AS lead_code, ld.title AS lead_title,
         (SELECT min(a.due_at) FROM crm_activities a WHERE a.related_type = 'opportunity' AND a.related_id = o.id AND a.is_active AND a.done_at IS NULL) AS next_activity_at
    FROM crm_opportunities o
    JOIN crm_stages s ON s.id = o.stage_id
    JOIN crm_pipelines p ON p.id = o.pipeline_id
    LEFT JOIN contacts c ON c.id = o.contact_id
    LEFT JOIN contacts pc ON pc.id = o.person_id
    LEFT JOIN users u ON u.id = o.owner_id
    LEFT JOIN crm_lead_sources src ON src.id = o.source_id
    LEFT JOIN crm_lost_reasons lr ON lr.id = o.lost_reason_id
    LEFT JOIN crm_leads ld ON ld.id = o.lead_id`;

export const DEAL_TRACKED_FIELDS: Record<string, string> = {
  name: 'Name', contact_name: 'Customer', person_name: 'Contact person', pipeline_name: 'Pipeline', stage_name: 'Stage',
  owner_name: 'Owner', expected_revenue: 'Expected revenue', currency: 'Currency', probability: 'Probability',
  expected_close_date: 'Expected close', source_name: 'Source', tags: 'Tags', notes: 'Notes', status: 'Status',
};

type Deal = Record<string, unknown> & {
  id: string; name: string; status: 'open' | 'won' | 'lost'; stage_id: string; pipeline_id: string; company_id: string | null;
  probability: number | null; stage_probability: number; expected_revenue: string; stage_changed_at: string; rotting_days: number | null;
};

/** Opportunities (deals) on pipelines: board, stage moves, won/lost and the weighted forecast (CRM 1.2, 1.4). */
@Injectable()
export class CrmOpportunitiesService extends CrmBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
    private readonly setup: CrmSetupService,
  ) {
    super();
  }

  /** Adds the deal's probability, weighted revenue and how long it has been in its stage. */
  static decorate<T extends Deal>(d: T, now = new Date()) {
    const probability = d.status === 'won' ? 100 : d.status === 'lost' ? 0 : dealProbability(d, { probability: d.stage_probability });
    const s = stuck(d.stage_changed_at, d.status === 'open' ? d.rotting_days : null, now);
    return { ...d, effective_probability: probability, weighted_revenue: weighted(d.expected_revenue, probability), days_in_stage: s.days, is_stuck: s.stuck };
  }

  async list(ctx: CatalogContext, q: ListOpportunitiesQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(ctx, scope, q);
    const limit = Math.min(q.limit ?? 40, 200);
    const page = q.page ?? 1;
    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await conn.query(
      `SELECT count(*)::int AS total FROM crm_opportunities o JOIN crm_stages s ON s.id = o.stage_id ${w}`, params,
    );
    const rows: Deal[] = await conn.query(
      `${DEAL_SQL} ${w} ORDER BY o.expected_close_date NULLS LAST, o.created_at DESC, o.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return { data: rows.map((d) => CrmOpportunitiesService.decorate(d)), meta: { page, limit, total } };
  }

  /** The Kanban board of one pipeline: open stages with their open deals, won and lost stages with the last 30 days. */
  async board(ctx: CatalogContext, q: BoardQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const pipeline = await this.setup.resolvePipeline(conn, scope, q.pipeline_id);
    const stages = await this.setup.stagesOf(conn, pipeline.id);
    const { where, params } = this.filters(ctx, scope, { q: q.q, owner_id: q.owner_id });
    params.push(pipeline.id);
    where.push(`o.pipeline_id = $${params.length}`);
    where.push(`(o.status = 'open' OR o.closed_at > now() - interval '30 days')`);
    const deals: Deal[] = await conn.query(`${DEAL_SQL} WHERE ${where.join(' AND ')} ORDER BY o.stage_changed_at DESC LIMIT 2000`, params);
    const decorated = deals.map((d) => CrmOpportunitiesService.decorate(d));
    return {
      pipeline,
      stages: stages.map((s) => {
        const mine = decorated.filter((d) => d.stage_id === s.id);
        return {
          ...s,
          count: mine.length,
          revenue: Math.round(mine.reduce((sum, d) => sum + Number(d.expected_revenue), 0) * 100) / 100,
          weighted: Math.round(mine.reduce((sum, d) => sum + d.weighted_revenue, 0) * 100) / 100,
          deals: mine.slice(0, 100),
        };
      }),
    };
  }

  async get(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    return CrmOpportunitiesService.decorate(await this.findVisible(conn, scope, id));
  }

  async create(ctx: CatalogContext, dto: CreateOpportunityDto & { lead_id?: string }) {
    const { conn, scope } = await this.open(ctx);
    const pipeline = await this.setup.resolvePipeline(conn, scope, dto.pipeline_id);
    const stages = await this.setup.stagesOf(conn, pipeline.id);
    const stage = dto.stage_id ? stages.find((s) => s.id === dto.stage_id) : stages.find((s) => !s.is_won && !s.is_lost);
    if (!stage) throw new BadRequestException(dto.stage_id ? 'That stage is not in this pipeline' : 'This pipeline has no open stage');
    if (stage.is_lost) throw new BadRequestException('Create the deal in an open stage, then mark it as lost with the reason');
    const companyId = dto.company_id !== undefined ? dto.company_id : defaultRecordCompany(scope);
    assertCompanyAssignable(scope, companyId);
    const branchId = dto.branch_id !== undefined ? dto.branch_id : defaultRecordBranch(scope);
    assertBranchAssignable(scope, branchId);
    await this.checkContacts(conn, scope, dto.contact_id, dto.person_id);
    await this.checkUser(conn, dto.owner_id, 'owner');
    await this.checkListItem(conn, 'crm_lead_sources', dto.source_id, 'lead source');
    const [row] = await conn
      .query(
        `INSERT INTO crm_opportunities (name, contact_id, person_id, pipeline_id, stage_id, owner_id, expected_revenue, currency, probability,
                                        expected_close_date, status, closed_at, source_id, lead_id, tags, notes, company_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18) RETURNING id`,
        [dto.name.trim(), dto.contact_id ?? null, dto.person_id ?? null, pipeline.id, stage.id, dto.owner_id ?? ctx.user?.sub ?? null,
          dto.expected_revenue ?? 0, dto.currency ?? 'ETB', dto.probability ?? null, dto.expected_close_date?.slice(0, 10) ?? null,
          stage.is_won ? 'won' : 'open', stage.is_won ? new Date() : null, dto.source_id ?? null, dto.lead_id ?? null, cleanTags(dto.tags),
          blankToNull(dto.notes) ?? null, companyId ?? null, ctx.user?.sub ?? null],
      )
      .catch((e: unknown) => this.rethrow(e));
    // No branch picked: the database puts the deal in its creator's branch.
    if (branchId) await setRecordBranch(conn, 'crm_opportunities', row.id, branchId);
    await this.record(ctx, ENTITY.opportunity, row.id, 'created', `Deal "${dto.name.trim()}" created in ${stage.name}`);
    if (dto.contact_id) await this.record(ctx, ENTITY.contact, dto.contact_id, 'updated', `Deal "${dto.name.trim()}" created`);
    return this.get(ctx, row.id);
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateOpportunityDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible(conn, scope, id);
    if (dto.pipeline_id !== undefined || dto.stage_id !== undefined) {
      if (dto.pipeline_id && dto.pipeline_id !== before.pipeline_id) return this.movePipeline(ctx, id, dto);
      if (dto.stage_id && dto.stage_id !== before.stage_id) throw new BadRequestException('Move the deal with its stage buttons (or drag it on the board)');
    }
    if (dto.company_id !== undefined) assertCompanyAssignable(scope, dto.company_id);
    assertBranchAssignable(scope, dto.branch_id);
    await this.checkContacts(conn, scope, dto.contact_id !== undefined ? dto.contact_id : (before.contact_id as string | null), dto.person_id !== undefined ? dto.person_id : (before.person_id as string | null));
    await this.checkUser(conn, dto.owner_id, 'owner');
    await this.checkListItem(conn, 'crm_lead_sources', dto.source_id, 'lead source');
    const row: Record<string, unknown> = {
      ...dto, name: dto.name?.trim(), tags: dto.tags ? cleanTags(dto.tags) : undefined, notes: dto.notes === undefined ? undefined : blankToNull(dto.notes),
      expected_close_date: dto.expected_close_date === undefined ? undefined : dto.expected_close_date?.slice(0, 10) ?? null,
    };
    const set = setClause(row, ['name', 'contact_id', 'person_id', 'owner_id', 'expected_revenue', 'currency', 'probability', 'expected_close_date', 'source_id', 'tags', 'notes', 'company_id', 'branch_id']);
    if (!set.present.length) return this.get(ctx, id);
    await conn
      .query(`UPDATE crm_opportunities SET ${set.sql}, updated_by = $${set.params.length + 1}, updated_at = now() WHERE id = $${set.params.length + 2}`,
        [...set.params, ctx.user?.sub ?? null, id])
      .catch((e: unknown) => this.rethrow(e));
    const after = await this.findVisible(conn, scope, id);
    await this.timeline.recordChanges(ctx.tenantId, {
      entityType: ENTITY.opportunity, entityId: id, moduleKey: 'crm', before, after, fields: DEAL_TRACKED_FIELDS, actorId: ctx.user?.sub, client: ctx.client,
    });
    return CrmOpportunitiesService.decorate(after);
  }

  /** Moves a deal to another stage of its pipeline. A won stage wins it; a lost stage needs Mark as lost. */
  async moveStage(ctx: CatalogContext, id: string, stageId: string) {
    const { conn, scope } = await this.open(ctx);
    const deal = await this.findVisible(conn, scope, id);
    const stages = await this.setup.stagesOf(conn, deal.pipeline_id);
    const to = stages.find((s) => s.id === stageId);
    if (!to) throw new BadRequestException('That stage is not in this deal\'s pipeline');
    if (to.is_lost) throw new BadRequestException('Use Mark as lost and give the reason');
    if (to.id === deal.stage_id && deal.status === (to.is_won ? 'won' : 'open')) return CrmOpportunitiesService.decorate(deal);
    return this.setStage(ctx, conn, scope, deal, to, to.is_won ? 'won' : 'open');
  }

  async markWon(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const deal = await this.findVisible(conn, scope, id);
    const won = (await this.setup.stagesOf(conn, deal.pipeline_id)).find((s) => s.is_won);
    if (!won) throw new BadRequestException('This pipeline has no won stage (CRM -> Set-up)');
    return this.setStage(ctx, conn, scope, deal, won, 'won');
  }

  async markLost(ctx: CatalogContext, id: string, dto: LoseDto) {
    const { conn, scope } = await this.open(ctx);
    const deal = await this.findVisible(conn, scope, id);
    await this.checkListItem(conn, 'crm_lost_reasons', dto.lost_reason_id, 'lost reason');
    const lost = (await this.setup.stagesOf(conn, deal.pipeline_id)).find((s) => s.is_lost);
    if (!lost) throw new BadRequestException('This pipeline has no lost stage (CRM -> Set-up)');
    return this.setStage(ctx, conn, scope, deal, lost, 'lost', dto);
  }

  /** Opens a won or lost deal again, in the first open stage. */
  async reopen(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const deal = await this.findVisible(conn, scope, id);
    if (deal.status === 'open') return CrmOpportunitiesService.decorate(deal);
    const first = (await this.setup.stagesOf(conn, deal.pipeline_id)).find((s) => !s.is_won && !s.is_lost);
    if (!first) throw new BadRequestException('This pipeline has no open stage');
    return this.setStage(ctx, conn, scope, deal, first, 'open');
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
    return this.timeline.list(ctx.tenantId, ENTITY.opportunity, id, opts);
  }

  /** Weighted forecast of open deals by expected close month, plus won this month and the pipeline totals. */
  async forecast(ctx: CatalogContext, q: ForecastQueryDto) {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(ctx, scope, { owner_id: q.owner_id, pipeline_id: q.pipeline_id, status: 'open' });
    const open: Deal[] = await conn.query(`${DEAL_SQL} WHERE ${where.join(' AND ')} LIMIT 20000`, params);
    const decorated = open.map((d) => CrmOpportunitiesService.decorate(d));
    const won = this.filters(ctx, scope, { owner_id: q.owner_id, pipeline_id: q.pipeline_id, status: 'won' });
    const [wonMonth] = await conn.query(
      `SELECT count(*)::int AS count, COALESCE(sum(o.expected_revenue), 0)::float AS revenue FROM crm_opportunities o JOIN crm_stages s ON s.id = o.stage_id
        WHERE ${won.where.join(' AND ')} AND o.closed_at >= date_trunc('month', now())`, won.params,
    );
    return {
      months: forecastByMonth(decorated.map((d) => ({ expected_close_date: (d.expected_close_date as string | null) ?? null, expected_revenue: d.expected_revenue, probability: d.effective_probability }))),
      open_count: decorated.length,
      open_revenue: Math.round(decorated.reduce((s, d) => s + Number(d.expected_revenue), 0) * 100) / 100,
      open_weighted: Math.round(decorated.reduce((s, d) => s + d.weighted_revenue, 0) * 100) / 100,
      overdue_count: decorated.filter((d) => d.expected_close_date && String(d.expected_close_date).slice(0, 10) < new Date().toISOString().slice(0, 10)).length,
      stuck_count: decorated.filter((d) => d.is_stuck).length,
      won_this_month: wonMonth ?? { count: 0, revenue: 0 },
    };
  }

  async exportCsv(ctx: CatalogContext, q: ListOpportunitiesQueryDto): Promise<string> {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(ctx, scope, q);
    const rows: Deal[] = await conn.query(`${DEAL_SQL} WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT 50000`, params);
    const cols = ['code', 'name', 'contact_name', 'person_name', 'pipeline_name', 'stage_name', 'status', 'owner_name', 'expected_revenue', 'currency',
      'effective_probability', 'weighted_revenue', 'expected_close_date', 'source_name', 'lost_reason_name', 'days_in_stage', 'created_at', 'closed_at'];
    const lines = [cols.join(',')];
    for (const r of rows.map((d) => CrmOpportunitiesService.decorate(d)) as Record<string, unknown>[]) lines.push(cols.map((c) => csvCell(r[c])).join(','));
    return lines.join('\r\n');
  }

  // ── helpers ────────────────────────────────────────────────────────────────────
  private async setStage(ctx: CatalogContext, conn: Queryable, scope: CompanyScope, deal: Deal, to: StageRow, status: 'open' | 'won' | 'lost', lost?: LoseDto) {
    await conn.query(
      // $2 is only the status column: PostgreSQL refuses one parameter used as varchar and as text
      // ("inconsistent types deduced for parameter"), which made every stage move a server error.
      `UPDATE crm_opportunities SET stage_id = $1, stage_changed_at = now(), status = $2,
              closed_at = CASE WHEN $7 THEN NULL ELSE now() END,
              lost_reason_id = $3, lost_note = $4, updated_by = $5, updated_at = now()
        WHERE id = $6`,
      [to.id, status, status === 'lost' ? lost!.lost_reason_id : null, status === 'lost' ? blankToNull(lost?.note) ?? null : null, ctx.user?.sub ?? null, deal.id, status === 'open'],
    );
    const from = String(deal.stage_name ?? '');
    const days = CrmOpportunitiesService.decorate(deal).days_in_stage;
    const what = status === 'won' ? 'Won' : status === 'lost' ? 'Lost' : deal.status !== 'open' ? `Reopened in ${to.name}` : `${from} → ${to.name}`;
    await this.record(ctx, ENTITY.opportunity, deal.id, 'stage_changed', `${what} (after ${days} day${days === 1 ? '' : 's'} in ${from})`,
      { from_stage_id: deal.stage_id, to_stage_id: to.id, days_in_stage: days, status, lost_reason_id: lost?.lost_reason_id ?? null });
    if (deal.contact_id && status !== 'open') await this.record(ctx, ENTITY.contact, String(deal.contact_id), 'updated', `Deal "${deal.name}" ${status}`);
    return CrmOpportunitiesService.decorate(await this.findVisible(conn, scope, deal.id));
  }

  private async movePipeline(ctx: CatalogContext, id: string, dto: UpdateOpportunityDto) {
    const { conn, scope } = await this.open(ctx);
    const deal = await this.findVisible(conn, scope, id);
    if (deal.status !== 'open') throw new BadRequestException('Reopen the deal before moving it to another pipeline');
    const pipeline = await this.setup.resolvePipeline(conn, scope, dto.pipeline_id);
    const stages = await this.setup.stagesOf(conn, pipeline.id);
    const stage = dto.stage_id ? stages.find((s) => s.id === dto.stage_id) : stages.find((s) => !s.is_won && !s.is_lost);
    if (!stage || stage.is_won || stage.is_lost) throw new BadRequestException('Choose an open stage of the new pipeline');
    await conn.query(`UPDATE crm_opportunities SET pipeline_id = $1, stage_id = $2, stage_changed_at = now(), updated_by = $3, updated_at = now() WHERE id = $4`,
      [pipeline.id, stage.id, ctx.user?.sub ?? null, id]);
    await this.record(ctx, ENTITY.opportunity, id, 'stage_changed', `Moved to the ${pipeline.name} pipeline (${stage.name})`, { to_stage_id: stage.id });
    const { pipeline_id: _p, stage_id: _s, ...rest } = dto;
    void _p;
    void _s;
    return Object.keys(rest).length ? this.update(ctx, id, rest) : this.get(ctx, id);
  }

  private async setActive(ctx: CatalogContext, id: string, active: boolean) {
    const { conn, scope } = await this.open(ctx);
    const deal = await this.findVisible(conn, scope, id);
    if (Boolean(deal.is_active) === active) return CrmOpportunitiesService.decorate(deal);
    await conn.query(`UPDATE crm_opportunities SET is_active = $1, updated_by = $2, updated_at = now() WHERE id = $3`, [active, ctx.user?.sub ?? null, id]);
    await this.record(ctx, ENTITY.opportunity, id, active ? 'restored' : 'deleted', `Deal "${deal.name}" ${active ? 'restored' : 'archived'}`);
    return this.get(ctx, id);
  }

  private async checkContacts(conn: Queryable, scope: CompanyScope, contactId?: string | null, personId?: string | null) {
    if (contactId) {
      const [c] = await conn.query(`SELECT id, company_id, branch_id, is_active FROM contacts WHERE id = $1`, [contactId]);
      if (!c || !isVisible(scope, c.company_id, c.branch_id) || !c.is_active) throw new BadRequestException('That customer was not found');
    }
    if (personId) {
      const [p] = await conn.query(`SELECT id, parent_id, company_id, branch_id, is_active FROM contacts WHERE id = $1 AND contact_type = 'person'`, [personId]);
      if (!p || !isVisible(scope, p.company_id, p.branch_id) || !p.is_active) throw new BadRequestException('That contact person was not found');
      if (contactId && p.parent_id !== contactId && p.id !== contactId) throw new BadRequestException('That person does not work at this customer');
    }
  }

  private filters(ctx: CatalogContext, scope: CompanyScope, q: Partial<ListOpportunitiesQueryDto>) {
    const where: string[] = [q.archived === 'archived' ? 'NOT o.is_active' : 'o.is_active'];
    const params: unknown[] = [];
    if (q.q?.trim()) {
      params.push(`%${q.q.trim().toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
      const like = `$${params.length}`;
      where.push(`(lower(o.name) LIKE ${like} OR lower(o.code) LIKE ${like} OR EXISTS (SELECT 1 FROM contacts c2 WHERE c2.id IN (o.contact_id, o.person_id) AND lower(c2.name) LIKE ${like}))`);
    }
    if (q.pipeline_id) where.push(`o.pipeline_id = $${params.push(q.pipeline_id)}`);
    if (q.stage_id) where.push(`o.stage_id = $${params.push(q.stage_id)}`);
    if (q.status) where.push(`o.status = $${params.push(q.status)}`);
    const owner = this.userParam(ctx, q.owner_id);
    if (owner) where.push(`o.owner_id = $${params.push(owner)}`);
    if (q.contact_id) where.push(`(o.contact_id = $${params.push(q.contact_id)} OR o.person_id = $${params.length})`);
    if (q.attention === 'overdue') where.push(`o.status = 'open' AND o.expected_close_date < CURRENT_DATE`);
    if (q.attention === 'no_activity') {
      where.push(`o.status = 'open' AND NOT EXISTS (SELECT 1 FROM crm_activities a WHERE a.related_type = 'opportunity' AND a.related_id = o.id AND a.is_active AND a.done_at IS NULL)`);
    }
    if (q.attention === 'stuck') where.push(`o.status = 'open' AND s.rotting_days IS NOT NULL AND o.stage_changed_at < now() - make_interval(days => s.rotting_days)`);
    const own = ownSql(scope, 'o', params);
    if (own) where.push(own);
    const f = companyFilter(scope, 'o', params.length + 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    return { where, params };
  }

  private async findVisible(conn: Queryable, scope: CompanyScope, id: string): Promise<Deal> {
    const [row] = await conn.query(`${DEAL_SQL} WHERE o.id = $1`, [id]);
    if (!row || !isVisible(scope, row.company_id, row.branch_id) || !ownsCrmRow(scope as { mine?: string | null }, row)) throw new NotFoundException('Opportunity not found');
    return row;
  }
}
