import { AsyncLocalStorage } from 'async_hooks';
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../../common/types/authenticated-request';
import { RoleContextBuilderService } from './role-context-builder.service';

/**
 * Who an AI request is for, available anywhere during that request (chat, actions, documents)
 * without passing it through every call. Actions and document data run with these credentials,
 * so the AI can only see and do what this user can.
 */
export interface AiRequestContext {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string;
  /** The user's access_token cookie, forwarded on internal API calls made for them. */
  accessToken?: string;
  /** Headers forwarded on those calls (active company/branch, client platform, user agent). */
  headers: Record<string, string>;
  permissions: () => Promise<string[]>;
  /** Set by the chat once known; held changes belong to this conversation. */
  conversationId?: string;
}

export const aiRequestContext = new AsyncLocalStorage<AiRequestContext>();

const FORWARDED_HEADERS = ['x-company-id', 'x-branch-id', 'x-client-platform', 'x-client-device', 'x-app-version', 'user-agent', 'accept-language'];

export function forwardedHeaders(req: { headers?: Record<string, string | string[] | undefined> }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of FORWARDED_HEADERS) {
    const v = req.headers?.[h];
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === 'string' && s.trim()) out[h] = s.trim().slice(0, 500);
  }
  return out;
}

/** Puts the signed-in user's AI request context around the handler (AI chat and documents). */
@Injectable()
export class AiRequestContextInterceptor implements NestInterceptor {
  constructor(private readonly roles: RoleContextBuilderService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req?.user;
    if (!user?.sub) return next.handle();
    let cached: Promise<string[]> | undefined;
    const store: AiRequestContext = {
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      role: user.role,
      accessToken: (req as unknown as { cookies?: Record<string, string | undefined> }).cookies?.access_token,
      headers: forwardedHeaders(req),
      permissions: () => (cached ??= this.roles.getPermissions(user.tenantSlug, user.sub, user.role).catch(() => [])),
    };
    return new Observable((subscriber) =>
      aiRequestContext.run(store, () => {
        const sub = next.handle().subscribe(subscriber);
        return () => sub.unsubscribe();
      }),
    );
  }
}
