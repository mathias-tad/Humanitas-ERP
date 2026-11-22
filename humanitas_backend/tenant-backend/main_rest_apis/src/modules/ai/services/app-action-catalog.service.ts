import { Injectable, Logger, OnApplicationBootstrap, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { getMetadataStorage } from 'class-validator';
import { PERMISSIONS_KEY } from '../../auth/guards/permissions.guard';
import { MODULE_KEY } from '../../auth/guards/module-subscription.guard';
import {
  humanize,
  isBlockedPath,
  joinPath,
  pathParamsOf,
  searchActions,
  type ActionField,
  type AppAction,
  type HttpMethod,
} from './app-action-catalog';

type Ctor = abstract new (...args: never[]) => unknown;

const METHODS: Partial<Record<RequestMethod, HttpMethod>> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
};

/** class-validator decorators -> a short type the model understands. */
export function fieldsOf(dto: unknown): ActionField[] {
  if (typeof dto !== 'function' || [String, Number, Boolean, Object, Array].includes(dto as never)) return [];
  const metas = getMetadataStorage().getTargetValidationMetadatas(dto as Ctor as never, '', true, false);
  const byProp = new Map<string, { optional: boolean; types: string[] }>();
  for (const m of metas) {
    const entry = byProp.get(m.propertyName) ?? { optional: false, types: [] };
    if (m.type === 'conditionalValidation') entry.optional = true;
    else if (m.type === 'nestedValidation') entry.types.push(m.each ? 'array of objects' : 'object');
    else if (m.name) {
      const n = m.name;
      if (n === 'isIn' && Array.isArray(m.constraints?.[0])) entry.types.push(`one of: ${(m.constraints[0] as unknown[]).join(' | ')}`);
      else if (n === 'isUuid' || n === 'isUUID') entry.types.push(m.each ? 'uuid[]' : 'uuid');
      else if (n === 'isEmail') entry.types.push('email');
      else if (n === 'isDateString' || n === 'isISO8601' || n === 'isDate') entry.types.push('date (YYYY-MM-DD)');
      else if (n === 'isBoolean') entry.types.push('boolean');
      else if (['isNumber', 'isInt', 'isPositive', 'isNumberString'].includes(n)) entry.types.push('number');
      else if (n === 'isArray') entry.types.push('array');
      else if (n === 'isString' && !entry.types.length) entry.types.push('string');
      else if (n === 'isEnum' && m.constraints?.[0] && typeof m.constraints[0] === 'object') {
        entry.types.push(`one of: ${Object.values(m.constraints[0] as Record<string, unknown>).join(' | ')}`);
      }
    }
    byProp.set(m.propertyName, entry);
  }
  const rank = (t: string) => (t.startsWith('one of') ? 0 : t === 'string' ? 9 : 5);
  return [...byProp.entries()].map(([name, e]) => ({
    name,
    required: !e.optional,
    type: [...new Set(e.types)].sort((a, b) => rank(a) - rank(b))[0] ?? 'string',
  }));
}

/**
 * Builds the AI action catalog from the app's own controllers at start-up: every route behind
 * the sign-in guard, with its permission, module, path values and body/query fields. New
 * endpoints are picked up automatically, so the assistant can do whatever the app can.
 */
@Injectable()
export class AppActionCatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AppActionCatalogService.name);
  private catalog: AppAction[] = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap() {
    this.catalog = this.build();
    this.logger.log(`AI action catalog: ${this.catalog.length} actions`);
  }

  all(): AppAction[] {
    return this.catalog;
  }

  get(id: string): AppAction | undefined {
    const norm = id.trim().replace(/\s+/g, ' ');
    return this.catalog.find((a) => a.id === norm || a.id.toLowerCase() === norm.toLowerCase());
  }

  search(query: string, permissions: string[], limit?: number): AppAction[] {
    return searchActions(this.catalog, query, permissions, limit);
  }

  build(): AppAction[] {
    const out: AppAction[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const metatype = wrapper.metatype as Ctor | undefined;
      const instance = wrapper.instance as object | undefined;
      if (!metatype || !instance) continue;
      const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
      const basePaths = this.paths(Reflect.getMetadata(PATH_METADATA, metatype));
      const classGuards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, metatype) ?? [];
      for (const name of this.scanner.getAllMethodNames(proto)) {
        const handler = proto[name] as (...a: unknown[]) => unknown;
        const routePaths = Reflect.getMetadata(PATH_METADATA, handler);
        if (routePaths === undefined) continue;
        const method = METHODS[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod];
        if (!method) continue;
        const guards: unknown[] = [...classGuards, ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? [])];
        if (!guards.some((g) => typeof g === 'function' && (g as { name?: string }).name === 'JwtAuthGuard')) continue;
        const headers: { name: string; value: string }[] = Reflect.getMetadata(HEADERS_METADATA, handler) ?? [];
        if (headers.some((h) => /content-(type|disposition)/i.test(h.name) && !/json/i.test(h.value))) continue; // file downloads
        const args: Record<string, { index: number; data?: unknown }> = Reflect.getMetadata(ROUTE_ARGS_METADATA, metatype, name) ?? {};
        const kinds = Object.entries(args).map(([k, v]) => ({ type: Number(k.split(':')[0]), ...v }));
        if (kinds.some((k) => [RouteParamtypes.FILE, RouteParamtypes.FILES, RouteParamtypes.RESPONSE, RouteParamtypes.NEXT].includes(k.type))) continue;
        const paramTypes: unknown[] = Reflect.getMetadata('design:paramtypes', proto, name) ?? [];
        const bodyArg = kinds.find((k) => k.type === RouteParamtypes.BODY && k.data === undefined);
        const queryArg = kinds.find((k) => k.type === RouteParamtypes.QUERY && k.data === undefined);
        const namedQuery = kinds
          .filter((k) => k.type === RouteParamtypes.QUERY && typeof k.data === 'string')
          .map((k) => ({ name: String(k.data), required: false, type: 'string' }));
        const permissions: string[] = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [handler, metatype]) ?? [];
        const module: string | null = this.reflector.getAllAndOverride<string>(MODULE_KEY, [handler, metatype]) ?? null;
        const op = Reflect.getMetadata('swagger/apiOperation', handler) as { summary?: string } | undefined;
        for (const base of basePaths) {
          for (const route of this.paths(routePaths)) {
            const path = joinPath(base, route);
            if (isBlockedPath(path)) continue;
            out.push({
              id: `${method} ${path}`,
              method,
              path,
              module,
              permissions,
              summary: op?.summary?.trim() || `${humanize(metatype.name)}: ${humanize(name)}`,
              pathParams: pathParamsOf(path),
              body: bodyArg ? fieldsOf(paramTypes[bodyArg.index]) : [],
              query: [...(queryArg ? fieldsOf(paramTypes[queryArg.index]) : []), ...namedQuery],
            });
          }
        }
      }
    }
    // One entry per id (the first registered wins, as in the router).
    const seen = new Set<string>();
    return out.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
  }

  private paths(v: unknown): string[] {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') return [v];
    return ['/'];
  }
}
