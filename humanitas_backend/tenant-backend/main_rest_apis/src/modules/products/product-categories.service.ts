import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CreateProductCategoryDto, UpdateProductCategoryDto } from './dto/products.dto';
import { assertCompanyAssignable, companyFilter, defaultRecordCompany, isVisible, resolveCompanyScope, type CompanyScope, type Queryable, defaultRecordBranch, assertBranchAssignable, setRecordBranch } from './products.scope';
import { rethrowCatalogConflict } from './products.errors';
import type { CatalogContext } from './products.service';

export const CATEGORY_TRACKED_FIELDS: Record<string, string> = {
  name: 'Name', parent_id: 'Parent category', code: 'Code', description: 'Description', excise_rate: 'Excise rate', is_active: 'Active', company_id: 'Company', branch_id: 'Branch',
};

@Injectable()
export class ProductCategoriesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  private async open(ctx: CatalogContext) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    return { conn, scope: await resolveCompanyScope(conn, ctx.user, ctx.companyHeader, ctx.branchHeader) };
  }

  /** Flat list with full path and product count; the UI builds the tree. */
  async list(ctx: CatalogContext, includeArchived = false) {
    const { conn, scope } = await this.open(ctx);
    const where: string[] = [];
    const params: unknown[] = [];
    if (!includeArchived) where.push('c.is_active');
    const f = companyFilter(scope, 'c', 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    return conn.query(
      `WITH RECURSIVE tree AS (
         SELECT id, parent_id, name::text AS full_path, 0 AS depth FROM product_categories WHERE parent_id IS NULL
         UNION ALL
         SELECT ch.id, ch.parent_id, tree.full_path || ' / ' || ch.name, tree.depth + 1
           FROM product_categories ch JOIN tree ON ch.parent_id = tree.id
          WHERE tree.depth < 20
       )
       SELECT c.*, t.full_path, t.depth,
              (SELECT count(*)::int FROM products p WHERE p.category_id = c.id AND p.is_active) AS product_count
         FROM product_categories c JOIN tree t ON t.id = c.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY t.full_path`,
      params,
    );
  }

  async get(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    return this.findVisible(conn, scope, id);
  }

  async create(ctx: CatalogContext, dto: CreateProductCategoryDto) {
    const { conn, scope } = await this.open(ctx);
    const companyId = dto.company_id !== undefined ? dto.company_id : defaultRecordCompany(scope);
    assertCompanyAssignable(scope, companyId);
    const branchId = dto.branch_id !== undefined ? dto.branch_id : defaultRecordBranch(scope);
    assertBranchAssignable(scope, branchId);
    if (dto.parent_id) await this.findVisible(conn, scope, dto.parent_id, 'Parent category not found');
    const [row] = await conn.query(
        `INSERT INTO product_categories (name, parent_id, code, description, company_id, created_by, updated_by, excise_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7) RETURNING *`,
        [dto.name.trim(), dto.parent_id ?? null, dto.code?.trim() || null, dto.description ?? null, companyId ?? null,
         ctx.user?.sub ?? null, dto.excise_rate ?? 0],
      ).catch(rethrowCatalogConflict);
    if (branchId) {
      await setRecordBranch(conn, 'product_categories', String(row.id), branchId);
      row.branch_id = branchId;
    }
    await this.timeline.record(ctx.tenantId, {
      entityType: 'product_category', entityId: String(row.id), eventType: 'created', moduleKey: 'products',
      summary: `Category "${row.name}" created`,
      changes: ActivityTimelineService.diff(null, row, CATEGORY_TRACKED_FIELDS),
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return row;
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateProductCategoryDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible(conn, scope, id);
    if (dto.company_id !== undefined) assertCompanyAssignable(scope, dto.company_id);
    assertBranchAssignable(scope, dto.branch_id);
    if (dto.parent_id) {
      await this.findVisible(conn, scope, dto.parent_id, 'Parent category not found');
      await this.assertNotDescendant(conn, id, dto.parent_id);
    }
    if (dto.is_active === false) await this.assertNoActiveChildren(conn, id);
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of ['name', 'parent_id', 'code', 'description', 'excise_rate', 'is_active', 'company_id', 'branch_id'] as const) {
      if (dto[key] === undefined) continue;
      let v: unknown = dto[key];
      if (typeof v === 'string' && (key === 'name' || key === 'code')) v = v.trim() || null;
      params.push(v);
      sets.push(`${key} = $${params.length}`);
    }
    params.push(ctx.user?.sub ?? null, id);
    const [after] = await conn.query(
        `UPDATE product_categories SET ${[...sets, `updated_by = $${params.length - 1}`, 'updated_at = now()'].join(', ')}
          WHERE id = $${params.length} RETURNING *`,
        params,
      ).catch(rethrowCatalogConflict);
    await this.timeline.recordChanges(ctx.tenantId, {
      entityType: 'product_category', entityId: id, moduleKey: 'products', before, after, fields: CATEGORY_TRACKED_FIELDS,
      actorId: ctx.user?.sub, client: ctx.client,
    });
    return after;
  }

  /** Delete = archive; refused while active subcategories exist. Products keep their category. */
  async archive(ctx: CatalogContext, id: string) {
    return this.update(ctx, id, { is_active: false });
  }

  private async findVisible(conn: Queryable, scope: CompanyScope, id: string, message = 'Category not found') {
    const rows = await conn.query(`SELECT * FROM product_categories WHERE id = $1`, [id]);
    if (!rows[0] || !isVisible(scope, rows[0].company_id, rows[0].branch_id)) throw new NotFoundException(message);
    return rows[0];
  }

  /** Moving a category under itself or one of its descendants would create a loop. */
  private async assertNotDescendant(conn: Queryable, id: string, newParentId: string) {
    if (id === newParentId) throw new BadRequestException('A category cannot be its own parent');
    const rows = await conn.query(
      `WITH RECURSIVE up AS (
         SELECT id, parent_id, 0 AS depth FROM product_categories WHERE id = $1
         UNION ALL
         SELECT c.id, c.parent_id, up.depth + 1 FROM product_categories c JOIN up ON c.id = up.parent_id WHERE up.depth < 50
       ) SELECT 1 FROM up WHERE id = $2 LIMIT 1`,
      [newParentId, id],
    );
    if (rows.length) throw new BadRequestException('A category cannot be moved under one of its own subcategories');
  }

  private async assertNoActiveChildren(conn: Queryable, id: string) {
    const rows = await conn.query(`SELECT 1 FROM product_categories WHERE parent_id = $1 AND is_active LIMIT 1`, [id]);
    if (rows.length) throw new ConflictException('Archive or move its subcategories first');
  }
}
