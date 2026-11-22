import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from './products.service';
import {
  assertCompanyAssignable, companyFilter, defaultRecordCompany, isVisible, resolveCompanyScope, type CompanyScope, type Queryable,
} from './products.scope';
import { rethrowCatalogConflict } from './products.errors';
import { layoutProblem, type LabelLayout } from './label-templates.layout';
import { PriceListsService } from './price-lists.service';
import type { CreateLabelTemplateDto, LabelPricesDto, UpdateLabelTemplateDto } from './dto/label-templates.dto';

/** Columns a template can set (besides name, which is required). */
const COLUMNS = [
  'name', 'layout', 'label_width_mm', 'label_height_mm', 'page_width_mm', 'page_height_mm', 'columns', 'rows',
  'margin_top_mm', 'margin_left_mm', 'gap_x_mm', 'gap_y_mm', 'barcode_format', 'show_name', 'show_variant', 'show_sku',
  'show_price', 'show_barcode_text', 'show_company', 'font_size_pt', 'price_list_id', 'company_id', 'sort_order', 'is_active',
] as const;
type Column = (typeof COLUMNS)[number];

/** A new template: a 50 × 25 mm roll label with name, price and barcode. */
export const TEMPLATE_DEFAULTS = {
  layout: 'roll', label_width_mm: 50, label_height_mm: 25, page_width_mm: 210, page_height_mm: 297, columns: 1, rows: 1,
  margin_top_mm: 0, margin_left_mm: 0, gap_x_mm: 0, gap_y_mm: 0, barcode_format: 'auto', show_name: true, show_variant: true,
  show_sku: false, show_price: true, show_barcode_text: true, show_company: false, font_size_pt: 8, price_list_id: null,
} as const;

function defined(dto: object): Partial<Record<Column, unknown>> {
  const out: Partial<Record<Column, unknown>> = {};
  for (const c of COLUMNS) {
    const v = (dto as Record<string, unknown>)[c];
    if (v !== undefined) out[c] = c === 'name' && typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

/** Barcode and price label templates (featureslist §1: printable QR/barcode labels). */
@Injectable()
export class LabelTemplatesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timeline: ActivityTimelineService,
    private readonly priceLists: PriceListsService,
  ) {}

  private async open(ctx: CatalogContext) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader);
    return { conn, scope };
  }

  async list(ctx: CatalogContext, includeArchived = false) {
    const { conn, scope } = await this.open(ctx);
    const where: string[] = [];
    const params: unknown[] = [];
    if (!includeArchived) where.push('t.is_active');
    const f = companyFilter(scope, 't', 1);
    if (f) {
      params.push(f.param);
      where.push(f.sql);
    }
    return conn.query(
      `SELECT t.* FROM label_templates t ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.sort_order, lower(t.name)`,
      params,
    );
  }

  async get(ctx: CatalogContext, id: string) {
    const { conn, scope } = await this.open(ctx);
    return this.findVisible(conn, scope, id);
  }

  async create(ctx: CatalogContext, dto: CreateLabelTemplateDto) {
    const { conn, scope } = await this.open(ctx);
    const companyId = dto.company_id !== undefined ? dto.company_id : defaultRecordCompany(scope);
    assertCompanyAssignable(scope, companyId);
    const row: Partial<Record<Column, unknown>> = { ...TEMPLATE_DEFAULTS, ...defined(dto), company_id: companyId ?? null };
    delete row.is_active;
    this.checkLayout(row);
    await this.checkPriceList(conn, scope, row.price_list_id as string | null);
    const cols = (Object.keys(row) as Column[]).filter((c) => c !== 'sort_order');
    const params = cols.map((c) => row[c]);
    params.push(row.sort_order ?? null, ctx.user?.sub ?? null);
    const n = params.length;
    const [created] = await conn
      .query(
        `INSERT INTO label_templates (${cols.join(', ')}, sort_order, created_by, updated_by)
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, COALESCE($${n - 1}, (SELECT COALESCE(max(sort_order), 0) + 1 FROM label_templates)), $${n}, $${n})
         RETURNING id`,
        params,
      )
      .catch(rethrowCatalogConflict);
    await this.record(ctx, created.id, 'created', `Label template "${row.name}" created`);
    return this.get(ctx, created.id);
  }

  async update(ctx: CatalogContext, id: string, dto: UpdateLabelTemplateDto) {
    const { conn, scope } = await this.open(ctx);
    const before = await this.findVisible(conn, scope, id);
    const changes = defined(dto);
    if (changes.company_id !== undefined) assertCompanyAssignable(scope, changes.company_id as string | null);
    if (Object.keys(changes).length === 0) return before;
    this.checkLayout({ ...before, ...changes });
    if (changes.price_list_id !== undefined) await this.checkPriceList(conn, scope, changes.price_list_id as string | null);
    const cols = Object.keys(changes) as Column[];
    const params: unknown[] = cols.map((c) => changes[c]);
    params.push(ctx.user?.sub ?? null, id);
    await conn
      .query(
        `UPDATE label_templates SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_by = $${params.length - 1}, updated_at = now()
          WHERE id = $${params.length}`,
        params,
      )
      .catch(rethrowCatalogConflict);
    const event = changes.is_active === false ? 'deleted' : changes.is_active === true && !before.is_active ? 'restored' : 'updated';
    await this.record(ctx, id, event, `Label template "${(changes.name as string) ?? before.name}" ${event === 'deleted' ? 'archived' : event}`);
    return this.get(ctx, id);
  }

  /** Archives the template (rule 24); restore with PATCH is_active: true. */
  archive(ctx: CatalogContext, id: string) {
    return this.update(ctx, id, { is_active: false });
  }

  /** Prices for the labels being printed (the template's list, or the default list). */
  prices(ctx: CatalogContext, dto: LabelPricesDto) {
    return this.priceLists.prices(ctx, dto);
  }

  private checkLayout(row: Partial<Record<Column, unknown>>) {
    const problem = layoutProblem(row as unknown as LabelLayout);
    if (problem) throw new BadRequestException(problem);
  }

  private async checkPriceList(conn: Queryable, scope: CompanyScope, id: string | null | undefined) {
    if (!id) return;
    const [list] = await conn.query(`SELECT id, company_id, is_active FROM price_lists WHERE id = $1`, [id]);
    if (!list || !isVisible(scope, list.company_id)) throw new BadRequestException('Price list not found');
    if (!list.is_active) throw new BadRequestException('This price list is archived');
  }

  private async findVisible(conn: Queryable, scope: CompanyScope, id: string) {
    const [row] = await conn.query(`SELECT * FROM label_templates WHERE id = $1`, [id]);
    if (!row || !isVisible(scope, row.company_id)) throw new NotFoundException('Label template not found');
    return row;
  }

  private async record(ctx: CatalogContext, id: string, eventType: 'created' | 'updated' | 'deleted' | 'restored', summary: string) {
    await this.timeline.record(ctx.tenantId, {
      entityType: 'label_template', entityId: id, eventType, moduleKey: 'products', summary, actorId: ctx.user?.sub, client: ctx.client,
    });
  }
}
