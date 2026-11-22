/** Checks and helpers for contacts (pure, tested in contacts.rules.spec.ts). */

/** Ethiopian TIN: 10 digits (spaces and dashes are ignored). Returns the digits, null for empty, or throws text. */
export function normalizeTin(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/[\s-]/g, '');
  if (!digits) return null;
  if (!/^\d{10}$/.test(digits)) throw new Error('A TIN is 10 digits');
  return digits;
}

/** Phone numbers compared by digits only, Ethiopian numbers in their +251 form (0911…, 911…, +251911… are the same). */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = `251${d.slice(1)}`;
  else if (d.length === 9 && /^[79]/.test(d)) d = `251${d}`;
  return d;
}

export function emailKey(raw: string | null | undefined): string | null {
  const e = (raw ?? '').trim().toLowerCase();
  return e || null;
}

/** Tags: trimmed, no empty or repeated ones (case-insensitive), at most 20 of up to 40 characters. */
export function cleanTags(tags: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags ?? []) {
    const v = String(t).trim().slice(0, 40);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length === 20) break;
  }
  return out;
}

export interface DuplicateCandidate {
  id: string;
  code: string;
  name: string;
  tin: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
}

/** Why an existing contact looks like the same one (same TIN, phone or email), or null. */
export function duplicateReason(
  input: { tin?: string | null; phone?: string | null; mobile?: string | null; email?: string | null },
  c: DuplicateCandidate,
): string | null {
  if (input.tin && c.tin && input.tin === c.tin) return 'same TIN';
  const mine = [phoneKey(input.phone), phoneKey(input.mobile)].filter(Boolean);
  const theirs = [phoneKey(c.phone), phoneKey(c.mobile)].filter(Boolean);
  if (mine.some((p) => theirs.includes(p))) return 'same phone';
  if (emailKey(input.email) && emailKey(input.email) === emailKey(c.email)) return 'same email';
  return null;
}
