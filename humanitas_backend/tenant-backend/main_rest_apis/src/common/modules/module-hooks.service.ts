import { Global, Injectable, Logger, Module } from '@nestjs/common';

/**
 * Extension points between modules (AGENTS.md rule 30). A base module announces what it is about
 * to do; the modules built on it answer, without the base module importing them:
 *
 *   products:  const refusal = await hooks.veto('product.archive', { tenantId, conn, productIds });
 *   inventory: hooks.onVeto('product.archive', 'inventory', async ({ conn, productIds }) => ...);
 *
 * A veto handler returns a message to refuse (shown to the person) or null to let it go ahead.
 * `notify` handlers react after the fact (and never break the action that triggered them).
 */
export interface HookEvents {
  /** Products about to be archived. */
  'product.archive': { tenantId: string; conn: { query(sql: string, params?: unknown[]): Promise<any> }; productIds: string[] };
}

type VetoHandler<E extends keyof HookEvents> = (payload: HookEvents[E]) => Promise<string | null>;
type NotifyHandler<E extends keyof HookEvents> = (payload: HookEvents[E]) => Promise<void>;

@Injectable()
export class ModuleHooksService {
  private readonly logger = new Logger(ModuleHooksService.name);
  private readonly vetoes = new Map<string, { module: string; fn: VetoHandler<any> }[]>();
  private readonly listeners = new Map<string, { module: string; fn: NotifyHandler<any> }[]>();

  onVeto<E extends keyof HookEvents>(event: E, module: string, fn: VetoHandler<E>): void {
    const list = this.vetoes.get(event) ?? [];
    if (!list.some((h) => h.module === module)) list.push({ module, fn });
    this.vetoes.set(event, list);
  }

  on<E extends keyof HookEvents>(event: E, module: string, fn: NotifyHandler<E>): void {
    const list = this.listeners.get(event) ?? [];
    if (!list.some((h) => h.module === module)) list.push({ module, fn });
    this.listeners.set(event, list);
  }

  /** The first refusal any module gives, or null when every module agrees. */
  async veto<E extends keyof HookEvents>(event: E, payload: HookEvents[E]): Promise<string | null> {
    for (const h of this.vetoes.get(event) ?? []) {
      const refusal = await h.fn(payload);
      if (refusal) return refusal;
    }
    return null;
  }

  async notify<E extends keyof HookEvents>(event: E, payload: HookEvents[E]): Promise<void> {
    for (const h of this.listeners.get(event) ?? []) {
      try {
        await h.fn(payload);
      } catch (e) {
        this.logger.warn(`${h.module} failed on ${event}: ${(e as Error).message}`);
      }
    }
  }

  /** Which modules plug into an event (for tests and the module map). */
  handlers(event: keyof HookEvents): string[] {
    return [...(this.vetoes.get(event) ?? []), ...(this.listeners.get(event) ?? [])].map((h) => h.module);
  }
}

@Global()
@Module({ providers: [ModuleHooksService], exports: [ModuleHooksService] })
export class ModuleHooksModule {}
