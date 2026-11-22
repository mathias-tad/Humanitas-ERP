import { describe, expect, it } from 'vitest';
import { isStale, lastContactText } from './FollowUps';

describe('last contact', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  it('says how and when, or Never', () => {
    expect(lastContactText(null, null, now)).toBe('Never');
    expect(lastContactText('2026-11-22T08:00:00Z', 'telegram', now)).toBe('Telegram · today');
    expect(lastContactText('2026-11-21T08:00:00Z', 'call', now)).toBe('Call · yesterday');
    expect(lastContactText('2026-11-17T08:00:00Z', 'whatsapp', now)).toBe('WhatsApp · 5 days ago');
  });
  it('flags records nobody contacted for two weeks', () => {
    expect(isStale(null, now)).toBe(true);
    expect(isStale('2026-11-01T00:00:00Z', now)).toBe(true);
    expect(isStale('2026-11-20T00:00:00Z', now)).toBe(false);
  });
});
