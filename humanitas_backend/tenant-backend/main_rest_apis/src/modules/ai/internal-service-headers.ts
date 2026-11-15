import { ConfigService } from '@nestjs/config';

/**
 * Headers for authenticated tenant-backend → admin-backend calls.
 * The admin backend's InternalServiceGuard compares `x-internal-service-key`
 * against INTERNAL_SERVICE_SECRET (must be identical on both services).
 */
export function internalServiceHeaders(configService: ConfigService): Record<string, string> {
  return {
    'x-internal-service': 'tenant-backend',
    'x-internal-service-key': configService.get<string>('INTERNAL_SERVICE_SECRET') || '',
  };
}
