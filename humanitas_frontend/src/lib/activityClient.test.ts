import { describe, expect, it } from 'vitest';
import { describeClient } from './activityClient';

describe('describeClient', () => {
  it('labels mobile app, browser, integrations and unknown clients', () => {
    expect(describeClient({ platform: 'mobile_app', info: { os: 'Android', appVersion: '1.4.0' } })).toBe('Mobile app · Android 1.4.0');
    expect(describeClient({ platform: 'web', device: 'desktop', info: { browser: 'Chrome', os: 'Windows' } })).toBe('Web · Chrome on Windows (desktop)');
    expect(describeClient({ platform: 'web', device: 'phone', info: { browser: 'Safari', os: 'iOS' } })).toBe('Web · Safari on iOS (phone)');
    expect(describeClient({ platform: 'mcp' })).toBe('External AI (MCP)');
    expect(describeClient({ platform: null })).toBe('Unknown client');
  });
});
