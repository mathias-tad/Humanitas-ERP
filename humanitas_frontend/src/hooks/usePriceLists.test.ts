import { describe, expect, it } from 'vitest';
import { ruleInputProblem, rulePriceText, ruleTarget } from './usePriceLists';

describe('price list helpers', () => {
  it('describes rules in plain words', () => {
    expect(ruleTarget({ applies_to: 'product', product_name: 'T-shirt', category_name: null, product_has_variants: true })).toBe('T-shirt (all variants)');
    expect(ruleTarget({ applies_to: 'category', product_name: null, category_name: 'Grains', product_has_variants: null })).toBe('All of Grains');
    expect(ruleTarget({ applies_to: 'all', product_name: null, category_name: null, product_has_variants: null })).toBe('Every product');
    expect(rulePriceText({ compute: 'fixed', fixed_price: '95', percent: null })).toBe('95.00 ETB');
    expect(rulePriceText({ compute: 'discount', fixed_price: null, percent: '10.0000' })).toBe('10% off the sales price');
    expect(rulePriceText({ compute: 'markup', fixed_price: null, percent: '-5' })).toBe('cost − 5%');
  });

  it('checks a rule before sending it', () => {
    expect(ruleInputProblem({ applies_to: 'all', compute: 'discount', percent: 10 }, 'ETB')).toBeNull();
    expect(ruleInputProblem({ applies_to: 'product', compute: 'fixed', fixed_price: 5 }, 'ETB')).toMatch(/product/);
    expect(ruleInputProblem({ applies_to: 'all', compute: 'discount', percent: 101 }, 'ETB')).toMatch(/0 and 100/);
    expect(ruleInputProblem({ applies_to: 'all', compute: 'markup', percent: 10 }, 'USD')).toMatch(/fixed prices/);
    expect(ruleInputProblem({ applies_to: 'all', compute: 'fixed', fixed_price: 5, date_start: '2026-12-02', date_end: '2026-12-01' }, 'ETB')).toMatch(/end date/);
  });
});
