/** Label templates (featureslist §1): label size, page layout and what each label shows. */
export const LABEL_LAYOUTS = ['roll', 'sheet'] as const;
export type LabelLayoutKind = (typeof LABEL_LAYOUTS)[number];

/** auto: EAN-13 / EAN-8 / UPC-A when the barcode is one (check digit valid), otherwise Code 128. */
export const BARCODE_FORMATS = ['auto', 'code128', 'ean13', 'qr', 'none'] as const;
export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

export interface LabelLayout {
  layout: LabelLayoutKind;
  label_width_mm: number | string;
  label_height_mm: number | string;
  page_width_mm: number | string;
  page_height_mm: number | string;
  columns: number | string;
  rows: number | string;
  margin_top_mm: number | string;
  margin_left_mm: number | string;
  gap_x_mm: number | string;
  gap_y_mm: number | string;
}

const mm = (n: number) => String(Math.round(n * 100) / 100);

/**
 * Why these labels do not fit, or null. A roll prints one label per page (the label printer's
 * page is the label); a sheet (A4 sticker sheets) holds columns × rows labels.
 */
export function layoutProblem(t: LabelLayout): string | null {
  const w = Number(t.label_width_mm);
  const h = Number(t.label_height_mm);
  if (!(w >= 10 && w <= 300) || !(h >= 10 && h <= 300)) return 'A label is 10 to 300 mm wide and high';
  if (t.layout === 'roll') return null;
  const pw = Number(t.page_width_mm);
  const ph = Number(t.page_height_mm);
  const cols = Number(t.columns);
  const rows = Number(t.rows);
  const ml = Number(t.margin_left_mm);
  const mt = Number(t.margin_top_mm);
  const gx = Number(t.gap_x_mm);
  const gy = Number(t.gap_y_mm);
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
