/**
 * Products completion (featureslist §1): GS1 barcodes, packaging, kits and combos, order
 * quantities, generated SKUs and barcodes, catalog data-quality checks. Pure, no database.
 */

/** GS1 check digit for the digits before it (GTIN-8, 12, 13, 14 and SSCC use the same rule). */
export function gs1CheckDigit(body: string): number {
  if (!/^\d+$/.test(body)) throw new Error('digits only');
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

/** A GTIN-8, GTIN-12 (UPC-A), GTIN-13 (EAN-13) or GTIN-14 with a correct check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === Number(code.slice(-1));
}

/** The barcode type a GTIN prints as. */
export function gtinType(code: string): 'ean8' | 'upca' | 'ean13' | 'code128' {
  return code.length === 8 ? 'ean8' : code.length === 12 ? 'upca' : code.length === 13 ? 'ean13' : 'code128';
}

/**
 * An in-store EAN-13: prefix (20-29 is GS1's range for restricted, in-store use, so these never
 * clash with a manufacturer's barcode), the sequence padded to 12 digits, then the check digit.
 */
export function ean13(prefix: string, sequence: number): string {
  const body = prefix + String(sequence).padStart(12 - prefix.length, '0');
  if (!/^\d{12}$/.test(body)) throw new Error(`The barcode prefix ${prefix} leaves no room for number ${sequence}`);
  return body + gs1CheckDigit(body);
}

/** P000123 style SKU. */
export function formatSku(prefix: string, padding: number, n: number): string {
  return `${prefix}${String(n).padStart(padding, '0')}`;
}

/** Why a sale quantity is not allowed (minimum order, sold in multiples), or null. */
export function quantityProblem(quantity: number, minQty: number | string | null | undefined, step: number | string | null | undefined, unit = ''): string | null {
  const min = Number(minQty ?? 0) || 0;
  const s = Number(step ?? 0) || 0;
  const u = unit ? ` ${unit}` : '';
  if (min > 0 && quantity < min) return `The minimum order is ${min}${u}`;
  if (s > 0) {
    const ratio = quantity / s;
    if (Math.abs(ratio - Math.round(ratio)) > 1e-6) return `Sold in multiples of ${s}${u}`;
  }
  return null;
}

export const PACKAGING_LEVELS = ['unit', 'inner', 'case', 'pallet', 'other'] as const;
export type PackagingLevel = (typeof PACKAGING_LEVELS)[number];

export interface PackagingInput {
  name: string;
  level?: PackagingLevel;
  quantity: number;
  gtin?: string | null;
}

/** A packaging list's own problems: names and GTINs unique, GTINs valid, quantity above zero. */
export function packagingProblem(list: PackagingInput[]): string | null {
  const names = new Set<string>();
  const gtins = new Set<string>();
  for (const p of list) {
    const name = p.name.trim().toLowerCase();
    if (!name) return 'Every packaging needs a name';
    if (names.has(name)) return `The packaging "${p.name.trim()}" is listed twice`;
    names.add(name);
    if (!(Number(p.quantity) > 0)) return `Enter how many units are in "${p.name.trim()}"`;
    if (p.gtin) {
      if (!isValidGtin(p.gtin)) return `${p.gtin} is not a valid GTIN (8, 12, 13 or 14 digits with the right check digit)`;
      if (gtins.has(p.gtin)) return `The GTIN ${p.gtin} is listed twice`;
      gtins.add(p.gtin);
    }
  }
  return null;
}

export const COMPOSITIONS = ['single', 'kit', 'combo'] as const;
export type Composition = (typeof COMPOSITIONS)[number];

export interface ComponentInput {
  component_id: string;
  quantity: number;
}

export interface ComboGroupInput {
  name: string;
  min_choices: number;
  max_choices: number;
  choices: { component_id: string; quantity?: number; extra_price?: number; is_default?: boolean }[];
}

/** A kit's or combo's own problems (the service checks the products themselves). */
export function compositionProblem(productId: string, composition: Composition, components: ComponentInput[], groups: ComboGroupInput[]): string | null {
  if (composition === 'single') return null;
  if (composition === 'kit') {
    if (!components.length) return 'Add the products that make up the kit';
    if (groups.length) return 'A kit has components, not choice groups';
    const seen = new Set<string>();
    for (const c of components) {
      if (c.component_id === productId) return 'A kit cannot contain itself';
      if (seen.has(c.component_id)) return 'A product is listed twice in the kit; change its quantity instead';
      seen.add(c.component_id);
      if (!(Number(c.quantity) > 0)) return 'Every component needs a quantity above 0';
    }
    return null;
  }
  if (!groups.length) return 'Add at least one choice group (for example "Main", "Drink")';
  if (components.length) return 'A combo has choice groups, not fixed components';
  const names = new Set<string>();
  for (const g of groups) {
    const name = g.name.trim();
    if (!name) return 'Every choice group needs a name';
    if (names.has(name.toLowerCase())) return `The group "${name}" is listed twice`;
    names.add(name.toLowerCase());
    if (!g.choices.length) return `Add the choices for "${name}"`;
    if (g.min_choices < 0 || g.max_choices < 1 || g.min_choices > g.max_choices) return `In "${name}" the minimum must be between 0 and the maximum, and the maximum at least 1`;
    if (g.max_choices > g.choices.length) return `"${name}" allows ${g.max_choices} choices but has only ${g.choices.length}`;
    const seen = new Set<string>();
    for (const c of g.choices) {
      if (c.component_id === productId) return 'A combo cannot offer itself';
      if (seen.has(c.component_id)) return `A product is listed twice in "${name}"`;
      seen.add(c.component_id);
      if (c.quantity !== undefined && !(Number(c.quantity) > 0)) return `Every choice in "${name}" needs a quantity above 0`;
      if (c.extra_price !== undefined && Number(c.extra_price) < 0) return `An extra price in "${name}" cannot be negative`;
    }
    if (g.choices.filter((c) => c.is_default).length > g.max_choices) return `"${name}" has more default choices than it allows`;
  }
  return null;
}

/** Margin in % of the sales price, rounded to 0.1; null when there is no price or cost. */
export function marginPercent(sales: number | string, cost: number | string): number | null {
  const s = Number(sales) || 0;
  const c = Number(cost) || 0;
  if (s <= 0 || c <= 0) return null;
  return Math.round(((s - c) / s) * 1000) / 10;
}

/**
 * Catalog data-quality checks, as SQL on products p joined to uoms u (the base unit).
 * Used by the Products list filter (?issue=) and Product Reports. Sellable products only.
 */
export const ISSUE_SQL = {
  no_barcode: `(p.product_type <> 'service' AND NOT EXISTS (SELECT 1 FROM product_barcodes ib WHERE ib.product_id = p.id)
                AND NOT EXISTS (SELECT 1 FROM product_packagings ipk WHERE ipk.product_id = p.id AND ipk.is_active AND ipk.gtin IS NOT NULL))`,
  no_price: `(p.can_be_sold AND p.sales_price = 0 AND p.composition <> 'combo')`,
  no_cost: `(p.product_type <> 'service' AND p.cost_price = 0 AND p.composition = 'single')`,
  below_cost: `(p.sales_price > 0 AND p.cost_price > p.sales_price)`,
  no_category: `(p.category_id IS NULL)`,
  no_image: `(p.image_url IS NULL OR btrim(p.image_url) = '')`,
  not_eims_ready: `NOT (u.mor_code IS NOT NULL AND length(COALESCE(NULLIF(btrim(p.invoice_description), ''), p.name)) <= 100)`,
} as const;
export type CatalogIssue = keyof typeof ISSUE_SQL;
export const CATALOG_ISSUES = Object.keys(ISSUE_SQL) as CatalogIssue[];

export const ISSUE_LABELS: Record<CatalogIssue, string> = {
  no_barcode: 'No barcode',
  no_price: 'No sales price',
  no_cost: 'No cost',
  below_cost: 'Priced below cost',
  no_category: 'No category',
  no_image: 'No image',
  not_eims_ready: 'Not ready for e-invoicing',
};

/** Margin bands for the reports chart. */
export const MARGIN_BANDS = [
  { key: 'negative', label: 'Below cost', max: 0 },
  { key: 'low', label: '0–10%', max: 10 },
  { key: 'fair', label: '10–25%', max: 25 },
  { key: 'good', label: '25–50%', max: 50 },
  { key: 'high', label: 'Over 50%', max: Infinity },
] as const;

export function marginBand(m: number): (typeof MARGIN_BANDS)[number]['key'] {
  for (const b of MARGIN_BANDS) if (m < b.max || b.max === Infinity) return b.key;
  return 'high';
}

/** What a gallery or attachment file really is, from its first bytes (the name can lie). */
export function sniffFile(buf: Buffer, ext: string): { kind: 'image' | 'document'; mime: string } | null {
  const b = (i: number) => buf[i];
  if (buf.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { kind: 'image', mime: 'image/jpeg' };
  if (buf.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return { kind: 'image', mime: 'image/png' };
  if (buf.length >= 6 && buf.subarray(0, 6).toString('latin1').startsWith('GIF8')) return { kind: 'image', mime: 'image/gif' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { kind: 'image', mime: 'image/webp' };
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { kind: 'document', mime: 'application/pdf' };
  if (buf.length >= 4 && b(0) === 0x50 && b(1) === 0x4b && b(2) === 0x03 && b(3) === 0x04) {
    const office: Record<string, string> = {
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    return office[ext] ? { kind: 'document', mime: office[ext] } : null;
  }
  if (buf.length >= 4 && b(0) === 0xd0 && b(1) === 0xcf && b(2) === 0x11 && b(3) === 0xe0) {
    const legacy: Record<string, string> = { '.doc': 'application/msword', '.xls': 'application/vnd.ms-excel' };
    return legacy[ext] ? { kind: 'document', mime: legacy[ext] } : null;
  }
  if ((ext === '.txt' || ext === '.csv') && !buf.includes(0)) return { kind: 'document', mime: ext === '.csv' ? 'text/csv' : 'text/plain' };
  return null;
}
