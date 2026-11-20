/**
 * Universal Activity Timeline — shared types (featureslist §30).
 */
export const ACTIVITY_EVENT_TYPES = [
  'created',
  'updated',
  'deleted',
  'restored',
  'stage_changed',
  'note',
  'interaction',
  'activity',
  'system',
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const ACTIVITY_SOURCES = ['ui', 'api', 'ai', 'mcp', 'system', 'import'] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

export type ActivityVisibility = 'internal' | 'customer';

/** One changed field: `old` and `new` are the stored values, already JSON-safe. */
export interface ActivityFieldChange {
  field: string;
  label: string;
  old: unknown;
  new: unknown;
}

export interface RecordActivityInput {
  entityType: string;
  entityId: string;
  eventType: ActivityEventType;
  moduleKey?: string;
  summary?: string;
  changes?: ActivityFieldChange[];
  payload?: Record<string, unknown>;
  source?: ActivitySource;
  visibility?: ActivityVisibility;
  actorId?: string | null;
  onBehalfOf?: string | null;
  occurredAt?: Date;
}

/** Map of field name → human label. Only these fields are tracked. */
export type TrackedFields = Record<string, string>;

export interface RecordChangesInput {
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null | undefined;
  after: Record<string, unknown> | null | undefined;
  fields: TrackedFields;
  moduleKey?: string;
  summary?: string;
  source?: ActivitySource;
  actorId?: string | null;
  onBehalfOf?: string | null;
}

export interface ActivityEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: ActivityEventType;
  module_key: string | null;
  summary: string | null;
  changes: ActivityFieldChange[];
  payload: Record<string, unknown>;
  source: ActivitySource;
  visibility: ActivityVisibility;
  created_by: string | null;
  created_by_name?: string | null;
  on_behalf_of: string | null;
  company_id: string | null;
  branch_id: string | null;
  occurred_at: string;
  created_at: string;
}

export interface ListActivityOptions {
  limit?: number;
  /** Cursor: return events strictly older than this event id. */
  before?: string;
  eventTypes?: ActivityEventType[];
  visibility?: ActivityVisibility;
}
