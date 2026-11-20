import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ACTIVITY_EVENT_TYPES,
  ACTIVITY_SOURCES,
  type ActivityEvent,
  type ActivityFieldChange,
  type ListActivityOptions,
  type RecordActivityInput,
  type RecordChangesInput,
  type TrackedFields,
} from './activity-timeline.types';

const ENTITY_TYPE = /^[a-z][a-z0-9_]{1,79}$/;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/** Normalize a value for comparison and storage (dates → ISO, numeric strings stay as given). */
function normalize(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'object') return JSON.parse(JSON.stringify(value));
  return value;
}

/** True when two normalized values represent the same thing (10 == "10.00", objects deep-equal). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  const numA = typeof a === 'number' || (typeof a === 'string' && a.trim() !== '' && !Number.isNaN(Number(a)));
  const numB = typeof b === 'number' || (typeof b === 'string' && b.trim() !== '' && !Number.isNaN(Number(b)));
  if (numA && numB && (typeof a === 'number' || typeof b === 'number')) return Number(a) === Number(b);
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

/**
 * Shared service behind the per-record timeline (featureslist §30).
 * Modules call `record()` / `recordChanges()`; rows are immutable (enforced in the database).
 */
@Injectable()
export class ActivityTimelineService {
  constructor(private readonly databaseService: DatabaseService) {}

  /** Field-level diff limited to the tracked fields. Pure; exported for reuse and tests. */
  static diff(
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown> | null | undefined,
    fields: TrackedFields,
  ): ActivityFieldChange[] {
    const changes: ActivityFieldChange[] = [];
    for (const [field, label] of Object.entries(fields)) {
      if (after && !(field in after)) continue; // field not part of this update
      const oldValue = normalize(before?.[field]);
      const newValue = normalize(after?.[field]);
      if (!sameValue(oldValue, newValue)) changes.push({ field, label, old: oldValue, new: newValue });
    }
    return changes;
  }

  async record(tenantId: string, input: RecordActivityInput): Promise<ActivityEvent> {
    this.validate(input);
    const conn = await this.databaseService.getTenantConnectionById(tenantId);
    const rows: ActivityEvent[] = await conn.query(
      `INSERT INTO activity_events
         (entity_type, entity_id, event_type, module_key, summary, changes, payload,
          source, visibility, created_by, on_behalf_of, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, COALESCE($12::timestamptz, now()))
       RETURNING *`,
      [
        input.entityType,
        String(input.entityId),
        input.eventType,
        input.moduleKey ?? null,
        input.summary ?? null,
        JSON.stringify(input.changes ?? []),
        JSON.stringify(input.payload ?? {}),
        input.source ?? 'ui',
        input.visibility ?? 'internal',
        input.actorId ?? null,
        input.onBehalfOf ?? null,
        input.occurredAt ? input.occurredAt.toISOString() : null,
      ],
    );
    return rows[0];
  }

  /** Records an `updated` event with the tracked-field diff; returns null when nothing changed. */
  async recordChanges(tenantId: string, input: RecordChangesInput): Promise<ActivityEvent | null> {
    const changes = ActivityTimelineService.diff(input.before, input.after, input.fields);
    if (changes.length === 0) return null;
    return this.record(tenantId, {
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: 'updated',
      moduleKey: input.moduleKey,
      summary: input.summary ?? changes.map((c) => c.label).join(', ') + ' changed',
      changes,
      source: input.source,
      actorId: input.actorId,
      onBehalfOf: input.onBehalfOf,
    });
  }

  /** Newest first, cursor-paginated by event id. Callers must have checked view permission. */
  async list(
    tenantId: string,
    entityType: string,
    entityId: string,
    options: ListActivityOptions = {},
  ): Promise<{ events: ActivityEvent[]; nextCursor: string | null }> {
    if (!ENTITY_TYPE.test(entityType)) throw new BadRequestException('Invalid entity type');
    const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const conn = await this.databaseService.getTenantConnectionById(tenantId);

    const params: unknown[] = [entityType, String(entityId)];
    const where = ['e.entity_type = $1', 'e.entity_id = $2'];
    if (options.eventTypes?.length) {
      const bad = options.eventTypes.filter((t) => !ACTIVITY_EVENT_TYPES.includes(t));
      if (bad.length) throw new BadRequestException(`Invalid event type: ${bad.join(', ')}`);
      params.push(options.eventTypes);
      where.push(`e.event_type = ANY($${params.length})`);
    }
    if (options.visibility) {
      params.push(options.visibility);
      where.push(`e.visibility = $${params.length}`);
    }
    if (options.before) {
      params.push(options.before);
      const p = `$${params.length}`;
      where.push(
        `(e.occurred_at, e.id) < (SELECT occurred_at, id FROM activity_events WHERE id = ${p}::uuid)`,
      );
    }
    params.push(limit + 1);
    const rows: ActivityEvent[] = await conn.query(
      `SELECT e.*, u.full_name AS created_by_name
         FROM activity_events e
         LEFT JOIN users u ON u.id = e.created_by
        WHERE ${where.join(' AND ')}
        ORDER BY e.occurred_at DESC, e.id DESC
        LIMIT $${params.length}`,
      params,
    );
    const hasMore = rows.length > limit;
    const events = hasMore ? rows.slice(0, limit) : rows;
    return { events, nextCursor: hasMore ? events[events.length - 1].id : null };
  }

  private validate(input: RecordActivityInput): void {
    if (!ENTITY_TYPE.test(input.entityType ?? '')) throw new BadRequestException('Invalid entity type');
    if (!input.entityId) throw new BadRequestException('entityId is required');
    if (!ACTIVITY_EVENT_TYPES.includes(input.eventType)) throw new BadRequestException('Invalid event type');
    if (input.source && !ACTIVITY_SOURCES.includes(input.source)) throw new BadRequestException('Invalid source');
    if (input.visibility && !['internal', 'customer'].includes(input.visibility)) {
      throw new BadRequestException('Invalid visibility');
    }
  }
}
