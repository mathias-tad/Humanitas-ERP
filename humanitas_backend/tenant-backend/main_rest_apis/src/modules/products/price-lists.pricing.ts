/**
 * Which price a product gets on a price list (featureslist §1). Pure: the service loads the
 * rules and the product, this decides. Sales, POS and the online store all ask here.
 *
 * Rule order: the most specific rule wins (this variant > its parent product > the product's
 * category, nearest first > every product), then the highest minimum quantity that the line
 * reaches, then the lowest sort order. No rule: the product's own sales price.
 */

export type RuleScope = 'product' | 'category' | 'all';
export type RuleCompute = 'fixed' | 'discount' | 'markup';

export interface PriceRule {
  id: string;
  applies_to: RuleScope;
  product_id: string | null;
  category_id: string | null;
  min_quantity: number | string;
  compute: RuleCompute;
  fixed_price: number | string | null;
  percent: number | string | null;
  date_start: string | null;
  date_end: string | null;
  sort_order: number;
  is_active?: boolean;
}

export interface PricedProduct {
  id: string;
  parent_id: string | null;
  /** The product's category first, then its parent categories up to the root. */
  category_path: string[];
  sales_price: number | string;
  cost_price: number | string;
}

export interface PriceResult {
  price: number;
  rule_id: string | null;
  /** 'rule' when a rule set the price, 'base' when the product's sales price applies. */
  source: 'rule' | 'base';
  base_price: number;
}

/** Money is rounded once, half-up, to 2 decimals (AGENTS.md rule 24 item 7). */
export function roundMoney(v: number): number {
  return Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
}

/** 0 = the rule does not apply to this product. */
export function specificity(rule: PriceRule, p: PricedProduct): number {
  if (rule.applies_to === 'product') {
    if (rule.product_id === p.id) return 1000;
    if (p.parent_id && rule.product_id === p.parent_id) return 900;
    return 0;
  }
  if (rule.applies_to === 'category') {
    const i = rule.category_id ? p.category_path.indexOf(rule.category_id) : -1;
    return i < 0 ? 0 : 500 - i;
  }
  return 1;
}

/** Dates are YYYY-MM-DD; both ends inclusive. */
export function inDateRange(rule: Pick<PriceRule, 'date_start' | 'date_end'>, day: string): boolean {
  const d = day.slice(0, 10);
  if (rule.date_start && d < String(rule.date_start).slice(0, 10)) return false;
  if (rule.date_end && d > String(rule.date_end).slice(0, 10)) return false;
  return true;
}

export function applyRule(rule: PriceRule, p: PricedProduct): number {
  const sales = Number(p.sales_price) || 0;
  const cost = Number(p.cost_price) || 0;
  const pct = Number(rule.percent ?? 0);
  if (rule.compute === 'fixed') return roundMoney(Number(rule.fixed_price ?? 0));
  if (rule.compute === 'discount') return roundMoney(Math.max(0, sales * (1 - pct / 100)));
  return roundMoney(Math.max(0, cost * (1 + pct / 100)));
}

export function pickRule(rules: PriceRule[], p: PricedProduct, quantity: number, day: string): PriceRule | null {
  let best: { r: PriceRule; spec: number } | null = null;
  for (const r of rules) {
    if (r.is_active === false) continue;
    const spec = specificity(r, p);
    if (!spec || Number(r.min_quantity) > quantity || !inDateRange(r, day)) continue;
    if (
      !best ||
      spec > best.spec ||
      (spec === best.spec && Number(r.min_quantity) > Number(best.r.min_quantity)) ||
      (spec === best.spec && Number(r.min_quantity) === Number(best.r.min_quantity) && r.sort_order < best.r.sort_order)
    ) {
      best = { r, spec };
    }
  }
  return best?.r ?? null;
}

export function priceFor(rules: PriceRule[], p: PricedProduct, quantity = 1, day = new Date().toISOString().slice(0, 10)): PriceResult {
  const base = roundMoney(Number(p.sales_price) || 0);
  const rule = pickRule(rules, p, quantity, day);
  if (!rule) return { price: base, rule_id: null, source: 'base', base_price: base };
  return { price: applyRule(rule, p), rule_id: rule.id, source: 'rule', base_price: base };
}

/** A rule's own consistency (the database checks it again). Returns a message or null. */
export function ruleProblem(
  r: Pick<PriceRule, 'applies_to' | 'product_id' | 'category_id' | 'compute' | 'fixed_price' | 'percent' | 'date_start' | 'date_end'>,
  listCurrency: string,
  baseCurrency = 'ETB',
): string | null {
  if (r.applies_to === 'product' && !r.product_id) return 'Choose the product this rule is for';
  if (r.applies_to === 'category' && !r.category_id) return 'Choose the category this rule is for';
  if (r.compute === 'fixed' && (r.fixed_price === null || r.fixed_price === undefined || Number(r.fixed_price) < 0)) return 'Enter a price of 0 or more';
  if (r.compute !== 'fixed') {
    const pct = Number(r.percent);
    if (r.percent === null || r.percent === undefined || Number.isNaN(pct)) return 'Enter a percentage';
    if (r.compute === 'discount' && (pct < 0 || pct > 100)) return 'A discount is between 0 and 100%';
    if (r.compute === 'markup' && (pct < -100 || pct > 1000)) return 'A markup is between -100% and 1000%';
    // Product prices are in the base currency; other currencies need exchange rates (Accounting).
    if (listCurrency !== baseCurrency) return `In a ${listCurrency} price list, set fixed prices (exchange rates come with Accounting)`;
  }
  if (r.date_start && r.date_end && String(r.date_end) < String(r.date_start)) return 'The end date is before the start date';
  return null;
}
