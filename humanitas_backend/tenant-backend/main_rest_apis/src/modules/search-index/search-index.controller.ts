import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { DatabaseService } from '../database/database.service';

export interface SearchIndexEntry {
  module_key: string;
  feature: string;
  route: string;
  purpose: string;
  actions: string[];
  buttons: { label: string; location: string }[];
}

interface KnowledgeRow {
  module_key: string;
  feature_name: string;
  route_path: string;
  page_purpose: string | null;
  available_actions: unknown;
  button_locations: unknown;
  required_permissions: unknown;
}

const asArray = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** Knowledge entries the user may use, trimmed for the search box (any one listed permission is enough). */
export function toSearchIndex(rows: KnowledgeRow[], permissions: string[]): SearchIndexEntry[] {
  const all = permissions.includes('*');
  return rows
    .filter((r) => {
      const required = asArray(r.required_permissions).map(String);
      return all || !required.length || required.some((p) => permissions.includes(p));
    })
    .map((r) => ({
      module_key: r.module_key,
      feature: r.feature_name,
      route: r.route_path,
      purpose: (r.page_purpose ?? '').slice(0, 200),
      actions: asArray(r.available_actions).map(String).slice(0, 40),
      buttons: asArray(r.button_locations)
        .map((b) => (b && typeof b === 'object' ? (b as { label?: unknown; location?: unknown }) : {}))
        .filter((b) => typeof b.label === 'string')
        .map((b) => ({ label: String(b.label), location: String(b.location ?? '') }))
        .slice(0, 40),
    }));
}

/** What the Ctrl+K search box can find besides menus: every page, feature and button the user may use. */
@Controller()
@UseGuards(JwtAuthGuard)
export class SearchIndexController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('me/search-index')
  async index(@Request() req: AuthenticatedRequest): Promise<SearchIndexEntry[]> {
    const conn = await this.databaseService.getTenantConnectionById(req.user.tenantId);
    let permissions: string[] = ['*'];
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      const [r] = await conn.query(`SELECT r.permissions FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [req.user.sub]);
      permissions = asArray(r?.permissions).map(String);
    }
    const rows: KnowledgeRow[] = await conn
      .query(
        `SELECT module_key, feature_name, route_path, page_purpose, available_actions, button_locations, required_permissions
           FROM ai_knowledge_entries ORDER BY module_key, feature_name`,
      )
      .catch(() => []);
    return toSearchIndex(rows, permissions);
  }
}
