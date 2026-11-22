/**
 * Barcode drawing for printed labels (featureslist §1): EAN-13, EAN-8, UPC-A (printed as EAN-13)
 * and Code 128. Returns the bars as a string of modules, "1" = bar, "0" = space; QR codes are drawn
 * by qrcode.react. No outside service: labels print offline.
 */
import { gs1CheckDigitOk } from './barcodeCheck';

export type LinearFormat = 'ean13' | 'ean8' | 'code128';

/** Code 128 bar/space widths for symbol values 0-105, then the stop pattern (106). */
const C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
export const CODE128_PATTERNS: readonly string[] = C128;
const START_B = 104;
const START_C = 105;
const STOP = 106;

function widthsToModules(widths: string): string {
  let out = '';
  for (let i = 0; i < widths.length; i++) out += (i % 2 === 0 ? '1' : '0').repeat(Number(widths[i]));
  return out;
}

/** Code 128 symbol values (start, data, checksum, stop). Digits-only text of even length uses set C. */
export function code128Values(text: string): number[] | null {
  if (!text) return null;
  const values: number[] = [];
  if (/^\d+$/.test(text) && text.length % 2 === 0) {
    values.push(START_C);
    for (let i = 0; i < text.length; i += 2) values.push(Number(text.slice(i, i + 2)));
  } else {
    values.push(START_B);
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code < 32 || code > 126) return null;
      values.push(code - 32);
    }
  }
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103, STOP);
  return values;
}

export function code128Modules(text: string): string | null {
  const values = code128Values(text);
  return values ? values.map((v) => widthsToModules(C128[v])).join('') : null;
}

/** EAN left-hand odd-parity (L) patterns; R is L inverted and G is R reversed. */
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((p) => p.replace(/./g, (b) => (b === '1' ? '0' : '1')));
const G = R.map((p) => p.split('').reverse().join(''));
/** EAN-13: the first digit is not drawn; it sets which of the next six digits use G instead of L. */
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function ean13Modules(code: string): string | null {
  if (!/^\d{13}$/.test(code) || !gs1CheckDigitOk(code)) return null;
  const d = code.split('').map(Number);
  const parity = PARITY[d[0]];
  let out = '101';
  for (let i = 1; i <= 6; i++) out += (parity[i - 1] === 'L' ? L : G)[d[i]];
  out += '01010';
  for (let i = 7; i <= 12; i++) out += R[d[i]];
  return out + '101';
}

export function ean8Modules(code: string): string | null {
  if (!/^\d{8}$/.test(code) || !gs1CheckDigitOk(code)) return null;
  const d = code.split('').map(Number);
  let out = '101';
  for (let i = 0; i < 4; i++) out += L[d[i]];
  out += '01010';
  for (let i = 4; i < 8; i++) out += R[d[i]];
  return out + '101';
}

/** Which barcode a label prints for a code: retail codes as EAN, anything else as Code 128. */
export function chooseFormat(
  code: string,
  wanted: 'auto' | 'code128' | 'ean13' | 'qr' | 'none',
): { format: LinearFormat | 'qr'; value: string } | null {
  const v = code.trim();
  if (!v || wanted === 'none') return null;
  if (wanted === 'qr') return { format: 'qr', value: v };
  const ean = /^\d{13}$/.test(v) && gs1CheckDigitOk(v) ? v : /^\d{12}$/.test(v) && gs1CheckDigitOk(v) ? `0${v}` : null;
  if (wanted === 'ean13' || wanted === 'auto') {
    if (ean) return { format: 'ean13', value: ean };
    if (wanted === 'auto' && /^\d{8}$/.test(v) && gs1CheckDigitOk(v)) return { format: 'ean8', value: v };
  }
  return code128Values(v) ? { format: 'code128', value: v } : { format: 'qr', value: v };
}

export function modulesFor(format: LinearFormat, value: string): string | null {
  if (format === 'ean13') return ean13Modules(value);
  if (format === 'ean8') return ean8Modules(value);
  return code128Modules(value);
}
