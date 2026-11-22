import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { ProductsService, type CatalogContext } from './products.service';
import type { Queryable } from './products.scope';
import { rethrowCatalogConflict } from './products.errors';
import { REFRESH_VARIANT_NAMES_SQL } from './product-attributes.service';
import type { SaveVariantConfigDto } from './dto/product-variants.dto';
import { ProductSettingsService } from './product-settings.service';
import {
  MAX_VARIANTS,
  combinationCount,
  planVariants,
  variantName,
  variantSku,
  type AttributeLine,
  type ExistingVariant,
} from './product-variants';

export interface VariantConfig {
  product_id: string;
  has_variants: boolean;
  attributes: {
    attribute_id: string;
    name: string;
    display_type: string;
    sort_order: number;
    values: { id: string; name: string; code: string | null; html_color: string | null }[];
  }[];
  variants: Record<string, unknown>[];
}

/** A product's attributes and the variants generated from them (featureslist §1). */
@Injectable()
export class ProductVariantsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly products: ProductsService,
    private readonly timeline: ActivityTimelineService,
    /** Generated in-store barcodes for new variants (Product Settings). */
    private readonly settings?: ProductSettingsService,
  ) {}

  async get(ctx: CatalogContext, productId: string): Promise<VariantConfig> {
    const product = await this.products.get(ctx, productId);
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const parentId = product.parent_id ?? product.id;
    const attributes = await conn.query(
      `SELECT t.attribute_id, a.name, a.display_type, t.sort_order,
              COALESCE((SELECT json_agg(json_build_object('id', av.id, 'name', av.name, 'code', av.code, 'html_color', av.html_color)
                                ORDER BY av.sort_order, lower(av.name))
                          FROM product_attribute_values av WHERE av.id = ANY(t.value_ids)), '[]'::json) AS values
         FROM product_template_attributes t JOIN product_attributes a ON a.id = t.attribute_id
        WHERE t.product_id = $1 ORDER BY t.sort_order`,
      [parentId],
    );
    const variants = await this.products.variantsOf(ctx, parentId);
    return { product_id: parentId, has_variants: product.parent_id ? true : !!product.has_variants, attributes, variants };
  }

  /** Saves the attribute lines and creates, archives or restores variants to match. */
  async save(ctx: CatalogContext, productId: string, dto: SaveVariantConfigDto) {
    const product = await this.products.get(ctx, productId);
    if (product.parent_id) {
      throw new BadRequestException(`This is a variant of "${product.parent_name}". Set up variants on that product.`);
    }
    if (!product.is_active) throw new BadRequestException('Restore the product before changing its variants');
    if (product.composition && product.composition !== 'single' && dto.attributes.length) {
      throw new BadRequestException('A kit or combo cannot have variants; make it a single product first');
    }
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const lines = await this.loadLines(conn, dto);
    const count = combinationCount(lines);
    if (count > MAX_VARIANTS) {
      throw new BadRequestException(`These choices make ${count} variants; the limit is ${MAX_VARIANTS}. Choose fewer values.`);
    }
    const existing: ExistingVariant[] = await conn.query(
      `SELECT id, variant_key, is_active, auto_archived FROM products WHERE parent_id = $1`,
      [product.id],
    );
    // Barcodes made by the in-store numbering go away; each variant gets its own.
    const ownBarcodes = (product.barcodes ?? []).filter((b: { is_generated?: boolean }) => !b.is_generated);
    if (lines.length && !existing.length && ownBarcodes.length) {
      throw new BadRequestException(
        'Each variant gets its own barcode. Remove the barcodes from this product, create the variants, then add a barcode to each variant.',
      );
    }
    const plan = planVariants(lines, existing);
    const suffixes = plan.create.map((c) => variantSku(product.sku, c.skuSuffix)).filter((s): s is string => !!s);
    const taken = new Set<string>(
      suffixes.length
        ? (await conn.query(`SELECT lower(sku) AS sku FROM products WHERE lower(sku) = ANY($1::text[])`, [suffixes.map((s) => s.toLowerCase())])).map(
            (r: { sku: string }) => r.sku,
          )
        : [],
    );
    const actor = ctx.user?.sub ?? null;
    const created: { id: string; name: string }[] = [];

    await conn
      .transaction(async (m: Queryable) => {
        await m.query(`DELETE FROM product_template_attributes WHERE product_id = $1`, [product.id]);
        if (lines.length && !existing.length) await m.query(`DELETE FROM product_barcodes WHERE product_id = $1 AND is_generated`, [product.id]);
        for (const l of lines) {
          await m.query(
            `INSERT INTO product_template_attributes (product_id, attribute_id, value_ids, sort_order) VALUES ($1, $2, $3::uuid[], $4)`,
            [product.id, l.attribute_id, l.values.map((v) => v.id), l.sort_order],
          );
        }
        await m.query(`UPDATE products SET has_variants = $2, updated_by = $3, updated_at = now() WHERE id = $1`, [
          product.id,
          lines.length > 0,
          actor,
        ]);
        for (const c of plan.create) {
          let sku = variantSku(product.sku, c.skuSuffix);
          if (sku && taken.has(sku.toLowerCase())) sku = null;
          if (sku) taken.add(sku.toLowerCase());
          const name = variantName(product.name, c.label);
          const [row] = await m.query(
            `INSERT INTO products (sku, name, description, product_type, category_id, uom_id, purchase_uom_id, sales_price, cost_price,
                                   tax_code, can_be_sold, can_be_purchased, image_url, company_id, created_by, updated_by,
                                   harmonization_code, excise_rate, parent_id, variant_key, variant_label, price_extra,
                                   sales_uom_id, min_sale_qty, sale_qty_step)
             SELECT $2, $3, p.description, p.product_type, p.category_id, p.uom_id, p.purchase_uom_id, p.sales_price, p.cost_price,
                    p.tax_code, p.can_be_sold, p.can_be_purchased, p.image_url, p.company_id, $4, $4,
                    p.harmonization_code, p.excise_rate, p.id, $5, $6, 0,
                    p.sales_uom_id, p.min_sale_qty, p.sale_qty_step
               FROM products p WHERE p.id = $1
             RETURNING id`,
            [product.id, sku, name, actor, c.key, c.label],
          );
          const code = this.settings && product.product_type !== 'service' ? await this.settings.generatedBarcode(m) : null;
          if (code) {
            await m.query(
              `INSERT INTO product_barcodes (product_id, barcode, barcode_type, quantity, is_primary, is_generated, created_by)
               VALUES ($1, $2, 'ean13', 1, true, true, $3)`,
              [row.id, code, actor],
            );
          }
          for (const v of c.values) {
            await m.query(`INSERT INTO product_variant_values (product_id, attribute_id, value_id) VALUES ($1, $2, $3)`, [
              row.id,
              v.attribute_id,
              v.value_id,
            ]);
          }
          created.push({ id: row.id, name });
        }
        if (plan.archive.length) {
          await m.query(
            `UPDATE products SET is_active = false, archived_at = now(), auto_archived = 'config', updated_by = $2, updated_at = now()
              WHERE id = ANY($1::uuid[])`,
            [plan.archive.map((v) => v.id), actor],
          );
        }
        if (plan.restore.length) {
          await m.query(
            `UPDATE products SET is_active = true, archived_at = NULL, auto_archived = NULL, updated_by = $2, updated_at = now()
              WHERE id = ANY($1::uuid[])`,
            [plan.restore.map((v) => v.id), actor],
          );
        }
        // Attribute order may have changed: refresh "Parent (Red, M)" names.
        if (plan.keep.length) await m.query(REFRESH_VARIANT_NAMES_SQL, [plan.keep.map((k) => k.variant.id)]);
      })
      .catch(rethrowCatalogConflict);

    const summary = { created: created.length, archived: plan.archive.length, restored: plan.restore.length };
    if (summary.created || summary.archived || summary.restored) {
      const parts = [
        summary.created && `${summary.created} created`,
        summary.archived && `${summary.archived} archived`,
        summary.restored && `${summary.restored} restored`,
      ].filter(Boolean);
      await this.timeline.record(ctx.tenantId, {
        entityType: 'product', entityId: product.id, eventType: 'updated', moduleKey: 'products',
        summary: `Variants: ${parts.join(', ')}`,
        actorId: ctx.user?.sub, client: ctx.client,
      });
      for (const v of created) {
        await this.timeline.record(ctx.tenantId, {
          entityType: 'product', entityId: v.id, eventType: 'created', moduleKey: 'products',
          summary: `Variant "${v.name}" created from "${product.name}"`,
          actorId: ctx.user?.sub, client: ctx.client,
        });
      }
    }
    return { ...(await this.get(ctx, product.id)), summary };
  }

  /** Validates the requested lines against active attributes and values, in the requested order. */
  private async loadLines(conn: Queryable, dto: SaveVariantConfigDto): Promise<AttributeLine[]> {
    const ids = dto.attributes.map((a) => a.attribute_id);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each attribute can be used once');
    if (!ids.length) return [];
    const attrs: { id: string; name: string; is_active: boolean }[] = await conn.query(
      `SELECT id, name, is_active FROM product_attributes WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    const valueIds = [...new Set(dto.attributes.flatMap((a) => a.value_ids))];
    const values: { id: string; attribute_id: string; name: string; code: string | null; sort_order: number; is_active: boolean }[] =
      await conn.query(
        `SELECT id, attribute_id, name, code, sort_order, is_active FROM product_attribute_values WHERE id = ANY($1::uuid[])`,
        [valueIds],
      );
    return dto.attributes.map((line, index) => {
      const attr = attrs.find((a) => a.id === line.attribute_id);
      if (!attr) throw new BadRequestException('Attribute not found');
      if (!attr.is_active) throw new BadRequestException(`"${attr.name}" is archived`);
      const chosen = [...new Set(line.value_ids)].map((id) => {
        const v = values.find((x) => x.id === id);
        if (!v || v.attribute_id !== attr.id) throw new BadRequestException(`A value chosen for "${attr.name}" does not belong to it`);
        if (!v.is_active) throw new BadRequestException(`"${v.name}" (${attr.name}) is archived`);
        return { id: v.id, name: v.name, code: v.code, sort_order: v.sort_order };
      });
      if (!chosen.length) throw new BadRequestException(`Choose at least one value for "${attr.name}"`);
      return { attribute_id: attr.id, attribute_name: attr.name, sort_order: index, values: chosen };
    });
  }
}
