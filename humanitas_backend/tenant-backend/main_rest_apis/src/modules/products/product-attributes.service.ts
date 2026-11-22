import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { CatalogContext } from './products.service';
import type { Queryable } from './products.scope';
import { rethrowCatalogConflict } from './products.errors';
import type {
  AttributeValueDto,
  CreateAttributeDto,
  UpdateAttributeDto,
  UpdateAttributeValueDto,
} from './dto/product-variants.dto';

/**
 * Renames variants after a value or parent name change: "<parent> (<values in attribute order>)".
 * $1 = uuid[] of variant ids to refresh.
 */
export const REFRESH_VARIANT_NAMES_SQL = `
  UPDATE products v
     SET variant_label = s.label,
         name = CASE WHEN length(par.name || ' (' || s.label || ')') <= 255
                     THEN par.name || ' (' || s.label || ')'
                     ELSE left(par.name || ' (' || s.label || ')', 252) || '...' END,
         updated_at = now()
    FROM products par,
         (SELECT pvv.product_id, string_agg(av.name, ', ' ORDER BY COALESCE(t.sort_order, 0), a.sort_order, lower(a.name)) AS label
            FROM product_variant_values pvv
            JOIN products vv ON vv.id = pvv.product_id
            JOIN product_attributes a ON a.id = pvv.attribute_id
            JOIN product_attribute_values av ON av.id = pvv.value_id
            LEFT JOIN product_template_attributes t ON t.product_id = vv.parent_id AND t.attribute_id = pvv.attribute_id
           WHERE pvv.product_id = ANY($1::uuid[])
           GROUP BY pvv.product_id) s
   WHERE v.id = s.product_id AND par.id = v.parent_id`;

const LIST_SQL = `
  SELECT a.id, a.name, a.display_type, a.sort_order, a.is_active,
         (SELECT count(*)::int FROM product_template_attributes t JOIN products p ON p.id = t.product_id AND p.is_active
           WHERE t.attribute_id = a.id) AS product_count,
         COALESCE((SELECT json_agg(json_build_object(
                    'id', av.id, 'name', av.name, 'code', av.code, 'html_color', av.html_color,
                    'sort_order', av.sort_order, 'is_active', av.is_active,
                    'variant_count', (SELECT count(*)::int FROM product_variant_values pvv
                                        JOIN products v ON v.id = pvv.product_id AND v.is_active
                                       WHERE pvv.value_id = av.id))
                    ORDER BY av.sort_order, lower(av.name))
                     FROM product_attribute_values av
                    WHERE av.attribute_id = a.id AND (av.is_active OR $1)), '[]'::json) AS values
    FROM product_attributes a`;

@Injectable()
export class ProductAttributesService {
  constructor(private readonly databaseService: DatabaseService) {}

  private conn(ctx: CatalogContext) {
    return this.databaseService.getTenantConnectionById(ctx.tenantId);
  }

  async list(ctx: CatalogContext, includeArchived = false) {
    const conn = await this.conn(ctx);
    return conn.query(`${LIST_SQL} WHERE a.is_active OR $1 ORDER BY a.sort_order, lower(a.name)`, [includeArchived]);
  }

  async get(ctx: CatalogContext, id: string) {
    const conn = await this.conn(ctx);
    return this.find(conn, id);
  }

  async create(ctx: CatalogContext, dto: CreateAttributeDto) {
    const conn = await this.conn(ctx);
    const names = new Set<string>();
    for (const v of dto.values ?? []) {
      const key = v.name.trim().toLowerCase();
      if (names.has(key)) throw new BadRequestException(`The value "${v.name.trim()}" is listed twice`);
      names.add(key);
    }
    const id = await conn
      .transaction(async (m: Queryable) => {
        const [row] = await m.query(
          `INSERT INTO product_attributes (name, display_type, sort_order, created_by, updated_by)
           VALUES ($1, $2, COALESCE($3, (SELECT COALESCE(max(sort_order), 0) + 1 FROM product_attributes)), $4, $4) RETURNING id`,
          [dto.name.trim(), dto.display_type ?? 'pills', dto.sort_order ?? null, ctx.user?.sub ?? null],
        );
        let i = 0;
        for (const v of dto.values ?? []) await this.insertValue(m, row.id, v, ++i, ctx.user?.sub);
        return row.id as string;
      })
      .catch(rethrowCatalogConflict);
    return this.find(conn, id);
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateAttributeDto) {
    const conn = await this.conn(ctx);
    await this.find(conn, id);
    const sets: string[] = [];
    const params: unknown[] = [];
    const put = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (dto.name !== undefined) put('name', dto.name.trim());
    if (dto.display_type !== undefined) put('display_type', dto.display_type);
    if (dto.sort_order !== undefined) put('sort_order', dto.sort_order);
    if (dto.is_active !== undefined) put('is_active', dto.is_active);
    if (sets.length) {
      params.push(ctx.user?.sub ?? null, id);
      await conn
        .query(
          `UPDATE product_attributes SET ${[...sets, `updated_by = $${params.length - 1}`, 'updated_at = now()'].join(', ')}
            WHERE id = $${params.length}`,
          params,
        )
        .catch(rethrowCatalogConflict);
    }
    return this.find(conn, id);
  }

  /** Archive (rule 24). Refused while active products use it, so their variants keep making sense. */
  async archive(ctx: CatalogContext, id: string) {
    const conn = await this.conn(ctx);
    const attr = await this.find(conn, id);
    if (attr.product_count > 0) {
      throw new BadRequestException(
        `"${attr.name}" is used by ${attr.product_count} product${attr.product_count === 1 ? '' : 's'}. Remove it from their variants first.`,
      );
    }
    await conn.query(`UPDATE product_attributes SET is_active = false, updated_by = $2, updated_at = now() WHERE id = $1`, [
      id,
      ctx.user?.sub ?? null,
    ]);
    return this.find(conn, id, true);
  }

  /** Add a value on the fly (also from a product's Variants tab). */
  async addValue(ctx: CatalogContext, id: string, dto: AttributeValueDto) {
    const conn = await this.conn(ctx);
    const attr = await this.find(conn, id);
    if (!attr.is_active) throw new BadRequestException(`"${attr.name}" is archived`);
    const value = await this.insertValue(conn, id, dto, dto.sort_order ?? null, ctx.user?.sub).catch(rethrowCatalogConflict);
    return value;
  }

  async updateValue(ctx: CatalogContext, id: string, valueId: string, dto: UpdateAttributeValueDto) {
    const conn = await this.conn(ctx);
    const value = await this.findValue(conn, id, valueId);
    if (dto.is_active === false) await this.assertValueUnused(conn, value);
    const sets: string[] = [];
    const params: unknown[] = [];
    const put = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (dto.name !== undefined) put('name', dto.name.trim());
    if (dto.code !== undefined) put('code', dto.code?.trim() || null);
    if (dto.html_color !== undefined) put('html_color', dto.html_color || null);
    if (dto.sort_order !== undefined) put('sort_order', dto.sort_order);
    if (dto.is_active !== undefined) put('is_active', dto.is_active);
    if (!sets.length) return value;
    params.push(valueId);
    await conn
      .transaction(async (m: Queryable) => {
        await m.query(
          `UPDATE product_attribute_values SET ${[...sets, 'updated_at = now()'].join(', ')} WHERE id = $${params.length}`,
          params,
        );
        if (dto.name !== undefined && dto.name.trim() !== value.name) {
          // Variants named after this value ("T-shirt (Red, M)") follow the new name.
          const ids = (await m.query(`SELECT product_id FROM product_variant_values WHERE value_id = $1`, [valueId])).map(
            (r: { product_id: string }) => r.product_id,
          );
          if (ids.length) await m.query(REFRESH_VARIANT_NAMES_SQL, [ids]);
        }
      })
      .catch(rethrowCatalogConflict);
    return this.findValue(conn, id, valueId);
  }

  async archiveValue(ctx: CatalogContext, id: string, valueId: string) {
    return this.updateValue(ctx, id, valueId, { is_active: false });
  }

  // ── helpers ──────────────────────────────────────────────────────────────────────
  private async find(conn: Queryable, id: string, includeArchived = true) {
    const rows = await conn.query(`${LIST_SQL} WHERE a.id = $2`, [includeArchived, id]);
    if (!rows.length) throw new NotFoundException('Attribute not found');
    return rows[0];
  }

  private async findValue(conn: Queryable, attributeId: string, valueId: string) {
    const rows = await conn.query(
      `SELECT id, attribute_id, name, code, html_color, sort_order, is_active FROM product_attribute_values
        WHERE id = $1 AND attribute_id = $2`,
      [valueId, attributeId],
    );
    if (!rows.length) throw new NotFoundException('Attribute value not found');
    return rows[0];
  }

  private async assertValueUnused(conn: Queryable, value: { id: string; name: string }) {
    const [{ variants, products }] = await conn.query(
      `SELECT (SELECT count(*)::int FROM product_variant_values pvv JOIN products v ON v.id = pvv.product_id AND v.is_active
                WHERE pvv.value_id = $1) AS variants,
              (SELECT count(*)::int FROM product_template_attributes t JOIN products p ON p.id = t.product_id AND p.is_active
                WHERE $1 = ANY(t.value_ids)) AS products`,
      [value.id],
    );
    if (variants > 0 || products > 0) {
      throw new BadRequestException(
        `"${value.name}" is used by ${products} product${products === 1 ? '' : 's'} (${variants} active variant${variants === 1 ? '' : 's'}). Remove it from their variants first.`,
      );
    }
  }

  private async insertValue(m: Queryable, attributeId: string, v: AttributeValueDto, sortOrder: number | null, actorId?: string) {
    const [row] = await m.query(
      `INSERT INTO product_attribute_values (attribute_id, name, code, html_color, sort_order, created_by)
       VALUES ($1, $2, $3, $4,
               COALESCE($5, (SELECT COALESCE(max(sort_order), 0) + 1 FROM product_attribute_values WHERE attribute_id = $1)), $6)
       RETURNING id, attribute_id, name, code, html_color, sort_order, is_active`,
      [attributeId, v.name.trim(), v.code?.trim() || null, v.html_color || null, sortOrder, actorId ?? null],
    );
    return row;
  }
}
