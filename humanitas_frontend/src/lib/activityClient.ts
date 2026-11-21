/** Human label for the client that produced a timeline event (mirrors the API's describeClient). */
export interface ClientLike {
  platform?: string | null;
  device?: string | null;
  info?: { os?: string; browser?: string; appVersion?: string } | null;
}

export function describeClient(c: ClientLike): string {
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
