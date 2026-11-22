import { BarcodeSvg } from './BarcodeSvg';
import type { LabelData, LabelTemplate } from '@/lib/labels';

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One label at its real size in millimetres; the same element is previewed and printed. */
export function ProductLabel({ label, template: t, currency, company }: { label: LabelData; template: LabelTemplate; currency: string; company?: string | null }) {
  const font = Number(t.font_size_pt) || 8;
  return (
    <div
      className="flex flex-col overflow-hidden bg-white text-black"
      style={{ width: `${Number(t.label_width_mm)}mm`, height: `${Number(t.label_height_mm)}mm`, padding: '1.5mm', fontSize: `${font}pt`, lineHeight: 1.15, boxSizing: 'border-box' }}
    >
      {t.show_company && company && <div className="truncate" style={{ fontSize: `${font * 0.8}pt` }}>{company}</div>}
      {t.show_name && <div className="line-clamp-2 font-semibold">{label.name}</div>}
      {t.show_variant && label.variant && <div className="truncate">{label.variant}</div>}
      {t.show_sku && label.sku && <div className="truncate" style={{ fontSize: `${font * 0.85}pt` }}>SKU {label.sku}</div>}
      <div className="min-h-0 flex-1 py-[0.5mm]">
        <BarcodeSvg code={label.code} format={t.barcode_format} showText={t.show_barcode_text} fontSizePt={font} />
      </div>
      {t.show_price && label.price != null && (
        <div className="text-right font-bold" style={{ fontSize: `${font * 1.4}pt` }}>{money(label.price)} {currency}</div>
      )}
    </div>
  );
}
