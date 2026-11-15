import { describe, expect, it, vi } from 'vitest';
import { cn, formatInTimeZone, localTimeToUtc, normalizeTimezone } from './utils';

describe('cn', () => {
  it('lets later Tailwind classes win', () => {
    expect(cn('p-2 text-sm', 'p-4')).toBe('text-sm p-4');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});

describe('normalizeTimezone', () => {
  it('keeps valid IANA zones', () => {
    expect(normalizeTimezone('Africa/Addis_Ababa')).toBe('Africa/Addis_Ababa');
  });

  it('maps GMT/UTC offsets to POSIX zones (sign inverted)', () => {
    expect(normalizeTimezone('GMT+3')).toBe('Etc/GMT-3');
    expect(normalizeTimezone('utc-5')).toBe('Etc/GMT+5');
    expect(normalizeTimezone('+3')).toBe('Etc/GMT-3');
  });

  it('falls back to UTC for empty or unknown values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(normalizeTimezone('')).toBe('UTC');
    expect(normalizeTimezone('Not/AZone')).toBe('UTC');
    expect(warn).toHaveBeenCalled();
  });
});

describe('localTimeToUtc', () => {
  it('converts a local time to UTC', () => {
    expect(localTimeToUtc('09:00', 'Etc/GMT-3')).toBe('06:00');
    expect(localTimeToUtc('09:30', 'UTC')).toBe('09:30');
  });

  it('wraps around midnight', () => {
    expect(localTimeToUtc('01:00', 'Etc/GMT-3')).toBe('22:00');
  });

  it('returns an empty string for empty input', () => {
    expect(localTimeToUtc('', 'UTC')).toBe('');
  });
});

describe('formatInTimeZone', () => {
  it('shows a dash for missing or unparseable values', () => {
    expect(formatInTimeZone(null, 'UTC')).toBe('-');
    expect(formatInTimeZone('not a date', 'UTC')).toBe('-');
  });

  it('formats bare time strings as HH:mm', () => {
    expect(formatInTimeZone('9:05:00', 'UTC')).toBe('09:05');
  });

  it('formats full timestamps as HH:mm', () => {
    expect(formatInTimeZone(new Date(2026, 10, 10, 14, 7), 'UTC')).toBe('14:07');
  });
});
