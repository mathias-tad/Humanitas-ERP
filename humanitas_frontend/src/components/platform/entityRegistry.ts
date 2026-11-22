import type { ComponentType } from 'react';

/**
 * In-Context Action Framework registry (featureslist §29).
 * A module registers each record type once; every other module then gets search,
 * one-step create, "Create & edit…" and "Search more…" for it — no copy-paste.
 */
export interface EntityOption {
  id: string;
  label: string;
  description?: string;
}

export interface EntityFormProps<T = unknown> {
  mode: 'create' | 'edit';
  id?: string;
  /** Pre-filled values, e.g. { name: 'what the user typed' }. */
  initial?: Record<string, unknown>;
  onSaved: (record: T) => void;
  onCancel: () => void;
}

export interface EntityDefinition<T = unknown> {
  type: string;
  /** Singular label, e.g. "product". */
  label: string;
  /** Module key that must be subscribed, e.g. "products". */
  module: string;
  permissions: { view: string; create: string };
  search: (query: string) => Promise<T[]>;
  toOption: (record: T) => EntityOption;
  /** One-step create from the typed text (only `name` required). */
  quickCreate?: (text: string) => Promise<T>;
  /** Full create/edit form shown in the side drawer. */
  Form?: ComponentType<EntityFormProps<T>>;
}

const registry = new Map<string, EntityDefinition<any>>();

export function registerEntity<T>(def: EntityDefinition<T>): void {
  registry.set(def.type, def as EntityDefinition<any>);
}

export function getEntity<T = unknown>(type: string): EntityDefinition<T> | undefined {
  return registry.get(type) as EntityDefinition<T> | undefined;
}

/** Every registered record type (the Ctrl+K search looks records up in each). */
export function allEntities(): EntityDefinition<unknown>[] {
  return [...registry.values()] as EntityDefinition<unknown>[];
}

export interface AccessChecks {
  hasPermission: (permission: string) => boolean;
  isModuleSubscribed: (module: string) => boolean;
}

export interface EntityAccess {
  available: boolean;
  canView: boolean;
  canCreate: boolean;
}

/** Subscription first, then the single permission for each action (AGENTS.md rules 4 and 27). */
export function entityAccess(def: EntityDefinition<any> | undefined, checks: AccessChecks): EntityAccess {
  if (!def || !checks.isModuleSubscribed(def.module)) return { available: false, canView: false, canCreate: false };
  const canView = checks.hasPermission(def.permissions.view);
  return { available: true, canView, canCreate: canView && checks.hasPermission(def.permissions.create) };
}

export type PickerAction =
  | { kind: 'option'; option: EntityOption }
  | { kind: 'quick-create'; text: string; label: string }
  | { kind: 'create-edit'; text: string; label: string }
  | { kind: 'search-more'; label: string }
  | { kind: 'no-permission'; label: string };

/** What a picker offers for the current text — pure, so it is easy to test. */
export function pickerActions(
  def: EntityDefinition<any>,
  access: EntityAccess,
  query: string,
  options: EntityOption[],
): PickerAction[] {
  const text = query.trim();
  const actions: PickerAction[] = options.map((option) => ({ kind: 'option', option }));
  const exact = options.some((o) => o.label.trim().toLowerCase() === text.toLowerCase());
  if (text && !exact) {
    if (access.canCreate) {
      if (def.quickCreate) actions.push({ kind: 'quick-create', text, label: `Create "${text}"` });
      if (def.Form) actions.push({ kind: 'create-edit', text, label: `Create and edit "${text}"…` });
    } else if (access.available && access.canView) {
      actions.push({ kind: 'no-permission', label: `You can't create a new ${def.label}. Ask someone with "${def.permissions.create}".` });
    }
  }
  if (access.canView) actions.push({ kind: 'search-more', label: 'Search more…' });
  return actions;
}
