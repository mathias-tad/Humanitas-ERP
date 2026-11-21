import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CreateUomCategoryDto, CreateUomDto, UpdateUomDto } from './dto/products.dto';
import { rethrowCatalogConflict } from './products.errors';
import type { CatalogContext } from './products.service';
import type { Queryable } from './products.scope';

export const UOM_TRACKED_FIELDS: Record<string, string> = {
  name: 'Name', symbol: 'Symbol', mor_code: 'MoR unit code', ratio: 'Ratio to reference unit', rounding: 'Rounding',
  is_active: 'Active',
};

/** Units of measure are tenant-wide (shared by every company). */
@Injectable()
export class UomsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  private conn(ctx: CatalogContext) {
    return this.databaseService.getTenantConnectionById(ctx.tenantId);
  }

  /** Unit categories with their units, reference unit first. */
  async list(ctx: CatalogContext, includeInactive = false) {
    const conn = await this.conn(ctx);
    return conn.query(
      `SELECT c.id, c.name, c.is_active,
              COALESCE(json_agg(json_build_object(
                'id', u.id, 'name', u.name, 'symbol', u.symbol, 'mor_code', u.mor_code, 'ratio', u.ratio, 'is_reference', u.is_reference,
                'rounding', u.rounding, 'is_active', u.is_active) ORDER BY u.is_reference DESC, u.ratio, u.name)
                FILTER (WHERE u.id IS NOT NULL), '[]'::json) AS units
         FROM uom_categories c
         LEFT JOIN uoms u ON u.category_id = c.id ${includeInactive ? '' : 'AND u.is_active'}
        ${includeInactive ? '' : 'WHERE c.is_active'}
        GROUP BY c.id ORDER BY lower(c.name)`,
    );
  }

  /** MoR unit codes (eims_codes list "unit") for the unit form. */
  async morCodes(ctx: CatalogContext) {
    const conn = await this.conn(ctx);
    return conn.query(
      `SELECT code, name FROM eims_codes WHERE list_name = 'unit' AND is_active ORDER BY sort_order, code`,
    );
  }

  /** null/'' clears the code; anything else must be an active MoR unit code (MoR error 7023). */
  private async checkMorCode(conn: Queryable, code: string | null | undefined): Promise<string | null | undefined> {
    if (code === undefined) return undefined;
    const value = code?.trim().toUpperCase() || null;
    if (!value) return null;
    const rows = await conn.query(
      `SELECT 1 FROM eims_codes WHERE list_name = 'unit' AND code = $1 AND is_active`, [value],
    );
    if (!rows.length) throw new BadRequestException(`${value} is not a MoR unit code`);
    return value;
  }

  /** A new unit category always gets its reference unit (ratio 1). */
  async createCategory(ctx: CatalogContext, dto: CreateUomCategoryDto) {
    const conn = await this.conn(ctx);
    const morCode = await this.checkMorCode(conn, dto.reference_mor_code);
    try {
      return await conn.transaction(async (m) => {
        const [cat] = await m.query(`INSERT INTO uom_categories (name, created_by) VALUES ($1,$2) RETURNING *`, [dto.name.trim(), ctx.user?.sub ?? null]);
        const [ref] = await m.query(
          `INSERT INTO uoms (category_id, name, symbol, ratio, is_reference, created_by, mor_code)
           VALUES ($1,$2,$3,1,true,$4,$5) RETURNING *`,
          [cat.id, dto.reference_unit.trim(), dto.reference_symbol ?? null, ctx.user?.sub ?? null, morCode ?? null],
        );
        return { ...cat, units: [ref] };
      });
    } catch (err) {
      rethrowCatalogConflict(err);
    }
  }

  async create(ctx: CatalogContext, dto: CreateUomDto) {
    const conn = await this.conn(ctx);
    const cat = await conn.query(`SELECT id FROM uom_categories WHERE id = $1 AND is_active`, [dto.category_id]);
    if (!cat.length) throw new BadRequestException('Unit category not found');
    const morCode = await this.checkMorCode(conn, dto.mor_code);
    const [row] = await conn.query(
        `INSERT INTO uoms (category_id, name, symbol, ratio, rounding, created_by, mor_code)
         VALUES ($1,$2,$3,$4,COALESCE($5, 0.01),$6,$7) RETURNING *`,
        [dto.category_id, dto.name.trim(), dto.symbol ?? null, dto.ratio, dto.rounding ?? null, ctx.user?.sub ?? null, morCode ?? null],
      ).catch(rethrowCatalogConflict);
    await this.timeline.record(ctx.tenantId, {
      entityType: 'uom', entityId: String(row.id), eventType: 'created', moduleKey: 'products',
      summary: `Unit "${row.name}" created`, changes: ActivityTimelineService.diff(null, row, UOM_TRACKED_FIELDS),
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return row;
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateUomDto) {
    const conn = await this.conn(ctx);
    const [before] = await conn.query(`SELECT * FROM uoms WHERE id = $1`, [id]);
    if (!before) throw new NotFoundException('Unit not found');
    if (before.is_reference && dto.ratio !== undefined && Number(dto.ratio) !== 1) {
      throw new BadRequestException('The reference unit always has ratio 1');
    }
    if (before.is_reference && dto.is_active === false) throw new ConflictException('The reference unit cannot be archived');
    if (dto.ratio !== undefined && Number(dto.ratio) !== Number(before.ratio) && (await this.isUsed(conn, id))) {
      throw new ConflictException('This unit is used by products; create a new unit instead of changing its ratio');
    }
    if (dto.is_active === false && (await this.isUsed(conn, id))) {
      throw new ConflictException('This unit is used by active products');
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of ['name', 'symbol', 'ratio', 'rounding', 'is_active'] as const) {
      if (dto[key] === undefined) continue;
      params.push(typeof dto[key] === 'string' ? (dto[key] as string).trim() : dto[key]);
      sets.push(`${key} = $${params.length}`);
    }
    const morCode = await this.checkMorCode(conn, dto.mor_code);
    if (morCode !== undefined) {
      params.push(morCode);
      sets.push(`mor_code = $${params.length}`);
    }
    if (!sets.length) return before;
    params.push(id);
    const [after] = await conn.query(`UPDATE uoms SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $${params.length} RETURNING *`, params).catch(rethrowCatalogConflict);
    await this.timeline.recordChanges(ctx.tenantId, {
      entityType: 'uom', entityId: id, moduleKey: 'products', before, after, fields: UOM_TRACKED_FIELDS,
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return after;
  }

  /** Delete = archive (rule 24). */
  async archive(ctx: CatalogContext, id: string) {
    return this.update(ctx, id, { is_active: false });
  }

  private async isUsed(conn: Queryable, id: string) {
    const rows = await conn.query(
      `SELECT 1 FROM products WHERE is_active AND (uom_id = $1 OR purchase_uom_id = $1) LIMIT 1`,
      [id],
    );
    return rows.length > 0;
  }
}
