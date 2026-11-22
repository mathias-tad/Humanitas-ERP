import { BadRequestException, ConflictException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service';
import type { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from '../products/products.service';
import { resolveCompanyScope, type CompanyScope, type Queryable } from '../products/products.scope';
import type { AuthUser } from '../../common/types/authenticated-request';
import { VIEW_ALL_CRM_RECORDS } from './crm.permissions';

/** The company scope plus whose records: null = everyone's, else only this user's own. */
export type CrmScope = CompanyScope & { mine: string | null };

/** Owners, Administrators and holders of view_all_crm_records see every CRM record. */
export function seesAllCrm(user: Pick<AuthUser, 'role' | 'permissions'> | undefined): boolean {
  if (!user) return true;
  if (['owner', 'admin', 'administrator'].includes(String(user.role ?? '').toLowerCase())) return true;
  const perms = user.permissions ?? [];
  return perms.includes('*') || perms.includes(VIEW_ALL_CRM_RECORDS);
}

/** Whether a lead or deal is the person's own (they own it or created it). */
export function ownsCrmRow(scope: { mine?: string | null }, row: { owner_id?: unknown; created_by?: unknown }): boolean {
  return !scope.mine || row.owner_id === scope.mine || row.created_by === scope.mine;
}

/** SQL limiting leads (alias l) or deals (alias o) to the person's own; pushes the parameter. */
export function ownSql(scope: CompanyScope, alias: string, params: unknown[]): string | null {
  const mine = (scope as CrmScope).mine;
  if (!mine) return null;
  const n = params.push(mine);
  return `(${alias}.owner_id = $${n} OR ${alias}.created_by = $${n})`;
}

export const blankToNull = (v: unknown) => (typeof v === 'string' ? v.trim() || null : v);

/** Timeline entity types of CRM records. */
export const ENTITY = { lead: 'crm_lead', opportunity: 'crm_opportunity', contact: 'contact' } as const;

/** Shared plumbing of the CRM services: tenant connection, company scope, users, history. */
export abstract class CrmBase {
  protected abstract readonly databaseService: DatabaseService;
  protected abstract readonly timeline: ActivityTimelineService;

  protected async open(ctx: CatalogContext) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const company = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader, ctx.branchHeader);
    const scope: CrmScope = { ...company, mine: seesAllCrm(ctx.user) ? null : ctx.user?.sub ?? null };
    return { conn, scope };
  }

  /** 'me' means the signed-in user. */
  protected userParam(ctx: CatalogContext, v: string | undefined | null): string | null {
    if (!v) return null;
    if (v === 'me') return ctx.user?.sub ?? null;
    if (!/^[0-9a-f-]{36}$/i.test(v)) throw new BadRequestException('Unknown user');
    return v;
  }

  protected async checkUser(conn: Queryable, id: string | null | undefined, what: string) {
    if (!id) return;
    const [u] = await conn.query(`SELECT id FROM users WHERE id = $1 AND COALESCE(is_active, true)`, [id]);
    if (!u) throw new BadRequestException(`That ${what} is not an active user`);
  }

  protected async checkListItem(conn: Queryable, table: 'crm_lead_sources' | 'crm_lost_reasons', id: string | null | undefined, what: string) {
    if (!id) return;
    const [row] = await conn.query(`SELECT id, is_active FROM ${table} WHERE id = $1`, [id]);
    if (!row || !row.is_active) throw new BadRequestException(`That ${what} was not found`);
  }

  protected record(
    ctx: CatalogContext,
    entityType: string,
    entityId: string,
    eventType: 'created' | 'updated' | 'deleted' | 'restored' | 'stage_changed' | 'note' | 'interaction' | 'activity',
    summary: string,
    payload?: Record<string, unknown>,
  ) {
    return this.timeline.record(ctx.tenantId, {
      entityType, entityId, eventType, moduleKey: 'crm', summary, payload, actorId: ctx.user?.sub, client: ctx.client,
    });
  }

  protected rethrow(e: unknown): never {
    const err = e as { code?: string; constraint?: string };
    if (err?.code === '23505') {
      const messages: Record<string, string> = {
        uq_crm_leads_code: 'Another lead already has this code',
        uq_crm_opportunities_code: 'Another opportunity already has this code',
        uq_crm_pipelines_name: 'A pipeline with this name already exists',
        uq_crm_pipelines_one_default: 'Only one pipeline can be the default',
        uq_crm_stages_name: 'This pipeline already has a stage with this name',
        uq_crm_lead_sources_name: 'A lead source with this name already exists',
        uq_crm_lost_reasons_name: 'A lost reason with this name already exists',
      };
      throw new ConflictException(messages[err.constraint ?? ''] ?? 'This would duplicate an existing record');
    }
    throw e;
  }
}

/** UPDATE … SET for the given columns of a row (only the ones present). */
export function setClause(row: Record<string, unknown>, cols: readonly string[], offset = 0) {
  const present = cols.filter((c) => row[c] !== undefined);
  return { present, sql: present.map((c, i) => `${c} = $${i + 1 + offset}`).join(', '), params: present.map((c) => row[c]) };
}
