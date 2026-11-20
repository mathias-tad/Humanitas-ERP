import { clientFromRequest, describeClient } from './activity-client';

const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  chromeAndroidPhone:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  dio: 'Dart/3.5 (dart:io)',
};

describe('clientFromRequest', () => {
  it.each([
    ['desktop Chrome on Windows', UA.chromeWindows, 'web', 'desktop', 'Windows', 'Chrome'],
    ['desktop Edge on Windows', UA.edgeWindows, 'web', 'desktop', 'Windows', 'Edge'],
    ['desktop Safari on macOS', UA.safariMac, 'web', 'desktop', 'macOS', 'Safari'],
    ['Firefox on Linux', UA.firefoxLinux, 'web', 'desktop', 'Linux', 'Firefox'],
    ['phone browser (Android Chrome)', UA.chromeAndroidPhone, 'web', 'phone', 'Android', 'Chrome'],
    ['phone browser (iPhone Safari)', UA.safariIphone, 'web', 'phone', 'iOS', 'Safari'],
    ['iPad browser', UA.ipad, 'web', 'tablet', 'iOS', 'Safari'],
    ['Android tablet browser', UA.androidTablet, 'web', 'tablet', 'Android', 'Chrome'],
  ])('%s', (_name, ua, platform, device, os, browser) => {
    const c = clientFromRequest({ headers: { 'user-agent': ua } });
    expect(c).toMatchObject({ platform, device, info: { os, browser } });
  });

  it('identifies the mobile app from its headers', () => {
    const c = clientFromRequest({
      headers: { 'x-client-platform': 'android', 'x-app-version': '1.4.0+12', 'user-agent': UA.dio },
    });
    expect(c).toEqual({
      platform: 'mobile_app',
      device: 'phone',
      info: { os: 'Android', appVersion: '1.4.0+12', userAgent: UA.dio },
    });
    expect(clientFromRequest({ headers: { 'x-client-platform': 'IOS', 'x-client-device': 'tablet' } })).toMatchObject({
      platform: 'mobile_app', device: 'tablet', info: { os: 'iOS' },
    });
  });

  it('recognises older mobile app builds by the Dart user agent', () => {
    expect(clientFromRequest({ headers: { 'user-agent': UA.dio } })).toMatchObject({ platform: 'mobile_app', device: 'phone' });
  });

  it('identifies native desktop apps, MCP and API clients', () => {
    expect(clientFromRequest({ headers: { 'x-client-platform': 'windows' } })).toMatchObject({ platform: 'desktop_app', device: 'desktop' });
    expect(clientFromRequest({ headers: { 'x-client-platform': 'mcp' } }).platform).toBe('mcp');
    expect(clientFromRequest({ headers: { 'user-agent': 'curl/8.5.0' } }).platform).toBe('api');
  });

  it('falls back to unknown and handles array headers and missing requests', () => {
    expect(clientFromRequest(undefined)).toEqual({ platform: 'unknown', device: null, info: {} });
    expect(clientFromRequest({ headers: {} }).platform).toBe('unknown');
    expect(clientFromRequest({ headers: { 'user-agent': [UA.chromeWindows, 'x'] } }).platform).toBe('web');
  });

  it('truncates long header values', () => {
    const c = clientFromRequest({ headers: { 'user-agent': 'Mozilla/5.0 ' + 'x'.repeat(1000) } });
    expect(c.info?.userAgent?.length).toBe(300);
  });
});

describe('describeClient', () => {
  it('renders readable labels', () => {
    expect(describeClient({ platform: 'mobile_app', info: { os: 'Android', appVersion: '1.4.0' } })).toBe('Mobile app · Android 1.4.0');
    expect(describeClient({ platform: 'web', device: 'desktop', info: { browser: 'Chrome', os: 'Windows' } })).toBe(
      'Web · Chrome on Windows (desktop)',
    );
    expect(describeClient({ platform: 'web', device: 'phone', info: { browser: 'Safari', os: 'iOS' } })).toBe(
      'Web · Safari on iOS (phone)',
    );
    expect(describeClient({ platform: 'mcp' })).toBe('External AI (MCP)');
    expect(describeClient({ platform: 'unknown' })).toBe('Unknown client');
  });
});
