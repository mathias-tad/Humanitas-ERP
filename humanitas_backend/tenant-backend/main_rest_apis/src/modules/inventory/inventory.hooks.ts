import type { ModuleHooksService } from '../../common/modules/module-hooks.service';

/**
 * How Inventory plugs into the modules it builds on (rule 30). Products never imports Inventory;
 * Inventory answers Products' events instead.
 */
export function registerInventoryHooks(hooks: ModuleHooksService): void {
  // A product (or a variant of it) still holding stock cannot be archived: count or move it out first.
  hooks.onVeto('product.archive', 'inventory', async ({ conn, productIds }) => {
    if (!productIds.length) return null;
    const rows: { name: string; quantity: string }[] = await conn.query(
      `SELECT p.name, sum(q.quantity)::text AS quantity
         FROM inventory_quants q JOIN products p ON p.id = q.product_id
        WHERE q.product_id = ANY($1::uuid[])
        GROUP BY p.id, p.name HAVING sum(q.quantity) <> 0
        ORDER BY p.name LIMIT 3`,
      [productIds],
    );
    if (!rows.length) return null;
    const list = rows.map((r) => `${r.name} (${Number(r.quantity)})`).join(', ');
    return `Still in stock: ${list}. Deliver, move or adjust it out in Inventory before archiving`;
  });
}
