import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../products/products.service';
import { companyFilter, defaultRecordCompany, isVisible, type CompanyScope, type Queryable, defaultRecordBranch, setRecordBranch } from '../products/products.scope';
import { CrmBase, ENTITY, blankToNull, ownsCrmRow, setClause, type CrmScope } from './crm.base';
import type { CompleteActivityDto, CreateActivityDto, ListActivitiesQueryDto, UpdateActivityDto } from './dto/crm.dto';

const ACTIVITY_SQL = `
  SELECT a.*, u.full_name AS assigned_to_name,
         l.owner_id AS lead_owner_id, l.created_by AS lead_created_by, o.owner_id AS deal_owner_id, o.created_by AS deal_created_by,
         CASE a.related_type WHEN 'lead' THEN l.title WHEN 'opportunity' THEN o.name WHEN 'contact' THEN c.name END AS related_name
    FROM crm_activities a
    LEFT JOIN users u ON u.id = a.assigned_to
    LEFT JOIN crm_leads l ON a.related_type = 'lead' AND l.id = a.related_id
    LEFT JOIN crm_opportunities o ON a.related_type = 'opportunity' AND o.id = a.related_id
    LEFT JOIN contacts c ON a.related_type = 'contact' AND c.id = a.related_id`;

const TYPE_LABEL: Record<string, string> = { call: 'Call', meeting: 'Meeting', email: 'Email', visit: 'Visit', todo: 'To-do' };
/** IANA zone names only (e.g. Africa/Addis_Ababa). */
const TZ = /^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){0,2}$/;

/** Planned calls, meetings, emails, visits and to-dos; My activities (CRM 1.5). */
@Injectable()
export class CrmActivitiesService extends CrmBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
  ) {
    super();
  }

  async list(ctx: CatalogContext, q: ListActivitiesQueryDto & { tz?: string }) {
    const { conn, scope } = await this.open(ctx);
    const { where, params } = this.filters(ctx, scope, q);
    const limit = Math.min(q.limit ?? 40, 200);
    const page = q.page ?? 1;
    const order = q.when === 'done' ? 'a.done_at DESC' : 'a.due_at ASC';
    const w = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await conn.query(`SELECT count(*)::int AS total FROM crm_activities a ${w}`, params);
    const data = await conn.query(`${ACTIVITY_SQL} ${w} ORDER BY ${order}, a.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]);
    return { data, meta: { page, limit, total } };
  }

  /** Counts for "My activities": overdue, today and upcoming (in the user's time zone). */
  async summary(ctx: CatalogContext, tz?: string) {
    const { conn, scope } = await this.open(ctx);
    const zone = tz && TZ.test(tz) ? tz : 'Africa/Addis_Ababa';
    const params: unknown[] = [ctx.user?.sub ?? null, zone];
    const f = companyFilter(scope, 'a', 3);
    if (f) params.push(f.param);
    const [row] = await conn.query(
      `SELECT count(*) FILTER (WHERE a.due_at < date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2)::int AS overdue,
              count(*) FILTER (WHERE a.due_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2
                                 AND a.due_at < (date_trunc('day', now() AT TIME ZONE $2) + interval '1 day') AT TIME ZONE $2)::int AS today,
              count(*) FILTER (WHERE a.due_at >= (date_trunc('day', now() AT TIME ZONE $2) + interval '1 day') AT TIME ZONE $2)::int AS upcoming
         FROM crm_activities a WHERE a.is_active AND a.done_at IS NULL AND a.assigned_to = $1 ${f ? `AND ${f.sql}` : ''}`,
      params,
    );
    return row ?? { overdue: 0, today: 0, upcoming: 0 };
  }

  async create(ctx: CatalogContext, dto: CreateActivityDto) {
    const { conn, scope } = await this.open(ctx);
    const assignee = dto.assigned_to ?? ctx.user?.sub;
    if (!assignee) throw new BadRequestException('Choose who does it');
    await this.checkUser(conn, assignee, 'person');
    const related = await this.checkRelated(conn, scope, dto.related_type ?? null, dto.related_id ?? null);
    const [row] = await conn.query(
      `INSERT INTO crm_activities (activity_type, subject, notes, due_at, duration_minutes, assigned_to, related_type, related_id, company_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id`,
      [dto.activity_type, dto.subject.trim(), blankToNull(dto.notes) ?? null, dto.due_at, dto.duration_minutes ?? null, assignee,
        dto.related_type ?? null, dto.related_id ?? null, related?.company_id ?? defaultRecordCompany(scope) ?? null, ctx.user?.sub ?? null],
    );
    // An activity sits in the branch of what it is about (else the picked branch, else its assignee's).
    const branchId = related ? related.branch_id : defaultRecordBranch(scope);
    if (branchId) await setRecordBranch(conn, 'crm_activities', row.id, branchId);
    if (related) {
      await this.record(ctx, ENTITY[related.type], related.id, 'activity', `${TYPE_LABEL[dto.activity_type]} planned: ${dto.subject.trim()}`,
        { activity_id: row.id, due_at: dto.due_at, assigned_to: assignee });
    }
    return this.get(ctx, row.id);
  }

  async get(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    return this.findVisible(conn, scope, id);
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateActivityDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible(conn, scope, id);
    if (before.done_at) throw new BadRequestException('This activity is done; plan a new one instead');
    if (dto.assigned_to) await this.checkUser(conn, dto.assigned_to, 'person');
    if (dto.related_type !== undefined || dto.related_id !== undefined) {
      await this.checkRelated(conn, scope, dto.related_type ?? null, dto.related_id ?? null);
    }
    const row = { ...dto, subject: dto.subject?.trim(), notes: dto.notes === undefined ? undefined : blankToNull(dto.notes) };
    const set = setClause(row, ['activity_type', 'subject', 'notes', 'due_at', 'duration_minutes', 'assigned_to', 'related_type', 'related_id']);
    if (!set.present.length) return before;
    await conn.query(`UPDATE crm_activities SET ${set.sql}, updated_by = $${set.params.length + 1}, updated_at = now() WHERE id = $${set.params.length + 2}`,
      [...set.params, ctx.user?.sub ?? null, id]);
    return this.get(ctx, id);
  }

  /** Marks it done; the outcome goes on the lead, deal or contact history as a logged interaction. */
  async complete(ctx: CatalogContext, id: string, dto: CompleteActivityDto) {
    const { conn, scope } = await this.open(ctx);
    const a = await this.findVisible(conn, scope, id);
    if (a.done_at) return a;
    await conn.query(`UPDATE crm_activities SET done_at = now(), done_by = $1, outcome = $2, updated_by = $1, updated_at = now() WHERE id = $3`,
      [ctx.user?.sub ?? null, blankToNull(dto.outcome) ?? null, id]);
    // A call, meeting, email or visit done counts as a contact with the lead or deal.
    if (a.activity_type !== 'todo' && (a.related_type === 'lead' || a.related_type === 'opportunity') && a.related_id) {
      await conn.query(
        `UPDATE ${a.related_type === 'lead' ? 'crm_leads' : 'crm_opportunities'}
            SET contact_count = contact_count + 1, last_contact_at = now(), last_contact_channel = $1 WHERE id = $2`,
        [a.activity_type, a.related_id],
      );
    }
    if (a.related_type && a.related_id) {
      const type = a.related_type as keyof typeof ENTITY;
      await this.record(ctx, ENTITY[type], a.related_id as string, a.activity_type === 'todo' ? 'activity' : 'interaction',
        `${TYPE_LABEL[a.activity_type as string]} done: ${a.subject}${dto.outcome?.trim() ? ` — ${dto.outcome.trim()}` : ''}`,
        { activity_id: id, kind: a.activity_type });
    }
    return this.get(ctx, id);
  }

  /** Delete = archive (rule 24). */
  async archive(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    const a = await this.findVisible(conn, scope, id);
    await conn.query(`UPDATE crm_activities SET is_active = false, updated_by = $1, updated_at = now() WHERE id = $2`, [ctx.user?.sub ?? null, id]);
    return { ...a, is_active: false };
  }

  // ── helpers ────────────────────────────────────────────────────────────────────
  /** Mine when assigned to me, created by me, or on a lead or deal of mine. */
  private ownsActivity(scope: CompanyScope, a: Record<string, unknown>): boolean {
    const mine = (scope as CrmScope).mine;
    if (!mine) return true;
    return a.assigned_to === mine || a.created_by === mine
      || (a.related_type === 'lead' && (a.lead_owner_id === mine || a.lead_created_by === mine))
      || (a.related_type === 'opportunity' && (a.deal_owner_id === mine || a.deal_created_by === mine));
  }

  private async checkRelated(conn: Queryable, scope: CompanyScope, type: 'lead' | 'opportunity' | 'contact' | null, id: string | null) {
    if (!type && !id) return null;
    if (!type || !id) throw new BadRequestException('Say what the activity is about (a lead, a deal or a contact) and which one');
    const table = { lead: 'crm_leads', opportunity: 'crm_opportunities', contact: 'contacts' }[type];
    const extra = type === 'contact' ? '' : ', owner_id, created_by';
    const [row] = await conn.query(`SELECT id, company_id, branch_id, is_active${extra} FROM ${table} WHERE id = $1`, [id]);
    const visible = row && isVisible(scope, row.company_id, row.branch_id) && (type === 'contact' || ownsCrmRow(scope as { mine?: string | null }, row));
    if (!visible || !row.is_active) throw new BadRequestException(`That ${type === 'opportunity' ? 'deal' : type} was not found`);
    return { type, id, company_id: row.company_id as string | null, branch_id: (row.branch_id as string | null) ?? null };
  }

  private filters(ctx: CatalogContext, scope: CompanyScope, q: ListActivitiesQueryDto & { tz?: string }) {
    const where: string[] = ['a.is_active'];
    const params: unknown[] = [];
    const who = q.assigned_to === 'all' ? null : this.userParam(ctx, q.assigned_to ?? 'me');
    if (who) where.push(`a.assigned_to = $${params.push(who)}`);
    const zone = q.tz && TZ.test(q.tz) ? q.tz : 'Africa/Addis_Ababa';
    const day = () => `date_trunc('day', now() AT TIME ZONE $${params.push(zone)})`;
    if (q.when === 'done') where.push('a.done_at IS NOT NULL');
    else if (q.when) {
      where.push('a.done_at IS NULL');
      if (q.when === 'overdue') where.push(`a.due_at < ${day()} AT TIME ZONE $${params.length}`);
      if (q.when === 'today') {
        const d = day();
        where.push(`a.due_at >= ${d} AT TIME ZONE $${params.length} AND a.due_at < (${d} + interval '1 day') AT TIME ZONE $${params.length}`);
      }
      if (q.when === 'upcoming') where.push(`a.due_at >= (${day()} + interval '1 day') AT TIME ZONE $${params.length}`);
    }
    if (q.related_type) where.push(`a.related_type = $${params.push(q.related_type)}`);
    if (q.related_id) where.push(`a.related_id = $${params.push(q.related_id)}`);
    const mine = (scope as CrmScope).mine;
    if (mine) {
      const n = params.push(mine);
      where.push(`(a.assigned_to = $${n} OR a.created_by = $${n}
        OR (a.related_type = 'lead' AND EXISTS (SELECT 1 FROM crm_leads x WHERE x.id = a.related_id AND (x.owner_id = $${n} OR x.created_by = $${n})))
        OR (a.related_type = 'opportunity' AND EXISTS (SELECT 1 FROM crm_opportunities x WHERE x.id = a.related_id AND (x.owner_id = $${n} OR x.created_by = $${n}))))`);
    }
    const f = companyFilter(scope, 'a', params.length + 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    return { where, params };
  }

  private async findVisible(conn: Queryable, scope: CompanyScope, id: string) {
    const [row] = await conn.query(`${ACTIVITY_SQL} WHERE a.id = $1`, [id]);
    if (!row || !isVisible(scope, row.company_id, row.branch_id) || !row.is_active || !this.ownsActivity(scope, row)) throw new NotFoundException('Activity not found');
    return row;
  }
}
