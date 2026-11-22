import { applyRule, inDateRange, priceFor, roundMoney, ruleProblem, type PriceRule, type PricedProduct } from './price-lists.pricing';

const product: PricedProduct = { id: 'v1', parent_id: 'p1', category_path: ['teff', 'grains', 'food'], sales_price: '120.00', cost_price: '80' };
let n = 0;
const rule = (over: Partial<PriceRule>): PriceRule => ({
  id: `r${++n}`, applies_to: 'all', product_id: null, category_id: null, min_quantity: 0, compute: 'discount',
  fixed_price: null, percent: 10, date_start: null, date_end: null, sort_order: 0, ...over,
});

describe('price list pricing', () => {
  it('uses the sales price when no rule applies', () => {
    expect(priceFor([], product)).toEqual({ price: 120, rule_id: null, source: 'base', base_price: 120 });
    expect(priceFor([rule({ applies_to: 'product', product_id: 'other' })], product).source).toBe('base');
  });

  it('prefers this variant, then its parent, then the nearest category, then every product', () => {
    const all = rule({ applies_to: 'all', percent: 5 });
    const food = rule({ applies_to: 'category', category_id: 'food', percent: 10 });
    const teff = rule({ applies_to: 'category', category_id: 'teff', percent: 15 });
    const parent = rule({ applies_to: 'product', product_id: 'p1', compute: 'fixed', fixed_price: 100 });
    const variant = rule({ applies_to: 'product', product_id: 'v1', compute: 'fixed', fixed_price: 99 });
    expect(priceFor([all, food, teff, parent, variant], product).rule_id).toBe(variant.id);
    expect(priceFor([all, food, teff, parent], product).price).toBe(100);
    expect(priceFor([all, food, teff], product).price).toBe(102);
    expect(priceFor([all, food], product).price).toBe(108);
    expect(priceFor([all], product).price).toBe(114);
  });

  it('applies the largest quantity break the line reaches', () => {
    const one = rule({ applies_to: 'product', product_id: 'v1', compute: 'fixed', fixed_price: 118 });
    const ten = rule({ applies_to: 'product', product_id: 'v1', compute: 'fixed', fixed_price: 110, min_quantity: 10 });
    const fifty = rule({ applies_to: 'product', product_id: 'v1', compute: 'fixed', fixed_price: 100, min_quantity: '50.0000' });
    expect(priceFor([one, ten, fifty], product, 9).price).toBe(118);
    expect(priceFor([one, ten, fifty], product, 10).price).toBe(110);
    expect(priceFor([one, ten, fifty], product, 75).price).toBe(100);
  });

  it('respects dates (inclusive), archived rules and sort order', () => {
    const promo = rule({ applies_to: 'all', percent: 50, date_start: '2026-12-01', date_end: '2026-12-31' });
    expect(priceFor([promo], product, 1, '2026-11-30').source).toBe('base');
    expect(priceFor([promo], product, 1, '2026-12-01').price).toBe(60);
    expect(priceFor([promo], product, 1, '2026-12-31T23:00:00Z').price).toBe(60);
    expect(priceFor([{ ...promo, is_active: false }], product, 1, '2026-12-10').source).toBe('base');
    const a = rule({ applies_to: 'all', percent: 1, sort_order: 2 });
    const b = rule({ applies_to: 'all', percent: 2, sort_order: 1 });
    expect(priceFor([a, b], product).rule_id).toBe(b.id);
    expect(inDateRange({ date_start: null, date_end: null }, '2030-01-01')).toBe(true);
  });

  it('computes fixed, discount and markup prices and rounds half-up once', () => {
    expect(applyRule(rule({ compute: 'markup', percent: 25 }), product)).toBe(100);
    expect(applyRule(rule({ compute: 'discount', percent: 100 }), product)).toBe(0);
    expect(applyRule(rule({ compute: 'fixed', fixed_price: '19.999' }), product)).toBe(20);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.345)).toBe(2.35);
  });

  it('explains what is wrong with a rule', () => {
    const ok = { applies_to: 'all' as const, product_id: null, category_id: null, compute: 'discount' as const, fixed_price: null, percent: 10, date_start: null, date_end: null };
    expect(ruleProblem(ok, 'ETB')).toBeNull();
    expect(ruleProblem({ ...ok, applies_to: 'product' }, 'ETB')).toMatch(/product/);
    expect(ruleProblem({ ...ok, percent: 120 }, 'ETB')).toMatch(/between 0 and 100/);
    expect(ruleProblem({ ...ok, compute: 'fixed' }, 'ETB')).toMatch(/price/);
    expect(ruleProblem(ok, 'USD')).toMatch(/fixed prices/);
    expect(ruleProblem({ ...ok, compute: 'fixed', fixed_price: 5 }, 'USD')).toBeNull();
    expect(ruleProblem({ ...ok, date_start: '2026-12-02', date_end: '2026-12-01' }, 'ETB')).toMatch(/end date/);
  });
});
