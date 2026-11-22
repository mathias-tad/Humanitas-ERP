import { QRCodeSVG } from 'qrcode.react';
import { chooseFormat, modulesFor } from '@/lib/barcodes';
import type { LabelBarcodeFormat } from '@/lib/labels';

/**
 * A barcode drawn as SVG so it prints sharp at any size. EAN codes keep their digits under the
 * bars; Code 128 and QR print the code as text below when `showText` is on.
 */
export function BarcodeSvg({ code, format, showText, fontSizePt }: { code: string; format: LabelBarcodeFormat; showText: boolean; fontSizePt: number }) {
  const choice = chooseFormat(code, format);
  if (!choice) return null;
  if (choice.format === 'qr') {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center">
        <QRCodeSVG value={choice.value} level="M" marginSize={0} style={{ height: '100%', width: 'auto', maxWidth: '100%' }} />
        {showText && <span style={{ fontSize: `${fontSizePt * 0.8}pt` }} className="leading-none">{choice.value}</span>}
      </div>
    );
  }
  const modules = modulesFor(choice.format, choice.value);
  if (!modules) return null;
  const quiet = choice.format === 'code128' ? 10 : 7;
  const total = modules.length + quiet * 2;
  const bars: { x: number; w: number }[] = [];
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] !== '1') continue;
    let w = 1;
    while (modules[i + w] === '1') w++;
    bars.push({ x: quiet + i, w });
    i += w - 1;
  }
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-stretch">
      <svg viewBox={`0 0 ${total} 50`} preserveAspectRatio="none" className="min-h-0 w-full flex-1" role="img" aria-label={`Barcode ${choice.value}`}>
        {bars.map((b) => <rect key={b.x} x={b.x} y={0} width={b.w} height={50} fill="#000" shapeRendering="crispEdges" />)}
      </svg>
      {showText && (
        <span className="text-center font-mono leading-none tracking-wider" style={{ fontSize: `${fontSizePt * 0.85}pt` }}>{choice.value}</span>
      )}
    </div>
  );
}
