import { describe, expect, it } from 'vitest';
import { dealHealth } from './useCrm';

describe('deal card colours', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  const deal = (over: Record<string, unknown> = {}) => ({
    status: 'open' as const, expected_close_date: '2026-12-31', next_activity_at: '2026-11-25T09:00:00Z', is_stuck: false, ...over,
  });
  it('tells won, lost, late, needs attention and on track apart', () => {
    expect(dealHealth(deal(), now)).toBe('on_track');
    expect(dealHealth(deal({ status: 'won' }), now)).toBe('won');
    expect(dealHealth(deal({ status: 'lost' }), now)).toBe('lost');
    expect(dealHealth(deal({ next_activity_at: '2026-11-20T09:00:00Z' }), now)).toBe('late');
    expect(dealHealth(deal({ expected_close_date: '2026-11-01' }), now)).toBe('late');
    expect(dealHealth(deal({ next_activity_at: null }), now)).toBe('attention');
    expect(dealHealth(deal({ is_stuck: true }), now)).toBe('attention');
  });
});
