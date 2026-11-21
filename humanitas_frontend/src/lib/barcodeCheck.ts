/**
 * Guards against camera misreads. A camera decoder can return a wrong code from a blurry or
 * partial frame (a few wrong digits, or an EAN read as a short ITF code). We only accept a
 * code that passes its format's check digit and that the camera reads the same way twice in a row.
 */

/** GS1 check digit (EAN-8, UPC-A, EAN-13, ITF-14): the last digit must match the others. */
export function gs1CheckDigitOk(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // From the right, weights alternate 3, 1, 3, 1 …
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

/** Expands an 8-digit UPC-E code to its 12-digit UPC-A form (null if it is not a valid UPC-E). */
export function upcEToUpcA(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0];
  const d = code.slice(1, 7);
  const check = code[7];
  const last = d[5];
  let body: string;
  if (last <= '2') body = d.slice(0, 2) + last + '0000' + d.slice(2, 5);
  else if (last === '3') body = d.slice(0, 3) + '00000' + d.slice(3, 5);
  else if (last === '4') body = d.slice(0, 4) + '00000' + d[4];
  else body = d.slice(0, 5) + '0000' + last;
  return ns + body + check;
}

/** True when a code read by the camera is believable for the format the decoder reported. */
export function isPlausibleRead(code: string, formatName?: string | null): boolean {
  if (!code) return false;
  const format = (formatName ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  switch (format) {
    case 'EAN13':
      return /^\d{13}$/.test(code) && gs1CheckDigitOk(code);
    case 'EAN8':
      return /^\d{8}$/.test(code) && gs1CheckDigitOk(code);
    case 'UPCA':
      return /^\d{12}$/.test(code) && gs1CheckDigitOk(code);
    case 'UPCE': {
      const upcA = upcEToUpcA(code);
      return upcA !== null && gs1CheckDigitOk(upcA);
    }
    case 'ITF':
      // Partial EAN reads often come back as short ITF codes.
      return /^\d+$/.test(code) && code.length % 2 === 0 && code.length >= 6 && (code.length !== 14 || gs1CheckDigitOk(code));
    case 'CODE39':
    case 'CODE128':
      return code.length >= 3;
    case 'QRCODE':
      return true;
    default:
      // Unknown format: still check digits when it looks like a retail code.
      if (/^\d{8}$|^\d{12,13}$/.test(code)) return gs1CheckDigitOk(code);
      return true;
  }
}

/**
 * Accepts a code only after it has been read the same way `required` times in a row,
 * each read within `windowMs` of the previous one. A different code starts over.
 */
export class ReadConfirmer {
  private last: string | null = null;
  private count = 0;
  private at = 0;
  private readonly required: number;
  private readonly windowMs: number;

  constructor(required = 2, windowMs = 1500) {
    this.required = required;
    this.windowMs = windowMs;
  }

  /** Returns the code once it is confirmed, otherwise null. */
  push(code: string, now = Date.now()): string | null {
    if (code === this.last && now - this.at <= this.windowMs) this.count += 1;
    else {
      this.last = code;
      this.count = 1;
    }
    this.at = now;
    return this.count >= this.required ? code : null;
  }

  reset(): void {
    this.last = null;
    this.count = 0;
    this.at = 0;
  }
}
