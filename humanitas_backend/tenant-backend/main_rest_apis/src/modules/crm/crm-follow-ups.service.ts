import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../products/products.service';
import { isVisible, type Queryable } from '../products/products.scope';
import { CrmBase, ENTITY, ownsCrmRow } from './crm.base';
import type { FollowUpChannel, LogFollowUpDto } from './dto/follow-up.dto';

export type FollowUpTarget = 'lead' | 'opportunity';

export const CHANNEL_LABEL: Record<FollowUpChannel, string> = {
  call: 'Call', meeting: 'Meeting', visit: 'Visit', email: 'Email', telegram: 'Telegram', whatsapp: 'WhatsApp', sms: 'SMS', note: 'Note',
};

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd" */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** "2nd contact · Telegram from them (5 min) with Sara: wants a quote by Friday" */
export function followUpSummary(dto: Pick<LogFollowUpDto, 'channel' | 'direction' | 'duration_minutes' | 'with_whom' | 'outcome'>, sequence: number | null): string {
  if (dto.channel === 'note') return `Note: ${dto.outcome.trim()}`;
  const way = dto.direction === 'inbound' ? ' from them' : dto.direction === 'outbound' ? ' by us' : '';
  const mins = dto.duration_minutes ? ` (${dto.duration_minutes} min)` : '';
  const who = dto.with_whom?.trim() ? ` with ${dto.with_whom.trim()}` : '';
  return `${sequence ? `${ordinal(sequence)} contact · ` : ''}${CHANNEL_LABEL[dto.channel]}${way}${mins}${who}: ${dto.outcome.trim()}`;
}

const TABLE = { lead: 'crm_leads', opportunity: 'crm_opportunities' } as const;

/**
 * Follow-ups (featureslist §30, §4.1 1.5): contacts that already happened with a lead or a deal (channel,
 * direction, when, how long, with whom, outcome), numbered 1st, 2nd… contact. They go on the record's
 * timeline (and the customer's, for a deal); the record keeps its last contact for the lists.
 */
@Injectable()
export class CrmFollowUpsService extends CrmBase {
  constructor(
    protected readonly databaseService: DatabaseService,
    protected readonly timeline: ActivityTimelineService,
  ) {
    super();
  }

  async log(ctx: CatalogContext, target: FollowUpTarget, id: string, dto: LogFollowUpDto) {
    const { conn, scope } = await this.open(ctx);
    const rec = await this.find(conn, scope, target, id);
    if (target === 'lead' && rec.status === 'converted') throw new BadRequestException('This lead is converted; log follow-ups on its deal');
    const occurredAt = dto.occurred_at ? new Date(dto.occurred_at) : new Date();
    if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000) throw new BadRequestException('Log what already happened; plan future contacts as the next step');
    if (occurredAt.getTime() < Date.now() - 366 * 86_400_000) throw new BadRequestException('A follow-up can be logged up to a year back');
    const isContact = dto.channel !== 'note';
    const sequence = isContact ? Number(rec.contact_count ?? 0) + 1 : null;
    const summary = followUpSummary(dto, sequence);
    const payload = {
      kind: dto.channel, channel: dto.channel, direction: dto.direction ?? null, duration_minutes: dto.duration_minutes ?? null,
      with_whom: dto.with_whom?.trim() || null, outcome: dto.outcome.trim(), sequence, backdated: !!dto.occurred_at,
    };
    let nextId: string | null = null;
    await conn.transaction(async (m: Queryable) => {
      if (isContact) {
        // The last contact is the latest by time, so a backdated entry does not replace a newer one.
        await m.query(
          `UPDATE ${TABLE[target]}
              SET contact_count = contact_count + 1,
                  last_contact_channel = CASE WHEN last_contact_at IS NULL OR last_contact_at <= $1 THEN $2 ELSE last_contact_channel END,
                  last_contact_at = GREATEST(COALESCE(last_contact_at, $1), $1)
            WHERE id = $3`,
          [occurredAt, dto.channel, id],
        );
      }
      if (dto.next) {
        const [row] = await m.query(
          `INSERT INTO crm_activities (activity_type, subject, due_at, assigned_to, related_type, related_id, company_id, branch_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $9, $8, $8) RETURNING id`,
          [dto.next.activity_type, dto.next.subject.trim(), dto.next.due_at, dto.next.assigned_to ?? ctx.user?.sub ?? null, target, id, rec.company_id ?? null, ctx.user?.sub ?? null, rec.branch_id ?? null],
        );
        nextId = row.id;
      }
    });
    const entityType = target === 'lead' ? ENTITY.lead : ENTITY.opportunity;
    const event = {
      eventType: (isContact ? 'interaction' : 'note') as 'interaction' | 'note', moduleKey: 'crm', payload, occurredAt,
      actorId: ctx.user?.sub, client: ctx.client,
    };
    const recorded = await this.timeline.record(ctx.tenantId, { ...event, entityType, entityId: id, summary });
    if (target === 'opportunity' && rec.contact_id) {
      await this.timeline.record(ctx.tenantId, { ...event, entityType: ENTITY.contact, entityId: String(rec.contact_id), summary: `${summary} (deal "${rec.name}")` });
    }
    if (dto.next) {
      await this.record(ctx, entityType, id, 'activity', `Next step planned: ${dto.next.subject.trim()}`, { activity_id: nextId });
    }
    return { event: recorded, sequence, next_activity_id: nextId };
  }

  /** The record's follow-ups (contacts and notes), newest first, page by page. */
  async list(ctx: CatalogContext, target: FollowUpTarget, id: string, opts: { limit?: number; before?: string }) {
    const { conn, scope } = await this.open(ctx);
    await this.find(conn, scope, target, id);
    return this.timeline.list(ctx.tenantId, target === 'lead' ? ENTITY.lead : ENTITY.opportunity, id, { ...opts, eventTypes: ['interaction', 'note'] });
  }

  private async find(conn: Queryable, scope: Parameters<typeof isVisible>[0], target: FollowUpTarget, id: string) {
    const extra = target === 'lead' ? 'status, title AS name' : 'status, name, contact_id';
    const [rec] = await conn.query(
      `SELECT id, company_id, branch_id, owner_id, created_by, is_active, contact_count, ${extra} FROM ${TABLE[target]} WHERE id = $1`, [id],
    );
    if (!rec || !isVisible(scope, rec.company_id, rec.branch_id) || !ownsCrmRow(scope as { mine?: string | null }, rec)) {
      throw new NotFoundException(target === 'lead' ? 'Lead not found' : 'Opportunity not found');
    }
    if (!rec.is_active) throw new BadRequestException('Restore it before logging follow-ups');
    return rec;
  }
}
