import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export const INTERNAL_SERVICE_KEY_HEADER = 'x-internal-service-key';

/**
 * Service-to-service authentication for internal endpoints (e.g. calculation service → tenant-backend).
 *
 * The caller must send the shared INTERNAL_SERVICE_SECRET in the `x-internal-service-key`
 * header. The comparison is constant-time, and the guard fails closed: if the secret is
 * not configured (or is shorter than 32 characters), every request is rejected.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('INTERNAL_SERVICE_SECRET') || '';
    if (expected.length < 32) {
      this.logger.error(
        'INTERNAL_SERVICE_SECRET is missing or shorter than 32 characters — internal endpoints are disabled.',
      );
      throw new ForbiddenException('Internal service access is not configured');
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers?.[INTERNAL_SERVICE_KEY_HEADER];
    if (typeof provided !== 'string' || !InternalServiceGuard.safeEqual(provided, expected)) {
      throw new ForbiddenException('Internal service access only');
    }
    return true;
  }

  /** Constant-time string comparison (hashes first so lengths never leak). */
  static safeEqual(a: string, b: string): boolean {
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
  }
}
