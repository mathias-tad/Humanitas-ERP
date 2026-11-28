import { describe, expect, it } from 'vitest';
import { countProgress, nextStep, varianceLabel } from './useStocktakes';

describe('stocktake helpers', () => {
  it('shows counting progress', () => {
    expect(countProgress(undefined).label).toBe('Nothing to count yet');
    expect(countProgress({ lines: 40, counted: 12 })).toEqual({ label: '12 of 40 counted (30%)', percent: 30 });
  });

  it('labels a difference with its sign, and nothing for an uncounted or hidden line', () => {
    expect(varianceLabel({ counted_qty: '8', variance: -2 })).toBe('−2');
    expect(varianceLabel({ counted_qty: '12', variance: 2.5 })).toBe('+2.5');
    expect(varianceLabel({ counted_qty: '5', variance: 0 })).toBe('0');
    expect(varianceLabel({ counted_qty: null, variance: 0 })).toBe('');
    expect(varianceLabel({ counted_qty: '5' })).toBe('');
  });

  it('names the next step of a count', () => {
    expect(nextStep('draft')).toBe('start');
    expect(nextStep('counting')).toBe('submit');
    expect(nextStep('review')).toBe('post');
    expect(nextStep('posted')).toBeNull();
  });
});
