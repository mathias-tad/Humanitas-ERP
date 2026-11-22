import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import type { CatalogContext } from './products.service';
import type { CreateProductDto, UpdateProductDto } from './dto/products.dto';
import type { UpdateProductSettingsDto } from './dto/product-extras.dto';
import type { Queryable } from './products.scope';
import { ean13, formatSku } from './product-structure';

export interface ProductSettings {
  sku_mode: 'manual' | 'auto';
  sku_prefix: string;
  sku_padding: number;
  sku_next: number | string;
  barcode_mode: 'manual' | 'ean13';
  barcode_prefix: string;
  barcode_next: number | string;
  default_product_type: 'storable' | 'consumable' | 'service';
  default_tax_code: string;
  default_uom_id: string | null;
  default_category_id: string | null;
  require_category: boolean;
  require_barcode: boolean;
  warn_below_cost: boolean;
}

export const DEFAULT_SETTINGS: ProductSettings = {
  sku_mode: 'manual', sku_prefix: 'P', sku_padding: 6, sku_next: 1, barcode_mode: 'manual', barcode_prefix: '20', barcode_next: 1,
  default_product_type: 'consumable', default_tax_code: 'VAT15', default_uom_id: null, default_category_id: null,
  require_category: false, require_barcode: false, warn_below_cost: true,
};

const FIELDS = Object.keys(DEFAULT_SETTINGS) as (keyof ProductSettings)[];

/**
 * Product Settings (featureslist §1): numbering of SKUs and in-store barcodes, defaults for new
 * products, and what a product must have. One set per tenant.
 */
@Injectable()
export class ProductSettingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async get(ctx: CatalogContext) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const s = await this.load(conn);
    const [names] = await conn.query(
      `SELECT (SELECT name FROM uoms WHERE id = $1) AS default_uom_name, (SELECT name FROM product_categories WHERE id = $2) AS default_category_name`,
      [s.default_uom_id, s.default_category_id],
    );
    return {
      ...s,
      ...(names ?? {}),
      next_sku_preview: s.sku_mode === 'auto' ? formatSku(s.sku_prefix, s.sku_padding, Number(s.sku_next)) : null,
      next_barcode_preview: s.barcode_mode === 'ean13' ? safeEan(s.barcode_prefix, Number(s.barcode_next)) : null,
    };
  }

  async update(ctx: CatalogContext, dto: UpdateProductSettingsDto) {
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const before = await this.load(conn);
    const next = { ...before, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) } as ProductSettings;
    if (next.barcode_mode === 'ean13') {
      if (!safeEan(next.barcode_prefix, Number(next.barcode_next))) {
        throw new BadRequestException(`The barcode prefix ${next.barcode_prefix} leaves no room for number ${next.barcode_next}; use a shorter prefix`);
      }
      if (!/^2\d/.test(next.barcode_prefix) && next.barcode_prefix.length < 6) {
        throw new BadRequestException('Use a prefix from 20 to 29 for in-store barcodes, or your full GS1 company prefix (6 digits or more)');
      }
    }
    if (dto.default_uom_id) {
      const [u] = await conn.query(`SELECT is_active FROM uoms WHERE id = $1`, [dto.default_uom_id]);
      if (!u?.is_active) throw new BadRequestException('Unit of measure not found');
    }
    if (dto.default_category_id) {
      const [c] = await conn.query(`SELECT is_active, company_id FROM product_categories WHERE id = $1`, [dto.default_category_id]);
      if (!c?.is_active) throw new BadRequestException('Category not found');
      if (c.company_id) throw new BadRequestException('Choose a category shared by all companies as the default');
    }
    const params = FIELDS.map((f) => next[f]);
    await conn.query(
      `INSERT INTO product_settings (id, ${FIELDS.join(', ')}, updated_by, updated_at)
       VALUES (1, ${FIELDS.map((_, i) => `$${i + 1}`).join(', ')}, $${FIELDS.length + 1}, now())
       ON CONFLICT (id) DO UPDATE SET ${FIELDS.map((f) => `${f} = EXCLUDED.${f}`).join(', ')}, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [...params, ctx.user?.sub ?? null],
    );
    const changed = FIELDS.filter((f) => String(before[f] ?? '') !== String(next[f] ?? ''));
    if (changed.length) {
      await this.timeline.record(ctx.tenantId, {
        entityType: 'product_settings', entityId: '00000000-0000-0000-0000-000000000001', eventType: 'updated', moduleKey: 'products',
        summary: `Product settings changed: ${changed.join(', ')}`, actorId: ctx.user?.sub, client: ctx.client,
      });
    }
    return this.get(ctx);
  }

  /** Fills a new product's type, tax code, unit and category from the settings and checks what it must have. */
  async applyDefaults(conn: Queryable, dto: CreateProductDto): Promise<CreateProductDto> {
    const s = await this.load(conn);
    const out: CreateProductDto = {
      ...dto,
      product_type: dto.product_type ?? s.default_product_type,
      tax_code: dto.tax_code ?? (s.default_tax_code as CreateProductDto['tax_code']),
      uom_id: dto.uom_id ?? s.default_uom_id ?? undefined,
      category_id: dto.category_id ?? s.default_category_id ?? undefined,
    };
    if (s.require_category && !out.category_id) throw new BadRequestException('Choose a category; Product Settings require one');
    if (s.require_barcode && out.product_type !== 'service' && !(dto.barcodes ?? []).length && s.barcode_mode !== 'ean13') {
      throw new BadRequestException('Add a barcode; Product Settings require one for goods');
    }
    return out;
  }

  /** Settings rules for an edit: a required category cannot be cleared, nor the last barcode of goods. */
  async checkUpdate(conn: Queryable, before: Record<string, unknown>, dto: UpdateProductDto) {
    const s = await this.load(conn);
    if (s.require_category && dto.category_id === null) throw new BadRequestException('Product Settings require a category');
    const type = dto.product_type ?? before.product_type;
    if (s.require_barcode && dto.barcodes && !dto.barcodes.length && type !== 'service' && !before.has_variants) {
      throw new BadRequestException('Product Settings require a barcode for goods');
    }
  }

  /** After a new product is inserted: its SKU and in-store barcode when the settings generate them. */
  async fillCodes(m: Queryable, productId: string, opts: { hasSku: boolean; hasBarcode: boolean; productType: string }, actorId?: string | null) {
    const s = await this.load(m);
    const out: { sku?: string; barcode?: string } = {};
    if (s.sku_mode === 'auto' && !opts.hasSku) {
      out.sku = await this.next(m, 'sku', (n) => formatSku(s.sku_prefix, s.sku_padding, n),
        `SELECT 1 FROM products WHERE lower(sku) = lower($1)`);
      await m.query(`UPDATE products SET sku = $1 WHERE id = $2`, [out.sku, productId]);
    }
    if (s.barcode_mode === 'ean13' && !opts.hasBarcode && opts.productType !== 'service') {
      out.barcode = (await this.generatedBarcode(m, s)) ?? undefined;
      if (out.barcode) await m.query(
        `INSERT INTO product_barcodes (product_id, barcode, barcode_type, quantity, is_primary, is_generated, created_by)
         VALUES ($1, $2, 'ean13', 1, true, true, $3)`,
        [productId, out.barcode, actorId ?? null],
      );
    }
    return out;
  }

  /** The next free in-store EAN-13, or null when barcodes are entered by hand. */
  async generatedBarcode(m: Queryable, settings?: ProductSettings): Promise<string | null> {
    const s = settings ?? (await this.load(m));
    if (s.barcode_mode !== 'ean13') return null;
    return this.next(m, 'barcode', (n) => ean13(s.barcode_prefix, n),
      `SELECT 1 FROM product_barcodes WHERE barcode = $1 UNION ALL SELECT 1 FROM product_packagings WHERE gtin = $1 AND is_active`);
  }

  async load(conn: Queryable): Promise<ProductSettings> {
    const [row] = await conn.query(`SELECT * FROM product_settings WHERE id = 1`);
    return { ...DEFAULT_SETTINGS, ...(row ?? {}) };
  }

  /** Takes numbers from the counter until one is free (a code typed by hand may already use it). */
  private async next(m: Queryable, counter: 'sku' | 'barcode', format: (n: number) => string, takenSql: string): Promise<string> {
    for (let i = 0; i < 100; i++) {
      const [row] = await m.query(
        `UPDATE product_settings SET ${counter}_next = ${counter}_next + 1 WHERE id = 1 RETURNING ${counter}_next - 1 AS n`,
      );
      const n = Number(row?.n ?? 1);
      let code: string;
      try {
        code = format(n);
      } catch {
        throw new BadRequestException('The in-store barcode numbers are used up; change the prefix in Product Settings');
      }
      if (!(await m.query(takenSql, [code])).length) return code;
    }
    throw new BadRequestException(`Could not find a free ${counter === 'sku' ? 'SKU' : 'barcode'}; check the numbering in Product Settings`);
  }
}

function safeEan(prefix: string, n: number): string | null {
  try {
    return ean13(prefix, n);
  } catch {
    return null;
  }
}
