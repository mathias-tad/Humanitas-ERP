import { clientIp, SlidingWindowLimiter, slugProblem, suggestSlug } from './signup-rules';

describe('slugProblem', () => {
  it('accepts a normal organization ID', () => {
    expect(slugProblem('abebe-trading')).toBeNull();
    expect(slugProblem('shop24')).toBeNull();
  });
  it('explains what is wrong', () => {
    expect(slugProblem('')).toMatch(/Enter/);
    expect(slugProblem('ab')).toMatch(/at least 3/);
    expect(slugProblem('Abebe')).toMatch(/lowercase/);
    expect(slugProblem('-abc')).toMatch(/Hyphens/);
    expect(slugProblem('a--b')).toMatch(/Hyphens/);
    expect(slugProblem('12345')).toMatch(/letter/);
    expect(slugProblem('admin')).toMatch(/reserved/);
    expect(slugProblem('x'.repeat(41))).toMatch(/at most 40/);
  });
});

describe('suggestSlug', () => {
  it('turns a company name into a organization ID', () => {
    expect(suggestSlug('Abebe & Sons PLC')).toBe('abebe-sons-plc');
    expect(suggestSlug('  Café Ñoño  ')).toBe('cafe-nono');
  });
});

describe('SlidingWindowLimiter', () => {
  it('allows up to the limit per window, per key', () => {
    const l = new SlidingWindowLimiter(2, 1000);
    expect(l.hit('a', 0)).toBe(true);
    expect(l.hit('a', 10)).toBe(true);
    expect(l.hit('a', 20)).toBe(false);
    expect(l.hit('b', 20)).toBe(true);
    expect(l.hit('a', 1015)).toBe(true);
  });
});

describe('clientIp', () => {
  it('prefers the first forwarded address', () => {
    expect(clientIp({ ip: '10.0.0.1', headers: { 'x-forwarded-for': '196.188.1.2, 10.0.0.1' } })).toBe('196.188.1.2');
    expect(clientIp({ ip: '10.0.0.1', headers: {} })).toBe('10.0.0.1');
  });
});
