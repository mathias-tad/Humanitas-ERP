/**
 * MoR EIMS rules that apply to the product catalog (AGENTS.md rule 28, docs/eims/EIMS_REFERENCE.md).
 * Sales, POS and Invoicing read these fields from the product; they never guess them at send time.
 */

/** Line tax codes a product can carry, with their rate in %. Withholding codes are invoice-level only. */
export const EIMS_TAX_CODES = { VAT15: 15, VAT0: 0, VATEX: 0, TOT2: 2, TOT10: 10 } as const;
export type EimsTaxCode = keyof typeof EIMS_TAX_CODES;
export const EIMS_TAX_CODE_LIST = Object.keys(EIMS_TAX_CODES) as EimsTaxCode[];

/** MoR field limits for ItemList[] entries. */
export const EIMS_LIMITS = { itemCode: 15, description: 100, harmonizationCode: 15 } as const;

export const ITEM_CODE_PATTERN = /^[A-Za-z0-9._/-]{1,15}$/;
export const HS_CODE_PATTERN = /^[0-9A-Za-z.]{2,15}$/;

export type EimsIssue = 'item_code' | 'description' | 'unit' | 'tax_code';

export interface EimsProductFields {
  item_code?: string | null;
  name?: string | null;
  invoice_description?: string | null;
  tax_code?: string | null;
  uom_mor_code?: string | null;
}

/** The description MoR receives: the invoice description when set, otherwise the product name. */
export function eimsDescription(p: EimsProductFields): string {
  return (p.invoice_description?.trim() || p.name?.trim() || '');
}

/**
 * What would stop this product from being e-invoiced. Empty = ready.
 * - unit: the product's unit has no MoR code (MoR error 7023)
 * - description: longer than 100 characters; set a shorter invoice description
 * - item_code / tax_code: missing or invalid (MoR errors 7014 / 7024); the database normally prevents this
 */
export function eimsIssues(p: EimsProductFields): EimsIssue[] {
  const issues: EimsIssue[] = [];
  if (!p.item_code || !ITEM_CODE_PATTERN.test(p.item_code)) issues.push('item_code');
  const d = eimsDescription(p);
  if (!d || d.length > EIMS_LIMITS.description) issues.push('description');
  if (!p.uom_mor_code) issues.push('unit');
  if (!p.tax_code || !(p.tax_code in EIMS_TAX_CODES)) issues.push('tax_code');
  return issues;
}

/** Attach `eims_ready` and `eims_issues` to a product row from SELECT_PRODUCT. */
export function withEimsStatus<T extends EimsProductFields>(row: T): T & { eims_ready: boolean; eims_issues: EimsIssue[] } {
  const issues = eimsIssues(row);
  return { ...row, eims_ready: issues.length === 0, eims_issues: issues };
}

/** SQL condition matching e-invoice-ready rows (product alias p, sales unit alias u); mirrors eimsIssues(). */
export const EIMS_READY_SQL = `(u.mor_code IS NOT NULL AND length(COALESCE(NULLIF(btrim(p.invoice_description), ''), p.name)) <= ${EIMS_LIMITS.description})`;
