import { activityBucket, dealProbability, forecastByMonth, leadStatusProblem, stuck, weighted } from './crm.rules';

describe('CRM rules', () => {
  it('moves leads only along allowed statuses', () => {
    expect(leadStatusProblem('new', 'contacted')).toBeNull();
    expect(leadStatusProblem('lost', 'new')).toBeNull();
    expect(leadStatusProblem('new', 'converted')).toMatch(/Convert/);
    expect(leadStatusProblem('qualified', 'lost')).toMatch(/reason/);
    expect(leadStatusProblem('converted', 'new')).toMatch(/converted/);
  });

  it('uses the deal probability, else the stage one, and weights revenue', () => {
    expect(dealProbability({ probability: null }, { probability: 25 })).toBe(25);
    expect(dealProbability({ probability: '60' }, { probability: 25 })).toBe(60);
    expect(weighted('10000.00', 25)).toBe(2500);
    expect(weighted(333.33, 50)).toBe(166.67);
  });

  it('forecasts by expected close month, deals without a date last', () => {
    const r = forecastByMonth([
      { expected_close_date: '2026-12-20', expected_revenue: 1000, probability: 50 },
      { expected_close_date: null, expected_revenue: 400, probability: 10 },
      { expected_close_date: '2026-11-03', expected_revenue: '2000', probability: 25 },
      { expected_close_date: '2026-12-01', expected_revenue: 500, probability: 100 },
    ]);
    expect(r).toEqual([
      { month: '2026-11', count: 1, revenue: 2000, weighted: 500 },
      { month: '2026-12', count: 2, revenue: 1500, weighted: 1000 },
      { month: 'none', count: 1, revenue: 400, weighted: 40 },
    ]);
  });

  it('shows a deal as stuck after the stage allows', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(stuck('2026-11-10T12:00:00Z', 7, now)).toEqual({ days: 12, stuck: true });
    expect(stuck('2026-11-20T12:00:00Z', 7, now)).toEqual({ days: 2, stuck: false });
    expect(stuck('2026-01-01T00:00:00Z', null, now).stuck).toBe(false);
  });

  it('sorts activities into overdue, today, upcoming and done', () => {
    const now = new Date(2026, 10, 22, 10, 0);
    expect(activityBucket({ due_at: new Date(2026, 10, 21, 16, 0), done_at: null }, now)).toBe('overdue');
    expect(activityBucket({ due_at: new Date(2026, 10, 22, 8, 0), done_at: null }, now)).toBe('today');
    expect(activityBucket({ due_at: new Date(2026, 10, 22, 15, 0), done_at: null }, now)).toBe('today');
    expect(activityBucket({ due_at: new Date(2026, 10, 23, 9, 0), done_at: null }, now)).toBe('upcoming');
    expect(activityBucket({ due_at: new Date(2026, 10, 20, 9, 0), done_at: new Date() }, now)).toBe('done');
  });
});
