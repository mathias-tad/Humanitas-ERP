import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ActivityTimelineService } from '../activity-timeline/activity-timeline.service';
import { ProductsService, type CatalogContext } from './products.service';
import { isVisible, resolveCompanyScope, type Queryable } from './products.scope';
import type { SaveCompositionDto, SavePackagingsDto } from './dto/product-extras.dto';
import { compositionProblem, gtinType, packagingProblem, type Composition } from './product-structure';
import { roundMoney } from './price-lists.pricing';

const PACKAGING_SQL = `SELECT id, name, level, quantity, gtin, weight_kg, length_cm, width_cm, height_cm, can_sell, can_buy, sort_order
                         FROM product_packagings`;

/** Packaging levels (GS1) and kits / combos of a product (featureslist §1). */
@Injectable()
export class ProductStructureService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly products: ProductsService,
    private readonly timeline: ActivityTimelineService,
  ) {}

  async packagings(ctx: CatalogContext, productId: string) {
    await this.products.get(ctx, productId);
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    return conn.query(`${PACKAGING_SQL} WHERE product_id = $1 AND is_active ORDER BY sort_order, quantity`, [productId]);
  }

  /** Replaces the product's packagings. A GTIN must be valid and not used as any product's barcode or packaging. */
  async savePackagings(ctx: CatalogContext, productId: string, dto: SavePackagingsDto) {
    const product = await this.products.get(ctx, productId);
    if (product.has_variants) throw new BadRequestException('Set the packaging on each variant; a product with variants is not sold itself');
    const list = dto.packagings.map((p) => ({ ...p, name: p.name.trim(), gtin: p.gtin?.trim() || null }));
    const problem = packagingProblem(list);
    if (problem) throw new BadRequestException(problem);
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const gtins = list.map((p) => p.gtin).filter((g): g is string => !!g);
    if (gtins.length) {
      const clash = await conn.query(
        `SELECT b.barcode AS code, p.name FROM product_barcodes b JOIN products p ON p.id = b.product_id WHERE b.barcode = ANY($1::text[])
         UNION ALL
         SELECT k.gtin AS code, p.name FROM product_packagings k JOIN products p ON p.id = k.product_id
          WHERE k.gtin = ANY($1::text[]) AND k.is_active AND k.product_id <> $2`,
        [gtins, productId],
      );
      if (clash.length) throw new ConflictException(`${clash[0].code} is already used by "${clash[0].name}"`);
    }
    const before = await this.packagings(ctx, productId);
    await conn.transaction(async (m: Queryable) => {
      await m.query(`UPDATE product_packagings SET is_active = false, updated_at = now() WHERE product_id = $1 AND is_active`, [productId]);
      for (const [i, p] of list.entries()) {
        await m.query(
          `INSERT INTO product_packagings (product_id, name, level, quantity, gtin, weight_kg, length_cm, width_cm, height_cm, can_sell, can_buy, sort_order, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [productId, p.name, p.level ?? 'case', p.quantity, p.gtin, p.weight_kg ?? null, p.length_cm ?? null, p.width_cm ?? null, p.height_cm ?? null,
            p.can_sell ?? true, p.can_buy ?? true, i, ctx.user?.sub ?? null],
        );
      }
    });
    const after = await this.packagings(ctx, productId);
    const describe = (rows: { name: string; quantity: unknown; gtin: string | null }[]) =>
      rows.map((r) => `${r.name} (${Number(r.quantity)}${r.gtin ? `, ${r.gtin}` : ''})`).join('; ') || 'none';
    if (describe(before) !== describe(after)) {
      await this.timeline.record(ctx.tenantId, {
        entityType: 'product', entityId: productId, eventType: 'updated', moduleKey: 'products',
        summary: `Packaging of "${product.name}" changed`,
        changes: [{ field: 'packagings', label: 'Packaging', old: describe(before), new: describe(after) }],
        actorId: ctx.user?.sub, client: ctx.client,
      });
    }
    return after.map((p: { gtin: string | null }) => ({ ...p, gtin_type: p.gtin ? gtinType(p.gtin) : null }));
  }

  /** A kit's components or a combo's choice groups, with the components' total price and cost for comparison. */
  async composition(ctx: CatalogContext, productId: string) {
    const product = await this.products.get(ctx, productId);
    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    const components = await conn.query(
      `SELECT c.component_id, c.quantity, p.name, p.sku, p.sales_price, p.cost_price, p.is_active, u.symbol AS uom_symbol
         FROM product_components c JOIN products p ON p.id = c.component_id JOIN uoms u ON u.id = p.uom_id
        WHERE c.product_id = $1 ORDER BY c.sort_order`,
      [productId],
    );
    const groups = await conn.query(
      `SELECT g.id, g.name, g.min_choices, g.max_choices,
              COALESCE((SELECT json_agg(json_build_object('component_id', ch.component_id, 'quantity', ch.quantity, 'extra_price', ch.extra_price,
                         'is_default', ch.is_default, 'name', p.name, 'sku', p.sku, 'sales_price', p.sales_price, 'is_active', p.is_active)
                         ORDER BY ch.sort_order)
                  FROM product_combo_choices ch JOIN products p ON p.id = ch.component_id WHERE ch.group_id = g.id), '[]'::json) AS choices
         FROM product_combo_groups g WHERE g.product_id = $1 ORDER BY g.sort_order`,
      [productId],
    );
    const sum = (f: 'sales_price' | 'cost_price') =>
      roundMoney(components.reduce((t: number, c: Record<string, unknown>) => t + Number(c[f]) * Number(c.quantity), 0));
    return {
      product_id: productId,
      composition: product.composition ?? 'single',
      components,
      groups,
      components_price: sum('sales_price'),
      components_cost: sum('cost_price'),
      sales_price: Number(product.sales_price),
    };
  }

  /**
   * Sets a product as single, a kit (fixed components sold as one item at the kit's price) or a combo
   * (the customer picks from groups, e.g. a main and a drink; choices can cost extra).
   * Components are sold items: not products with variants (pick the variant), not other kits or combos.
   */
  async saveComposition(ctx: CatalogContext, productId: string, dto: SaveCompositionDto) {
    const product = await this.products.get(ctx, productId);
    const composition: Composition = dto.composition;
    const components = (dto.components ?? []).map((c) => ({ ...c }));
    const groups = (dto.groups ?? []).map((g) => ({ ...g, name: g.name.trim() }));
    if (composition !== 'single') {
      if (product.has_variants || product.parent_id) throw new BadRequestException('A product with variants, or a variant, cannot be a kit or combo');
    }
    const problem = compositionProblem(productId, composition, components, groups);
    if (problem) throw new BadRequestException(problem);

    const conn = await this.databaseService.getTenantConnectionById(ctx.tenantId);
    if (composition !== 'single') {
      const [used] = await conn.query(
        `SELECT p.name FROM product_components c JOIN products p ON p.id = c.product_id WHERE c.component_id = $1
         UNION ALL
         SELECT p.name FROM product_combo_choices ch JOIN product_combo_groups g ON g.id = ch.group_id JOIN products p ON p.id = g.product_id
          WHERE ch.component_id = $1 LIMIT 1`,
        [productId],
      );
      if (used) throw new BadRequestException(`"${product.name}" is part of "${used.name}"; a kit or combo cannot be inside another one`);
      const ids = [...new Set([...components.map((c) => c.component_id), ...groups.flatMap((g) => g.choices.map((c) => c.component_id))])];
      const scope = await resolveCompanyScope(conn, ctx.user, ctx.companyHeader);
      const rows: { id: string; name: string; is_active: boolean; has_variants: boolean; composition: string; company_id: string | null }[] =
        await conn.query(`SELECT id, name, is_active, has_variants, composition, company_id FROM products WHERE id = ANY($1::uuid[])`, [ids]);
      for (const id of ids) {
        const r = rows.find((x) => x.id === id);
        if (!r || !isVisible(scope, r.company_id)) throw new BadRequestException('A component was not found');
        if (!r.is_active) throw new BadRequestException(`"${r.name}" is archived`);
        if (r.has_variants) throw new BadRequestException(`"${r.name}" has variants; choose one of them`);
        if (r.composition !== 'single') throw new BadRequestException(`"${r.name}" is itself a kit or combo`);
      }
    }
    const before = await this.composition(ctx, productId);
    await conn.transaction(async (m: Queryable) => {
      await m.query(`DELETE FROM product_components WHERE product_id = $1`, [productId]);
      await m.query(`DELETE FROM product_combo_groups WHERE product_id = $1`, [productId]);
      await m.query(`UPDATE products SET composition = $1, updated_by = $2, updated_at = now() WHERE id = $3`, [composition, ctx.user?.sub ?? null, productId]);
      for (const [i, c] of components.entries()) {
        await m.query(`INSERT INTO product_components (product_id, component_id, quantity, sort_order) VALUES ($1, $2, $3, $4)`, [productId, c.component_id, c.quantity, i]);
      }
      for (const [i, g] of groups.entries()) {
        const [row] = await m.query(
          `INSERT INTO product_combo_groups (product_id, name, min_choices, max_choices, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [productId, g.name, g.min_choices, g.max_choices, i],
        );
        for (const [j, ch] of g.choices.entries()) {
          await m.query(
            `INSERT INTO product_combo_choices (group_id, component_id, quantity, extra_price, is_default, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`,
            [row.id, ch.component_id, ch.quantity ?? 1, ch.extra_price ?? 0, !!ch.is_default, j],
          );
        }
      }
    });
    const after = await this.composition(ctx, productId);
    const label = (c: Composition) => (c === 'kit' ? 'Kit' : c === 'combo' ? 'Combo' : 'Single product');
    const describe = (s: typeof after) =>
      s.composition === 'kit'
        ? s.components.map((c: { name: string; quantity: unknown }) => `${Number(c.quantity)} × ${c.name}`).join(', ')
        : s.composition === 'combo'
          ? s.groups.map((g: { name: string; choices: unknown[] }) => `${g.name} (${g.choices.length})`).join(', ')
          : '';
    if (before.composition !== after.composition || describe(before) !== describe(after)) {
      await this.timeline.record(ctx.tenantId, {
        entityType: 'product', entityId: productId, eventType: 'updated', moduleKey: 'products',
        summary: before.composition !== after.composition
          ? `"${product.name}" is now: ${label(after.composition)}`
          : `${label(after.composition)} contents of "${product.name}" changed`,
        changes: [{ field: 'composition', label: 'Contents', old: describe(before) || label(before.composition), new: describe(after) || label(after.composition) }],
        actorId: ctx.user?.sub, client: ctx.client,
      });
    }
    return after;
  }
}
