/** Barcode and price labels (featureslist §1): template layout and the labels to print. */
import type { Product } from '@/hooks/useProducts';

export type LabelLayoutKind = 'roll' | 'sheet';
export type LabelBarcodeFormat = 'auto' | 'code128' | 'ean13' | 'qr' | 'none';

export interface LabelTemplate {
  id: string;
  name: string;
  layout: LabelLayoutKind;
  label_width_mm: string | number;
  label_height_mm: string | number;
  page_width_mm: string | number;
  page_height_mm: string | number;
  columns: number;
  rows: number;
  margin_top_mm: string | number;
  margin_left_mm: string | number;
  gap_x_mm: string | number;
  gap_y_mm: string | number;
  barcode_format: LabelBarcodeFormat;
  show_name: boolean;
  show_variant: boolean;
  show_sku: boolean;
  show_price: boolean;
  show_barcode_text: boolean;
  show_company: boolean;
  font_size_pt: string | number;
  price_list_id: string | null;
  company_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export type LabelTemplateInput = Partial<Omit<LabelTemplate, 'id'>>;

/** A new template: a 50 × 25 mm roll label (same as the server's defaults). */
export const NEW_TEMPLATE: Omit<LabelTemplate, 'id' | 'name' | 'company_id' | 'sort_order' | 'is_active'> = {
  layout: 'roll', label_width_mm: 50, label_height_mm: 25, page_width_mm: 210, page_height_mm: 297, columns: 1, rows: 1,
  margin_top_mm: 0, margin_left_mm: 0, gap_x_mm: 0, gap_y_mm: 0, barcode_format: 'auto', show_name: true, show_variant: true,
  show_sku: false, show_price: true, show_barcode_text: true, show_company: false, font_size_pt: 8, price_list_id: null,
};

const mm = (n: number) => String(Math.round(n * 100) / 100);

/** Why the labels do not fit, or null (the same check as the server's label-templates.layout.ts). */
export function layoutProblem(t: Pick<LabelTemplate, 'layout' | 'label_width_mm' | 'label_height_mm' | 'page_width_mm' | 'page_height_mm' | 'columns' | 'rows' | 'margin_top_mm' | 'margin_left_mm' | 'gap_x_mm' | 'gap_y_mm'>): string | null {
  const w = Number(t.label_width_mm);
  const h = Number(t.label_height_mm);
  if (!(w >= 10 && w <= 300) || !(h >= 10 && h <= 300)) return 'A label is 10 to 300 mm wide and high';
  if (t.layout === 'roll') return null;
  const pw = Number(t.page_width_mm);
  const ph = Number(t.page_height_mm);
  const cols = Number(t.columns);
  const rows = Number(t.rows);
  const [ml, mt, gx, gy] = [t.margin_left_mm, t.margin_top_mm, t.gap_x_mm, t.gap_y_mm].map(Number);
  if (!(pw >= 20 && pw <= 600) || !(ph >= 20 && ph <= 600)) return 'A page is 20 to 600 mm wide and high';
  if (!Number.isInteger(cols) || cols < 1 || cols > 20 || !Number.isInteger(rows) || rows < 1 || rows > 40) {
    return 'A sheet has 1 to 20 columns and 1 to 40 rows';
  }
  if ([ml, mt, gx, gy].some((v) => !(v >= 0 && v <= 100))) return 'Margins and gaps are 0 to 100 mm';
  const usedW = ml + cols * w + (cols - 1) * gx;
  if (usedW > pw + 0.01) {
    return `${cols} labels of ${mm(w)} mm with ${mm(gx)} mm gaps and a ${mm(ml)} mm margin need ${mm(usedW)} mm; the page is ${mm(pw)} mm wide`;
  }
  const usedH = mt + rows * h + (rows - 1) * gy;
  if (usedH > ph + 0.01) {
    return `${rows} rows of ${mm(h)} mm with ${mm(gy)} mm gaps and a ${mm(mt)} mm margin need ${mm(usedH)} mm; the page is ${mm(ph)} mm high`;
  }
  return null;
}

/** One product on the print list. */
export interface LabelItem {
  product: Product;
  copies: number;
}

/** What one printed label shows. */
export interface LabelData {
  key: string;
  name: string;
  variant: string | null;
  sku: string | null;
  /** The code drawn as the barcode: the primary barcode, else the item code. */
  code: string;
  price: number | null;
}

/** Most labels one print run makes (a full roll is rarely more). */
export const MAX_LABELS = 2000;

/** The barcode a product's labels carry: its primary barcode, else its first, else its item code. */
export function labelCode(p: Product): string {
  const primary = p.barcodes?.find((b) => b.is_primary) ?? p.barcodes?.[0];
  return primary?.barcode || p.item_code || p.sku || p.id;
}

/** A variant is labelled with its parent's name and its own values ("T-shirt", "Red, M"). */
export function labelNames(p: Product): { name: string; variant: string | null } {
  if (p.parent_id && p.variant_label) return { name: p.parent_name ?? p.name, variant: p.variant_label };
  return { name: p.name, variant: null };
}

/** Every label to print, copies included, in list order (at most MAX_LABELS). */
export function expandLabels(items: LabelItem[], prices: Record<string, number> | undefined): LabelData[] {
  const out: LabelData[] = [];
  for (const { product: p, copies } of items) {
    const n = Math.max(0, Math.floor(copies));
    const { name, variant } = labelNames(p);
    const price = prices?.[p.id] ?? (p.sales_price != null && p.sales_price !== '' ? Number(p.sales_price) : null);
    for (let i = 0; i < n && out.length < MAX_LABELS; i++) {
      out.push({ key: `${p.id}-${i}`, name, variant, sku: p.sku, code: labelCode(p), price });
    }
  }
  return out;
}

/** Labels per page: one on a roll, columns × rows on a sheet. */
export function labelsPerPage(t: Pick<LabelTemplate, 'layout' | 'columns' | 'rows'>): number {
  return t.layout === 'roll' ? 1 : Math.max(1, Number(t.columns)) * Math.max(1, Number(t.rows));
}

export function paginate<T>(labels: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < labels.length; i += perPage) pages.push(labels.slice(i, i + perPage));
  return pages;
}

/** Where label number `index` (0-based, on its page) sits on a sheet, in mm from the top-left corner. */
export function slotPosition(t: LabelTemplate, index: number): { left: number; top: number } {
  if (t.layout === 'roll') return { left: 0, top: 0 };
  const cols = Math.max(1, Number(t.columns));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    left: Number(t.margin_left_mm) + col * (Number(t.label_width_mm) + Number(t.gap_x_mm)),
    top: Number(t.margin_top_mm) + row * (Number(t.label_height_mm) + Number(t.gap_y_mm)),
  };
}

/** Page size the browser prints: the label itself on a roll, the sheet otherwise. */
export function pageSize(t: LabelTemplate): { width: number; height: number } {
  return t.layout === 'roll'
    ? { width: Number(t.label_width_mm), height: Number(t.label_height_mm) }
    : { width: Number(t.page_width_mm), height: Number(t.page_height_mm) };
}
