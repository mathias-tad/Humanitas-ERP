import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { DatabaseService } from '../../database/database.service';
import { AppActionCatalogService } from './app-action-catalog.service';
import { buildUrl, describeAction, isCancellation, isConfirmation, WRITE_METHODS, type AppAction } from './app-action-catalog';
import type { AiRequestContext } from './ai-request-context';

/** Longest API response the model is shown. */
const MAX_RESULT_CHARS = 6000;
/** Most actions one chat message may run (guards against loops). */
const MAX_RUNS_PER_MESSAGE = 15;
/** How long a change waits for the user's yes. */
const PENDING_MINUTES = 15;

interface InjectResponse {
  statusCode: number;
  body: string;
}
type Injector = (opts: { method: string; url: string; headers: Record<string, string>; payload?: string }) => Promise<InjectResponse>;

export interface PendingRow {
  id: string;
  action: string;
  url: string;
  body: unknown;
  summary: string;
  status: string;
}

/**
 * Lets the AI assistant do what the user could do in the app (featureslist §13, AGENTS.md rule 29):
 * it finds the right API action in the catalog and runs it through the normal API with the
 * user's own sign-in, so permissions, module access, validation, approvals and history apply.
 * Reads run at once; every change is held until the user confirms it in their next message.
 */
@Injectable()
export class AiAppActionsService {
  private readonly logger = new Logger(AiAppActionsService.name);

  constructor(
    private readonly catalog: AppActionCatalogService,
    private readonly adapterHost: HttpAdapterHost,
    private readonly config: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  /** Injects a request into this API (no network hop). Overridable in tests. */
  protected injector(): Injector {
    const instance = this.adapterHost?.httpAdapter?.getInstance?.() as { inject?: (o: unknown) => Promise<{ statusCode: number; body: string }> } | undefined;
    if (!instance?.inject) throw new Error('The app API is not available for AI actions');
    return async (o) => {
      const r = await instance.inject!(o);
      return { statusCode: r.statusCode, body: r.body };
    };
  }

  private prefix(): string {
    return `/${(this.config?.get<string>('API_PREFIX') ?? 'api/v1').replace(/^\/+|\/+$/g, '')}`;
  }

  private async conn(ctx: AiRequestContext) {
    return this.databaseService.getTenantConnectionById(ctx.tenantId);
  }

  /**
   * Applies the user's yes/no in this message to the changes waiting from earlier messages, and
   * returns a note for the model naming what was confirmed (chat history keeps only text).
   */
  async resolvePending(ctx: AiRequestContext, conversationId: string, message: string): Promise<string | null> {
    const decision = isConfirmation(message) ? 'approved' : isCancellation(message) ? 'cancelled' : null;
    if (!decision) return null;
    try {
      const ds = await this.conn(ctx);
      const rows: { id: string; summary: string }[] = await ds.query(
        `UPDATE ai_pending_actions SET status = $4, decided_at = now()
          WHERE user_id = $1 AND conversation_id = $2 AND status = 'pending' AND expires_at > now() AND created_at < $3
          RETURNING id, summary`,
        [ctx.userId, conversationId, new Date(), decision],
      );
      if (!rows?.length) return null;
      const list = rows.map((r) => `- pending_id ${r.id}: ${r.summary}`).join('\n');
      return decision === 'approved'
        ? `[The user confirmed these changes. Carry out each one now with run_app_action using only its pending_id, then report the results.]\n${list}`
        : `[The user cancelled these changes; nothing was done. Acknowledge it briefly.]\n${list}`;
    } catch (err) {
      this.logger.warn(`[AI-ACTION] could not resolve pending actions: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * The two tools the agent uses. `readOnly` (documents) offers only reads.
   * `conversationId` ties held changes to the chat they were asked in.
   */
  tools(ctx: AiRequestContext, conversationId: string, opts: { readOnly?: boolean } = {}) {
    let runs = 0;
    const readOnly = !!opts.readOnly;

    const find = tool(
      async ({ request }) => {
        const permissions = await ctx.permissions();
        const found = this.catalog.search(request, permissions, 8).filter((a) => !readOnly || a.method === 'GET');
        if (!found.length) {
          return 'No app action matches that. Try other words (e.g. the page or record name), or tell the user it cannot be done here.';
        }
        return `Actions you may run for this user (id, then inputs; "?" = optional):\n${found.map(describeAction).join('\n')}`;
      },
      {
        name: 'find_app_actions',
        description:
          'Find the app actions (API endpoints) that do what the user asked, e.g. "create product", "list leave requests", "approve leave". Returns only actions this user has permission for, with their inputs. Call this before run_app_action.',
        schema: z.object({ request: z.string().describe('What the user wants to do or see, in a few words') }),
      },
    );

    const run = tool(
      async ({ action_id, path_values, query, body, pending_id }) => {
        if (++runs > MAX_RUNS_PER_MESSAGE) return 'Too many actions in one message. Summarise what was done and ask the user how to continue.';
        try {
          if (pending_id) {
            if (readOnly) return 'Changes are not allowed here.';
            return await this.runApproved(ctx, conversationId, pending_id);
          }
          const action = this.catalog.get(action_id ?? '');
          if (!action) return `Unknown action "${action_id}". Call find_app_actions first and use an id exactly as listed.`;
          const permissions = await ctx.permissions();
          if (!permissions.includes('*') && action.permissions.length && !action.permissions.some((p) => permissions.includes(p))) {
            return 'You do not have permission for this.';
          }
          if (readOnly && action.method !== 'GET') return 'Only reading data is allowed here.';
          const url = buildUrl(action, path_values ?? {}, query ?? {});
          if (action.method === 'GET') return await this.execute(ctx, action, url, undefined);
          return await this.hold(ctx, conversationId, action, url, body);
        } catch (err) {
          return `Could not run the action: ${(err as Error).message}`;
        }
      },
      {
        name: 'run_app_action',
        description: readOnly
          ? 'Run a read-only app action found with find_app_actions and return its data.'
          : 'Run an app action found with find_app_actions, as the user. Reads (GET) return data at once. Changes (create, update, delete…) are held: the result describes the change and you must ask the user to confirm it. When the user has confirmed in their next message, call this again with only pending_id.',
        schema: z.object({
          action_id: z.string().optional().describe('Action id exactly as listed, e.g. "POST /products"'),
          path_values: z.record(z.string(), z.any()).optional().describe('Values for the path, e.g. { "id": "<uuid>" }'),
          query: z.record(z.string(), z.any()).optional().describe('Query parameters, e.g. { "q": "teff", "status": "active" }'),
          body: z.record(z.string(), z.any()).optional().describe('Request body with the fields listed for the action'),
          pending_id: z.string().optional().describe('Id of a confirmed change to carry out'),
        }),
      },
    );

    return [find, run];
  }

  /** Records a change for confirmation instead of running it. */
  private async hold(ctx: AiRequestContext, conversationId: string, action: AppAction, url: string, body: unknown): Promise<string> {
    const summary = `${action.summary} (${action.method} ${url.split('?')[0]})`;
    const ds = await this.conn(ctx);
    const [row] = await ds.query(
      `INSERT INTO ai_pending_actions (user_id, conversation_id, action, url, body, summary, expires_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, now() + ($7 || ' minutes')::interval)
       RETURNING id`,
      [ctx.userId, conversationId, action.id, url, JSON.stringify(body ?? null), summary, String(PENDING_MINUTES)],
    );
    return [
      `CONFIRMATION NEEDED (pending_id ${row.id}). Nothing has changed yet.`,
      `Change: ${summary}`,
      body ? `Data: ${JSON.stringify(body).slice(0, 1500)}` : '',
      `Tell the user in plain words exactly what will be changed and ask them to reply "yes" to confirm or "no" to cancel (valid ${PENDING_MINUTES} minutes).`,
      'Do not say it is done. After the user replies yes, call run_app_action with only this pending_id.',
    ].filter(Boolean).join('\n');
  }

  /** Runs a change the user confirmed, exactly as it was shown to them. */
  private async runApproved(ctx: AiRequestContext, conversationId: string, pendingId: string): Promise<string> {
    const ds = await this.conn(ctx);
    const rows: PendingRow[] = await ds.query(
      `UPDATE ai_pending_actions SET status = 'running'
        WHERE id::text = $1 AND user_id = $2 AND conversation_id = $3 AND status = 'approved' AND expires_at > now()
        RETURNING id, action, url, body, summary, status`,
      [pendingId, ctx.userId, conversationId],
    );
    const p = rows?.[0];
    if (!p) {
      return 'This change has not been confirmed by the user (or it expired or was cancelled). Ask the user to confirm it by replying "yes", then try again.';
    }
    const action = this.catalog.get(p.action);
    if (!action) return 'This action no longer exists.';
    const result = await this.execute(ctx, action, p.url, p.body ?? undefined);
    await ds
      .query(`UPDATE ai_pending_actions SET status = $2, result = $3 WHERE id = $1`, [p.id, result.startsWith('OK') ? 'done' : 'failed', result.slice(0, 2000)])
      .catch(() => undefined);
    return result;
  }

  /** Calls the API as the user and returns what the model should read. */
  async execute(ctx: AiRequestContext, action: AppAction, url: string, body: unknown): Promise<string> {
    if (!ctx.accessToken) return 'Your sign-in could not be used for this action. Please sign in again.';
    const headers: Record<string, string> = {
      ...ctx.headers,
      cookie: `access_token=${ctx.accessToken}`,
      'x-ai-action': '1',
      accept: 'application/json',
    };
    let payload: string | undefined;
    if (WRITE_METHODS.includes(action.method) && body !== undefined && body !== null) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await this.injector()({ method: action.method, url: `${this.prefix()}${url}`, headers, payload });
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    let text = res.body ?? '';
    try {
      const parsed = JSON.parse(text);
      if (!ok) {
        const msg = Array.isArray(parsed?.message) ? parsed.message.join('; ') : parsed?.message;
        text = msg ? String(msg) : text;
      } else {
        text = JSON.stringify(parsed);
      }
    } catch {
      // not JSON: keep as text
    }
    if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}… (truncated: ask for fewer results, e.g. with limit or a search)`;
    if (WRITE_METHODS.includes(action.method)) await this.audit(ctx, action, url, res.statusCode);
    return ok ? `OK (${res.statusCode}) ${action.id}\n${text}` : `FAILED (${res.statusCode}) ${action.id}: ${text}`;
  }

  private async audit(ctx: AiRequestContext, action: AppAction, url: string, status: number) {
    try {
      const ds = await this.conn(ctx);
      await ds.query(
        `INSERT INTO system_audit_logs (action_type, performed_by, executed_by, entity_type, entity_id, details, created_at)
         VALUES ('ai_action', $1, 'ai_on_behalf', $2, $3, $4, NOW())`,
        [ctx.userId, action.module ?? action.path.split('/')[1] ?? 'app', null, JSON.stringify({ action: action.id, url, status })],
      );
    } catch (err) {
      this.logger.warn(`[AI-AUDIT] ${(err as Error).message}`);
    }
  }
}
