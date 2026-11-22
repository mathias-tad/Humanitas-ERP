/**
 * Variant matrix rules (featureslist §1): which combinations a product's attributes produce,
 * and how each variant is keyed, named and given a SKU. Pure functions, no database.
 */

/** Most variants one product may have; larger matrices are almost always a mistake. */
export const MAX_VARIANTS = 300;

export interface AttributeLine {
  attribute_id: string;
  attribute_name: string;
  sort_order: number;
  values: { id: string; name: string; code: string | null; sort_order: number }[];
}

export interface Combination {
  /** Sorted value ids joined by ',' (products.variant_key). */
  key: string;
  /** "Red, XL" in attribute order. */
  label: string;
  /** "RED-XL" in attribute order, for generated SKUs. */
  skuSuffix: string;
  values: { attribute_id: string; value_id: string }[];
}

export function variantKey(valueIds: string[]): string {
  return [...valueIds].sort().join(',');
}

/** "Extra Large" -> "EXTRA-LARGE"; the code wins when set. */
export function valueSkuCode(v: { name: string; code: string | null }): string {
  const raw = (v.code && v.code.trim()) || v.name;
  return raw
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12);
}

/** How many variants the lines would make (without building them). */
export function combinationCount(lines: Pick<AttributeLine, 'values'>[]): number {
  if (!lines.length) return 0;
  return lines.reduce((n, l) => n * l.values.length, 1);
}

/** Every combination of one value per attribute line, lines in their display order. */
export function combinations(lines: AttributeLine[]): Combination[] {
  if (!lines.length || lines.some((l) => !l.values.length)) return [];
  const ordered = [...lines].sort((a, b) => a.sort_order - b.sort_order);
  const ordValues = ordered.map((l) => [...l.values].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
  let acc: { attribute_id: string; v: AttributeLine['values'][number] }[][] = [[]];
  ordered.forEach((line, i) => {
    const next: typeof acc = [];
    for (const partial of acc) for (const v of ordValues[i]) next.push([...partial, { attribute_id: line.attribute_id, v }]);
    acc = next;
  });
  return acc.map((parts) => ({
    key: variantKey(parts.map((p) => p.v.id)),
    label: parts.map((p) => p.v.name).join(', '),
    skuSuffix: parts.map((p) => valueSkuCode(p.v)).filter(Boolean).join('-'),
    values: parts.map((p) => ({ attribute_id: p.attribute_id, value_id: p.v.id })),
  }));
}

export function variantName(parentName: string, label: string): string {
  const name = `${parentName} (${label})`;
  return name.length <= 255 ? name : `${name.slice(0, 252)}...`;
}

/** Parent SKU "TSHIRT" + "RED-XL" -> "TSHIRT-RED-XL" (null when the parent has no SKU). */
export function variantSku(parentSku: string | null | undefined, suffix: string): string | null {
  if (!parentSku || !parentSku.trim()) return null;
  const sku = `${parentSku.trim()}-${suffix}`.replace(/[^A-Za-z0-9._\-/]/g, '-');
  return sku.length <= 64 ? sku : null;
}

export interface ExistingVariant {
  id: string;
  variant_key: string;
  is_active: boolean;
  auto_archived: 'config' | 'parent' | null;
}

export interface VariantPlan {
  create: Combination[];
  /** Combinations no longer offered: archive these (they keep their history). */
  archive: ExistingVariant[];
  /** Archived only because their combination had been removed, and offered again now. */
  restore: ExistingVariant[];
  /** Combinations that still exist (their names are refreshed). */
  keep: { variant: ExistingVariant; combination: Combination }[];
}

/** What to create, archive and restore so the variants match the attribute lines. */
export function planVariants(lines: AttributeLine[], existing: ExistingVariant[]): VariantPlan {
  const wanted = combinations(lines);
  const byKey = new Map(existing.map((v) => [v.variant_key, v]));
  const wantedKeys = new Set(wanted.map((c) => c.key));
  const plan: VariantPlan = { create: [], archive: [], restore: [], keep: [] };
  for (const c of wanted) {
    const v = byKey.get(c.key);
    if (!v) plan.create.push(c);
    else {
      plan.keep.push({ variant: v, combination: c });
      if (!v.is_active && v.auto_archived === 'config') plan.restore.push(v);
    }
  }
  for (const v of existing) if (!wantedKeys.has(v.variant_key) && v.is_active) plan.archive.push(v);
  return plan;
}

/** Fields that live on the parent and are copied to every variant. */
export const SHARED_WITH_VARIANTS = [
  'description', 'product_type', 'category_id', 'uom_id', 'purchase_uom_id', 'tax_code', 'harmonization_code',
  'excise_rate', 'can_be_sold', 'can_be_purchased', 'company_id',
] as const;

/** Fields a variant sets for itself. */
export const VARIANT_OWN_FIELDS = ['sku', 'cost_price', 'image_url', 'invoice_description', 'item_code', 'price_extra'] as const;
