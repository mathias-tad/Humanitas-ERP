/**
 * Which client (browser, mobile app, integration…) made a request — recorded on every
 * timeline event so history shows "from the mobile app (Android 1.4.0)" vs "from Chrome on Windows".
 *
 * Mobile apps send `x-client-platform` (android | ios | windows | macos | linux | web) and
 * `x-app-version`. Browsers are recognised from the User-Agent; older app builds from Dio's
 * default `Dart/…` agent.
 */
export const CLIENT_PLATFORMS = ['web', 'mobile_app', 'desktop_app', 'api', 'mcp', 'system', 'unknown'] as const;
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];
export type ClientDevice = 'desktop' | 'phone' | 'tablet';

export interface ActivityClient {
  platform: ClientPlatform;
  device?: ClientDevice | null;
  info?: {
    os?: string;
    browser?: string;
    appVersion?: string;
    userAgent?: string;
    /** 'ai' when the AI assistant made the request for the user (AI actions). */
    via?: 'ai';
  };
}

/** Minimal request shape: anything with Node/Fastify-style headers. */
export interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

function header(req: RequestLike | undefined, name: string): string | undefined {
  const v = req?.headers?.[name];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && s.trim() ? s.trim().slice(0, 300) : undefined;
}

function osFromUserAgent(ua: string): string | undefined {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return undefined;
}

function browserFromUserAgent(ua: string): string | undefined {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return undefined;
}

function deviceFromUserAgent(ua: string): ClientDevice {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'phone';
  return 'desktop';
}

const APP_PLATFORM: Record<string, { platform: ClientPlatform; device: ClientDevice; os: string }> = {
  android: { platform: 'mobile_app', device: 'phone', os: 'Android' },
  ios: { platform: 'mobile_app', device: 'phone', os: 'iOS' },
  windows: { platform: 'desktop_app', device: 'desktop', os: 'Windows' },
  macos: { platform: 'desktop_app', device: 'desktop', os: 'macOS' },
  linux: { platform: 'desktop_app', device: 'desktop', os: 'Linux' },
};

export function clientFromRequest(req: RequestLike | undefined): ActivityClient {
  const client = clientFromHeaders(req);
  if (header(req, 'x-ai-action') === '1') client.info = { ...(client.info ?? {}), via: 'ai' };
  return client;
}

function clientFromHeaders(req: RequestLike | undefined): ActivityClient {
  const declared = header(req, 'x-client-platform')?.toLowerCase();
  const appVersion = header(req, 'x-app-version');
  const declaredDevice = header(req, 'x-client-device')?.toLowerCase();
  const ua = header(req, 'user-agent');

  if (declared && APP_PLATFORM[declared]) {
    const p = APP_PLATFORM[declared];
    const device = declaredDevice === 'tablet' ? 'tablet' : p.device;
    return { platform: p.platform, device, info: clean({ os: p.os, appVersion, userAgent: ua }) };
  }
  if (declared === 'mcp') return { platform: 'mcp', device: null, info: clean({ appVersion, userAgent: ua }) };
  if (declared === 'api') return { platform: 'api', device: null, info: clean({ appVersion, userAgent: ua }) };

  if (ua && /^Dart\//.test(ua)) {
    // Mobile app build that predates the x-client-platform header.
    return { platform: 'mobile_app', device: 'phone', info: clean({ appVersion, userAgent: ua }) };
  }
  if (declared === 'web' || (ua && /Mozilla\//.test(ua))) {
    const agent = ua ?? '';
    return {
      platform: 'web',
      device: agent ? deviceFromUserAgent(agent) : null,
      info: clean({ os: osFromUserAgent(agent), browser: browserFromUserAgent(agent), appVersion, userAgent: ua }),
    };
  }
  if (ua) return { platform: 'api', device: null, info: clean({ userAgent: ua }) };
  return { platform: 'unknown', device: null, info: {} };
}

function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;
}

/** Human label for UI/AI: "Mobile app · Android 1.4.0", "Web · Chrome on Windows (desktop)". */
export function describeClient(c: { platform: string; device?: string | null; info?: ActivityClient['info'] }): string {
  const i = c.info ?? {};
  switch (c.platform) {
    case 'mobile_app':
      return ['Mobile app', [i.os, i.appVersion].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    case 'desktop_app':
      return ['Desktop app', [i.os, i.appVersion].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    case 'web': {
      const where = [i.browser, i.os && `on ${i.os}`].filter(Boolean).join(' ');
      return ['Web', where, c.device && `(${c.device})`].filter(Boolean).join(' · ').replace(' · (', ' (');
    }
    case 'api':
      return 'API / integration';
    case 'mcp':
      return 'External AI (MCP)';
    case 'system':
      return 'System';
    default:
      return 'Unknown client';
  }
}
