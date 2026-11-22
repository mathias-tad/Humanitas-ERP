import { api } from "@/lib/api";
import type { Permission } from "@/components/roleAndPermisions/PermissionMatrix";

/** One permission from GET /roles/permission-catalog (the server keeps the list; AGENTS rule 24 item 25). */
export interface PermissionCatalogEntry {
  id: string;
  label: string;
  group: string;
  /** Subscription the permission belongs to; "core" shows for every tenant. */
  module: string;
}

export const permissionCatalogKey = ["roles", "permission-catalog"] as const;

export function fetchPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
  return api.get<PermissionCatalogEntry[]>("/roles/permission-catalog");
}

/** The catalog entries for this tenant's modules (core always), shaped for the permission matrix. */
export function visiblePermissions(
  entries: readonly PermissionCatalogEntry[] | undefined,
  isSubscribed: (module: string) => boolean,
): Permission[] {
  return (entries ?? [])
    .filter((e) => e.module === "core" || isSubscribed(e.module))
    .map((e) => ({ id: e.id, name: e.id, label: e.label, module: e.group }));
}
